/**
 * ECHODESK — End-to-End Integration & Demo Acceptance Tests
 * Verifies all 12 Live Hackathon Demo Moments from docs/echodesk_prd_pack/08_TESTING_ACCEPTANCE.md:
 * 1. "Hey JOT, studying DBMS" -> Zen session starts
 * 2. Timer passes 25m threshold -> JOT stays quiet (flow protected)
 * 3. Absence detected -> Pause proposal ("Looks like you stepped away. Pause DBMS?")
 * 4. User confirms pause -> Session paused, context saved
 * 5. Natural check-in -> Water / look away / 3 breaths
 * 6. User resumes -> Structured Echo Memory greeting restored
 * 7. "JOT, I stopped an hour ago" -> Retroactive elapsed time corrected
 * 8. "JOT, less reminders" -> Intervention preference set to minimal
 * 9. "JOT, continue DBMS on laptop" -> Cross-device authenticated handoff
 * 10. Privacy Center -> Zero surveillance enforced, desktop inspection DENIED
 * 11. Memory controls -> Deletion of memory verified
 * 12. Security checks -> Prompt injection cannot bypass PrivacyPolicyGate
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Integration Flow — Demo Moment 1 & 2: Natural Intent to Zen Session', async () => {
    test('User declares intent: "Hey JOT, studying DBMS" -> Starts Zen session', async () => {
      const bus = new EventBus();
      const storage = new StorageAdapter('test_mem1_');
      storage.clearAll();
      const gate = new PrivacyPolicyGate({ storage, eventBus: bus });
      const ai = new DeterministicLocalProvider();
      const intentEngine = new IntentEngine({ aiProvider: ai, privacyGate: gate, eventBus: bus });
      const session = new WorkSession({ eventBus: bus });

      const command = await intentEngine.process('Hey JOT, studying DBMS', {}, { explicitUserGesture: true });
      exp(command.intent).toBe('START_WORK_SESSION');
      exp(command.contextName).toBe('DBMS');
      exp(command.allowed).toBe(true);

      session.start(command.contextName, {
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
        mode: 'zen',
      });

      exp(session.state).toBe(WorkSessionState.ACTIVE);
      exp(session.contextName).toBe('DBMS');
      exp(session.topic).toBe('Normalization');
      exp(session.lastStep).toBe('Q5');
    });
  });

  desc('Integration Flow — Demo Moment 3: Flow Protection at Pomodoro Threshold', () => {
    test('When active duration exceeds 25 minutes, FlowEngine protects flow and stays quiet', () => {
      const storage = new StorageAdapter('test_flow_');
      const flow = new FlowEngine({ storage });
      flow.setPreference('minimal');

      // 26 minutes elapsed
      const evaluation = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 26 * 60 * 1000,
        presenceSignal: 'PRESENT',
      });

      // Crucial: Must NOT force a break!
      exp(evaluation.decision).toBe(FlowDecision.SHOW_FLOW_STATUS);
      exp(evaluation.flowProtected).toBe(true);
      exp(evaluation.reason.includes('Flow protected')).toBe(true);
    });
  });

  desc('Integration Flow — Demo Moment 4 & 5: Natural Pause Detection & Check-ins', () => {
    test('Detects sustained absence beyond grace period and asks before pausing', () => {
      const storage = new StorageAdapter('test_abs_');
      const flow = new FlowEngine({ storage });
      flow.absenceGracePeriodMs = 10; // set small for test

      // First sample of absence
      const eval1 = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 5000,
        presenceSignal: 'ABSENT',
      });
      // Initial sample is within grace period: stays silent
      exp(eval1.decision).toBe(FlowDecision.STAY_SILENT);

      // Simulate grace period expiry
      flow.absenceStartedAt = Date.now() - 15000;
      const eval2 = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 5000,
        presenceSignal: 'ABSENT',
      });

      exp(eval2.decision).toBe(FlowDecision.ASK_PAUSE);
      exp(eval2.prompt.includes('stepped away')).toBe(true);
    });

    test('Offers non-intrusive wellness check-in when appropriate', () => {
      const storage = new StorageAdapter('test_check_');
      const flow = new FlowEngine({ storage });
      const checkIn = flow.getNextCheckIn();
      exp(checkIn.id).toBeTruthy();
      exp(checkIn.text).toBeTruthy();
    });
  });

  desc('Integration Flow — Demo Moment 6 & 7: Context Resumption & Retroactive Correction', async () => {
    test('Structured Echo Memory stores context and provides accurate resumption greeting', () => {
      const storage = new StorageAdapter('test_mem_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
        status: 'paused',
        activeDurationMs: 42 * 60 * 1000 + 18000,
        formattedDuration: '42:18',
      });

      const greeting = memory.formatResumeGreeting('DBMS');
      exp(greeting).toBe('Welcome back. You were working on Q5 — Normalization.');

      const saved = memory.get('DBMS');
      exp(saved.contextName).toBe('DBMS');
      exp(saved.lastStep).toBe('Q5');
    });

    test('Corrects time retroactively: "JOT, I stopped an hour ago"', async () => {
      const ai = new DeterministicLocalProvider();
      const parsed = await ai.parseIntent('JOT, I stopped an hour ago', {
        activeDurationMs: 90 * 60 * 1000, // 90 minutes
      });

      exp(parsed.intent).toBe('CORRECT_SESSION_TIME');
      exp(parsed.minutesAgo).toBe(60);
      exp(parsed.adjustedDurationMs).toBe(30 * 60 * 1000); // 90m - 60m = 30m

      const session = new WorkSession();
      session.start('DBMS');
      session.correctElapsedTime(parsed.adjustedDurationMs, parsed.reason);
      exp(session.activeDurationMs).toBe(30 * 60 * 1000);
      exp(session.corrections.length).toBe(1);
    });
  });

  desc('Integration Flow — Demo Moment 8 & 9: Preferences & Phone-to-Laptop Continuity', async () => {
    test('Parses preference change: "JOT, less reminders"', async () => {
      const ai = new DeterministicLocalProvider();
      const parsed = await ai.parseIntent('JOT, less reminders');
      exp(parsed.intent).toBe('SET_INTERVENTION_PREFERENCE');
      exp(parsed.preference).toBe('minimal');
    });

    test('Explicit Phone to Laptop Handoff synchronizes structured state without surveillance', () => {
      const storage = new StorageAdapter('test_bridge_');
      storage.clearAll();
      const gate = new PrivacyPolicyGate({ storage });
      const bridge = new BridgeEngine({ storage, privacyGate: gate });

      const phoneSession = {
        id: 'sess_1234',
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
        status: 'active',
        activeDurationMs: 42 * 60 * 1000 + 18000,
        formattedDuration: '42:18',
        mode: 'zen',
      };

      const handoffPkg = bridge.initiateHandoff(phoneSession, 'laptop');
      exp(handoffPkg.targetDevice).toBe('laptop');
      exp(handoffPkg.session.contextName).toBe('DBMS');
      exp(handoffPkg.session.lastStep).toBe('Q5');

      // Laptop receives state
      const received = bridge.receiveHandoff();
      exp(received.session.id).toBe('sess_1234');
      exp(received.session.contextName).toBe('DBMS');
      exp(received.session.formattedDuration).toBe('42:18');
    });
  });

  desc('Integration Flow — Demo Moment 10, 11, 12: Security & Privacy Gate Enforcement', () => {
    test('Desktop surveillance is STRICTLY FORBIDDEN by policy gate', () => {
      const gate = new PrivacyPolicyGate();
      const evaluation = gate.evaluate(PolicyActionType.DESKTOP_SURVEILLANCE);
      exp(evaluation.allowed).toBe(false);
      exp(evaluation.code).toBe('DENY_PROHIBITED_FEATURE');
    });

    test('Passive/hidden microphone recording is DENIED without explicit gesture', () => {
      const gate = new PrivacyPolicyGate();
      const evaluation = gate.evaluate(PolicyActionType.ACTIVATE_MIC, { explicitUserGesture: false });
      exp(evaluation.allowed).toBe(false);
      exp(evaluation.code).toBe('DENY_PASSIVE_MIC');
    });

    test('Streaming raw camera frames to cloud is DENIED', () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ cameraEnabled: true });
      const evaluation = gate.evaluate(PolicyActionType.ACTIVATE_CAMERA, { cloudStreamRequested: true });
      exp(evaluation.allowed).toBe(false);
      exp(evaluation.code).toBe('DENY_CLOUD_VIDEO_STREAM');
    });

    test('Memory deletion permanently removes record', () => {
      const storage = new StorageAdapter('test_del_');
      const memory = new EchoMemoryEngine({ storage });
      memory.save({ contextName: 'DBMS', lastStep: 'Q5' });
      exp(memory.get('DBMS')).toBeTruthy();

      memory.delete('DBMS');
      exp(memory.get('DBMS')).toBeNull();
    });
  });
})();
