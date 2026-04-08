<?php
require_once __DIR__ . '/_bootstrap.php';

auth_roles(['admin', 'reseller']);

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;
$q = trim($_GET['q'] ?? '');

$where = '';
$params = [];
if ($q !== '') {
    $where = ' WHERE name LIKE ? OR description LIKE ?';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
}

$countStmt = $db->prepare('SELECT COUNT(*) FROM products' . $where);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$sql = 'SELECT * FROM products' . $where . ' ORDER BY id DESC LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

json_response($rows, 200, [
    'page' => $page,
    'limit' => $limit,
    'total' => $total,
    'total_pages' => (int)ceil($total / $limit),
]);
