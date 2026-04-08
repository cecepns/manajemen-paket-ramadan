<?php
require_once __DIR__ . '/_bootstrap.php';
auth_user_id();

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(10, max(1, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;
$q = trim($_GET['q'] ?? '');

$where = '';
$params = [];
if ($q !== '') {
    $where = ' WHERE r.name LIKE ? OR r.phone LIKE ? OR r.address LIKE ?';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$countStmt = $db->prepare('SELECT COUNT(*) FROM resellers r' . $where);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$stmt = $db->prepare(
    "SELECT r.*,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_order_amount,
            COALESCE(SUM(o.amount_paid), 0) AS total_uang_masuk,
            COALESCE(SUM(GREATEST(o.total_amount - o.amount_paid, 0)), 0) AS total_sisa_bayar
     FROM resellers r
     LEFT JOIN orders o ON o.reseller_id = r.id
     " . $where . "
     GROUP BY r.id
     ORDER BY r.id DESC
     LIMIT ? OFFSET ?"
);
foreach ($params as $index => $value) {
    $stmt->bindValue($index + 1, $value, PDO::PARAM_STR);
}
$stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
$stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
$stmt->execute();

json_response($stmt->fetchAll(), 200, [
    'page' => $page,
    'limit' => $limit,
    'total' => $total,
    'total_pages' => (int)ceil($total / $limit),
]);
