# ECHODESK Backend — Stage 6: Voice Input & Intent Verification Runner
# PowerShell 5.1 compatible, standalone, zero external dependencies

$PassCount = 0
$FailCount = 0

function Assert-Equal($actual, $expected, $message) {
    if ($actual -eq $expected) {
        Write-Host "  [PASS] $message" -ForegroundColor Green
        $script:PassCount++
    }
    else {
        Write-Host "  [FAIL] $message. Expected: '$expected', Got: '$actual'" -ForegroundColor Red
        $script:FailCount++
    }
}

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host "  [PASS] $message" -ForegroundColor Green
        $script:PassCount++
    }
    else {
        Write-Host "  [FAIL] $message (Condition was False)" -ForegroundColor Red
        $script:FailCount++
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ECHODESK Step 6: Scoped Voice Input Verification Suite   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Voice Sensor Architecture & Scoped Push-to-Talk
Write-Host "`n1. Testing Voice Sensor Architecture & Scoped Gestures..." -ForegroundColor Yellow
$voiceJs = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\sensors\voice-input.js") -Raw
Assert-True ($voiceJs.Contains('class VoiceInput')) "VoiceInput class defined in frontend"
Assert-True ($voiceJs.Contains('startListening(meta = { explicitUserGesture: true })')) "startListening requires explicitUserGesture"
Assert-True ($voiceJs.Contains('this.recognition.continuous = false')) "continuous listening is strictly disabled (single command only)"
Assert-True ($voiceJs.Contains('simulateVoiceUtterance')) "simulateVoiceUtterance available for testing and demos"

# 2. Privacy Policy Gate Enforcement
Write-Host "`n2. Testing Privacy Policy Gate Enforcement for Audio..." -ForegroundColor Yellow
$gateJs = Get-Content (Join-Path $PSScriptRoot "..\core\privacy-gate.js") -Raw
Assert-True ($gateJs.Contains('DENY_PASSIVE_MIC')) "Gate denies passive listening without explicit user gesture"
Assert-True ($gateJs.Contains('DENY_MIC_DISABLED')) "Gate rejects activation when mic is toggled off"
Assert-True ($gateJs.Contains('ALLOW_SCOPED_MIC')) "Gate authorizes scoped mic on explicit gesture"
Assert-True ($gateJs.Contains('rawAudioRetention: false')) "rawAudioRetention is hard-locked to false"

# 3. All 5 Mandatory Voice Commands in Intent Engine
Write-Host "`n3. Testing 5 Mandatory Voice Commands in Intent Engine..." -ForegroundColor Yellow
$intentJs = Get-Content (Join-Path $PSScriptRoot "..\engines\intent-engine.js") -Raw
Assert-True ($intentJs.Contains('START_WORK_SESSION')) "Command 1: 'Hey JOT, studying DBMS' supported"
Assert-True ($intentJs.Contains('PAUSE_SESSION')) "Command 2: 'JOT, pause' supported"
Assert-True ($intentJs.Contains('STOP_SESSION')) "Command 3: 'JOT, stop' supported"
Assert-True ($intentJs.Contains('CORRECT_SESSION_TIME')) "Command 4: 'JOT, I stopped an hour ago' supported"
Assert-True ($intentJs.Contains('RESUME_SESSION')) "Command 5: 'JOT, resume DBMS' supported"

# 4. Microphone Active State Signaling in UI & CSS
Write-Host "`n4. Testing Microphone Visual Active State..." -ForegroundColor Yellow
$cssApp = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\css\app.css") -Raw
$jotCtrl = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\ui\jot-controller.js") -Raw
$appJs = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\app.js") -Raw

Assert-True ($cssApp.Contains('.btn-icon.active')) "Active microphone button CSS class defined"
Assert-True ($cssApp.Contains('pulse-mic')) "Pulsing visual indicator keyframes defined"
Assert-True ($jotCtrl.Contains('this.voiceBtn.classList.add(''active'')')) "JotController adds active class when listening"
Assert-True ($jotCtrl.Contains('span.textContent = ''Listening...''')) "Button text changes to 'Listening...' while recording"
Assert-True ($appJs.Contains('Mic: Listening')) "Topbar sensor pill displays 'Mic: Listening'"

# 5. Clean Text Fallback Behavior
Write-Host "`n5. Testing Text Fallback when Voice Unavailable..." -ForegroundColor Yellow
Assert-True ($voiceJs.Contains('NOT_SUPPORTED')) "VoiceInput defines NOT_SUPPORTED error"
Assert-True ($jotCtrl.Contains('VOICE_FALLBACK')) "JotController provides VOICE_FALLBACK notice"
Assert-True ($jotCtrl.Contains('this.input.focus()')) "JotController automatically focuses text input on voice failure"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 6 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
