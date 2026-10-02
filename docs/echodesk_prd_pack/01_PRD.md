# ECHODESK — Product Requirements Document
### Powered by JOT

## 1. Product Overview

**ECHODESK** is a privacy-first AI productivity workspace powered by **JOT**, an agent that turns natural human intent into actionable work without forcing users to constantly maintain a productivity system.

The user can type, speak, show, attach, or explicitly share information with JOT. JOT interprets the input, creates or updates context, starts or modifies work sessions, protects focus, provides low-disruption check-ins, remembers the user's work state, and helps resume later.

ECHODESK is deliberately designed around **data minimization and explicit consent**. It should help the user without requiring broad surveillance of the user's devices or personal life.

### Core product statement

> **JOT your intent. Less managing. More doing.**

### Product philosophy

> **JOT knows when to act, when to remember, and when to stay out of your way.**

---

## 2. Problem Statement

Hackathon problem statement:

> **Build AI-powered solutions that help people work smarter, automate repetitive tasks, manage time and information, improve workflows, and get more done.**

ECHODESK addresses the friction around work rather than simply adding another to-do list.

People often have to:

- translate natural intentions into structured tasks
- maintain priorities and schedules manually
- switch between notes, calendars, reminders, timers, files, chats, and workspaces
- rebuild context after interruptions
- tolerate productivity tools that interrupt active concentration

ECHODESK aims to reduce this overhead through one persistent AI workspace.

---

## 3. Target Users

### Primary

Students, creators, developers, researchers, and knowledge workers who frequently switch between tasks, devices, information sources, and work sessions.

### Secondary

Professionals with recurring planning/admin overhead and people who want a lightweight focus companion without intensive manual task management.

### User need

The user wants to **do the work**, not maintain a system about the work.

---

## 4. Product Principles

### 4.1 Zero-maintenance

The user should not have to manually maintain every task, status, schedule, or context record.

### 4.2 Multimodal intent

Text, voice, camera, files, and explicit device handoff should enter the same JOT intelligence layer.

### 4.3 Context continuity

JOT should remember work-session state: what the user was working on, what they last said they were doing, what was completed, what the next step was, and whether the session was active, paused, or ended.

### 4.4 Flow-first behavior

A timer must not automatically interrupt active concentration. JOT evaluates whether an intervention is actually helpful.

### 4.5 Privacy by architecture

Permissions constrain the agent. JOT must not have unrestricted access to devices or data.

### 4.6 User correction is first-class

The user can correct JOT naturally:

- “JOT, pause.”
- “JOT, stop.”
- “JOT, I stopped an hour ago.”
- “That wasn't DBMS; it was CN.”
- “Forget this session.”

### 4.7 No fabricated certainty

When confidence is low, JOT asks rather than pretending it knows.

---

## 5. Core Product Components

## 5.1 JOT — AI Agent

JOT is the primary interaction layer.

Supported inputs:

- text
- explicit voice command
- explicit camera capture
- file/URL attachment
- explicit phone-to-laptop continuation

Supported high-level actions:

- create/start a work session
- pause a session
- stop/end a session
- resume a session
- update context
- create structured work items when appropriate
- suggest a plan
- re-plan after changes
- offer a focus-safe check-in
- save/update context memory
- forget/delete memory

JOT should not automatically perform high-impact or irreversible actions without permission.

---

## 5.2 Zen Mode

Zen Mode is an optional focus environment.

Entry example:

> “Hey JOT, studying DBMS.”

JOT response:

> “Zen session started.”

Zen Mode should present:

- current work context
- elapsed active time
- pause/resume control
- minimal JOT presence
- optional sensor status
- a way to exit Zen

Zen Mode intentionally removes unnecessary UI and reduces interruptions.

---

## 5.3 Adaptive Focus / Flow Support

ECHODESK should behave differently from a fixed Pomodoro timer.

Instead of:

> 25 minutes → mandatory break

use:

> session duration + activity/presence signals + user preferences + intervention policy → decide whether to stay quiet or offer a check-in.

JOT should be able to produce states such as:

- Active
- Flow-support / low-intervention
- Possible pause
- Paused
- Ended
- Uncertain

Do not claim scientific measurement of a user's true psychological “flow state.” The system provides a **flow-support experience** based on product signals.

---

## 5.4 Smart Check-ins

JOT can offer low-disruption interventions such as:

- hydration
- look away from the screen
- brief breathing reset
- short movement reset

These are not constant alarms.

### Intervention policy

JOT should consider:

- active session status
- interruption sensitivity
- recent check-ins
- whether the user is currently active
- whether a natural pause is likely
- user preference
- whether the intervention is important enough to interrupt

If the user is engaged and a check-in is not critical, JOT should stay silent.

---

## 5.5 Presence / Pause Assistance

In Zen Mode, camera assistance is optional and explicitly enabled by the user.

The camera is NOT for:

- identity recognition
- biometric identification
- analyzing the user's private environment for unrelated purposes
- reading the user's screen
- continuous cloud video streaming

Its narrow purpose is to support a local signal such as:

> `user_present = true/false`

The implementation should use a grace period and confidence threshold before offering a pause suggestion.

Example:

> “Looks like you stepped away. Pause DBMS?”

A short glance away should not immediately pause a session.

---

## 5.6 Voice Control

Voice is an input method, not the entire product.

Examples:

> “Hey JOT, studying DBMS.”

> “JOT, pause.”

> “JOT, stop.”

> “JOT, I stopped an hour ago.”

> “JOT, resume DBMS.”

> “JOT, I only have 30 minutes.”

Voice commands should be converted into structured intents before execution.

---

## 5.7 Camera / Vision

Camera access is explicit and user-initiated or explicitly enabled as part of Zen Mode sensor assistance.

Potential uses:

- capture a whiteboard
- capture an assignment
- capture handwritten notes
- capture a timetable
- optional local presence assistance in Zen Mode

The AI should distinguish between:

### Visual understanding mode
User intentionally shows something to JOT.

### Presence assistance mode
User has deliberately opted into Zen Mode sensor assistance.

These should be separate permissions and data paths where practical.

---

## 5.8 Echo Memory

Echo Memory stores useful work-session state rather than raw surveillance data.

Example:

```text
Context: DBMS
Activity: Studying
Started: 20:42
Status: Paused
Active time: 47m
Last known step: Q5
Topic: Normalization
Next action: Continue Q5
``` 

The memory layer should support:

- session history
- user corrections
- resumable context
- project associations
- optional preference learning
- user deletion

---

## 5.9 ECHODESK Bridge

The laptop companion is for **cross-device continuity**, not surveillance.

It should support:

- secure session synchronization
- user-selected content transfer
- workspace continuity
- explicit phone → laptop handoff
- explicit laptop → phone updates

It must NOT silently inspect arbitrary open applications, browser tabs, private messages, files, or screen contents.

Example:

Phone:

> “JOT, continue DBMS on laptop.”

Laptop:

> “DBMS session ready. Q5 — Normalization.”

---

## 6. Core User Journeys

### Journey A — Start work naturally

1. User enters Zen Mode.
2. User says or types “studying DBMS.”
3. JOT creates a DBMS work session.
4. Zen UI starts.
5. User works.

### Journey B — Flow protection

1. User works beyond a fixed timer interval.
2. JOT sees an active session.
3. JOT chooses not to interrupt.
4. UI can show a quiet “flow protected” state.

### Journey C — Natural pause

1. User steps away.
2. Optional local presence signal changes.
3. Grace period is applied.
4. JOT suggests a pause rather than assuming one.
5. User confirms or continues.

### Journey D — Manual correction

User says:

> “JOT, I stopped an hour ago.”

JOT updates the session record.

### Journey E — Resume context

User says:

> “JOT, resume DBMS.”

JOT responds with the stored context and next step.

### Journey F — Phone → laptop

1. User has a DBMS session on the phone.
2. User explicitly requests continuation on laptop.
3. Bridge synchronizes session state.
4. Laptop shows the ECHODESK workspace.
5. User works.
6. Updated state syncs back.

### Journey G — Smart check-in

1. User is actively working.
2. JOT evaluates intervention policy.
3. If user is clearly engaged, JOT stays quiet.
4. At an appropriate point, JOT may offer:
   - water
   - look away
   - three breaths
   - short movement reset
5. User can accept, skip, or reduce future interventions.

---

## 7. Functional Requirements

### FR-01 — Intent capture

JOT shall accept text intent.

### FR-02 — Voice intent

JOT shall accept explicit voice commands and map them to structured intents.

### FR-03 — Work session lifecycle

Support start, active, pause, resume, and stop states.

### FR-04 — Context memory

Persist structured work-session state sufficient for later resume.

### FR-05 — Context correction

Allow user corrections without requiring manual record editing.

### FR-06 — Adaptive intervention

Do not interrupt every session at a fixed interval.

### FR-07 — Smart check-ins

Offer low-disruption wellness/focus prompts according to a user-configurable policy.

### FR-08 — Camera input

Allow user-initiated visual capture and optional Zen presence assistance.

### FR-09 — Microphone permissions

Microphone use must be explicit and scoped.

### FR-10 — Privacy policy gate

JOT actions must pass through permission/policy checks.

### FR-11 — Memory controls

Users must be able to inspect, correct, delete, and disable memory features.

### FR-12 — Sensor controls

Users must be able to disable camera/microphone assistance.

### FR-13 — Cross-device continuity

Synchronize explicitly requested sessions between phone and laptop.

### FR-14 — Failure handling

The system must degrade gracefully when network/LLM services fail.

### FR-15 — Confidence-aware behavior

Low-confidence context must trigger a clarification rather than an invented fact.

---

## 8. Non-Functional Requirements

### Privacy

Privacy is an architectural requirement, not a marketing claim.

### Security

- secure authentication for synced accounts
- encrypted transport
- safe credential/token handling
- least-privilege permissions
- secure local storage for sensitive state
- no hard-coded secrets
- no logging of sensitive raw sensor content

### Performance

JOT should feel responsive for normal actions. Local sensor processing should avoid unnecessary network round trips where feasible.

### Reliability

Core session controls should continue to work when nonessential AI services are unavailable.

### Transparency

The UI should expose when sensors are enabled and when cloud reasoning is used, where practical.

### Accessibility

Support readable text, touch targets, keyboard input, and voice interaction.

---

## 9. Data Model — Initial Concept

### User

- id
- preferences
- permission settings
- memory settings

### WorkSession

- id
- user_id
- context_name
- context_id/project_id
- start_time
- end_time
- active_duration
- status
- confidence
- source
- created_at
- updated_at

### ContextMemory

- id
- session_id
- last_step
- next_action
- topic
- notes
- user_verified
- retention_setting

### JotInput

- id
- type: text | voice | image | file | handoff
- normalized_intent
- created_at
- retention_setting

Avoid storing raw voice or raw sensor frames unless the user explicitly chooses functionality that requires storage.

---

## 10. Product Success for the Hackathon

The MVP should make these moments work reliably:

1. “Hey JOT, studying DBMS.”
2. Zen session begins.
3. User can work without a mandatory timer interruption.
4. Optional camera assistance can produce a local presence signal.
5. JOT can suggest a natural pause.
6. User can say “JOT, stop” or correct elapsed time.
7. JOT remembers the last work context.
8. Session can move between phone and laptop through an explicit bridge.
9. Privacy settings are visible and credible.

Do not prioritize breadth over reliability.
