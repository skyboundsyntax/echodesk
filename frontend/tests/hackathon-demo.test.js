/**
 * ECHODESK Browser Test Suite — Stage 12: Live Hackathon Demo Rehearsal
 * Tests the complete 11-step hackathon demo flow in browser context:
 * 1. "Hey JOT, studying DBMS."
 * 2. Zen session starts.
 * 3. Fixed timer threshold passes; JOT remains quiet.
 * 4. User steps away.
 * 5. Possible pause detected.
 * 6. JOT asks to pause.
 * 7. Natural check-in appears.
 * 8. User returns.
 * 9. JOT restores DBMS / Q5 context.
 * 10. Phone → laptop handoff.
 * 11. Privacy Center (ECHOSHIELD).
 */

(function () {
  const isNode = typeof window === 'undefined';
  const runner = isNode ? null : window.testRunner;
  if (!runner) return;

  const { describe, test, expect } = runner;

  describe('Stage 12 — Live Hackathon Demo 11-Step Sequence', () => {

    test('Demo Step 1: User intent "Hey JOT, studying DBMS" is parsed', async () => {
      const gate = new window.PrivacyPolicyGate();
      const intentEngine = new window.IntentEngine({
        aiProvider: new window.DeterministicLocalProvider(),
        privacyGate: gate,
      });

      const cmd = await intentEngine.process('Hey JOT, studying DBMS', {}, { explicitUserGesture: true });
      expect(cmd.intent).toBe('START_WORK_SESSION');
      expect(cmd.contextName).toBe('DBMS');
      expect(cmd.allowed).toBe(true);
    });

    test('Demo Step 2: Zen focus session starts cleanly', () => {
      const session = new window.WorkSession();
      session.start('DBMS', { topic: 'Normalization', lastStep: 'Q5', mode: 'zen' });

      expect(session.state).toBe(window.WorkSessionState.ACTIVE);
      expect(session.contextName).toBe('DBMS');
      expect(session.lastStep).toBe('Q5');
      expect(session.mode).toBe('zen');
    });

    test('Demo Step 3: Fixed timer threshold passes; JOT remains quiet', () => {
      const session = new window.WorkSession();
      session.start('DBMS', { topic: 'Normalization' });
      session.correctElapsedTime(26 * 60 * 1000, 'Demo: elapsed past 25m');

      const flow = new window.FlowEngine({ preference: 'minimal' });
      const evaluation = flow.evaluate({
        sessionState: session.state,
        activeDurationMs: session.getActiveDurationMs(),
        presenceSignal: 'PRESENT',
      });

      expect(['STAY_SILENT', 'SHOW_FLOW_STATUS'].includes(evaluation.decision)).toBe(true);
    });

    test('Demo Step 4: User steps away (presence: ABSENT)', () => {
      const camera = new window.CameraPresenceSensor({
        privacyGate: new window.PrivacyPolicyGate({ cameraEnabled: true }),
      });
      camera.start(true);
      const res = camera.setSignal('ABSENT', 0.94);

      expect(res.signal).toBe('ABSENT');
      expect(camera.currentSignal).toBe('ABSENT');
    });

    test('Demo Step 5: Possible pause detected with grace period', () => {
      const session = new window.WorkSession();
      session.start('DBMS');
      const flow = new window.FlowEngine({ absenceGracePeriodMs: 12000 });
      const now = Date.now();

      // Glance away: 3 seconds
      const quickGlance = flow.evaluate({
        sessionState: session.state,
        activeDurationMs: session.getActiveDurationMs(),
        presenceSignal: 'ABSENT',
        now: now + 3000,
      });
      expect(quickGlance.decision).toBe('STAY_SILENT');
    });

    test('Demo Step 6: JOT asks to pause on sustained absence', () => {
      const session = new window.WorkSession();
      session.start('DBMS');
      const flow = new window.FlowEngine({ absenceGracePeriodMs: 12000 });
      const now = Date.now();

      // Sustained absence: 15 seconds
      const sustained = flow.evaluate({
        sessionState: session.state,
        activeDurationMs: session.getActiveDurationMs(),
        presenceSignal: 'ABSENT',
        now: now + 15000,
      });
      expect(sustained.decision).toBe('ASK_PAUSE');
    });

    test('Demo Step 7: Natural check-in appears on pause', () => {
      const session = new window.WorkSession();
      session.start('DBMS');
      session.pause('Stepped away');

      const flow = new window.FlowEngine();
      const checkIn = flow.getNextCheckIn();
      expect(Boolean(checkIn && checkIn.title)).toBe(true);
      expect(session.state).toBe(window.WorkSessionState.PAUSED);
    });

    test('Demo Step 8: User returns (presence: PRESENT)', () => {
      const camera = new window.CameraPresenceSensor({
        privacyGate: new window.PrivacyPolicyGate({ cameraEnabled: true }),
      });
      camera.start(true);
      const res = camera.setSignal('PRESENT', 0.95);
      expect(res.signal).toBe('PRESENT');
      camera.stop();
    });

    test('Demo Step 9: JOT restores DBMS / Q5 context', () => {
      const memory = new window.EchoMemoryEngine();
      memory.save({
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
      });

      const greeting = memory.formatResumeGreeting('DBMS');
      expect(greeting.includes('Q5')).toBe(true);
      expect(greeting.includes('Normalization')).toBe(true);
    });

    test('Demo Step 10: Phone to laptop handoff synchronizes state without surveillance', () => {
      const bridge = new window.BridgeEngine();
      const sessionData = {
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
        status: 'active',
      };

      const handoff = bridge.initiateHandoff(sessionData, 'laptop');
      expect(bridge.getStage()).toBe('AUTHENTICATED_SYNC');
      expect(handoff.session.contextName).toBe('DBMS');

      const received = bridge.receiveHandoff({ targetDevice: 'laptop' });
      expect(bridge.getStage()).toBe('LAPTOP_SESSION_READY');
      expect(received.session.lastStep).toBe('Q5');
      expect(!('openTabs' in received)).toBe(true);
    });

    test('Demo Step 11: ECHOSHIELD Privacy Center enforces zero raw retention', () => {
      const gate = new window.PrivacyPolicyGate();
      const perms = gate.getPermissions();

      expect(perms.rawAudioRetention).toBe(false);
      expect(perms.rawVideoRetention).toBe(false);
      expect(perms.desktopInspectionAllowed).toBe(false);
      expect(perms.silentInventoryAllowed).toBe(false);
    });

  });
})();
