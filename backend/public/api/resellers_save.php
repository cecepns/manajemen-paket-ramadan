<?php
require_once __DIR__ . '/_bootstrap.php';
auth_user_id();

$body = request_body();
$id = (int)($body['id'] ?? 0);
$name = trim($body['name'] ?? '');
$phone = trim($body['phone'] ?? '');
$address = trim($body['address'] ?? '');
$loginUsername = trim($body['login_username'] ?? '');
$password = (string)($body['password'] ?? '');

if ($id > 0) {
    $curStmt = $db->prepare('SELECT login_username FROM resellers WHERE id = ?');
    $curStmt->execute([$id]);
    $currentLogin = $curStmt->fetchColumn();
    $currentLogin = $currentLogin ? (string)$currentLogin : '';

    $targetLogin = $loginUsername !== '' ? $loginUsername : $currentLogin;

    if ($targetLogin !== '') {
        $dup = $db->prepare('SELECT id FROM resellers WHERE login_username = ? AND id <> ? LIMIT 1');
        $dup->execute([$targetLogin, $id]);
        if ($dup->fetch()) {
            json_response(['message' => 'Username login sudah dipakai'], 422);
        }
    }

    if ($password !== '') {
        if ($targetLogin === '') {
            json_response(['message' => 'Isi username login sebelum mengatur password'], 422);
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE resellers SET name=?, phone=?, address=?, login_username=?, password_hash=?, updated_at=NOW() WHERE id=?');
        $stmt->execute([$name, $phone, $address, $targetLogin, $hash, $id]);
    } else {
        if ($loginUsername !== '' && $loginUsername !== $currentLogin) {
            $stmt = $db->prepare('UPDATE resellers SET name=?, phone=?, address=?, login_username=?, updated_at=NOW() WHERE id=?');
            $stmt->execute([$name, $phone, $address, $loginUsername, $id]);
        } else {
            $stmt = $db->prepare('UPDATE resellers SET name=?, phone=?, address=?, updated_at=NOW() WHERE id=?');
            $stmt->execute([$name, $phone, $address, $id]);
        }
    }
    json_response(['id' => $id]);
}

if ($loginUsername !== '') {
    $dup = $db->prepare('SELECT id FROM resellers WHERE login_username = ? LIMIT 1');
    $dup->execute([$loginUsername]);
    if ($dup->fetch()) {
        json_response(['message' => 'Username login sudah dipakai'], 422);
    }
}

if ($password !== '' && $loginUsername === '') {
    json_response(['message' => 'Username login wajib jika mengisi password'], 422);
}

$hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null;
$stmt = $db->prepare('INSERT INTO resellers(name, phone, address, login_username, password_hash, created_at, updated_at) VALUES(?,?,?,?,?,NOW(),NOW())');
$stmt->execute([$name, $phone, $address, $loginUsername !== '' ? $loginUsername : null, $hash]);
json_response(['id' => (int)$db->lastInsertId()]);
