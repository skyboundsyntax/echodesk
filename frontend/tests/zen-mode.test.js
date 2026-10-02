/**
 * ECHODESK — Stage 3: Zen Mode Focus Tests
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Minimal UI state binding
 * - Session state integrity across Zen Mode entry and exit
 * - Pause, resume, and stop controls inside Zen Mode
 * - 25-minute Pomodoro threshold strictly protects flow ("Flow protected — JOT is staying quiet")
 * - No forced breaks at timer boundaries
 * - Zero unauthorized camera/microphone activation
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { WorkSession, WorkSessionState } = isNode
    ? require('../js/core/session-state.js')
    : window;
  const { FlowEngine, FlowDecision } = isNode
    ? require('../js/engines/flow-engine.js')
    : window;
  const { PrivacyPolicyGate } = isNode
    ? require('../js/engines/privacy-gate.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 3 — Zen Mode: Real Session State Binding', () => {
    test('Zen Mode binds real WorkSession state and context cleanly', () => {
      const session = new WorkSession();
      session.start('DBMS', { topic: 'Normalization', lastStep: 'Q5', mode: 'zen' });

      exp(session.state).toBe(WorkSessionState.ACTIVE);
      exp(session.contextName).toBe('DBMS');
      exp(session.topic).toBe('Normalization');
      exp(session.lastStep).toBe('Q5');
      exp(session.mode).toBe('zen');
    });

    test('Session state and duration remain consistent across Zen entry and exit', async () => {
      const session = new WorkSession();
      session.start('DBMS', { mode: 'standard' });

      // Simulate work in standard workspace
      await new Promise((r) => setTimeout(r, 25));
      const durBeforeZen = session.getActiveDurationMs();
      exp(durBeforeZen).toBeGreaterThanOrEqual(20);

      // User enters Zen Mode
      session.mode = 'zen';
      exp(session.state).toBe(WorkSessionState.ACTIVE);

      // Time continues accumulating in Zen Mode
      await new Promise((r) => setTimeout(r, 25));
      const durInZen = session.getActiveDurationMs();
      exp(durInZen).toBeGreaterThan(durBeforeZen);

      // User exits Zen Mode back to standard workspace
      session.mode = 'standard';
      exp(session.state).toBe(WorkSessionState.ACTIVE);
      exp(session.getActiveDurationMs()).toBeGreaterThanOrEqual(durInZen);
    });
  });

  desc('Stage 3 — Zen Mode: Pause & Resume Controls', () => {
    test('Pausing within Zen Mode freezes active duration', async () => {
      const session = new WorkSession();
      session.start('DBMS', { mode: 'zen' });
      await new Promise((r) => setTimeout(r, 30));

      session.pause('User paused in Zen');
      exp(session.state).toBe(WorkSessionState.PAUSED);

      const pausedDuration = session.getActiveDurationMs();
      await new Promise((r) => setTimeout(r, 25));

      // Duration must remain completely frozen while paused
      exp(session.getActiveDurationMs()).toBe(pausedDuration);
    });

    test('Resuming within Zen Mode restarts accumulation without resetting base time', async () => {
      const session = new WorkSession();
      session.start('DBMS', { mode: 'zen' });
      await new Promise((r) => setTimeout(r, 25));
      session.pause('Stepped away');
      const frozen = session.getActiveDurationMs();

      session.resume('Resumed in Zen');
      exp(session.state).toBe(WorkSessionState.ACTIVE);
      await new Promise((r) => setTimeout(r, 25));

      exp(session.getActiveDurationMs()).toBeGreaterThan(frozen);
    });

    test('Stopping from Zen Mode marks ENDED and commits final active duration', async () => {
      const session = new WorkSession();
      session.start('DBMS', { mode: 'zen' });
      await new Promise((r) => setTimeout(r, 25));

      session.stop('User completed session in Zen');
      exp(session.state).toBe(WorkSessionState.ENDED);
      exp(session.endTime).toBeTruthy();
      exp(session.activeDurationMs).toBeGreaterThanOrEqual(20);
    });
  });

  desc('Stage 3 — Zen Mode: Flow Protection at Pomodoro Threshold', () => {
    test('At 25 minutes (Pomodoro boundary), JOT stays quiet and protects flow', () => {
      const flow = new FlowEngine();
      flow.setPreference('minimal');

      // Test exactly at 25-minute Pomodoro boundary (1,500,000 ms)
      const evaluation = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 25 * 60 * 1000,
        presenceSignal: 'PRESENT',
      });

      // Crucial: Must NOT force a break! Must NOT interrupt active work!
      exp(evaluation.decision).toBe(FlowDecision.SHOW_FLOW_STATUS);
      exp(evaluation.flowProtected).toBe(true);
      exp(evaluation.reason.includes('Flow protected')).toBe(true);
      exp(evaluation.reason.includes('JOT is staying quiet')).toBe(true);
    });

    test('Past 25 minutes (e.g. 42 minutes), JOT continues protecting flow', () => {
      const flow = new FlowEngine();
      flow.setPreference('minimal');

      const evaluation = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 42 * 60 * 1000 + 18000, // 42m 18s
        presenceSignal: 'PRESENT',
      });

      exp(evaluation.decision).toBe(FlowDecision.SHOW_FLOW_STATUS);
      exp(evaluation.flowProtected).toBe(true);
    });
  });

  desc('Stage 3 — Zen Mode: Sensor Isolation & Zero Default Surveillance', () => {
    test('Zen Mode does not activate camera or microphone by default', () => {
      const gate = new PrivacyPolicyGate();
      const perms = gate.getPermissions();

      // Camera is explicitly OFF by default until user specifically opts in
      exp(perms.cameraEnabled).toBe(false);
      exp(perms.rawAudioRetention).toBe(false);
      exp(perms.rawVideoRetention).toBe(false);
      exp(perms.desktopInspectionAllowed).toBe(false);
    });
  });
})();
