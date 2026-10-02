/**
 * ECHODESK — Stage 8: Smart Check-Ins & Flow Intervention Test Suite
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Gentle, context-aware check-ins (hydration, look away, three breaths, short movement reset)
 * - FlowEngine decision: high engagement + non-urgent check-in -> STAY_SILENT
 * - FlowEngine decision: natural pause detected -> OFFER_CHECKIN
 * - User preferences: minimal, balanced, frequent
 * - Natural command: "JOT, less reminders."
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { FlowEngine, FlowDecision, CheckInType } = isNode
    ? require('../js/engines/flow-engine.js')
    : window;
  const { IntentEngine } = isNode
    ? require('../js/engines/intent-engine.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 8 — Smart Check-Ins & Flow Intervention Policy', () => {
    test('Check-in types cover 4 gentle reset categories', () => {
      exp(CheckInType.WATER).toBeDefined();
      exp(CheckInType.WATER.id).toBe('water');

      exp(CheckInType.LOOK_AWAY).toBeDefined();
      exp(CheckInType.LOOK_AWAY.id).toBe('look_away');

      exp(CheckInType.BREATH).toBeDefined();
      exp(CheckInType.BREATH.id).toBe('breath');

      const move = CheckInType.MOVEMENT || CheckInType.STRETCH;
      exp(move).toBeDefined();
      exp(move.id).toBe('movement');
    });

    test('Active flow-support high + non-urgent check-in -> STAY_SILENT', () => {
      const flow = new FlowEngine({ preference: 'minimal' });
      const res = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 600000,
        highEngagement: true,
        urgentCheckIn: false,
      });

      exp(res.decision).toBe(FlowDecision.STAY_SILENT);
      exp(res.flowProtected).toBe(true);
      exp(res.reason.includes('Active flow-support is high')).toBe(true);
    });

    test('Natural pause detected -> OFFER_CHECKIN', () => {
      const flow = new FlowEngine({ preference: 'minimal' });
      const res = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 600000,
        naturalPause: true,
      });

      exp(res.decision).toBe(FlowDecision.OFFER_CHECKIN);
      exp(res.checkIn).toBeDefined();
      exp(res.reason.includes('Natural pause detected')).toBe(true);
    });

    test('Interruption preference defaults to minimal (45m/quiet)', () => {
      const flow = new FlowEngine();
      exp(flow.getPreference()).toBe('minimal');
      exp(flow.getPolicyInfo().intervalsMs.minimal).toBe(45 * 60 * 1000);
    });

    test('Preferences can be toggled: minimal, balanced, frequent', () => {
      const flow = new FlowEngine();
      flow.setPreference('balanced');
      exp(flow.getPreference()).toBe('balanced');

      flow.setPreference('frequent');
      exp(flow.getPreference()).toBe('frequent');

      flow.setPreference('minimal');
      exp(flow.getPreference()).toBe('minimal');
    });

    test('Frequent preference fires check-in at 15m threshold', () => {
      const flow = new FlowEngine({ preference: 'frequent' });
      const base = 1700000000000;

      const res = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 16 * 60 * 1000,
        now: base + 16 * 60 * 1000,
        lastInterventionAt: base,
      });

      exp(res.decision).toBe(FlowDecision.OFFER_CHECKIN);
      exp(res.checkIn).toBeDefined();
    });

    test('Cyclical rotation through check-ins with response tracking', () => {
      const flow = new FlowEngine();
      const first = flow.getNextCheckIn();
      flow.recordInterventionResponse('accepted');
      const second = flow.getNextCheckIn();
      exp(first.id).not.toBe(second.id);
    });

    test('Intent Engine parses "JOT, less reminders" to minimal preference', async () => {
      const engine = new IntentEngine();
      const res = await engine.process('JOT, less reminders');
      exp(res.intent).toBe('SET_INTERVENTION_PREFERENCE');
      exp(res.preference).toBe('minimal');
    });

    test('Intent Engine parses "JOT, more reminders" to frequent preference', async () => {
      const engine = new IntentEngine();
      const res = await engine.process('JOT, more reminders');
      exp(res.intent).toBe('SET_INTERVENTION_PREFERENCE');
      exp(res.preference).toBe('frequent');
    });
  });
})();
