# ECHODESK — Testing & Acceptance Checklist

## 1. Product Acceptance

### JOT

- [ ] Text intent can start a real session.
- [ ] Voice intent can start a real session when enabled.
- [ ] JOT can pause a session.
- [ ] JOT can resume a session.
- [ ] JOT can stop a session.
- [ ] JOT can correct previously recorded time.
- [ ] JOT can retrieve the current session.
- [ ] JOT does not invent a context when confidence is low.

### Zen Mode

- [ ] Zen Mode has minimal distractions.
- [ ] Session timer reflects real active time.
- [ ] Timer does not forcibly stop active work at a fixed Pomodoro threshold.
- [ ] User can exit Zen Mode cleanly.

### Echo Memory

- [ ] Last context is stored.
- [ ] Last step can be displayed.
- [ ] Next action can be displayed.
- [ ] User correction updates memory.
- [ ] Deleted memory is actually deleted from the configured store.

---

## 2. Pause Detection Acceptance

- [ ] Camera permission is explicit.
- [ ] Camera cannot be activated through a hidden code path.
- [ ] Presence processing is local where implemented locally.
- [ ] Raw frame data is not logged.
- [ ] A brief glance away does not pause the session.
- [ ] A sustained absence can trigger a possible-pause state.
- [ ] The product asks for confirmation when confidence is not sufficient.
- [ ] If camera is disabled, manual pause still works.

---

## 3. Smart Check-in Acceptance

- [ ] Check-ins do not appear constantly.
- [ ] Active focus can suppress non-urgent check-ins.
- [ ] Natural pauses can trigger an offer.
- [ ] User can skip.
- [ ] User preference affects future intervention frequency.

---

## 4. Privacy Acceptance

- [ ] Mic is off when not explicitly required.
- [ ] Camera is off when not explicitly required.
- [ ] Sensor status is visible.
- [ ] Raw audio is not logged.
- [ ] Raw camera frames are not logged.
- [ ] Screen recording is not required for core functionality.
- [ ] Laptop companion does not silently enumerate open apps.
- [ ] Private laptop content is not automatically collected.
- [ ] Memory can be viewed.
- [ ] Memory can be corrected.
- [ ] Memory can be deleted.
- [ ] Sensors can be disabled.

---

## 5. Security Acceptance

- [ ] No API keys in source control.
- [ ] Secrets are server-side or secure-storage only.
- [ ] Sync endpoints authenticate users/devices.
- [ ] Session ownership is validated.
- [ ] Payloads are validated.
- [ ] Agent tools cannot bypass policy checks.
- [ ] User-provided documents are treated as untrusted input.
- [ ] Prompt injection cannot change permissions.
- [ ] Sensitive fields are excluded from ordinary logs.

---

## 6. Office Kit / Bridge Acceptance

- [ ] User explicitly initiates handoff.
- [ ] Phone shows handoff state.
- [ ] Laptop receives the correct session.
- [ ] Laptop shows the correct context.
- [ ] State changes can sync back.
- [ ] Unauthorized devices are rejected.
- [ ] Offline mode fails gracefully.
- [ ] No arbitrary desktop inspection is required.

---

## 7. Failure Testing

### AI unavailable

- [ ] session controls still work
- [ ] useful fallback shown
- [ ] no fake success response

### Camera unavailable

- [ ] user can continue without sensor assistance

### Microphone unavailable

- [ ] text fallback works

### Network unavailable

- [ ] local state remains usable where designed

### Ambiguous context

- [ ] JOT asks for confirmation

### Sync failure

- [ ] user is told clearly
- [ ] no corrupted state is committed

---

## 8. Demo Acceptance

The team should be able to perform the complete live flow without changing code during the demo:

```text
"Hey JOT, studying DBMS."
          ↓
      Zen starts
          ↓
   Flow stays protected
          ↓
      User steps away
          ↓
    Pause suggestion
          ↓
   Gentle check-in
          ↓
       Resume
          ↓
  Q5 / Normalization restored
          ↓
  Phone → Laptop handoff
          ↓
    Privacy Center
```

---

## 9. Claims Audit

Before submission, verify that the presentation and demo do NOT claim:

- perfect security
- perfect privacy
- scientific flow-state detection
- emotion detection
- mind reading
- invisible surveillance
- all processing is on-device
- cloud APIs are never used
- complete OS-level access that the platform does not provide

Replace unsupported claims with precise wording such as:

- privacy-first
- local-first where practical
- optional sensor assistance
- presence signal
- context confidence
- minimum necessary context
- not stored by default
- user-controlled memory

---

## 10. Final Definition of Done

ECHODESK is demo-ready when:

1. the primary JOT session flow works reliably;
2. Zen Mode is polished;
3. context can be resumed;
4. privacy controls are real rather than decorative;
5. optional sensor assistance works or is clearly marked as prototype behavior;
6. phone-laptop handoff is real;
7. failures do not destroy state;
8. security checks pass;
9. no sensitive data is accidentally logged;
10. the complete demo can be performed repeatedly without manual intervention.
