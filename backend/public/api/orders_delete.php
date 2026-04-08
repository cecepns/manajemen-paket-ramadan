<?php
require_once __DIR__ . '/_bootstrap.php';
auth_user_id();

$body = request_body();
$id = (int)($body['id'] ?? 0);
if ($id <= 0) {
    json_response(['message' => 'ID tidak valid'], 422);
}

$stmt = $db->prepare('SELECT customer_id FROM orders WHERE id = ?');
$stmt->execute([$id]);
$customerId = (int)$stmt->fetchColumn();

$db->beginTransaction();
try {
    $db->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
    if ($customerId > 0) {
        $db->prepare('DELETE FROM customers WHERE id = ?')->execute([$customerId]);
    }
    $db->commit();
    json_response(['deleted' => true]);
} catch (Throwable $e) {
    $db->rollBack();
    json_response(['message' => 'Gagal menghapus order'], 500);
}
