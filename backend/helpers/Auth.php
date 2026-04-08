<?php

function get_bearer_token(): string
{
    $auth = '';

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $auth = trim((string)$value);
                break;
            }
        }
    }

    if ($auth === '') {
        $auth = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    }

    if ($auth === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth = trim((string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $matches)) {
        return '';
    }

    return trim($matches[1]);
}

function make_token(int $userId): string
{
    $env = require __DIR__ . '/../config/env.php';
    return base64_encode($userId . '|' . hash('sha256', $userId . '|' . $env['app_key']));
}

function make_reseller_token(int $resellerId): string
{
    $env = require __DIR__ . '/../config/env.php';
    $payload = 'r:' . $resellerId;
    return base64_encode($payload . '|' . hash('sha256', $payload . '|' . $env['app_key']));
}

/**
 * @return array{role: string, id: int}
 */
function auth_actor(): array
{
    $token = get_bearer_token();
    if ($token === '') {
        json_response(['message' => 'Unauthorized'], 401);
    }

    $decoded = base64_decode($token);
    if ($decoded === false || $decoded === '') {
        json_response(['message' => 'Invalid token'], 401);
    }

    $env = require __DIR__ . '/../config/env.php';

    if (str_starts_with($decoded, 'r:')) {
        $pipePos = strpos($decoded, '|');
        if ($pipePos === false) {
            json_response(['message' => 'Invalid token'], 401);
        }
        $payload = substr($decoded, 0, $pipePos);
        $hash = substr($decoded, $pipePos + 1);
        $rid = (int)substr($payload, 2);
        if ($rid <= 0) {
            json_response(['message' => 'Invalid token'], 401);
        }
        $expected = hash('sha256', $payload . '|' . $env['app_key']);
        if (!hash_equals($expected, $hash)) {
            json_response(['message' => 'Invalid token'], 401);
        }
        return ['role' => 'reseller', 'id' => $rid];
    }

    $pipePos = strpos($decoded, '|');
    if ($pipePos === false) {
        json_response(['message' => 'Invalid token'], 401);
    }
    $uid = (int)substr($decoded, 0, $pipePos);
    $hash = substr($decoded, $pipePos + 1);
    if ($uid <= 0) {
        json_response(['message' => 'Invalid token'], 401);
    }
    $expected = hash('sha256', $uid . '|' . $env['app_key']);
    if (!hash_equals($expected, $hash)) {
        json_response(['message' => 'Invalid token'], 401);
    }
    return ['role' => 'admin', 'id' => $uid];
}

function auth_user_id(): int
{
    $actor = auth_actor();
    if ($actor['role'] !== 'admin') {
        json_response(['message' => 'Forbidden'], 403);
    }
    return $actor['id'];
}

/**
 * @param list<string> $roles
 * @return array{role: string, id: int}
 */
function auth_roles(array $roles): array
{
    $actor = auth_actor();
    if (!in_array($actor['role'], $roles, true)) {
        json_response(['message' => 'Forbidden'], 403);
    }
    return $actor;
}
