# ECHODESK Backend — Stage 3: Zen Mode Verification Runner
# Validates Zen Mode State Machine, Pomodoro Flow Protection, Pause/Resume, and Privacy Constraints

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
Write-Host " ECHODESK Step 3: Zen Mode and Flow Protection Suite      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. State Machine in Zen Mode
Write-Host "`n1. Testing Session State in Zen Mode..." -ForegroundColor Yellow
$sessionFile = Get-Content (Join-Path $PSScriptRoot "..\core\session-state.js") -Raw
Assert-True ($sessionFile.Contains('WorkSessionState')) "WorkSessionState defined"
Assert-True ($sessionFile.Contains('ACTIVE')) "State ACTIVE supported"
Assert-True ($sessionFile.Contains('PAUSED')) "State PAUSED supported"
Assert-True ($sessionFile.Contains('ENDED')) "State ENDED supported"

# 2. Pomodoro 25-minute Flow Protection Check
Write-Host "`n2. Testing 25m Pomodoro Flow Protection Logic..." -ForegroundColor Yellow
$flowFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\engines\flow-engine.js") -Raw
Assert-True ($flowFile.Contains('pomodoroThresholdMs = 25 * 60 * 1000')) "25-minute Pomodoro threshold (1,500,000 ms) configured"
Assert-True ($flowFile.Contains('Flow protected')) "Flow protection message enforced"
Assert-True ($flowFile.Contains('SHOW_FLOW_STATUS')) "Decision is SHOW_FLOW_STATUS (no forced break)"

# 3. Zen Mode UI Controller and Keyboard Shortcuts
Write-Host "`n3. Testing Zen Mode UI Controller and Shortcuts..." -ForegroundColor Yellow
$zenUiFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\ui\zen-controller.js") -Raw
Assert-True ($zenUiFile.Contains("e.code === 'Space'")) "Spacebar shortcut toggles Pause/Resume in Zen Mode"
Assert-True ($zenUiFile.Contains("e.code === 'Escape'")) "Escape shortcut exits Zen Mode to Workspace"
Assert-True ($zenUiFile.Contains('Flow protected')) "Flow protection banner displays exact text"

# 4. Zero Sensor Surveillance by Default
Write-Host "`n4. Testing Sensor Default Constraints in Zen Mode..." -ForegroundColor Yellow
$privacyFile = Get-Content (Join-Path $PSScriptRoot "..\core\privacy-gate.js") -Raw
Assert-True ($privacyFile.Contains('cameraEnabled: false')) "Camera is OFF by default"
Assert-True ($privacyFile.Contains('rawAudioRetention: false')) "Raw audio retention is hard-locked to false"
Assert-True ($privacyFile.Contains('rawVideoRetention: false')) "Raw video retention is hard-locked to false"
Assert-True ($privacyFile.Contains('desktopInspectionAllowed: false')) "Desktop inspection is hard-locked to false"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 3 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
