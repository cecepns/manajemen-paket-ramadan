<?php
require_once __DIR__ . '/_bootstrap.php';
auth_user_id();

$body = request_body();
$id = (int)($body['id'] ?? 0);

$stmt = $db->prepare('SELECT image_path FROM products WHERE id = ?');
$stmt->execute([$id]);
$image = $stmt->fetchColumn();

$del = $db->prepare('DELETE FROM products WHERE id = ?');
$del->execute([$id]);
unlink_product_image($image);

json_response(['deleted' => true]);
