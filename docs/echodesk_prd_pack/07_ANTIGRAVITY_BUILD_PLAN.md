# ECHODESK — Antigravity Staged Build Prompts

Use these prompts one at a time. Do not ask Antigravity to build the entire system in one shot.

---

# STAGE 0 — AUDIT THE REPOSITORY

```text
Before modifying anything, audit the existing ECHODESK repository.

Do not write new product code yet.

Inspect:
- directory structure
- package files
- lockfiles
- README
- environment files/examples
- entry points
- current UI
- current backend
- existing API routes
- existing database/schema
- existing AI integrations
- existing camera/mic integrations
- existing desktop bridge

Identify:
1. what is genuinely useful
2. what is incomplete
3. what is broken
4. what appears generated or hallucinated
5. duplicate or dead code
6. security risks
7. privacy risks
8. dependency/version risks

Do not delete unfamiliar files without evidence.

Produce an audit report and a proposed implementation sequence.
Do not start major implementation until the audit is complete.
```

---

# STAGE 1 — SESSION FOUNDATION

```text
Implement the smallest reliable Work Session state machine for ECHODESK.

Required states:
- ACTIVE
- PAUSED
- ENDED
- UNCERTAIN

Implement:
- start session
- pause
- resume
- stop
- correct elapsed time
- structured context
- timestamps
- active duration
- confidence/source fields

Use real application state, not mocked timers.

Add tests for state transitions and invalid transitions.

Do not implement camera, microphone, or desktop monitoring yet.

At completion, report exactly what works and how it was tested.
```

---

# STAGE 2 — JOT TEXT AGENT

```text
Implement JOT as a text-first intent interface.

Support at minimum:
- START_WORK_SESSION
- PAUSE_SESSION
- RESUME_SESSION
- STOP_SESSION
- CORRECT_SESSION_TIME
- UPDATE_CONTEXT
- ASK_STATUS

Example:
"studying DBMS"
→ START_WORK_SESSION(context=DBMS)

"JOT, I stopped an hour ago"
→ CORRECT_SESSION_TIME

Keep the intent parser behind an abstraction.
Do not hard-code one AI provider.

Every agent action must pass through a privacy/policy gate.

Add explicit fallback behavior when the AI service is unavailable.
```

---

# STAGE 3 — ZEN MODE

```text
Build Zen Mode around the real Work Session state.

Requirements:
- minimal UI
- current context
- elapsed active time
- pause
- resume
- stop/end
- clear session status

At normal Pomodoro thresholds, do NOT automatically force a break.

Instead, expose a quiet state:
"Flow protected — JOT is staying quiet."

Do not implement camera or microphone yet.

Test that session state remains correct when Zen Mode is entered/exited.
```

---

# STAGE 4 — ECHO MEMORY

```text
Implement structured Echo Memory.

Store:
- context
- topic where available
- last step
- next action
- session status
- active duration
- user corrections
- source
- confidence

Implement:
- save
- retrieve current context
- update
- delete

Build a simple Memory Center.

Do not store raw sensor data.

The resume experience must be based on structured state, not a fake response generated from a static string.
```

---

# STAGE 5 — ADAPTIVE INTERVENTION POLICY

```text
Implement a Flow / Intervention Policy Engine.

Inputs may include:
- session status
- elapsed active time
- recent interruption history
- user interruption preference
- optional presence signal if one exists
- last check-in

Possible outputs:
- STAY_SILENT
- SHOW_FLOW_STATUS
- OFFER_CHECKIN
- ASK_PAUSE

Do not use claims of true psychological flow detection.
This is a product policy engine.

Add deterministic tests for policy decisions.

Example:
active session + high engagement + non-urgent check-in
→ STAY_SILENT

natural pause + check-in due
→ OFFER_CHECKIN
```

---

# STAGE 6 — VOICE

```text
Add explicit voice interaction to JOT.

Supported commands:
- "Hey JOT, studying DBMS"
- "JOT, pause"
- "JOT, stop"
- "JOT, I stopped an hour ago"
- "JOT, resume DBMS"

Do not implement hidden always-listening behavior.

Keep raw audio out of application logs.

Show a clear microphone-active state.

Provide a text fallback when voice is unavailable.
```

---

# STAGE 7 — CAMERA / ZEN PRESENCE ASSISTANCE

```text
Implement optional Zen camera assistance.

First establish the permission flow.

Requirements:
- explicit user enablement
- clear camera-active state
- local processing where practical
- no identity recognition
- no continuous screen analysis
- no cloud video upload for presence detection
- no raw frame logging

The local output should be minimal, for example:
PRESENT / ABSENT / UNCERTAIN

Use a grace period and confidence threshold.

Do not auto-pause from a momentary glance away.

When confidence is insufficient:
ask the user rather than assuming.

Clearly separate visual capture mode from presence assistance mode.
```

---

# STAGE 8 — SMART CHECK-INS

```text
Implement gentle, context-aware check-ins.

Examples:
- hydration
- look away
- three breaths
- short movement reset

The intervention engine must decide whether to interrupt.

If active flow-support is high and the check-in is non-urgent:
STAY_SILENT.

If a natural pause is detected:
OFFER_CHECKIN.

Add user preference:
- minimal
- balanced
- frequent

Support natural command:
"JOT, less reminders."
```

---

# STAGE 9 — PRIVACY CENTER / ECHOSHIELD

```text
Build a visible Privacy Center.

Show:
- microphone status
- camera status
- local processing state
- cloud reasoning status where applicable
- raw recording retention state
- memory controls
- laptop monitoring state

Controls:
- disable sensors
- delete memory
- clear session
- manage permissions

Make policy constraints enforceable in code, not just visible in UI.

Test that an agent/tool call cannot bypass the policy layer.
```

---

# STAGE 10 — PHONE ↔ LAPTOP BRIDGE

```text
Implement the smallest real cross-device session handoff.

The user explicitly requests:
"JOT, continue DBMS on laptop."

Synchronize only the work-session state required for continuity.

Do not inspect arbitrary laptop applications, tabs, screen content, or private files.

Show:
PHONE → HANDOFF REQUEST → AUTHENTICATED SYNC → LAPTOP SESSION READY

Include failure handling:
- unauthorized device
- expired session
- malformed payload
- offline state

The bridge should synchronize state, not surveillance.
```

---

# STAGE 11 — SECURITY / ROBUSTNESS PASS

```text
Perform a security and privacy review of the entire ECHODESK implementation.

Check:
- secret handling
- API authorization
- session ownership
- sync authentication
- payload validation
- logging
- raw sensor retention
- permission enforcement
- prompt injection boundaries
- AI tool authorization
- camera/mic activation paths
- desktop companion permissions

Do not add features.
Fix issues and document remaining limitations.
```

---

# STAGE 12 — DEMO POLISH

```text
Now polish only the features that appear in the live demo.

Demo sequence:
1. "Hey JOT, studying DBMS."
2. Zen session starts.
3. Fixed timer threshold passes; JOT remains quiet.
4. User steps away.
5. Possible pause detected.
6. JOT asks to pause.
7. Natural check-in appears.
8. User returns.
9. JOT restores DBMS / Q5 context.
10. Phone → laptop handoff.
11. Privacy Center.

Do not add unrelated features.
Prioritize visual quality, reliability, fast response, and accurate state.
```
