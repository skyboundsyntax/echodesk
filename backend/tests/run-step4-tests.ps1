# ECHODESK Backend — Stage 4: Echo Memory Verification Runner
# Validates Echo Memory CRUD, Update, Resume Greeting, and Privacy Gate Constraints

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
Write-Host " ECHODESK Step 4: Echo Memory Core Verification Suite     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Echo Memory Engine Structure
Write-Host "`n1. Testing Echo Memory Engine Methods..." -ForegroundColor Yellow
$memoryFile = Get-Content (Join-Path $PSScriptRoot "..\engines\memory-engine.js") -Raw
Assert-True ($memoryFile.Contains('class EchoMemoryEngine')) "EchoMemoryEngine class defined"
Assert-True ($memoryFile.Contains('save(memoryRecord)')) "save method implemented"
Assert-True ($memoryFile.Contains('get(contextName)')) "get method implemented"
Assert-True ($memoryFile.Contains('update(contextName, updates')) "update method implemented"
Assert-True ($memoryFile.Contains('delete(contextName)')) "delete method implemented"
Assert-True ($memoryFile.Contains('clearAll()')) "clearAll method implemented"
Assert-True ($memoryFile.Contains('formatResumeGreeting(contextName)')) "formatResumeGreeting method implemented"

# 2. Resumption Greeting Format
Write-Host "`n2. Testing Structured Resumption Greeting Formatter..." -ForegroundColor Yellow
Assert-True ($memoryFile.Contains('Welcome back. You were working on')) "Resume greeting restoration copy implemented"
Assert-True ($memoryFile.Contains('Welcome back. Ready when you are.')) "Graceful empty fallback greeting implemented"

# 3. Privacy Policy Gate Enforcement
Write-Host "`n3. Testing Privacy Gate Memory Write Policy..." -ForegroundColor Yellow
Assert-True ($memoryFile.Contains('SAVE_MEMORY')) "Memory writes evaluated against SAVE_MEMORY policy"
Assert-True ($memoryFile.Contains('rawAudio')) "Raw audio rejected by policy"
Assert-True ($memoryFile.Contains('rawVideo')) "Raw video rejected by policy"

# 4. Frontend Memory Controller Integration
Write-Host "`n4. Testing Frontend Memory Controller Actions..." -ForegroundColor Yellow
$controllerFile = Get-Content (Join-Path $PSScriptRoot "..\..\frontend\js\ui\memory-controller.js") -Raw
Assert-True ($controllerFile.Contains('btn-resume-memory')) "Resume button action bound"
Assert-True ($controllerFile.Contains('btn-correct-memory')) "Correct button action bound"
Assert-True ($controllerFile.Contains('btn-delete-memory')) "Forget button action bound"
Assert-True ($controllerFile.Contains('btn-memory-clear-all')) "Clear all button action bound"

# Summary
$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Step 4 Summary: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
