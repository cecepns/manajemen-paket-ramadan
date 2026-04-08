<?php
require_once __DIR__ . '/_bootstrap.php';

try {
    $body = request_body();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_response(['message' => 'Username dan password wajib diisi'], 422);
    }

    $stmt = $db->prepare('SELECT id, name, password_hash FROM resellers WHERE login_username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if (!$row || empty($row['password_hash']) || !password_verify($password, $row['password_hash'])) {
        json_response(['message' => 'Login gagal'], 401);
    }

    json_response([
        'token' => make_reseller_token((int)$row['id']),
        'role' => 'reseller',
        'reseller' => ['id' => (int)$row['id'], 'name' => $row['name']],
    ]);
} catch (Throwable $e) {
    error_log('RESELLER_LOGIN ERROR: ' . $e->getMessage());
    json_response(['message' => 'Terjadi kesalahan pada server'], 500);
}
