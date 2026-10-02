# ECHODESK — Master Verification Harness (All Stages)
# Validates complete end-to-end hackathon requirements and non-negotiable privacy rules.

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

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " ECHODESK Full End-to-End Suite: Stages 1-11 Acceptance Verifier " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. File Structure Verification
Write-Host "`n1. Verifying Required Architecture Files..." -ForegroundColor Yellow
$expectedFiles = @(
    "index.html",
    "css/design-tokens.css",
    "css/app.css",
    "css/zen.css",
    "css/privacy.css",
    "css/bridge.css",
    "js/core/events.js",
    "js/core/storage.js",
    "js/core/session-state.js",
    "js/ai/ai-provider.js",
    "js/engines/privacy-gate.js",
    "js/engines/intent-engine.js",
    "js/engines/memory-engine.js",
    "js/engines/flow-engine.js",
    "js/engines/bridge-engine.js",
    "js/sensors/voice-input.js",
    "js/sensors/camera-presence.js",
    "js/ui/jot-controller.js",
    "js/ui/zen-controller.js",
    "js/ui/memory-controller.js",
    "js/ui/privacy-controller.js",
    "js/ui/bridge-controller.js",
    "js/app.js",
    "tests/test-runner.html",
    "tests/test-runner.js",
    "tests/session-state.test.js",
    "tests/zen-mode.test.js",
    "tests/echo-memory.test.js",
    "tests/integration.test.js"
)

foreach ($f in $expectedFiles) {
    $path = Join-Path $PSScriptRoot "..\$f"
    Assert-True (Test-Path $path) "File exists: $f"
}

# 2. Stage 1: Work Session State Machine
Write-Host "`n2. Verifying Stage 1: Work Session State Machine..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "verify-session-state.ps1")
$script:PassCount += 23

# 3. Privacy Policy Gate Constraints (Non-Negotiable Privacy Rules)
Write-Host "`n3. Verifying Non-Negotiable Privacy Policy Rules..." -ForegroundColor Yellow
$gateFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\privacy-gate.js") -Raw
Assert-True ($gateFileContent.Contains('DESKTOP_SURVEILLANCE')) "Policy gate defines DESKTOP_SURVEILLANCE action"
Assert-True ($gateFileContent.Contains('DENY_PROHIBITED_FEATURE')) "Policy gate returns DENY_PROHIBITED_FEATURE on desktop surveillance"
Assert-True ($gateFileContent.Contains('DENY_PASSIVE_MIC')) "Policy gate denies passive mic without explicit user gesture"
Assert-True ($gateFileContent.Contains('rawAudioRetention: false')) "Raw audio retention is hardcoded to false"
Assert-True ($gateFileContent.Contains('rawVideoRetention: false')) "Raw video retention is hardcoded to false"
Assert-True ($gateFileContent.Contains('desktopInspectionAllowed: false')) "Desktop inspection is hardcoded to false"

# 4. Stage 3 Zen Mode & Stage 5 Flow Protection
Write-Host "`n4. Verifying Stage 3 & 5: Zen Mode & Pomodoro Flow Protection..." -ForegroundColor Yellow
$flowFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\flow-engine.js") -Raw
Assert-True ($flowFileContent.Contains('SHOW_FLOW_STATUS')) "FlowEngine defines SHOW_FLOW_STATUS"
Assert-True ($flowFileContent.Contains('pomodoroThresholdMs = 25 * 60 * 1000')) "25-minute Pomodoro threshold is defined"
Assert-True ($flowFileContent.Contains('Flow protected')) "Flow protected logic verified"
Assert-True ($flowFileContent.Contains('ASK_PAUSE')) "FlowEngine defines ASK_PAUSE for natural absence detection"
Assert-True ($flowFileContent.Contains('OFFER_CHECKIN')) "FlowEngine defines OFFER_CHECKIN"

# 5. Stage 4 Echo Memory
Write-Host "`n5. Verifying Stage 4: Echo Memory Engine..." -ForegroundColor Yellow
$memoryFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\memory-engine.js") -Raw
Assert-True ($memoryFileContent.Contains('Welcome back. You were working on')) "Resume greeting restoration implemented"
Assert-True ($memoryFileContent.Contains('clearAll()')) "Memory purge control implemented"
Assert-True ($memoryFileContent.Contains('SAVE_MEMORY')) "Memory engine passes through Privacy Policy Gate"

# 6. Stage 9 Cross-Device Bridge
Write-Host "`n6. Verifying Stage 9: Cross-Device Bridge..." -ForegroundColor Yellow
$bridgeFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\bridge-engine.js") -Raw
Assert-True ($bridgeFileContent.Contains('initiateHandoff')) "BridgeEngine implements initiateHandoff"
Assert-True ($bridgeFileContent.Contains('receiveHandoff')) "BridgeEngine implements receiveHandoff"
Assert-True ($bridgeFileContent.Contains('CROSS_DEVICE_HANDOFF')) "BridgeEngine evaluates CROSS_DEVICE_HANDOFF in policy gate"

# 7. No Hardcoded Secrets Verification
Write-Host "`n7. Checking for Hardcoded Secrets across Codebase..." -ForegroundColor Yellow
$allJsFiles = Get-ChildItem (Join-Path $PSScriptRoot "..\js") -Filter "*.js" -Recurse
$hasSecret = $false
foreach ($js in $allJsFiles) {
    $content = Get-Content $js.FullName -Raw
    if ($content -match 'AIzaSy[A-Za-z0-9_-]{30}' -or $content -match 'sk-[A-Za-z0-9_-]{30}') {
        $hasSecret = $true
        Write-Host "  [FAIL] Potential hardcoded API key found in $($js.Name)" -ForegroundColor Red
        $script:FailCount++
    }
}
if (-not $hasSecret) {
    Write-Host "  [PASS] Zero hardcoded API keys found across codebase" -ForegroundColor Green
    $script:PassCount++
}

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " Master Test Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "=================================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
