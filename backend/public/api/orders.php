<?php
require_once __DIR__ . '/_bootstrap.php';

$actor = auth_roles(['admin', 'reseller']);

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(10, max(1, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;
$customerName = trim($_GET['customer_name'] ?? '');
$q = trim($_GET['q'] ?? '');

if ($actor['role'] === 'reseller') {
    $resellerId = (int)$actor['id'];
} else {
    $resellerId = isset($_GET['reseller_id']) && $_GET['reseller_id'] !== '' ? (int)$_GET['reseller_id'] : null;
}

$parts = [];
$params = [];

if ($customerName !== '') {
    $parts[] = 'c.name LIKE ?';
    $params[] = '%' . $customerName . '%';
} elseif ($q !== '') {
    $parts[] = "(c.name LIKE ? OR c.phone LIKE ? OR r.name LIKE ? OR DATE_FORMAT(o.order_date, '%Y-%m-%d') LIKE ?)";
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

if ($resellerId) {
    $parts[] = 'o.reseller_id = ?';
    $params[] = $resellerId;
}

$where = $parts ? 'WHERE ' . implode(' AND ', $parts) : '';

$daysRemainingSql = "CASE WHEN o.payment_status = 'lunas' THEN 0
    ELSE GREATEST(COALESCE(o.payment_days_target, 0) - COALESCE(o.payment_days_total, 0), 0) END";

$countSql = "SELECT COUNT(*)
        FROM orders o
        JOIN customers c ON c.id=o.customer_id
        LEFT JOIN resellers r ON r.id=o.reseller_id" . ($where ? ' ' . $where : '');
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$sql = "SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, r.name AS reseller_name,
        GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
        {$daysRemainingSql} AS payment_days_remaining
        FROM orders o
        JOIN customers c ON c.id=o.customer_id
        LEFT JOIN resellers r ON r.id=o.reseller_id
        " . ($where ? $where . ' ' : ' ') . 'ORDER BY o.id DESC LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

json_response($rows, 200, [
    'page' => $page,
    'limit' => $limit,
    'total' => $total,
    'total_pages' => (int)ceil($total / $limit),
]);
