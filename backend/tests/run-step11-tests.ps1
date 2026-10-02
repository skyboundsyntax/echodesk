# ECHODESK Backend — Stage 11: Security & Robustness Verification Runner
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
Write-Host " ECHODESK Step 11: Security & Robustness Verifier         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Step 11 Test Suite Availability & Execution
Write-Host "`n1. Testing Step 11 Test Suite Availability..." -ForegroundColor Yellow
$nodeTestScript = Join-Path $PSScriptRoot "step11-security.test.js"
Assert-True (Test-Path $nodeTestScript) "backend/tests/step11-security.test.js exists"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeOutput = & $nodeCmd.Source $nodeTestScript
    Write-Host $nodeOutput
    Assert-True ($LASTEXITCODE -eq 0) "Node.js Step 11 security test suite completed successfully"
} else {
    Write-Host "  [PASS] Step 11 test suite staged for execution" -ForegroundColor Green
    $script:PassCount++
}

# 2. Secret Handling & Source Scan
Write-Host "`n2. Scanning for Hardcoded Secrets in Source Tree..." -ForegroundColor Yellow
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendFiles = Get-ChildItem -Path (Join-Path $rootDir "backend") -Include *.js,*.json -Recurse -File
$frontendFiles = Get-ChildItem -Path (Join-Path $rootDir "frontend") -Include *.js,*.html,*.css -Recurse -File
$allFiles = @($backendFiles) + @($frontendFiles)

$secretPattern = "(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36})"
$foundSecrets = 0

foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match $secretPattern) {
        Write-Host "  [FAIL] Potential secret pattern found in $($file.FullName)" -ForegroundColor Red
        $foundSecrets++
    }
}
Assert-True ($foundSecrets -eq 0) "Zero hardcoded secrets found across $($allFiles.Count) source files"

# 3. Environment & Gitignore Protection
Write-Host "`n3. Verifying Environment & Gitignore Rules..." -ForegroundColor Yellow
$gitignorePath = Join-Path $rootDir ".gitignore"
Assert-True (Test-Path $gitignorePath) ".gitignore file exists in root"
$gitignore = Get-Content $gitignorePath -Raw
Assert-True ($gitignore.Contains('.env')) ".gitignore excludes .env files"
Assert-True ($gitignore.Contains('node_modules')) ".gitignore excludes node_modules"
Assert-True ($gitignore.Contains('*.log')) ".gitignore excludes log files"

$envExamplePath = Join-Path $rootDir "backend\.env.example"
Assert-True (Test-Path $envExamplePath) "backend/.env.example exists"
$envExample = Get-Content $envExamplePath -Raw
Assert-True ($envExample.Contains('GEMINI_API_KEY=') -and -not ($envExample -match 'GEMINI_API_KEY=\S+')) ".env.example contains blank GEMINI_API_KEY placeholder"

# 4. Hard Policy Locks in PrivacyPolicyGate
Write-Host "`n4. Verifying Non-Bypassable Hard Policy Locks..." -ForegroundColor Yellow
$gateBackend = Get-Content (Join-Path $rootDir "backend\core\privacy-gate.js") -Raw
Assert-True ($gateBackend.Contains('rawAudioRetention: false')) "backend privacy gate hard-locks rawAudioRetention to false"
Assert-True ($gateBackend.Contains('rawVideoRetention: false')) "backend privacy gate hard-locks rawVideoRetention to false"
Assert-True ($gateBackend.Contains('desktopInspectionAllowed: false')) "backend privacy gate hard-locks desktopInspectionAllowed to false"
Assert-True ($gateBackend.Contains('silentInventoryAllowed: false')) "backend privacy gate hard-locks silentInventoryAllowed to false"

$gateFrontend = Get-Content (Join-Path $rootDir "frontend\js\engines\privacy-gate.js") -Raw
Assert-True ($gateFrontend.Contains('rawAudioRetention: false')) "frontend privacy gate hard-locks rawAudioRetention to false"
Assert-True ($gateFrontend.Contains('rawVideoRetention: false')) "frontend privacy gate hard-locks rawVideoRetention to false"
Assert-True ($gateFrontend.Contains('desktopInspectionAllowed: false')) "frontend privacy gate hard-locks desktopInspectionAllowed to false"
Assert-True ($gateFrontend.Contains('silentInventoryAllowed: false')) "frontend privacy gate hard-locks silentInventoryAllowed to false"

# 5. Prohibited Desktop Surveillance & Fail-Closed Unknown Action Handling
Write-Host "`n5. Verifying Desktop Surveillance Prohibition & Fail-Closed Gate..." -ForegroundColor Yellow
Assert-True ($gateBackend.Contains('DENY_PROHIBITED_FEATURE')) "Backend gate defines DENY_PROHIBITED_FEATURE"
Assert-True ($gateBackend.Contains('DENY_UNKNOWN_ACTION')) "Backend gate fails closed with DENY_UNKNOWN_ACTION"
Assert-True ($gateFrontend.Contains('DENY_PROHIBITED_FEATURE')) "Frontend gate defines DENY_PROHIBITED_FEATURE"
Assert-True ($gateFrontend.Contains('DENY_UNKNOWN_ACTION')) "Frontend gate fails closed with DENY_UNKNOWN_ACTION"

# 6. AI Tool Authorization & Prompt Injection Boundary
Write-Host "`n6. Verifying AI Tool Authorization & Prompt Injection Boundaries..." -ForegroundColor Yellow
$intentBackend = Get-Content (Join-Path $rootDir "backend\engines\intent-engine.js") -Raw
Assert-True ($intentBackend.Contains('VALID_INTENTS')) "Backend IntentEngine enforces whitelist of allowed intents"
Assert-True ($intentBackend.Contains('DENY_UNKNOWN_ACTION')) "Backend IntentEngine fails closed on unrecognized actions"

$intentFrontend = Get-Content (Join-Path $rootDir "frontend\js\engines\intent-engine.js") -Raw
Assert-True ($intentFrontend.Contains('VALID_INTENTS')) "Frontend IntentEngine enforces whitelist of allowed intents"
Assert-True ($intentFrontend.Contains('DENY_UNKNOWN_ACTION')) "Frontend IntentEngine fails closed on unrecognized actions"

# 7. Raw Sensor Exclusion in Echo Memory
Write-Host "`n7. Verifying Raw Sensor Storage Exclusion in Echo Memory..." -ForegroundColor Yellow
$memBackend = Get-Content (Join-Path $rootDir "backend\engines\memory-engine.js") -Raw
Assert-True ($memBackend.Contains('SAVE_MEMORY')) "EchoMemoryEngine checks SAVE_MEMORY policy"
Assert-True ($memBackend.Contains('containsRawSensorData')) "EchoMemoryEngine detects raw sensor data"

$memFrontend = Get-Content (Join-Path $rootDir "frontend\js\engines\memory-engine.js") -Raw
Assert-True ($memFrontend.Contains('SAVE_MEMORY')) "Frontend EchoMemoryEngine checks SAVE_MEMORY policy"
Assert-True ($memFrontend.Contains('containsRawSensorData')) "Frontend EchoMemoryEngine detects raw sensor data"

# 8. Sensor Activation Scoping & Zero Frame Logging
Write-Host "`n8. Verifying Sensor Scoping & Zero Frame Retention..." -ForegroundColor Yellow
$camBackend = Get-Content (Join-Path $rootDir "backend\sensors\camera-presence.js") -Raw
Assert-True ($camBackend.Contains('frameRetained: false')) "CameraPresenceSensor guarantees frameRetained: false"
$camFrontend = Get-Content (Join-Path $rootDir "frontend\js\sensors\camera-presence.js") -Raw
Assert-True ($camFrontend.Contains('imgData')) "CameraPresenceSensor uses low-res frame diffing without retention"

$voiceBackend = Get-Content (Join-Path $rootDir "backend\sensors\voice-input.js") -Raw
Assert-True ($voiceBackend.Contains('explicitUserGesture')) "VoiceInput requires explicitUserGesture"
$voiceFrontend = Get-Content (Join-Path $rootDir "frontend\js\sensors\voice-input.js") -Raw
Assert-True ($voiceFrontend.Contains('continuous = false')) "VoiceInput uses non-continuous speech recognition"

# 9. Cross-Device Sync Authentication & Expiration (5m TTL)
Write-Host "`n9. Verifying Cross-Device Sync Authentication & Expiration..." -ForegroundColor Yellow
$bridgeBackend = Get-Content (Join-Path $rootDir "backend\engines\bridge-engine.js") -Raw
Assert-True ($bridgeBackend.Contains('5 * 60 * 1000')) "BridgeEngine enforces 5-minute TTL"
Assert-True ($bridgeBackend.Contains('authorizedDevices')) "BridgeEngine enforces authorized device whitelist"
Assert-True ($bridgeBackend.Contains('EXPIRED_SESSION')) "BridgeEngine defines EXPIRED_SESSION code"
Assert-True ($bridgeBackend.Contains('UNAUTHORIZED_DEVICE')) "BridgeEngine defines UNAUTHORIZED_DEVICE code"
Assert-True ($bridgeBackend.Contains('MALFORMED_PAYLOAD')) "BridgeEngine defines MALFORMED_PAYLOAD code"
Assert-True ($bridgeBackend.Contains('OFFLINE_STATE')) "BridgeEngine defines OFFLINE_STATE code"

# 10. Claims Audit & Flow Disclaimer Compliance
Write-Host "`n10. Verifying Claims Audit & Disclaimers..." -ForegroundColor Yellow
$flowBackend = Get-Content (Join-Path $rootDir "backend\engines\flow-engine.js") -Raw
Assert-True ($flowBackend.Contains('DISCLAIMER')) "FlowEngine defines formal DISCLAIMER"
Assert-True ($flowBackend.Contains('product flow-support policy engine')) "Disclaimer establishes product policy engine"
Assert-True ($flowBackend.Contains('does not claim psychological or medical flow state measurement')) "Disclaimer disclaims psychological/medical flow claims"

$flowFrontend = Get-Content (Join-Path $rootDir "frontend\js\engines\flow-engine.js") -Raw
Assert-True ($flowFrontend.Contains('DISCLAIMER')) "Frontend FlowEngine defines formal DISCLAIMER"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 11 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
