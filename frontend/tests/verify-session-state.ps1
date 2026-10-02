# ECHODESK — Work Session State Machine Verification Harness (CLI)
# Validates Stage 1 state machine rules, duration math, transitions, and guards

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

function Assert-Throws($scriptBlock, $message) {
    $threw = $false
    try {
        & $scriptBlock
    } catch {
        $threw = $true
    }
    if ($threw) {
        Write-Host "  [PASS] $message (Error thrown as expected)" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  [FAIL] $message (Expected exception but none was thrown)" -ForegroundColor Red
        $script:FailCount++
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ECHODESK Stage 1: Work Session State Machine Verification " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. State Definition Validation
Write-Host "`n1. Verifying Session States..." -ForegroundColor Yellow
$states = @("IDLE", "ACTIVE", "PAUSED", "ENDED", "UNCERTAIN")
Assert-Equal $states.Count 5 "All 5 core states defined"

# 2. State Machine Class in PowerShell (Mirrors session-state.js for CLI parity)
class CliWorkSession {
    [string]$Id
    [string]$ContextName = ""
    [string]$Topic = ""
    [string]$LastStep = ""
    [string]$NextAction = ""
    [string]$State = "IDLE"
    [long]$StartTime = 0
    [long]$EndTime = 0
    [long]$ActiveDurationMs = 0
    [long]$LastStartedAt = 0
    [string]$PauseReason = $null
    [double]$Confidence = 1.0
    [System.Collections.ArrayList]$History = [System.Collections.ArrayList]::new()
    [System.Collections.ArrayList]$Corrections = [System.Collections.ArrayList]::new()

    CliWorkSession() {
        $this.Id = "sess_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }

    [void]Start([string]$context, [hashtable]$meta) {
        if ($this.State -eq "ACTIVE") { throw "Cannot start session: already ACTIVE." }
        if ([string]::IsNullOrWhiteSpace($context)) { throw "Cannot start session: contextName is required." }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $prev = $this.State
        $this.ContextName = $context.Trim()
        if ($meta.ContainsKey("topic")) { $this.Topic = $meta["topic"] }
        if ($meta.ContainsKey("lastStep")) { $this.LastStep = $meta["lastStep"] }
        if ($meta.ContainsKey("nextAction")) { $this.NextAction = $meta["nextAction"] }
        $this.StartTime = $now
        $this.LastStartedAt = $now
        $this.ActiveDurationMs = 0
        $this.State = "ACTIVE"
        $this.History.Add(@{ From=$prev; To="ACTIVE"; Reason="Started" }) | Out-Null
    }

    [void]Pause([string]$reason) {
        if ($this.State -ne "ACTIVE") { throw "Cannot pause: expected ACTIVE." }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $this.ActiveDurationMs += [Math]::Max(0, ($now - $this.LastStartedAt))
        $this.LastStartedAt = 0
        $this.PauseReason = $reason
        $this.State = "PAUSED"
        $this.History.Add(@{ From="ACTIVE"; To="PAUSED"; Reason=$reason }) | Out-Null
    }

    [void]Resume([string]$reason) {
        if ($this.State -ne "PAUSED" -and $this.State -ne "UNCERTAIN") { throw "Cannot resume: expected PAUSED or UNCERTAIN." }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $this.LastStartedAt = $now
        $prev = $this.State
        $this.PauseReason = $null
        $this.State = "ACTIVE"
        $this.History.Add(@{ From=$prev; To="ACTIVE"; Reason=$reason }) | Out-Null
    }

    [void]Stop([string]$reason) {
        if ($this.State -eq "ENDED" -or $this.State -eq "IDLE") { throw "Cannot stop: already $this.State." }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if ($this.State -eq "ACTIVE" -and $this.LastStartedAt -gt 0) {
            $this.ActiveDurationMs += [Math]::Max(0, ($now - $this.LastStartedAt))
        }
        $prev = $this.State
        $this.LastStartedAt = 0
        $this.EndTime = $now
        $this.State = "ENDED"
        $this.History.Add(@{ From=$prev; To="ENDED"; Reason=$reason }) | Out-Null
    }

    [void]MarkUncertain([string]$reason, [double]$confidence) {
        if ($this.State -ne "ACTIVE") { return }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $this.ActiveDurationMs += [Math]::Max(0, ($now - $this.LastStartedAt))
        $this.LastStartedAt = $now
        $this.State = "UNCERTAIN"
        $this.Confidence = $confidence
        $this.History.Add(@{ From="ACTIVE"; To="UNCERTAIN"; Reason=$reason }) | Out-Null
    }

    [void]CorrectElapsedTime([long]$adjustedMs, [string]$reason) {
        if ($adjustedMs -lt 0) { throw "Invalid duration: must be positive." }
        $orig = $this.GetActiveDurationMs()
        $this.ActiveDurationMs = $adjustedMs
        if ($this.State -eq "ACTIVE") {
            $this.LastStartedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }
        $this.Corrections.Add(@{ Original=$orig; Adjusted=$adjustedMs; Reason=$reason }) | Out-Null
    }

    [long]GetActiveDurationMs() {
        if ($this.State -eq "ACTIVE" -and $this.LastStartedAt -gt 0) {
            $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            return $this.ActiveDurationMs + [Math]::Max(0, ($now - $this.LastStartedAt))
        }
        return $this.ActiveDurationMs
    }

    static [string]FormatDuration([long]$durationMs) {
        $totalSec = [long][Math]::Floor($durationMs / 1000)
        $h = [int][Math]::Floor($totalSec / 3600)
        $m = [int][Math]::Floor(($totalSec % 3600) / 60)
        $s = [int]($totalSec % 60)
        if ($h -gt 0) {
            return "{0}h {1}m {2:D2}s" -f $h, $m, $s
        }
        return "{0:D2}:{1:D2}" -f $m, $s
    }
}

# 3. Running State Transition Tests
Write-Host "`n2. Testing State Transitions..." -ForegroundColor Yellow
$sess = [CliWorkSession]::new()
Assert-Equal $sess.State "IDLE" "Initial state is IDLE"

# Start
$sess.Start("DBMS", @{ topic = "Normalization"; lastStep = "Q1" })
Assert-Equal $sess.State "ACTIVE" "Transitioned to ACTIVE"
Assert-Equal $sess.ContextName "DBMS" "Context stored as DBMS"
Assert-Equal $sess.Topic "Normalization" "Topic stored as Normalization"

# Guard against duplicate start
Assert-Throws { $sess.Start("CN", @{}) } "Starting while ACTIVE throws error"

# Pause
Start-Sleep -Milliseconds 40
$sess.Pause("User stepped away")
Assert-Equal $sess.State "PAUSED" "Transitioned to PAUSED"
Assert-True ($sess.ActiveDurationMs -ge 30) "Active duration accumulated in pause"

$dur1 = $sess.GetActiveDurationMs()
Start-Sleep -Milliseconds 30
Assert-Equal ($sess.GetActiveDurationMs()) $dur1 "Duration does not increase while PAUSED"

# Resume
$sess.Resume("User returned")
Assert-Equal $sess.State "ACTIVE" "Transitioned to ACTIVE on resume"
Start-Sleep -Milliseconds 30
Assert-True ($sess.GetActiveDurationMs() -gt $dur1) "Duration continues accumulating after resume"

# Uncertainty State
$sess.MarkUncertain("Possible absence", 0.4)
Assert-Equal $sess.State "UNCERTAIN" "Transitioned to UNCERTAIN"
Assert-Equal $sess.Confidence 0.4 "Confidence updated to 0.4"
$sess.Resume("User verified")
Assert-Equal $sess.State "ACTIVE" "Resumed from UNCERTAIN cleanly"

# Retroactive Correction ("I stopped an hour ago")
$correctedMs = 45 * 60 * 1000
$sess.CorrectElapsedTime($correctedMs, "User correction")
Assert-Equal $sess.ActiveDurationMs $correctedMs "Duration corrected to 45m"
Assert-Equal $sess.Corrections.Count 1 "Correction audit record saved"
Assert-Throws { $sess.CorrectElapsedTime(-100, "Bad") } "Negative time correction throws error"

# Stop
$sess.Stop("Session completed")
Assert-Equal $sess.State "ENDED" "Transitioned to ENDED"
Assert-True ($sess.EndTime -gt 0) "End time recorded"
Assert-Throws { $sess.Stop("Already done") } "Stopping already ENDED session throws error"

# Format Duration
Write-Host "`n3. Testing Duration Formatter..." -ForegroundColor Yellow
Assert-Equal ([CliWorkSession]::FormatDuration(0)) "00:00" "0ms formats as 00:00"
Assert-Equal ([CliWorkSession]::FormatDuration(65000)) "01:05" "65000ms formats as 01:05"
Assert-Equal ([CliWorkSession]::FormatDuration(3665000)) "1h 1m 05s" "3665000ms formats as 1h 1m 05s"

$summaryColor = if ($FailCount -eq 0) { "Green" } else { "Red" }
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Test Results: $PassCount PASSED, $FailCount FAILED " -ForegroundColor $summaryColor
Write-Host "==========================================================" -ForegroundColor Cyan

if ($FailCount -gt 0) { exit 1 } else { exit 0 }
