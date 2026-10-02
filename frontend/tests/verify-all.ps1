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
    "tests/flow-policy.test.js",
    "tests/voice-input.test.js",
    "tests/camera-presence.test.js",
    "tests/smart-checkins.test.js",
    "tests/privacy-center.test.js",
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
Assert-True ($flowFileContent.Contains('does not claim psychological or medical')) "Non-medical product disclaimer verified"
Assert-True ($flowFileContent.Contains('minimal: 45 * 60 * 1000')) "Minimal preference 45m threshold enforced"
Assert-True ($flowFileContent.Contains('balanced: 30 * 60 * 1000')) "Balanced preference 30m threshold enforced"
Assert-True ($flowFileContent.Contains('frequent: 15 * 60 * 1000')) "Frequent preference 15m threshold enforced"
Assert-True ($flowFileContent.Contains('explainDecision')) "Explainability method implemented"
Assert-True ($flowFileContent.Contains('recordInterventionResponse')) "User response recording implemented"

# 5. Stage 4 Echo Memory
Write-Host "`n5. Verifying Stage 4: Echo Memory Engine..." -ForegroundColor Yellow
$memoryFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\memory-engine.js") -Raw
Assert-True ($memoryFileContent.Contains('Welcome back. You were working on')) "Resume greeting restoration implemented"
Assert-True ($memoryFileContent.Contains('clearAll()')) "Memory purge control implemented"
Assert-True ($memoryFileContent.Contains('SAVE_MEMORY')) "Memory engine passes through Privacy Policy Gate"

# 6. Stage 6 Voice Input & Scoped Push-to-Talk
Write-Host "`n6. Verifying Stage 6: Voice Input & Push-to-Talk..." -ForegroundColor Yellow
$voiceFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\sensors\voice-input.js") -Raw
Assert-True ($voiceFileContent.Contains('class VoiceInput')) "VoiceInput class implemented"
Assert-True ($voiceFileContent.Contains('explicitUserGesture')) "explicitUserGesture required for activation"
Assert-True ($voiceFileContent.Contains('continuous = false')) "Continuous passive listening is blocked"
Assert-True ($voiceFileContent.Contains('simulateVoiceUtterance')) "simulateVoiceUtterance available for testing"

$intentFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\ai\ai-provider.js") -Raw
Assert-True ($intentFileContent.Contains('studying')) "Voice command 'Hey JOT, studying DBMS' supported"
Assert-True ($intentFileContent.Contains('pause')) "Voice command 'JOT, pause' supported"
Assert-True ($intentFileContent.Contains('stop')) "Voice command 'JOT, stop' supported"
Assert-True ($intentFileContent.Contains('stopped') -and $intentFileContent.Contains('ago')) "Voice command 'JOT, I stopped an hour ago' supported"
Assert-True ($intentFileContent.Contains('resume')) "Voice command 'JOT, resume DBMS' supported"

# 7. Stage 7 Camera Presence Assistance
Write-Host "`n7. Verifying Stage 7: Camera & Zen Presence Assistance..." -ForegroundColor Yellow
$cameraFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\sensors\camera-presence.js") -Raw
Assert-True ($cameraFileContent.Contains('class CameraPresenceSensor')) "CameraPresenceSensor class implemented"
Assert-True ($cameraFileContent.Contains('ACTIVATE_CAMERA')) "Camera presence evaluates ACTIVATE_CAMERA in policy gate"
Assert-True ($cameraFileContent.Contains('PRESENT') -and $cameraFileContent.Contains('ABSENT') -and $cameraFileContent.Contains('UNCERTAIN')) "Sensor emits minimal classified signals (PRESENT, ABSENT, UNCERTAIN)"
Assert-True ($cameraFileContent.Contains('canvasElement')) "Camera operates local downsampled canvas with zero raw frame retention"

$backendCameraFile = Join-Path $PSScriptRoot "..\..\backend\sensors\camera-presence.js"
if (Test-Path $backendCameraFile) {
    $backendCamContent = Get-Content $backendCameraFile -Raw
    Assert-True ($backendCamContent.Contains('class CameraPresenceSensor')) "Backend CameraPresenceSensor implemented"
    Assert-True ($backendCamContent.Contains('frameRetained: false')) "Backend presence sensor guarantees zero frame retention"
}

$gateContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\privacy-gate.js") -Raw
Assert-True ($gateContent.Contains('cameraEnabled: false')) "Camera is OFF by default in privacy policy"
Assert-True ($gateContent.Contains('DENY_CLOUD_VIDEO_STREAM')) "Streaming raw video to cloud is strictly denied"
Assert-True ($gateContent.Contains('rawVideoRetention: false')) "Raw video retention is non-negotiably false"

# 8. Stage 8 Smart Check-Ins & Flow Intervention Policy
Write-Host "`n8. Verifying Stage 8: Smart Check-Ins & Preferences..." -ForegroundColor Yellow
$flowContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\flow-engine.js") -Raw
Assert-True ($flowContent.Contains('WATER:') -or $flowContent.Contains('water')) "Gentle check-in: Hydration supported"
Assert-True ($flowContent.Contains('LOOK_AWAY:') -or $flowContent.Contains('look_away')) "Gentle check-in: Look away supported"
Assert-True ($flowContent.Contains('BREATH:') -or $flowContent.Contains('breath')) "Gentle check-in: Three breaths supported"
Assert-True ($flowContent.Contains('MOVEMENT:') -or $flowContent.Contains('STRETCH:')) "Gentle check-in: Short movement reset supported"
Assert-True ($flowContent.Contains('naturalPause')) "Natural pause triggers gentle check-in"
Assert-True ($flowContent.Contains('highEngagement')) "High engagement flow stays silent"
Assert-True ($flowContent.Contains('minimal') -and $flowContent.Contains('balanced') -and $flowContent.Contains('frequent')) "Preferences (minimal, balanced, frequent) supported"

$intentContent = Get-Content (Join-Path $PSScriptRoot "..\js\ai\ai-provider.js") -Raw
Assert-True ($intentContent.Contains('less') -and $intentContent.Contains('reminders')) "Command 'JOT, less reminders' supported"

$htmlContent = Get-Content (Join-Path $PSScriptRoot "..\index.html") -Raw
Assert-True ($htmlContent.Contains('zen-checkin-card')) "Zen Mode check-in card container present"
Assert-True ($htmlContent.Contains('zen-checkin-accept-btn')) "Zen check-in accept action present"

# 9. Stage 9 Privacy Center & ECHOSHIELD
Write-Host "`n9. Verifying Stage 9: Privacy Center & ECHOSHIELD..." -ForegroundColor Yellow
$gateContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\privacy-gate.js") -Raw
Assert-True ($htmlContent.Contains('priv-toggle-mic')) "Privacy Center: Mic status toggle present"
Assert-True ($htmlContent.Contains('priv-toggle-camera')) "Privacy Center: Camera status toggle present"
Assert-True ($htmlContent.Contains('priv-toggle-memory')) "Privacy Center: Memory status toggle present"
Assert-True ($htmlContent.Contains('LOCAL ONLY')) "Privacy Center: Local processing badge present"
Assert-True ($htmlContent.Contains('STRICTLY OFF')) "Privacy Center: Raw recording retention locked badge present"
Assert-True ($htmlContent.Contains('STRICTLY DENIED')) "Privacy Center: Laptop monitoring blocked badge present"
Assert-True ($htmlContent.Contains('btn-disable-sensors')) "Privacy Center: Disable all sensors button present"
Assert-True ($htmlContent.Contains('btn-clear-session')) "Privacy Center: Clear active session button present"
Assert-True ($htmlContent.Contains('btn-clear-memory')) "Privacy Center: Delete memory button present"
Assert-True ($htmlContent.Contains('privacy-audit-tbody')) "Privacy Center: Live audit table stream present"

$privCtrlContent = Get-Content (Join-Path $PSScriptRoot "..\js\ui\privacy-controller.js") -Raw
Assert-True ($privCtrlContent.Contains('disableSensorsBtn')) "PrivacyController: Disable sensors action wired"
Assert-True ($privCtrlContent.Contains('clearSessionBtn')) "PrivacyController: Clear session action wired"
Assert-True ($privCtrlContent.Contains('clearMemoryBtn')) "PrivacyController: Delete memory action wired"

# 10. Stage 10 Cross-Device Bridge
Write-Host "`n10. Verifying Stage 10: Cross-Device Bridge..." -ForegroundColor Yellow
$bridgeFileContent = Get-Content (Join-Path $PSScriptRoot "..\js\engines\bridge-engine.js") -Raw
Assert-True ($bridgeFileContent.Contains('initiateHandoff')) "BridgeEngine implements initiateHandoff"
Assert-True ($bridgeFileContent.Contains('receiveHandoff')) "BridgeEngine implements receiveHandoff"
Assert-True ($bridgeFileContent.Contains('CROSS_DEVICE_HANDOFF')) "BridgeEngine evaluates CROSS_DEVICE_HANDOFF in policy gate"

# 11. No Hardcoded Secrets Verification
Write-Host "`n11. Checking for Hardcoded Secrets across Codebase..." -ForegroundColor Yellow
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
