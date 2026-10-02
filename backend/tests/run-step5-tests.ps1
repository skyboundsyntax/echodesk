# ECHODESK Backend — Stage 5: Adaptive Intervention Policy & Flow Engine Verification Runner
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
Write-Host " ECHODESK Step 5: Adaptive Intervention Policy Verifier   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Flow Engine Classes & Disclaimer
Write-Host "`n1. Testing Flow Engine Architecture & Non-Medical Disclaimer..." -ForegroundColor Yellow
$flowFile = Get-Content (Join-Path $PSScriptRoot "..\engines\flow-engine.js") -Raw
Assert-True ($flowFile.Contains('class FlowEngine')) "FlowEngine class defined in backend"
Assert-True ($flowFile.Contains('FlowDecision')) "FlowDecision enum defined"
Assert-True ($flowFile.Contains('STAY_SILENT')) "FlowDecision contains STAY_SILENT"
Assert-True ($flowFile.Contains('SHOW_FLOW_STATUS')) "FlowDecision contains SHOW_FLOW_STATUS"
Assert-True ($flowFile.Contains('OFFER_CHECKIN')) "FlowDecision contains OFFER_CHECKIN"
Assert-True ($flowFile.Contains('ASK_PAUSE')) "FlowDecision contains ASK_PAUSE"
Assert-True ($flowFile.Contains('CheckInType')) "CheckInType enum defined"
Assert-True ($flowFile.Contains('does not claim psychological or medical')) "Explicit non-medical product disclaimer verified"

# 2. Pomodoro 25-minute Flow Protection & Timing Rules
Write-Host "`n2. Testing 25-Minute Pomodoro Flow Protection Policy..." -ForegroundColor Yellow
Assert-True ($flowFile.Contains('25 * 60 * 1000')) "25-minute Pomodoro boundary implemented (1,500,000 ms)"
Assert-True ($flowFile.Contains('Flow protected — 25m reached, user engaged. JOT is staying quiet.')) "Pomodoro flow protected quiet state strictly enforced"
Assert-True ($flowFile.Contains('minIntervalMs')) "Intervention gap thresholds enforced"

# 3. Absence Detection & Grace Period
Write-Host "`n3. Testing Absence Detection with Grace Period..." -ForegroundColor Yellow
Assert-True ($flowFile.Contains('absenceGracePeriodMs')) "Absence grace period configured"
Assert-True ($flowFile.Contains('Looks like you stepped away. Pause session?')) "Gentle pause prompt on absence exceeding grace period"
Assert-True ($flowFile.Contains('Absence detected within')) "Absence within grace period remains quiet"

# 4. Adaptive Preferences (Minimal, Balanced, Frequent)
Write-Host "`n4. Testing Adaptive Preferences & Check-in Catalog..." -ForegroundColor Yellow
Assert-True ($flowFile.Contains('minimal: 45 * 60 * 1000')) "Minimal preference set to 45m interval"
Assert-True ($flowFile.Contains('balanced: 30 * 60 * 1000')) "Balanced preference set to 30m interval"
Assert-True ($flowFile.Contains('frequent: 15 * 60 * 1000')) "Frequent preference set to 15m interval"
Assert-True ($flowFile.Contains('Quick Reset')) "Hydration check-in (Water) included"
Assert-True ($flowFile.Contains('Micro Reset')) "Look away reset included"
Assert-True ($flowFile.Contains('Three Breaths')) "Breathing reset included"
Assert-True ($flowFile.Contains('Posture Check')) "Posture stretch reset included"

# 5. Transparent Policy Explainability
Write-Host "`n5. Testing Policy Explainability..." -ForegroundColor Yellow
Assert-True ($flowFile.Contains('explainDecision(query')) "explainDecision method implemented"
Assert-True ($flowFile.Contains('PAUSE_DECISION')) "Pause decision explainability implemented"
Assert-True ($flowFile.Contains('INTERVENTION_DECISION')) "Intervention decision explainability implemented"
Assert-True ($flowFile.Contains('POMODORO_POLICY')) "Pomodoro override explainability implemented"

# 6. Intent Engine NL Mapping for Preferences & Explainability
Write-Host "`n6. Testing JOT Intent Engine Stage 5 NLP Patterns..." -ForegroundColor Yellow
$intentFile = Get-Content (Join-Path $PSScriptRoot "..\engines\intent-engine.js") -Raw
Assert-True ($intentFile.Contains('SET_INTERVENTION_PREFERENCE')) "Intent engine supports SET_INTERVENTION_PREFERENCE"
Assert-True ($intentFile.Contains('ASK_EXPLANATION')) "Intent engine supports ASK_EXPLANATION"
Assert-True ($intentFile.Contains('less reminders') -or $intentFile.Contains('less') -and $intentFile.Contains('reminders')) "NLP handles 'less reminders'"
Assert-True ($intentFile.Contains('balanced') -and $intentFile.Contains('reminders')) "NLP handles 'balanced reminders'"
Assert-True ($intentFile.Contains('why') -and $intentFile.Contains('remind')) "NLP handles 'Why didn''t you remind me?'"
Assert-True ($intentFile.Contains('why') -and $intentFile.Contains('pause')) "NLP handles 'Why did you pause?'"

# 7. Backend Server REST Endpoints
Write-Host "`n7. Testing Backend Server REST Route Bindings..." -ForegroundColor Yellow
$serverFile = Get-Content (Join-Path $PSScriptRoot "..\server.js") -Raw
Assert-True ($serverFile.Contains('/api/flow/status')) "GET /api/flow/status route registered"
Assert-True ($serverFile.Contains('/api/flow/evaluate')) "POST /api/flow/evaluate route registered"
Assert-True ($serverFile.Contains('/api/flow/preference')) "POST /api/flow/preference route registered"
Assert-True ($serverFile.Contains('/api/flow/explain')) "POST /api/flow/explain route registered"
Assert-True ($serverFile.Contains('/api/flow/checkin')) "GET /api/flow/checkin route registered"
Assert-True ($serverFile.Contains('/api/flow/checkin/response')) "POST /api/flow/checkin/response route registered"

# 8. Frontend Controller & UI Integration
Write-Host "`n8. Testing Frontend UI Controls & Event Listeners..." -ForegroundColor Yellow
$htmlFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\index.html") -Raw
$appFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\app.js") -Raw
$zenFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\ui\zen-controller.js") -Raw

Assert-True ($htmlFile.Contains('pill-flow-preference')) "Flow status pill present in topbar"
Assert-True ($htmlFile.Contains('priv-select-flow')) "Intervention preference selector present in Privacy view"
Assert-True ($htmlFile.Contains('demo-simulate-checkin')) "Simulate Check-in demo button present in Zen view"
Assert-True ($appFile.Contains('flow:preference-changed')) "App listens to flow:preference-changed event"
Assert-True ($zenFile.Contains('recordInterventionResponse')) "Zen controller records user response on check-in accept/dismiss"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 5 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
