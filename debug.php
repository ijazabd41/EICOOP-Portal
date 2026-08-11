<?php
// debug.php — Upload temporarily to check server capabilities
// DELETE after diagnosis! Access at https://eicoop.ae/debug.php

echo '<pre>';

echo "=== PHP Info ===\n";
echo 'PHP Version: ' . phpversion() . "\n\n";

echo "=== cURL Check ===\n";
$curlAvailable = function_exists('curl_version');
if ($curlAvailable) {
    $cv = curl_version();
    echo 'cURL: ENABLED (v' . $cv['version'] . ")\n";
} else {
    echo "cURL: DISABLED - proxy.php will not work!\n";
}

echo "\n=== allow_url_fopen ===\n";
echo 'allow_url_fopen: ' . (ini_get('allow_url_fopen') ? 'ON' : 'OFF') . "\n";

echo "\n=== open_basedir ===\n";
$basedir = ini_get('open_basedir');
echo 'open_basedir: ' . ($basedir ? $basedir : 'NOT SET (good)') . "\n";

echo "\n=== Outbound Connection Test ===\n";
if ($curlAvailable) {
    $target = 'http://cooperp.freeddns.org:8076/api/shareholder/lookup';
    $ch = curl_init($target);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_exec($ch);
    $curlErrno = curl_errno($ch);
    $curlError = curl_error($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curlErrno === 0) {
        echo 'Outbound cURL to Odoo: SUCCESS (HTTP ' . $httpCode . ")\n";
    } else {
        echo "Outbound cURL to Odoo: FAILED\n";
        echo '  Error #' . $curlErrno . ': ' . $curlError . "\n";
    }
} else {
    echo "Skipped (cURL not available)\n";
}

echo "\n=== REQUEST_URI ===\n";
echo (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : 'NOT SET') . "\n";

echo "\n=== PATH_INFO ===\n";
echo (isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : 'NOT SET') . "\n";

echo '</pre>';
echo '<b>DELETE THIS FILE after diagnosis!</b>';
?>
