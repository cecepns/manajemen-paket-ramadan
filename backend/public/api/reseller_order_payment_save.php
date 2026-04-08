<?php
require_once __DIR__ . '/_bootstrap.php';

$actor = auth_roles(['admin', 'reseller']);

$body = request_body();
$orderId = (int)($body['order_id'] ?? 0);
$amountPaidInput = (float)($body['amount_paid'] ?? 0);
$paymentDaysTotal = max(0, (int)($body['payment_days_total'] ?? 0));

if ($orderId <= 0) {
    json_response(['message' => 'ID order tidak valid'], 422);
}

$orderStmt = $db->prepare('SELECT id, total_amount, reseller_id FROM orders WHERE id = ? LIMIT 1');
$orderStmt->execute([$orderId]);
$order = $orderStmt->fetch();
if (!$order) {
    json_response(['message' => 'Order tidak ditemukan'], 404);
}
if ((int)$order['reseller_id'] <= 0) {
    json_response(['message' => 'Order ini bukan order reseller'], 422);
}

if ($actor['role'] === 'reseller' && (int)$order['reseller_id'] !== (int)$actor['id']) {
    json_response(['message' => 'Forbidden'], 403);
}

$totalAmount = (float)$order['total_amount'];
$amountPaid = min(max($amountPaidInput, 0), $totalAmount);
$paymentStatus = $amountPaid >= $totalAmount ? 'lunas' : 'belum_lunas';

$updateStmt = $db->prepare('UPDATE orders SET amount_paid = ?, payment_days_total = ?, payment_status = ?, updated_at = NOW() WHERE id = ?');
$updateStmt->execute([$amountPaid, $paymentDaysTotal, $paymentStatus, $orderId]);

json_response([
    'order_id' => $orderId,
    'amount_paid' => $amountPaid,
    'payment_days_total' => $paymentDaysTotal,
    'payment_status' => $paymentStatus,
]);
