/**
 * ECHODESK Backend Test Suite — Step 10: Cross-Device Bridge & Session Continuity
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

const assert = require('assert');
const { BridgeEngine, BridgeStage, BridgeErrorCode } = require('../engines/bridge-engine.js');
const { IntentEngine } = require('../engines/intent-engine.js');
const { PrivacyPolicyGate, PolicyActionType } = require('../core/privacy-gate.js');

async function runStep10Tests() {
  console.log('==========================================================');
  console.log(' ECHODESK Step 10: Cross-Device Bridge Verifier           ');
  console.log('==========================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Natural Command Parsing: "JOT, continue DBMS on laptop."
  console.log('1. Testing Natural NLP Command Parsing...');
  await testAsync('IntentEngine parses "JOT, continue DBMS on laptop" into REQUEST_HANDOFF', async () => {
    const engine = new IntentEngine();
    const res = await engine.process('JOT, continue DBMS on laptop');
    assert.strictEqual(res.intent, 'REQUEST_HANDOFF');
    assert.strictEqual(res.targetDevice, 'laptop');
    assert.strictEqual(res.contextName, 'DBMS');
  });

  await testAsync('IntentEngine parses "continue on laptop" using active session context', async () => {
    const engine = new IntentEngine();
    const session = { contextName: 'Algorithms', topic: 'Dynamic Programming' };
    const res = await engine.process('JOT, continue on laptop', session);
    assert.strictEqual(res.intent, 'REQUEST_HANDOFF');
    assert.strictEqual(res.targetDevice, 'laptop');
    assert.strictEqual(res.contextName, 'Algorithms');
  });

  // 2. Structured State Handoff (Zero Desktop Surveillance)
  console.log('\n2. Testing Structured Handoff & Privacy Gate Enforcement...');
  test('Bridge requires explicit user request in privacy policy gate', () => {
    const gate = new PrivacyPolicyGate();
    const evalDeny = gate.evaluate(PolicyActionType.CROSS_DEVICE_HANDOFF, { explicitUserRequest: false });
    assert.strictEqual(evalDeny.allowed, false);
    assert.strictEqual(evalDeny.code, 'DENY_IMPLICIT_BRIDGE');

    const evalAllow = gate.evaluate(PolicyActionType.CROSS_DEVICE_HANDOFF, { explicitUserRequest: true });
    assert.strictEqual(evalAllow.allowed, true);
    assert.strictEqual(evalAllow.code, 'ALLOW_EXPLICIT_BRIDGE');
  });

  test('Handoff synchronizes structured work context only without screen or application data', () => {
    const gate = new PrivacyPolicyGate();
    const bridge = new BridgeEngine({ privacyGate: gate });
    const sessionData = {
      id: 'sess_123',
      contextName: 'DBMS',
      topic: 'Normalization',
      lastStep: 'Q5',
      nextAction: 'Continue Q5',
      status: 'active',
      activeDurationMs: 42 * 60 * 1000,
      formattedDuration: '42:00',
    };

    const payload = bridge.initiateHandoff(sessionData, 'laptop');
    assert(payload.handoffId, 'handoffId generated');
    assert.strictEqual(payload.session.contextName, 'DBMS');
    assert.strictEqual(payload.session.topic, 'Normalization');
    assert.strictEqual(payload.session.activeDurationMs, 42 * 60 * 1000);

    // Verify zero surveillance artifacts exist in payload
    assert.strictEqual(payload.openWindows, undefined, 'No openWindows collected');
    assert.strictEqual(payload.browserTabs, undefined, 'No browserTabs collected');
    assert.strictEqual(payload.screenshots, undefined, 'No screenshots collected');
    assert.strictEqual(payload.privateFiles, undefined, 'No privateFiles collected');
  });

  // 3. Pipeline Stepper Progression
  console.log('\n3. Testing Pipeline Stepper Progression...');
  test('Pipeline progresses: PHONE -> HANDOFF_REQUEST -> AUTHENTICATED_SYNC -> LAPTOP_SESSION_READY', () => {
    const bridge = new BridgeEngine();
    assert.strictEqual(bridge.getStage(), BridgeStage.PHONE);

    bridge.initiateHandoff({ contextName: 'DBMS' }, 'laptop');
    assert.strictEqual(bridge.getStage(), BridgeStage.AUTHENTICATED_SYNC);

    const received = bridge.receiveHandoff();
    assert.strictEqual(bridge.getStage(), BridgeStage.LAPTOP_SESSION_READY);
    assert(received, 'Payload received successfully');

    bridge.clearHandoff();
    assert.strictEqual(bridge.getStage(), BridgeStage.PHONE);
  });

  // 4. Failure Handling
  console.log('\n4. Testing Bridge Failure Handling...');
  test('Failure: Unauthorized Device is rejected with UNAUTHORIZED_DEVICE', () => {
    const bridge = new BridgeEngine();
    const badPayload = {
      handoffId: 'hoff_unauth',
      timestamp: Date.now(),
      targetDevice: 'untrusted_alien_device',
      session: { contextName: 'DBMS' },
    };

    const val = bridge.validatePayload(badPayload);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error.code, BridgeErrorCode.UNAUTHORIZED_DEVICE);
  });

  test('Failure: Expired Session (> 5m TTL) is rejected with EXPIRED_SESSION', () => {
    const bridge = new BridgeEngine({ sessionTtlMs: 300000 });
    const now = 1700000000000;
    const expiredPayload = {
      handoffId: 'hoff_old',
      timestamp: now - 350000, // 350 seconds old
      targetDevice: 'laptop',
      session: { contextName: 'DBMS' },
    };

    const val = bridge.validatePayload(expiredPayload, { now });
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error.code, BridgeErrorCode.EXPIRED_SESSION);
  });

  test('Failure: Malformed Payload is rejected with MALFORMED_PAYLOAD', () => {
    const bridge = new BridgeEngine();
    // Missing session / empty context
    const malformed = {
      handoffId: 'hoff_bad',
      timestamp: Date.now(),
      targetDevice: 'laptop',
      session: { contextName: '' },
    };

    const val = bridge.validatePayload(malformed);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error.code, BridgeErrorCode.MALFORMED_PAYLOAD);
  });

  test('Failure: Offline state is rejected with OFFLINE_STATE', () => {
    const bridge = new BridgeEngine();
    const payload = {
      handoffId: 'hoff_valid',
      timestamp: Date.now(),
      targetDevice: 'laptop',
      session: { contextName: 'DBMS' },
    };

    const val = bridge.validatePayload(payload, { isOffline: true });
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error.code, BridgeErrorCode.OFFLINE_STATE);
  });

  console.log('\n==========================================================');
  console.log(` Step 10 Summary: ${passed} PASSED, ${failed} FAILED `);
  console.log('==========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep10Tests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
