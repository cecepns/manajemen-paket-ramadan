<?php

function json_response($data = null, int $status = 200, array $meta = []): void
{
    http_response_code($status);
    echo json_encode(['data' => $data, 'meta' => $meta]);
    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    return is_array($json) ? $json : $_POST;
}
