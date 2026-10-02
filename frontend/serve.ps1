# ECHODESK — Lightweight Built-in PowerShell HTTP Server (Zero Dependencies)
# Serves frontend static files on http://localhost:8080/

param([int]$Port = 8080)

$Root = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")

try {
    $Listener.Start()
    Write-Host "[ECHODESK] HTTP Server active at http://localhost:$Port/" -ForegroundColor Green
    Write-Host "[ECHODESK] Serving files from: $Root" -ForegroundColor Cyan
} catch {
    Write-Host "[ECHODESK] Port $Port in use or listener restricted. You can open frontend/index.html directly." -ForegroundColor Yellow
    exit 0
}

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $UrlPath = $Request.Url.LocalPath
        if ($UrlPath -eq "/" -or [string]::IsNullOrWhiteSpace($UrlPath)) {
            $UrlPath = "/index.html"
        }

        $FilePath = [System.IO.Path]::Combine($Root, $UrlPath.TrimStart("/").Replace("/", "\"))

        if ([System.IO.File]::Exists($FilePath)) {
            $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
            $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }

            $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
            $Response.ContentType = $ContentType
            $Response.ContentLength64 = $Bytes.Length
            $Response.AddHeader("Access-Control-Allow-Origin", "*")
            $Response.AddHeader("Cache-Control", "no-cache")
            $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
            $Response.Close()
        } else {
            $Response.StatusCode = 404
            $ErrBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $Response.OutputStream.Write($ErrBytes, 0, $ErrBytes.Length)
            $Response.Close()
        }
    } catch {
        # Continue listening
    }
}
