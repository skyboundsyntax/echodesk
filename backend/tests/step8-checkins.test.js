/**
 * ECHODESK Backend Test Suite — Step 8: Smart Check-Ins & Intervention Engine
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Gentle, context-aware check-ins (hydration, look away, three breaths, movement reset)
 * - FlowEngine decision: high engagement + non-urgent check-in -> STAY_SILENT
 * - FlowEngine decision: natural pause detected -> OFFER_CHECKIN
 * - User preferences: minimal (45m/quiet), balanced (30m), frequent (15m)
 * - Natural language command: "JOT, less reminders" -> SET_INTERVENTION_PREFERENCE minimal
 * - User intervention response recording (accepted / dismissed)
 */

const assert = require('assert');
const { FlowEngine, FlowDecision, CheckInType } = require('../engines/flow-engine.js');
const { IntentEngine } = require('../engines/intent-engine.js');

async function runStep8Tests() {
  console.log('==========================================================');
  console.log(' ECHODESK Step 8: Smart Check-Ins & Preferences Verifier  ');
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

  // 1. Verify 4 Gentle Check-In Types
  console.log('1. Testing Gentle Context-Aware Check-In Types...');
  test('CheckInType contains hydration (WATER)', () => {
    assert(CheckInType.WATER, 'WATER checkin exists');
    assert(CheckInType.WATER.id === 'water', 'water id matches');
    assert(CheckInType.WATER.icon.includes('💧'), 'hydration icon matches');
  });

  test('CheckInType contains look away (LOOK_AWAY)', () => {
    assert(CheckInType.LOOK_AWAY, 'LOOK_AWAY checkin exists');
    assert(CheckInType.LOOK_AWAY.id === 'look_away', 'look_away id matches');
    assert(CheckInType.LOOK_AWAY.icon.includes('👀'), 'look away icon matches');
  });

  test('CheckInType contains three breaths (BREATH)', () => {
    assert(CheckInType.BREATH, 'BREATH checkin exists');
    assert(CheckInType.BREATH.id === 'breath', 'breath id matches');
    assert(CheckInType.BREATH.icon.includes('🫁'), 'breath icon matches');
  });

  test('CheckInType contains short movement reset (MOVEMENT / STRETCH)', () => {
    assert(CheckInType.MOVEMENT || CheckInType.STRETCH, 'MOVEMENT checkin exists');
    const move = CheckInType.MOVEMENT || CheckInType.STRETCH;
    assert(move.id === 'movement', 'movement id matches');
    assert(move.title.toLowerCase().includes('movement') || move.title.toLowerCase().includes('posture'), 'movement title matches');
  });

  // 2. Testing FlowEngine Decision Rules
  console.log('\n2. Testing FlowEngine Interruption Decisions...');
  test('High engagement + non-urgent check-in -> STAY_SILENT', () => {
    const flow = new FlowEngine({ preference: 'minimal' });
    const res = flow.evaluate({
      sessionState: 'ACTIVE',
      activeDurationMs: 600000, // 10 minutes in
      highEngagement: true,
      urgentCheckIn: false,
    });
    assert.strictEqual(res.decision, FlowDecision.STAY_SILENT);
    assert(res.flowProtected === true, 'Flow is flagged as protected');
    assert(res.reason.includes('Active flow-support is high'), 'Explains high flow protection');
  });

  test('Natural pause detected -> OFFER_CHECKIN', () => {
    const flow = new FlowEngine({ preference: 'minimal' });
    const res = flow.evaluate({
      sessionState: 'ACTIVE',
      activeDurationMs: 600000,
      naturalPause: true,
    });
    assert.strictEqual(res.decision, FlowDecision.OFFER_CHECKIN);
    assert(res.checkIn, 'Check-in object provided');
    assert(res.reason.includes('Natural pause detected'), 'Reason notes natural pause');
  });

  test('Natural pause during paused session -> OFFER_CHECKIN', () => {
    const flow = new FlowEngine({ preference: 'minimal' });
    const res = flow.evaluate({
      sessionState: 'PAUSED',
      naturalPause: true,
    });
    assert.strictEqual(res.decision, FlowDecision.OFFER_CHECKIN);
    assert(res.checkIn, 'Check-in payload provided');
  });

  // 3. User Interruption Preferences
  console.log('\n3. Testing User Interruption Preferences...');
  test('FlowEngine defaults to minimal preference (quietest / 45m)', () => {
    const flow = new FlowEngine();
    assert.strictEqual(flow.getPreference(), 'minimal');
    const info = flow.getPolicyInfo();
    assert.strictEqual(info.intervalsMs.minimal, 45 * 60 * 1000);
  });

  test('setPreference supports minimal, balanced, and frequent', () => {
    const flow = new FlowEngine();
    assert(flow.setPreference('balanced'), 'set balanced succeeds');
    assert.strictEqual(flow.getPreference(), 'balanced');

    assert(flow.setPreference('frequent'), 'set frequent succeeds');
    assert.strictEqual(flow.getPreference(), 'frequent');

    assert(flow.setPreference('minimal'), 'set minimal succeeds');
    assert.strictEqual(flow.getPreference(), 'minimal');

    // Invalid preference rejected
    assert(!flow.setPreference('hyperactive'), 'invalid preference rejected');
    assert.strictEqual(flow.getPreference(), 'minimal');
  });

  test('Frequent preference triggers check-in after 15 minutes of uninterrupted work', () => {
    const flow = new FlowEngine({ preference: 'frequent' });
    const baseTime = 1700000000000;

    // 10 minutes in -> STAY_SILENT
    const res1 = flow.evaluate({
      sessionState: 'ACTIVE',
      activeDurationMs: 10 * 60 * 1000,
      now: baseTime + (10 * 60 * 1000),
      lastInterventionAt: baseTime,
    });
    assert.strictEqual(res1.decision, FlowDecision.STAY_SILENT);

    // 16 minutes in -> OFFER_CHECKIN
    const res2 = flow.evaluate({
      sessionState: 'ACTIVE',
      activeDurationMs: 16 * 60 * 1000,
      now: baseTime + (16 * 60 * 1000),
      lastInterventionAt: baseTime,
    });
    assert.strictEqual(res2.decision, FlowDecision.OFFER_CHECKIN);
    assert(res2.checkIn, 'Checkin provided');
  });

  test('Cyclical rotation through check-in catalog', () => {
    const flow = new FlowEngine();
    const c1 = flow.getNextCheckIn();
    const c2 = flow.getNextCheckIn();
    const c3 = flow.getNextCheckIn();
    const c4 = flow.getNextCheckIn();
    const c5 = flow.getNextCheckIn();

    assert.notStrictEqual(c1.id, c2.id);
    assert.notStrictEqual(c2.id, c3.id);
    assert.notStrictEqual(c3.id, c4.id);
    assert.strictEqual(c1.id, c5.id, 'Cycles back to first checkin after queue exhausted');
  });

  test('recordInterventionResponse updates last intervention timestamp', () => {
    const flow = new FlowEngine();
    const ts = 1700000500000;
    const res = flow.recordInterventionResponse('accepted', ts);
    assert.strictEqual(res.response, 'accepted');
    assert.strictEqual(flow.lastInterventionAt, ts);
  });

  // 4. Natural Voice/Text Command Parsing
  console.log('\n4. Testing Natural Command: "JOT, less reminders"...');
  await testAsync('Intent engine parses "JOT, less reminders" to minimal preference', async () => {
    const engine = new IntentEngine();
    const res = await engine.process('JOT, less reminders');
    assert.strictEqual(res.intent, 'SET_INTERVENTION_PREFERENCE');
    assert.strictEqual(res.preference, 'minimal');
  });

  await testAsync('Intent engine parses "JOT, fewer reminders" to minimal preference', async () => {
    const engine = new IntentEngine();
    const res = await engine.process('JOT, fewer reminders');
    assert.strictEqual(res.intent, 'SET_INTERVENTION_PREFERENCE');
    assert.strictEqual(res.preference, 'minimal');
  });

  await testAsync('Intent engine parses "JOT, balanced reminders" to balanced preference', async () => {
    const engine = new IntentEngine();
    const res = await engine.process('JOT, balanced reminders');
    assert.strictEqual(res.intent, 'SET_INTERVENTION_PREFERENCE');
    assert.strictEqual(res.preference, 'balanced');
  });

  await testAsync('Intent engine parses "JOT, more reminders" to frequent preference', async () => {
    const engine = new IntentEngine();
    const res = await engine.process('JOT, more reminders');
    assert.strictEqual(res.intent, 'SET_INTERVENTION_PREFERENCE');
    assert.strictEqual(res.preference, 'frequent');
  });

  // 5. Transparent Explainability
  console.log('\n5. Testing Explainability for Interventions...');
  test('explainDecision explains why JOT stayed quiet or checked in', () => {
    const flow = new FlowEngine({ preference: 'minimal' });
    const exp = flow.explainDecision('why was there no reminder?');
    assert.strictEqual(exp.topic, 'INTERVENTION_DECISION');
    assert(exp.explanation.includes('minimal'), 'Mentions current preference');
    assert(exp.explanation.includes('protects your flow'), 'Explains flow protection');
  });

  console.log('\n==========================================================');
  console.log(` Step 8 Summary: ${passed} PASSED, ${failed} FAILED `);
  console.log('==========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep8Tests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
