<?php
require_once __DIR__ . '/_bootstrap.php';
auth_user_id();

$body = request_body();
$id = (int)($body['id'] ?? 0);
$stmt = $db->prepare('DELETE FROM resellers WHERE id = ?');
$stmt->execute([$id]);
json_response(['deleted' => true]);
