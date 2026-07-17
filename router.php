<?php
// router.php - Used for PHP built-in web server local testing (php -S localhost:8001 router.php)

$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (preg_match('#^/proxy(/.*)$#', $path, $matches)) {
    $_SERVER['REQUEST_URI'] = '/proxy.php?_path=' . $matches[1];
    require __DIR__ . '/proxy.php';
    return true;
}

$file = __DIR__ . $path;
if (file_exists($file) && !is_dir($file)) {
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    if ($ext === 'php') {
        return false; // Let PHP built-in server execute it
    }
    // Manually serve static files to avoid Windows PHP built-in server bugs with 'return false'
    $mimes = [
        'html' => 'text/html', 'htm' => 'text/html', 'css' => 'text/css',
        'js' => 'application/javascript', 'json' => 'application/json',
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'webp' => 'image/webp',
        'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: " . $mimes[$ext]);
    }
    readfile($file);
    return true;
}

if ($path === '/' || $path === '') {
    header("Content-Type: text/html");
    readfile(__DIR__ . '/index.html');
    return true;
}

return false;
