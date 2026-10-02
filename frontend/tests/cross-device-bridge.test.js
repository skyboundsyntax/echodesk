/**
 * ECHODESK — Stage 10: Cross-Device Bridge & Session Continuity Test Suite
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Natural request: "JOT, continue DBMS on laptop."
 * - Minimal structured session state synchronization (no desktop surveillance)
 * - Pipeline progression: PHONE -> HANDOFF REQUEST -> AUTHENTICATED SYNC -> LAPTOP SESSION READY
 * - Failure handling:
 *   - unauthorized device
 *   - expired session
 *   - malformed payload
 *   - offline state
 * - Bridge synchronizes state, not surveillance
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { BridgeEngine, BridgeStage, BridgeErrorCode } = isNode
    ? require('../js/engines/bridge-engine.js')
    : window;
  const { IntentEngine } = isNode
    ? require('../js/engines/intent-engine.js')
    : window;
  const { PrivacyPolicyGate } = isNode
    ? require('../js/engines/privacy-gate.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 10 — Cross-Device Bridge & Continuity', () => {
    test('NLP command: "JOT, continue DBMS on laptop" parses to REQUEST_HANDOFF', async () => {
      const engine = new IntentEngine();
      const res = await engine.process('JOT, continue DBMS on laptop');
      exp(res.intent).toBe('REQUEST_HANDOFF');
      exp(res.targetDevice).toBe('laptop');
      exp(res.contextName).toBe('DBMS');
    });

    test('Handoff requires explicit user request in PrivacyPolicyGate', () => {
      const gate = new PrivacyPolicyGate();
      const resDeny = gate.evaluate('CROSS_DEVICE_HANDOFF', { explicitUserRequest: false });
      exp(resDeny.allowed).toBe(false);
      exp(resDeny.code).toBe('DENY_IMPLICIT_BRIDGE');

      const resAllow = gate.evaluate('CROSS_DEVICE_HANDOFF', { explicitUserRequest: true });
      exp(resAllow.allowed).toBe(true);
      exp(resAllow.code).toBe('ALLOW_EXPLICIT_BRIDGE');
    });

    test('Synchronizes structured session state only (zero screen/tab inspection)', () => {
      const bridge = new BridgeEngine();
      const session = {
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
        activeDurationMs: 120000,
      };

      const payload = bridge.initiateHandoff(session, 'laptop');
      exp(payload.session.contextName).toBe('DBMS');
      exp(payload.session.topic).toBe('Normalization');
      exp(payload.openWindows).toBeUndefined();
      exp(payload.browserTabs).toBeUndefined();
      exp(payload.screenContent).toBeUndefined();
    });

    test('Pipeline progression transitions through defined stages', () => {
      const bridge = new BridgeEngine();
      exp(bridge.getStage()).toBe(BridgeStage.PHONE);

      bridge.initiateHandoff({ contextName: 'DBMS' }, 'laptop');
      exp(bridge.getStage()).toBe(BridgeStage.AUTHENTICATED_SYNC);

      const received = bridge.receiveHandoff();
      exp(bridge.getStage()).toBe(BridgeStage.LAPTOP_SESSION_READY);
      exp(received.session.contextName).toBe('DBMS');

      bridge.clearHandoff();
      exp(bridge.getStage()).toBe(BridgeStage.PHONE);
    });

    test('Failure handling: Unauthorized device rejected', () => {
      const bridge = new BridgeEngine();
      const bad = {
        handoffId: 'h1',
        timestamp: Date.now(),
        targetDevice: 'rogue_spy_laptop',
        session: { contextName: 'DBMS' },
      };

      const val = bridge.validatePayload(bad);
      exp(val.valid).toBe(false);
      exp(val.error.code).toBe(BridgeErrorCode.UNAUTHORIZED_DEVICE);
    });

    test('Failure handling: Expired session rejected', () => {
      const bridge = new BridgeEngine({ sessionTtlMs: 60000 });
      const now = 1700000000000;
      const expired = {
        handoffId: 'h2',
        timestamp: now - 120000,
        targetDevice: 'laptop',
        session: { contextName: 'DBMS' },
      };

      const val = bridge.validatePayload(expired, { now });
      exp(val.valid).toBe(false);
      exp(val.error.code).toBe(BridgeErrorCode.EXPIRED_SESSION);
    });

    test('Failure handling: Malformed payload rejected', () => {
      const bridge = new BridgeEngine();
      const malformed = {
        handoffId: 'h3',
        session: null,
      };

      const val = bridge.validatePayload(malformed);
      exp(val.valid).toBe(false);
      exp(val.error.code).toBe(BridgeErrorCode.MALFORMED_PAYLOAD);
    });

    test('Failure handling: Offline state rejected', () => {
      const bridge = new BridgeEngine();
      const payload = {
        handoffId: 'h4',
        timestamp: Date.now(),
        targetDevice: 'laptop',
        session: { contextName: 'DBMS' },
      };

      const val = bridge.validatePayload(payload, { isOffline: true });
      exp(val.valid).toBe(false);
      exp(val.error.code).toBe(BridgeErrorCode.OFFLINE_STATE);
    });
  });
})();
