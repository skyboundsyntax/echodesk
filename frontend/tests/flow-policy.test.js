/**
 * ECHODESK — Stage 5: Adaptive Intervention Policy & Flow Engine Tests
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Session status, elapsed active time, presence signals, and user preferences as inputs
 * - Outputs: STAY_SILENT, SHOW_FLOW_STATUS, OFFER_CHECKIN, ASK_PAUSE
 * - Active session + high engagement + non-urgent check-in -> STAY_SILENT
 * - Natural pause / due check-in -> OFFER_CHECKIN (Water, Look Away, Breathing, Stretch)
 * - Absence past grace period -> ASK_PAUSE
 * - Absence within grace period -> STAY_SILENT
 * - Pomodoro 25-minute boundary strictly protects flow (no forced break)
 * - Interruption preferences: minimal (45m/quiet), balanced (30m), frequent (15m)
 * - Policy explainability ("Why didn't you remind me?", "Why did you pause?")
 * - Product flow-support disclaimer (never claims psychological/medical flow measurement)
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { FlowEngine, FlowDecision, CheckInType } = isNode
    ? require('../js/engines/flow-engine.js')
    : window;
  const { WorkSession, WorkSessionState } = isNode
    ? require('../js/core/session-state.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 5 — Adaptive Intervention Policy: Product Flow Engine', () => {
    test('FlowEngine exposes non-medical product flow disclaimer', () => {
      exp(typeof FlowEngine.DISCLAIMER).toBe('string');
      exp(FlowEngine.DISCLAIMER.includes('does not claim psychological or medical')).toBe(true);
    });

    test('Non-active sessions always result in STAY_SILENT', () => {
      const engine = new FlowEngine();

      const idleResult = engine.evaluate({ sessionState: WorkSessionState.IDLE, activeDurationMs: 0 });
      exp(idleResult.decision).toBe(FlowDecision.STAY_SILENT);

      const pausedResult = engine.evaluate({ sessionState: WorkSessionState.PAUSED, activeDurationMs: 600000 });
      exp(pausedResult.decision).toBe(FlowDecision.STAY_SILENT);

      const endedResult = engine.evaluate({ sessionState: WorkSessionState.ENDED, activeDurationMs: 1200000 });
      exp(endedResult.decision).toBe(FlowDecision.STAY_SILENT);

      const uncertainResult = engine.evaluate({ sessionState: WorkSessionState.UNCERTAIN, activeDurationMs: 300000 });
      exp(uncertainResult.decision).toBe(FlowDecision.STAY_SILENT);
    });

    test('Active session with normal engaged duration stays silent', () => {
      const engine = new FlowEngine();
      const baseTime = 1700000000000;

      const result = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 10 * 60 * 1000, // 10 minutes
        presenceSignal: 'PRESENT',
        now: baseTime,
        lastInterventionAt: baseTime,
      });

      exp(result.decision).toBe(FlowDecision.STAY_SILENT);
      exp(result.flowProtected).toBe(true);
    });

    test('At 25m Pomodoro threshold, flow is protected and breaks are NOT forced', () => {
      const engine = new FlowEngine();
      const baseTime = 1700000000000;

      // Exactly 25 minutes elapsed
      const result = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 25 * 60 * 1000,
        presenceSignal: 'PRESENT',
        now: baseTime + 25 * 60 * 1000,
        lastInterventionAt: baseTime,
        preference: 'minimal',
      });

      exp(result.decision).toBe(FlowDecision.SHOW_FLOW_STATUS);
      exp(result.flowProtected).toBe(true);
      exp(result.reason.includes('Flow protected')).toBe(true);
      exp(result.reason.includes('25m reached')).toBe(true);
    });

    test('Absence signal within grace period remains STAY_SILENT', () => {
      const engine = new FlowEngine({ absenceGracePeriodMs: 12000 });
      const baseTime = 1700000000000;

      // First absent tick
      const tick1 = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 500000,
        presenceSignal: 'ABSENT',
        now: baseTime,
      });
      exp(tick1.decision).toBe(FlowDecision.STAY_SILENT);
      exp(tick1.reason.includes('grace period')).toBe(true);

      // 6 seconds later (still within 12s grace period)
      const tick2 = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 506000,
        presenceSignal: 'ABSENT',
        now: baseTime + 6000,
      });
      exp(tick2.decision).toBe(FlowDecision.STAY_SILENT);
      exp(tick2.reason.includes('grace period')).toBe(true);
    });

    test('Absence signal exceeding grace period triggers ASK_PAUSE', () => {
      const engine = new FlowEngine({ absenceGracePeriodMs: 12000 });
      const baseTime = 1700000000000;

      // Start absence
      engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 500000,
        presenceSignal: 'ABSENT',
        now: baseTime,
      });

      // 13 seconds later (exceeds 12s grace period)
      const tickLate = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 513000,
        presenceSignal: 'ABSENT',
        now: baseTime + 13000,
      });

      exp(tickLate.decision).toBe(FlowDecision.ASK_PAUSE);
      exp(tickLate.prompt.includes('Pause session?')).toBe(true);
      exp(tickLate.reason.includes('exceeding grace period')).toBe(true);
    });

    test('Presence signal returning to PRESENT resets absence tracking', () => {
      const engine = new FlowEngine({ absenceGracePeriodMs: 12000 });
      const baseTime = 1700000000000;

      // Absent at t=0
      engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 500000,
        presenceSignal: 'ABSENT',
        now: baseTime,
      });

      // Present at t=5s
      const tickPresent = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 505000,
        presenceSignal: 'PRESENT',
        now: baseTime + 5000,
      });
      exp(tickPresent.decision).toBe(FlowDecision.STAY_SILENT);

      // Step away again at t=10s: timer restarts from scratch!
      const tickAbsentAgain = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 510000,
        presenceSignal: 'ABSENT',
        now: baseTime + 10000,
      });
      exp(tickAbsentAgain.decision).toBe(FlowDecision.STAY_SILENT);
      exp(tickAbsentAgain.reason.includes('grace period')).toBe(true);
    });

    test('User intervention preferences: minimal, balanced, frequent intervals', () => {
      const engine = new FlowEngine();
      const baseTime = 1700000000000;

      // 1. Minimal: silent under 45m
      const minEarly = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 20 * 60 * 1000,
        presenceSignal: 'PRESENT',
        preference: 'minimal',
        now: baseTime + 20 * 60 * 1000,
        lastInterventionAt: baseTime,
      });
      exp(minEarly.decision).toBe(FlowDecision.STAY_SILENT);

      // Minimal: offers reset at 45m
      const minDue = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 46 * 60 * 1000,
        presenceSignal: 'PRESENT',
        preference: 'minimal',
        now: baseTime + 46 * 60 * 1000,
        lastInterventionAt: baseTime,
      });
      exp(minDue.decision).toBe(FlowDecision.OFFER_CHECKIN);
      exp(minDue.checkIn).toBeDefined();

      // 2. Balanced: offers reset at 30m
      const balDue = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 31 * 60 * 1000,
        presenceSignal: 'PRESENT',
        preference: 'balanced',
        now: baseTime + 31 * 60 * 1000,
        lastInterventionAt: baseTime,
      });
      exp(balDue.decision).toBe(FlowDecision.OFFER_CHECKIN);

      // 3. Frequent: offers reset at 15m
      const freqDue = engine.evaluate({
        sessionState: WorkSessionState.ACTIVE,
        activeDurationMs: 16 * 60 * 1000,
        presenceSignal: 'PRESENT',
        preference: 'frequent',
        now: baseTime + 16 * 60 * 1000,
        lastInterventionAt: baseTime,
      });
      exp(freqDue.decision).toBe(FlowDecision.OFFER_CHECKIN);
    });

    test('Check-ins cycle through 4 gentle wellness resets', () => {
      const engine = new FlowEngine();

      const c1 = engine.getNextCheckIn();
      exp(c1.id).toBe('water');
      exp(c1.icon).toBe('💧');

      const c2 = engine.getNextCheckIn();
      exp(c2.id).toBe('look_away');
      exp(c2.icon).toBe('👀');

      const c3 = engine.getNextCheckIn();
      exp(c3.id).toBe('breath');
      exp(c3.icon).toBe('🫁');

      const c4 = engine.getNextCheckIn();
      exp(c4.id).toBe('stretch');
      exp(c4.icon).toBe('🧘');

      // Cycles back to first
      const c5 = engine.getNextCheckIn();
      exp(c5.id).toBe('water');
    });

    test('Transparent policy explainability without hallucination', () => {
      const engine = new FlowEngine();
      engine.setPreference('minimal');

      const explainQuiet = engine.explainDecision("Why didn't you remind me?");
      exp(explainQuiet.topic).toBe('INTERVENTION_DECISION');
      exp(explainQuiet.explanation.includes('minimal')).toBe(true);
      exp(explainQuiet.explanation.includes('protects your flow')).toBe(true);

      const explainPause = engine.explainDecision('Why did you pause?');
      exp(explainPause.topic).toBe('PAUSE_DECISION');
      exp(explainPause.explanation.includes('grace period')).toBe(true);

      const explainPomodoro = engine.explainDecision('What is your 25m pomodoro policy?');
      exp(explainPomodoro.topic).toBe('POMODORO_POLICY');
      exp(explainPomodoro.explanation.includes('Flow protected')).toBe(true);
    });
  });
})();
