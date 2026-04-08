<?php
require_once __DIR__ . '/_bootstrap.php';

$actor = auth_roles(['admin', 'reseller']);

$body = request_body();
$orderId = (int)($body['id'] ?? 0);
$isUpdate = $orderId > 0;

if ($actor['role'] === 'reseller') {
    $resellerId = (int)$actor['id'];
} else {
    $resellerId = isset($body['reseller_id']) && $body['reseller_id'] !== '' ? (int)$body['reseller_id'] : null;
}

$customerName = trim($body['customer_name'] ?? '');
$customerPhone = trim($body['customer_phone'] ?? '');
$paymentStatus = ($body['payment_status'] ?? 'belum_lunas') === 'lunas' ? 'lunas' : 'belum_lunas';
$paymentDaysTotal = max(0, (int)($body['payment_days_total'] ?? 0));
$amountPaidInput = (float)($body['amount_paid'] ?? 0);
$items = $body['items'] ?? [];

if (!$customerName || count($items) === 0) {
    json_response(['message' => 'Data tidak lengkap'], 422);
}

$db->beginTransaction();
try {
    $customerId = 0;
    if ($orderId > 0) {
        $orderStmt = $db->prepare('SELECT customer_id, reseller_id FROM orders WHERE id = ?');
        $orderStmt->execute([$orderId]);
        $existing = $orderStmt->fetch();
        if (!$existing) {
            throw new Exception('Order tidak ditemukan');
        }
        if ($actor['role'] === 'reseller' && (int)$existing['reseller_id'] !== (int)$actor['id']) {
            throw new Exception('Order tidak ditemukan');
        }
        $customerId = (int)$existing['customer_id'];
        if ($customerId <= 0) {
            throw new Exception('Order tidak ditemukan');
        }
        $c = $db->prepare('UPDATE customers SET reseller_id=?, name=?, phone=?, updated_at=? WHERE id=?');
        $c->execute([$resellerId, $customerName, $customerPhone, date('Y-m-d H:i:s'), $customerId]);
    } else {
        $c = $db->prepare('INSERT INTO customers(reseller_id, name, phone, created_at, updated_at) VALUES(?,?,?,?,?)');
        $c->execute([$resellerId, $customerName, $customerPhone, date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
        $customerId = (int)$db->lastInsertId();
    }

    $total = 0;
    $paymentDaysTarget = 0;
    $normalizedItems = [];
    foreach ($items as $item) {
        $pid = (int)($item['product_id'] ?? 0);
        $qty = max(1, (int)($item['qty'] ?? 1));
        $p = $db->prepare('SELECT price, payment_days_total FROM products WHERE id = ?');
        $p->execute([$pid]);
        $row = $p->fetch();
        if (!$row) {
            throw new Exception('Produk tidak ditemukan');
        }
        $price = (float)$row['price'];
        $prodDays = (int)($row['payment_days_total'] ?? 0);
        $subtotal = $price * $qty;
        $total += $subtotal;
        $paymentDaysTarget += $qty * $prodDays;
        $normalizedItems[] = [$pid, $qty, $price, $subtotal];
    }

    $amountPaid = $paymentStatus === 'lunas' ? $total : min(max($amountPaidInput, 0), $total);
    if ($paymentStatus === 'belum_lunas' && $amountPaid > $total) {
        throw new Exception('Total uang dibayar tidak boleh lebih dari total order');
    }

    if ($orderId > 0) {
        $o = $db->prepare('UPDATE orders SET reseller_id=?, total_amount=?, payment_status=?, payment_days_total=?, payment_days_target=?, amount_paid=?, updated_at=NOW() WHERE id=?');
        $o->execute([$resellerId, $total, $paymentStatus, $paymentDaysTotal, $paymentDaysTarget, $amountPaid, $orderId]);
        $db->prepare('DELETE FROM order_items WHERE order_id = ?')->execute([$orderId]);
    } else {
        $o = $db->prepare('INSERT INTO orders(customer_id, reseller_id, order_date, total_amount, payment_status, payment_days_total, payment_days_target, amount_paid, created_at, updated_at) VALUES(?,?,CURDATE(),?,?,?,?,?,NOW(),NOW())');
        $o->execute([$customerId, $resellerId, $total, $paymentStatus, $paymentDaysTotal, $paymentDaysTarget, $amountPaid]);
        $orderId = (int)$db->lastInsertId();
    }

    $oi = $db->prepare('INSERT INTO order_items(order_id, product_id, qty, price, subtotal, created_at, updated_at) VALUES(?,?,?,?,?,NOW(),NOW())');
    foreach ($normalizedItems as [$pid, $qty, $price, $subtotal]) {
        $oi->execute([$orderId, $pid, $qty, $price, $subtotal]);
    }

    $db->commit();
    json_response(['id' => $orderId, 'message' => $isUpdate ? 'Order diupdate' : 'Order ditambah']);
} catch (Throwable $e) {
    $db->rollBack();
    $status = str_contains(strtolower($e->getMessage()), 'tidak') ? 422 : 500;
    json_response(['message' => $status === 422 ? $e->getMessage() : 'Gagal menyimpan order'], $status);
}
