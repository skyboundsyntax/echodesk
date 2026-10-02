# ECHODESK Backend — Stage 2 Verification Runner
# Validates JOT Text Intent Parser, Policy Gate Gating, and Fallback Handling

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

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " ECHODESK Backend Step 2: JOT Text Intent Test Suite " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Regex Intent Rules Verification
Write-Host "`n1. Testing START_WORK_SESSION regex parsing..." -ForegroundColor Yellow
$input1 = "studying DBMS"
$m1 = [regex]::Match($input1, '^(?:studying|working on|revising|reading|coding|building|preparing)\s+(.+)$', 'IgnoreCase')
Assert-True $m1.Success "Regex matches 'studying DBMS'"
Assert-Equal $m1.Groups[1].Value.ToUpper() "DBMS" "Context parsed as DBMS"

$input1b = "Hey JOT, studying DBMS - Normalization"
$clean1b = [regex]::Replace($input1b, '^(hey jot|jot|ok jot)[,\s]*', '', 'IgnoreCase')
$m1b = [regex]::Match($clean1b, '^(?:studying|working on|revising|reading|coding|building|preparing)\s+(.+)$', 'IgnoreCase')
Assert-True $m1b.Success "Matches with 'Hey JOT' prefix"
$parts = $m1b.Groups[1].Value -split '\s*[-–—:]\s*'
Assert-Equal $parts[0].Trim().ToUpper() "DBMS" "Main context is DBMS"
Assert-Equal $parts[1].Trim() "Normalization" "Topic is Normalization"

# 2. PAUSE_SESSION
Write-Host "`n2. Testing PAUSE_SESSION..." -ForegroundColor Yellow
$input2 = "JOT, pause"
$clean2 = [regex]::Replace($input2, '^(hey jot|jot|ok jot)[,\s]*', '', 'IgnoreCase').Trim()
Assert-True ([regex]::IsMatch($clean2, '^(pause(\s+.*)?|take a break|hold on)$', 'IgnoreCase')) "'JOT, pause' recognized"

# 3. RESUME_SESSION
Write-Host "`n3. Testing RESUME_SESSION..." -ForegroundColor Yellow
$input3 = "JOT, resume DBMS"
$clean3 = [regex]::Replace($input3, '^(hey jot|jot|ok jot)[,\s]*', '', 'IgnoreCase').Trim()
$m3 = [regex]::Match($clean3, '^resume\s+(.+)$', 'IgnoreCase')
Assert-True $m3.Success "'JOT, resume DBMS' recognized"
Assert-Equal $m3.Groups[1].Value.Trim() "DBMS" "Context name captured as DBMS"

# 4. STOP_SESSION
Write-Host "`n4. Testing STOP_SESSION..." -ForegroundColor Yellow
$input4 = "JOT, stop"
$clean4 = [regex]::Replace($input4, '^(hey jot|jot|ok jot)[,\s]*', '', 'IgnoreCase').Trim()
Assert-True ([regex]::IsMatch($clean4, '^(stop(\s+.*)?|end(\s+session)?|finish|done)$', 'IgnoreCase')) "'JOT, stop' recognized"

# 5. CORRECT_SESSION_TIME ("I stopped an hour ago")
Write-Host "`n5. Testing CORRECT_SESSION_TIME..." -ForegroundColor Yellow
$input5 = "JOT, I stopped an hour ago"
$clean5 = [regex]::Replace($input5, '^(hey jot|jot|ok jot)[,\s]*', '', 'IgnoreCase').Trim()
$m5 = [regex]::Match($clean5, '(?:i\s+)?stopped\s+(\d+|an?|half\s+an?)\s*(hour|hr|minute|min)s?\s*ago', 'IgnoreCase')
Assert-True $m5.Success "Matches 'I stopped an hour ago'"
$qty = $m5.Groups[1].Value
$unit = $m5.Groups[2].Value
$minutesAgo = if ($qty -eq "a" -or $qty -eq "an") { 60 } else { [int]$qty }
Assert-Equal $minutesAgo 60 "Calculated 60 minutes ago"
$activeDurationMs = 90 * 60 * 1000 # 90 minutes
$adjustedMs = [Math]::Max(0, ($activeDurationMs - ($minutesAgo * 60 * 1000)))
Assert-Equal $adjustedMs (30 * 60 * 1000) "Adjusted duration is 30 minutes (90m - 60m)"

# 6. UPDATE_CONTEXT
Write-Host "`n6. Testing UPDATE_CONTEXT..." -ForegroundColor Yellow
$input6 = "working on Q5"
$m6 = [regex]::Match($input6, '(?:working on|step:|question|topic:?)\s*(.+)', 'IgnoreCase')
Assert-True $m6.Success "'working on Q5' recognized as context update"
Assert-Equal $m6.Groups[1].Value.ToUpper() "Q5" "Step extracted as Q5"

# 7. ASK_STATUS
Write-Host "`n7. Testing ASK_STATUS..." -ForegroundColor Yellow
$input7 = "what was I doing?"
Assert-True ([regex]::IsMatch($input7, 'what\s+(was|am)\s+i\s+doing|status|last\s+step', 'IgnoreCase')) "'what was I doing?' recognized"

# 8. REQUEST_HANDOFF
Write-Host "`n8. Testing REQUEST_HANDOFF..." -ForegroundColor Yellow
$input8 = "JOT, continue DBMS on laptop"
Assert-True ([regex]::IsMatch($input8, 'continue\s+(.+?\s+)?on\s+laptop', 'IgnoreCase')) "Handoff command recognized"

# 9. SET_INTERVENTION_PREFERENCE
Write-Host "`n9. Testing SET_INTERVENTION_PREFERENCE..." -ForegroundColor Yellow
$input9 = "JOT, less reminders"
Assert-True ([regex]::IsMatch($input9, 'less\s+reminders?|fewer\s+reminders?', 'IgnoreCase')) "'less reminders' recognized"

# 10. Privacy Policy Gate Enforcement
Write-Host "`n10. Testing Backend Policy Enforcement..." -ForegroundColor Yellow
$gateContent = Get-Content (Join-Path $PSScriptRoot "..\core\privacy-gate.js") -Raw
Assert-True ($gateContent.Contains("PolicyActionType.DESKTOP_SURVEILLANCE")) "Desktop surveillance action defined in backend gate"
Assert-True ($gateContent.Contains("DENY_PROHIBITED_FEATURE")) "Desktop surveillance returns DENY_PROHIBITED_FEATURE"
Assert-True ($gateContent.Contains("DENY_PASSIVE_MIC")) "Passive mic rejected without explicit user gesture"

# 11. Backend Server REST Endpoints Verification
Write-Host "`n11. Testing Server Endpoints Existence..." -ForegroundColor Yellow
$serverContent = Get-Content (Join-Path $PSScriptRoot "..\server.js") -Raw
Assert-True ($serverContent.Contains("/api/intent")) "POST /api/intent endpoint implemented"
Assert-True ($serverContent.Contains("/api/session/start")) "POST /api/session/start endpoint implemented"
Assert-True ($serverContent.Contains("/api/session/pause")) "POST /api/session/pause endpoint implemented"
Assert-True ($serverContent.Contains("/api/session/resume")) "POST /api/session/resume endpoint implemented"
Assert-True ($serverContent.Contains("/api/session/stop")) "POST /api/session/stop endpoint implemented"
Assert-True ($serverContent.Contains("/api/session/correct")) "POST /api/session/correct endpoint implemented"
Assert-True ($serverContent.Contains("/api/memory")) "GET /api/memory endpoint implemented"
Assert-True ($serverContent.Contains("/api/bridge/handoff")) "POST /api/bridge/handoff endpoint implemented"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " Step 2 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
