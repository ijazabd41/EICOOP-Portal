<?php
// proxy.php — PHP production proxy, mirrors server.js logic
// Forwards requests to the Odoo ERP and bypasses CORS
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Session-Token');
header('Access-Control-Expose-Headers: Set-Cookie, Content-Type, Content-Disposition, X-Set-Session-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            } else if ($name == "CONTENT_TYPE") {
                $headers["Content-Type"] = $value;
            } else if ($name == "CONTENT_LENGTH") {
                $headers["Content-Length"] = $value;
            }
        }
        return $headers;
    }
}

// ── PATH PARSING ─────────────────────────────────────────────────
$uri = $_SERVER['REQUEST_URI'];
$parsedUrl = parse_url($uri);
$path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';
$prefix = '/proxy.php';
$pos = strpos($path, $prefix);
if ($pos !== false) {
    $pathInfo = substr($path, $pos + strlen($prefix));
} else {
    $pathInfo = $path;
}

if ($pathInfo === '/api/config') {
    header('Content-Type: application/json');
    echo json_encode([
        'db' => $ODOO_DB ?? 'production'
    ]);
    exit;
}

function isImage($p) {
    return strpos($p, '/web/image/') !== false || strpos($p, '/web/binary/') !== false;
}

// Fast 404 for non-Odoo static files to prevent proxy hanging
if (preg_match('/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|map)$/i', $pathInfo)) {
    if (strpos($pathInfo, '/web/') !== 0 && strpos($pathInfo, '/website/image/') !== 0) {
        http_response_code(404);
        die('Not Found');
    }
}

// ── QUERY STRING ─────────────────────────────────────────────────
$queryString = isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '';

// Fix: Odoo backend fails to decode %40 in email fields, pass @ unencoded
$queryString = str_replace('%40', '@', $queryString);
$queryString = str_replace(['%5B', '%5D'], ['[', ']'], $queryString);

// CRITICAL: Do NOT add by_AJR to shareholder endpoints — it causes 401 on Odoo
$isShareholderPath = strpos($pathInfo, '/api/shareholder/') === 0;

if (!isImage($pathInfo) && !$isShareholderPath) {
    if (strpos($queryString, 'by_AJR=') === false) {
        if (!empty($queryString)) {
            $queryString .= '&by_AJR=1';
        } else {
            $queryString = 'by_AJR=1';
        }
    }
}

$targetUrl = $ODOO_BASE_URL . $pathInfo;
if (!empty($queryString)) {
    $targetUrl .= '?' . $queryString;
}

$method = $_SERVER['REQUEST_METHOD'];

// ── SESSION PARSING ──────────────────────────────────────────────
$sessionToken = '';
foreach (getallheaders() as $name => $value) {
    if (strtolower($name) === 'x-session-token') {
        $sessionToken = $value;
    }
}

// ── SERVER-SIDE CACHING (Performance Optimization) ───────────────
$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}
$isCacheable = false;
$cacheFile = '';
$cacheTTL = 300; // 5 minutes cache

// Cache only specific GET endpoints for unauthenticated users
if ($method === 'GET' && !isImage($pathInfo) && !$sessionToken) {
    if (strpos($pathInfo, '/api/bcp-product-template') === 0 || 
        strpos($pathInfo, '/api/bcd-website-category') === 0 || 
        strpos($pathInfo, '/api/deal-day-slider') === 0 ||
        strpos($pathInfo, '/api/payment-provider') === 0) {
        
        $isCacheable = true;
        $cacheKey = md5($targetUrl);
        $cacheFile = $cacheDir . '/' . $cacheKey . '.json';
        
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTTL) {
            header('Content-Type: application/json');
            header('X-Proxy-Cache: HIT');
            echo file_get_contents($cacheFile);
            exit;
        }
    }
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

$isMultipart = false;
$contentTypeHeader = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
foreach (getallheaders() as $name => $value) {
    if (strtolower($name) === 'content-type') {
        $contentTypeHeader = $value;
        break;
    }
}
if (strpos(strtolower($contentTypeHeader), 'multipart/form-data') !== false) {
    $isMultipart = true;
}

if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    if ($isMultipart) {
        $postFields = [];
        foreach ($_POST as $k => $v) {
            $postFields[$k] = $v;
        }
        foreach ($_FILES as $k => $file) {
            $postFields[$k] = new CURLFile($file['tmp_name'], $file['type'], $file['name']);
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    } else {
        $input = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
    }
}

// ── HEADERS ──────────────────────────────────────────────────────
// Session token already parsed above

$headers = [];
foreach (getallheaders() as $name => $value) {
    $lowerName = strtolower($name);
    if ($lowerName !== 'host' && $lowerName !== 'content-length' && $lowerName !== 'connection' && $lowerName !== 'x-session-token' && $lowerName !== 'accept-encoding') {
        if ($isMultipart && $lowerName === 'content-type') {
            continue; // Let cURL generate Content-Type with correct boundary
        }
        if ($lowerName === 'cookie' && $sessionToken) {
            $value .= '; session_id=' . $sessionToken;
            $sessionToken = ''; // prevent adding it twice
        }
        $headers[] = "$name: $value";
    }
}
if ($sessionToken) {
    $headers[] = "Cookie: session_id=$sessionToken";
}

// Inject API key for shareholder endpoints (they require elevated privileges)
if ($isShareholderPath) {
    $headers[] = 'X-API-Key: ' . $ODOO_API_KEY;
}

$headers[] = "Connection: keep-alive";

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_ENCODING, ""); // Auto-handle gzip/deflate

// Timeouts and Keep-Alive settings to prevent hanging requests
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5); // 5 seconds connect timeout
curl_setopt($ch, CURLOPT_TIMEOUT, 30);       // 30 seconds total timeout
curl_setopt($ch, CURLOPT_TCP_KEEPALIVE, 1);
curl_setopt($ch, CURLOPT_TCP_KEEPIDLE, 120);
curl_setopt($ch, CURLOPT_TCP_KEEPINTVL, 60);

// ── RESPONSE ─────────────────────────────────────────────────────
$responseHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders) {
    $len = strlen($header);
    $parts = explode(':', $header, 2);
    if (count($parts) < 2) return $len;
    $name = strtolower(trim($parts[0]));
    $responseHeaders[$name][] = trim($parts[1]);
    return $len;
});

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $httpCode = 500;
    $response = json_encode(['error' => 'Proxy cURL Error: ' . curl_error($ch)]);
}
curl_close($ch);

// Forward Set-Cookie with SameSite fix (mirrors server.js)
if (isset($responseHeaders['set-cookie'])) {
    foreach ($responseHeaders['set-cookie'] as $cookie) {
        if (preg_match('/session_id=([^;]+)/', $cookie, $matches)) {
            header('X-Set-Session-Token: ' . $matches[1]);
        }
        $cookie = preg_replace('/;\s*Secure/i', '', $cookie);
        $cookie = preg_replace('/;\s*SameSite=[^;]*/i', '', $cookie);
        $cookie .= '; SameSite=Lax';
        header('Set-Cookie: ' . $cookie, false);
    }
}

if (isset($responseHeaders['content-type'])) {
    header('Content-Type: ' . $responseHeaders['content-type'][0]);
} else {
    header('Content-Type: application/json');
}

if (isset($responseHeaders['content-disposition'])) {
    header('Content-Disposition: ' . $responseHeaders['content-disposition'][0]);
}

if ($isCacheable && $httpCode === 200) {
    header('X-Proxy-Cache: MISS');
    file_put_contents($cacheFile, $response);
}

if ($httpCode >= 400) {
    $logMsg = date('Y-m-d H:i:s') . " - Error $httpCode on $targetUrl\nResponse: " . substr($response, 0, 2000) . "\n\n";
    file_put_contents(__DIR__ . '/proxy_error.log', $logMsg, FILE_APPEND);
}

http_response_code($httpCode);
echo $response;
?>
