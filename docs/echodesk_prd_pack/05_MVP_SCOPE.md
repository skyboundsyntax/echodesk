# ECHODESK — Hackathon MVP Scope

## 1. Objective

Build a reliable, impressive core experience for a 3–5 minute demo.

The goal is **not** to build an all-purpose life-management platform.

The goal is to prove one compelling loop:

> **JOT intent → focus → adaptive pause → context memory → resume → phone/laptop continuity**

---

## 2. P0 — MUST WORK

### P0.1 JOT text input

User can type:

> “Studying DBMS.”

JOT creates a work session.

### P0.2 JOT voice input

User can explicitly speak the same command.

### P0.3 Session lifecycle

Start / active / pause / resume / stop.

### P0.4 Zen Mode

Minimal focus UI with session state.

### P0.5 Adaptive interruption policy

At fixed timer thresholds, active sessions should not be forced to stop.

### P0.6 Manual corrections

Examples:

> “JOT, I stopped an hour ago.”

### P0.7 Echo Memory

Store enough structured context to resume.

### P0.8 Optional camera assistance

A user-controlled Zen presence signal, ideally processed locally for the MVP.

### P0.9 Natural pause suggestion

Presence signal + grace period → “Pause?”

### P0.10 Check-ins

At least one or two low-disruption prompts such as hydration / look-away.

### P0.11 Privacy Center

Visible camera/mic state and core memory controls.

### P0.12 Phone ↔ laptop session handoff

Explicitly transfer a work session between devices.

---

## 3. P1 — SHOULD HAVE

- file attachment
- camera document/whiteboard capture
- context confidence display
- adaptive intervention preference
- secure account/device pairing
- graceful offline session behavior
- structured Echo timeline

---

## 4. P2 — FUTURE / DO NOT PRIORITIZE FOR HACKATHON CORE

- complete calendar replacement
- full email management
- full habit tracker
- broad browser surveillance
- unrestricted desktop monitoring
- complex team collaboration
- wearable integrations
- large knowledge management suite
- advanced ML personalization
- broad third-party integrations

These should not delay the P0 demo.

---

## 5. Demo-Critical Features

The prototype should make the following moments visually obvious:

### Moment 1

> “Hey JOT, studying DBMS.”

### Moment 2

> “Zen session started.”

### Moment 3

The timer passes the usual Pomodoro point.

JOT stays quiet.

### Moment 4

User steps away.

JOT offers:

> “Looks like you stepped away. Pause DBMS?”

### Moment 5

Natural check-in:

> “Quick reset? Water · Look away · 3 breaths.”

### Moment 6

User returns.

JOT:

> “Welcome back. You were working on Q5 — Normalization.”

### Moment 7

Phone:

> “JOT, continue DBMS on laptop.”

Laptop:

> “DBMS session ready.”

### Moment 8

Privacy center:

> Camera: Zen only
> Microphone: Zen only
> Raw recording: not stored by default
> Laptop monitoring: OFF

---

## 6. Demo Safety

Never demo a fake local model or fake sensor pipeline as if it were real.

If a subsystem is a prototype/mock, label it internally as such and make the implementation status clear to the team.

Do not claim:

- exact scientific flow detection
- emotion detection
- mind reading
- perfect privacy
- absolute security
- complete local processing

---

## 7. Hackathon Build Priority

If time becomes limited:

1. session reliability
2. JOT interaction
3. Zen Mode
4. pause/resume + memory
5. phone-laptop handoff
6. privacy center
7. camera assistance
8. check-ins
9. polish

A smaller reliable loop is preferable to many incomplete features.
