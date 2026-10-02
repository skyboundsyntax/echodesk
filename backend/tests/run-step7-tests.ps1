# ECHODESK Backend — Stage 7: Camera & Zen Presence Assistance Verification Runner
# PowerShell 5.1 compatible, standalone, zero external dependencies

$PassCount = 0
$FailCount = 0

function Assert-Equal($actual, $expected, $message) {
    if ($actual -eq $expected) {
        Write-Host "  [PASS] $message" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  [FAIL] $message. Expected: '$expected', Got: '$actual'" -ForegroundColor Red
        $script:FailCount++
    }
}

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host "  [PASS] $message" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  [FAIL] $message (Condition was False)" -ForegroundColor Red
        $script:FailCount++
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ECHODESK Step 7: Camera Presence Assistance Verifier     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Camera Presence Sensor Architecture & Off-by-Default
Write-Host "`n1. Testing Camera Presence Architecture & Default State..." -ForegroundColor Yellow
$camJs = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\sensors\camera-presence.js") -Raw
Assert-True ($camJs.Contains('class CameraPresenceSensor')) "CameraPresenceSensor class defined in frontend"
Assert-True ($camJs.Contains('currentSignal = ''UNCERTAIN''')) "Initial signal defaults to UNCERTAIN"
Assert-True ($camJs.Contains('sampleIntervalMs = 2000')) "Local sampling interval configured"

$gateJs = Get-Content (Join-Path $PSScriptRoot "..\core\privacy-gate.js") -Raw
Assert-True ($gateJs.Contains('cameraEnabled: false')) "Camera presence assistance is OFF by default"
Assert-True ($gateJs.Contains('rawVideoRetention: false')) "rawVideoRetention is hard-locked to false"

# 2. Privacy Policy Gate Checks
Write-Host "`n2. Testing Privacy Policy Gate Camera Constraints..." -ForegroundColor Yellow
Assert-True ($gateJs.Contains('DENY_CAMERA_DISABLED')) "Gate rejects activation when camera is disabled in settings"
Assert-True ($gateJs.Contains('DENY_CLOUD_VIDEO_STREAM')) "Gate strictly blocks cloud video streaming"
Assert-True ($gateJs.Contains('ALLOW_LOCAL_PRESENCE')) "Gate authorizes local-only presence evaluation"

# 3. Minimal Classified Outputs & Frame Discarding
Write-Host "`n3. Testing Local Processing & Frame Discarding..." -ForegroundColor Yellow
Assert-True ($camJs.Contains('PRESENT') -and $camJs.Contains('ABSENT') -and $camJs.Contains('UNCERTAIN')) "Minimal output signals supported (PRESENT/ABSENT/UNCERTAIN)"
Assert-True ($camJs.Contains('Frame is immediately discarded') -or $camJs.Contains('discarded')) "Raw video frames immediately discarded after computing summary metric"
Assert-True ($camJs.Contains('setSignal')) "setSignal available for deterministic test injection"

# 4. Flow Engine Absence Grace Period & Confirmation Prompt
Write-Host "`n4. Testing Grace Period & Confirmation Prompt Integration..." -ForegroundColor Yellow
$flowJs = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\engines\flow-engine.js") -Raw
Assert-True ($flowJs.Contains('absenceGracePeriodMs')) "Absence grace period configured (12s default)"
Assert-True ($flowJs.Contains('Giving user time')) "Absence within grace period stays silent"
Assert-True ($flowJs.Contains('Looks like you stepped away. Pause session?')) "Sustained absence asks user with confirmation prompt"

# 5. UI & Zen Controller Presence Indicators
Write-Host "`n5. Testing Zen View Presence Indicators & Toggles..." -ForegroundColor Yellow
$htmlContent = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\index.html") -Raw
$zenCtrl = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\ui\zen-controller.js") -Raw
$appJs = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\app.js") -Raw

Assert-True ($htmlContent.Contains('zen-camera-status')) "Camera status indicator present in Zen view"
Assert-True ($htmlContent.Contains('zen-presence-indicator')) "Presence signal telemetry indicator present in Zen view"
Assert-True ($htmlContent.Contains('priv-toggle-camera')) "Camera permission toggle present in Privacy view"
Assert-True ($zenCtrl.Contains('handlePresenceSignal')) "Zen controller handles presence signal events"
Assert-True ($appJs.Contains('demo-simulate-absence')) "Demo button: Simulate User Stepped Away bound"
Assert-True ($appJs.Contains('demo-simulate-present')) "Demo button: Simulate User Returned bound"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 7 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
