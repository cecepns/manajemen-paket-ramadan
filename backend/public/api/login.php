<?php
require_once __DIR__ . '/_bootstrap.php';

try {
    $body = request_body();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_response(['message' => 'Username dan password wajib diisi'], 422);
    }

    $stmt = $db->prepare('SELECT id, username FROM users WHERE username = ? AND password = ? LIMIT 1');
    $stmt->execute([$username, md5($password)]);
    $user = $stmt->fetch();

    if (!$user) {
        json_response(['message' => 'Login gagal'], 401);
    }

    json_response([
        'token' => make_token((int)$user['id']),
        'role' => 'admin',
        'user' => $user,
    ]);
} catch (Throwable $e) {
    error_log('LOGIN ERROR: ' . $e->getMessage());
    json_response(['message' => 'Terjadi kesalahan pada server'], 500);
}
