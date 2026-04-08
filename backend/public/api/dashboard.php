<?php
require_once __DIR__ . '/_bootstrap.php';

$actor = auth_roles(['admin', 'reseller']);

if ($actor['role'] === 'admin') {
    $products = (int)$db->query('SELECT COUNT(*) FROM products')->fetchColumn();
    $resellers = (int)$db->query('SELECT COUNT(*) FROM resellers')->fetchColumn();
    $orders = (int)$db->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    $revenue = (float)$db->query('SELECT COALESCE(SUM(total_amount),0) FROM orders')->fetchColumn();

    json_response([
        'role' => 'admin',
        'products' => $products,
        'resellers' => $resellers,
        'orders' => $orders,
        'revenue' => $revenue,
    ]);
}

$rid = (int)$actor['id'];
$ordersStmt = $db->prepare('SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM orders WHERE reseller_id = ?');
$ordersStmt->execute([$rid]);
$row = $ordersStmt->fetch(PDO::FETCH_NUM);

json_response([
    'role' => 'reseller',
    'reseller_id' => $rid,
    'orders' => (int)$row[0],
    'revenue' => (float)$row[1],
]);
