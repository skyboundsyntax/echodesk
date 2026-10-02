# ECHODESK — System Architecture

## 1. Architecture Goal

Build JOT as a **privacy-constrained agent**, not an unrestricted assistant.

The agent should be able to understand intent, maintain session state, choose useful actions, and adapt while respecting explicit permissions and minimizing data exposure.

---

## 2. High-Level Architecture

```text
                         ECHODESK
                    ┌─────────────────┐
                    │       JOT       │
                    │   AI AGENT      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
        INPUT             CONTEXT            DEVICES
          │                  │                  │
     ┌────┼────┐        ┌────┼────┐       ┌────┴────┐
     │    │    │        │         │       │         │
    Text Voice Camera  Session   Memory   Phone    Laptop
     │    │    │        │         │       │         │
     └────┼────┘        └────┬────┘       └────┬────┘
          ↓                  ↓                 ↓
                 ┌────────────────────┐
                 │  INTENT ENGINE     │
                 └─────────┬──────────┘
                           ↓
                 ┌────────────────────┐
                 │  CONTEXT ENGINE    │
                 └─────────┬──────────┘
                           ↓
                 ┌────────────────────┐
                 │    FLOW ENGINE     │
                 └─────────┬──────────┘
                           ↓
                 ┌────────────────────┐
                 │  JOT AGENT / PLAN  │
                 └─────────┬──────────┘
                           ↓
                 ┌────────────────────┐
                 │  PRIVACY POLICY    │
                 │       GATE         │
                 └─────────┬──────────┘
                           ↓
                  ┌────────┴────────┐
                  ↓                 ↓
               ACTION            MEMORY
```

---

## 3. Input Layer

### Text

Natural language typed into JOT.

### Voice

Explicitly captured speech → speech-to-text → intent parser.

### Camera

Two separate use cases:

1. user-initiated visual input
2. optional Zen presence assistance

Keep these pipelines separate where practical.

### File/Link

User explicitly attaches or shares a file/URL.

### Handoff

User explicitly asks to continue a session on another device.

---

## 4. Intent Engine

Convert natural input into a structured command.

Example:

```json
{
  "intent": "START_WORK_SESSION",
  "context": "DBMS",
  "activity": "STUDYING",
  "mode": "ZEN",
  "confidence": 0.97
}
```

Potential intent types:

- START_WORK_SESSION
- PAUSE_SESSION
- RESUME_SESSION
- STOP_SESSION
- CORRECT_SESSION_TIME
- UPDATE_CONTEXT
- ASK_STATUS
- ASK_NEXT_ACTION
- REQUEST_PLAN
- REPLAN
- START_ZEN
- END_ZEN
- REQUEST_HANDOFF
- ACCEPT_CHECKIN
- SKIP_CHECKIN
- FORGET_MEMORY

The parser must return explicit uncertainty when appropriate.

---

## 5. Context Engine

The Context Engine combines user-declared information and allowed workspace state.

Never assume unrestricted access to the device.

Example context record:

```json
{
  "project": "DBMS",
  "topic": "Normalization",
  "last_step": "Q5",
  "next_action": "Continue Q5",
  "source": "user_declared",
  "confidence": 0.95
}
```

Source labels should distinguish:

- user_declared
- user_shared
- local_sensor_signal
- application_state
- inferred

This makes explanations and debugging easier.

---

## 6. Flow Engine

The Flow Engine decides whether JOT should:

- stay quiet
- show a subtle status
- offer a check-in
- suggest a pause
- end a session after confirmation

Inputs can include:

- active session state
- elapsed active time
- presence signal
- recent user actions
- user intervention preference
- last intervention time
- session confidence
- whether the user explicitly requested minimal interruption

Important:

Do not call this a medical or psychological “flow detector.” It is a **flow-support policy engine**.

---

## 7. JOT Agent

JOT should be tool-using and state-aware.

Suggested tools:

- `start_session`
- `pause_session`
- `resume_session`
- `stop_session`
- `correct_session_time`
- `get_current_session`
- `get_memory`
- `save_memory`
- `forget_memory`
- `suggest_checkin`
- `start_zen`
- `end_zen`
- `handoff_session`
- `replan`

Agent loop:

```text
OBSERVE ALLOWED CONTEXT
        ↓
INTERPRET INTENT
        ↓
CHECK CONFIDENCE
        ↓
PLAN ACTION
        ↓
PRIVACY / PERMISSION GATE
        ↓
EXECUTE
        ↓
STORE MINIMAL STATE
        ↓
RETURN RESULT
```

---

## 8. Privacy Policy Gate

Every agent action should be evaluated against policy.

Example:

```text
Action: use_camera_presence_signal

User opted into Zen sensor assistance? YES
OS permission granted? YES
Can local processing satisfy need? YES
Need cloud upload? NO

→ ALLOW LOCAL PROCESSING
```

Example:

```text
Action: inspect arbitrary laptop applications

Explicit user request? NO
Required for current task? NO

→ DENY
```

The policy layer must not be bypassable by an LLM response.

---

## 9. Local vs Cloud

Use a **local-first** architecture where practical.

Potentially local:

- presence classification
- lightweight sensor processing
- session timer/state
- simple intent shortcuts
- permission checks

Potentially cloud-backed:

- complex natural-language reasoning
- multi-document planning
- sophisticated summarization
- larger multimodal reasoning

Never send raw camera/microphone streams to the cloud merely because the cloud model can consume them.

---

## 10. Memory Architecture

Memory should be structured first and retrieval-based second.

### Structured state

Use a database for:

- sessions
- status
- timestamps
- permissions
- preferences
- user corrections

### Retrieval layer

Use embeddings/vector retrieval only where it materially helps:

- long-form notes
- user-provided documents
- historical context

Do not place every sensor event into a vector database.

---

## 11. Cross-Device Architecture

The ECHODESK Bridge should synchronize a **session state object**, not device surveillance data.

Example:

```json
{
  "session_id": "sess_1842",
  "context": "DBMS",
  "topic": "Normalization",
  "last_step": "Q5",
  "active_duration": 2820,
  "status": "active"
}
```

Only explicitly selected files/content should cross the bridge.

---

## 12. Failure Modes

### LLM unavailable

Core session controls still work locally.

### Camera unavailable

Fall back to explicit user controls.

### Mic unavailable

Fall back to text/buttons.

### Network unavailable

Preserve local session state and sync later where appropriate.

### Context ambiguity

Ask the user rather than inventing context.

### Sensor uncertainty

Do not auto-pause; offer a confirmation.

---

## 13. Suggested Technical Shape

Recommended baseline, subject to environment validation:

- Android/mobile client: native Android or Flutter
- Backend: FastAPI or Django
- Database: PostgreSQL
- Retrieval: pgvector or another lightweight vector store where needed
- AI provider: abstract behind an adapter so the model can be replaced
- Desktop bridge: lightweight companion using a minimal, explicit synchronization protocol

Do not let the build agent commit to a stack before checking the existing repository and available environment.
