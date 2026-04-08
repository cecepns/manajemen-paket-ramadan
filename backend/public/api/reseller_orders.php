<?php
require_once __DIR__ . '/_bootstrap.php';

$actor = auth_roles(['admin', 'reseller']);

if ($actor['role'] === 'reseller') {
    $resellerId = (int)$actor['id'];
} else {
    $resellerId = (int)($_GET['reseller_id'] ?? 0);
}

if ($resellerId <= 0) {
    json_response(['message' => 'ID reseller tidak valid'], 422);
}

$resellerStmt = $db->prepare('SELECT id, name FROM resellers WHERE id = ? LIMIT 1');
$resellerStmt->execute([$resellerId]);
$reseller = $resellerStmt->fetch();
if (!$reseller) {
    json_response(['message' => 'Reseller tidak ditemukan'], 404);
}

$ordersStmt = $db->prepare(
    "SELECT o.id,
            o.order_date,
            o.total_amount,
            o.payment_status,
            o.payment_days_total,
            o.payment_days_target,
            o.amount_paid,
            GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
            CASE WHEN o.payment_status = 'lunas' THEN 0
                ELSE GREATEST(COALESCE(o.payment_days_target, 0) - COALESCE(o.payment_days_total, 0), 0) END AS payment_days_remaining,
            c.id AS customer_id,
            c.name AS customer_name,
            c.phone AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.reseller_id = ?
     ORDER BY o.order_date DESC, o.id DESC"
);
$ordersStmt->execute([$resellerId]);

json_response([
    'reseller' => $reseller,
    'orders' => $ordersStmt->fetchAll(),
]);
