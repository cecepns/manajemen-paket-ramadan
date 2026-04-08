<?php

function product_upload_dir(): string
{
    $root = dirname(__DIR__);
    // Paksa konsisten ke uploads root (tanpa folder public).
    return $root . '/uploads/products';
}

function product_upload_public_prefix(): string
{
    return '/uploads/products/';
}

function upload_product_image(array $file): ?string
{
    if (!isset($file['tmp_name']) || !$file['tmp_name']) {
        return null;
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $name = uniqid('product_', true) . '.' . ($ext ?: 'jpg');
    $dir = product_upload_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $target = $dir . '/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        return null;
    }
    return product_upload_public_prefix() . $name;
}

function unlink_product_image(?string $path): void
{
    if (!$path) {
        return;
    }

    $cleanPath = ltrim($path, '/');
    $root = dirname(__DIR__);
    $paths = [
        $root . '/public/' . $cleanPath,
        $root . '/' . $cleanPath,
    ];
    if (str_starts_with($cleanPath, 'api/')) {
        $paths[] = $root . '/' . substr($cleanPath, 4);
    } else {
        $paths[] = $root . '/api/' . $cleanPath;
    }

    foreach ($paths as $filePath) {
        if (is_file($filePath)) {
            unlink($filePath);
        }
    }
}
