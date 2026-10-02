# ECHODESK — UX & User Flows

## 1. UX Goal

ECHODESK should feel like a calm intelligent workspace, not a control panel the user has to maintain.

### Core UX rule

> **The user should tell JOT what they want. JOT should handle the organization.**

---

## 2. Main Navigation

Keep the primary navigation minimal.

Recommended core surfaces:

- **JOT** — primary interaction
- **Today / Workspace** — current active work and context
- **Zen** — focus environment
- **Echoes** — work-session memory
- **Privacy** — permissions and memory controls

Avoid turning the app into a dashboard full of metrics.

---

## 3. JOT Home

Primary element:

```text
┌───────────────────────────────────┐
│ JOT                               │
│                                   │
│ What are you working on?          │
│                                   │
│ [ Type to JOT...              ]   │
│                                   │
│ 🎤 Speak   📷 Show   📎 Attach    │
│                                   │
│ Current: DBMS • Paused            │
└───────────────────────────────────┘
```

The user should not encounter “create task” as the primary action.

---

## 4. Start Session Flow

User:

> “Hey JOT, studying DBMS.”

JOT:

> “Zen session started.”

UI:

```text
DBMS
Studying

42:18

● Flow protected

[ Pause ]     [ End ]
```

Optional sensor state should be visible but not visually dominant.

---

## 5. Zen Mode

Zen should be visually quiet.

### Principles

- one primary work context
- one timer/state
- minimal controls
- no noisy notifications
- no endless metrics
- no “gamification” that competes with the work

Example:

```text
                 DBMS

                  Q5

                42:18

          ● Flow protected

        JOT is staying quiet.
```

---

## 6. Sensor Consent Flow

When the user enables optional Zen assistance:

```text
Zen Assistance

To support pause detection,
ECHODESK can optionally use:

🎤 Microphone
📷 Camera

Only while Zen assistance is enabled.

Processing is local where practical.
Raw recordings are not stored by default.

[ Enable ]  [ Continue without sensors ]
```

Do not hide this information inside settings.

---

## 7. Pause Detection Flow

### Wrong UX

Camera sees user looking away for 5 seconds → automatically pause.

### Desired UX

```text
Possible pause

Looks like you stepped away.

Pause DBMS?

[ Pause ] [ Keep working ]
```

Use a grace period and uncertainty state.

---

## 8. Flow Protection

At a fixed timer boundary, do not automatically force a break.

Instead, if the session is active:

```text
● Flow protected
JOT is staying quiet.
```

If the user reaches a natural stopping point:

```text
Quick reset?

💧 Water
👀 Look away
🫁 3 breaths

[ Start ] [ Later ]
```

---

## 9. Normal Mode Commands

Normal mode should not require camera access.

Examples:

> “JOT, stop.”

> “JOT, pause DBMS.”

> “JOT, I stopped an hour ago.”

> “JOT, resume DBMS.”

> “JOT, what was I doing?”

The system should update session state naturally.

---

## 10. Context Resume Flow

After a pause:

```text
WELCOME BACK

DBMS
Normalization

Last step: Q5
Next: Continue Q5

[ Resume ]
```

The point is context restoration, not punishment for leaving.

---

## 11. Check-in UX

Check-ins should feel like gentle assistant suggestions.

### Hydration

> 💧 Quick reset?
> Grab some water before continuing.

### Look away

> 👀 Micro reset
> Look away for a few seconds.

### Breathing

> 🫁 Three breaths?
> Then we continue.

The user should be able to say:

> “Less reminders.”

JOT should update the intervention preference.

---

## 12. JOT Explainability

When JOT acts automatically, the user should be able to understand why.

Example:

> **Why did you pause?**
>
> “I received a possible absence signal for 92 seconds. I waited for confirmation before pausing.”

Example:

> **Why didn't you remind me?**
>
> “You were in an active focus session and your interruption preference is minimal.”

Do not expose hidden chain-of-thought. Provide concise user-facing reasons based on observable product rules.

---

## 13. Phone → Laptop Handoff

Phone:

```text
DBMS
Active

[ Continue on laptop ]
```

Confirmation:

> “This will sync your DBMS session state with your ECHODESK laptop workspace.”

Laptop:

```text
JOT SESSION READY

DBMS
Q5 — Normalization
42:18 active

[ Continue ]
```

The handoff should show continuity, not surveillance.

---

## 14. Memory Center

Provide:

```text
JOT MEMORY

DBMS
• Last session: paused
• Last step: Q5
• Next: Continue Q5

[ Correct ] [ Forget ]
```

Users can delete individual memories or clear all.

---

## 15. Privacy Center

Recommended display:

```text
ECHOSHIELD

Microphone       Zen only     OFF
Camera           Zen only     OFF
Local sensing    Available    ON
Cloud reasoning  As needed    ON
Raw recordings   Stored       OFF
Laptop monitoring             OFF

[ Manage permissions ]
[ Manage memory ]
```

The interface should be clear enough that a nontechnical user can understand it.

---

## 16. UX Anti-Patterns

Do NOT:

- force users into task creation forms
- constantly interrupt with reminders
- imply that the camera is watching continuously
- hide sensor activity
- punish missed tasks
- use shame-based notifications
- overload the home screen with analytics
- make the AI omnipresent
- present uncertain inferences as facts
