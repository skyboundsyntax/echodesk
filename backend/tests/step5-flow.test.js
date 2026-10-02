/**
 * ECHODESK Backend — Stage 5: Flow Engine & Intervention Policy Test Suite
 * Validates backend FlowEngine & IntentEngine integration:
 * - Product flow-support disclaimer (no psychological claims)
 * - Deterministic policy evaluations (STAY_SILENT, SHOW_FLOW_STATUS, OFFER_CHECKIN, ASK_PAUSE)
 * - Pomodoro 25-minute boundary flow protection
 * - Absence tracking with 12s grace period
 * - Adaptive preferences (minimal, balanced, frequent)
 * - Policy explainability without hallucination
 * - Intent engine natural language mapping for preferences & explanations
 */

const { FlowEngine, FlowDecision, CheckInType } = require('../engines/flow-engine');
const { IntentEngine, DeterministicLocalProvider } = require('../engines/intent-engine');
const { PrivacyPolicyGate } = require('../core/privacy-gate');
const { WorkSession, WorkSessionState } = require('../core/session-state');

async function runStep5Tests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  console.log('====================================================');
  console.log(' ECHODESK Step 5: Flow & Intervention Policy Tests  ');
  console.log('====================================================\n');

  const engine = new FlowEngine();

  // 1. Disclaimer
  console.log('1. Testing Product Flow-Support Disclaimer...');
  assert(typeof FlowEngine.DISCLAIMER === 'string', 'Disclaimer is a defined string');
  assert(FlowEngine.DISCLAIMER.includes('does not claim psychological or medical'), 'Explicitly disclaims medical/psychological measurement');

  // 2. Non-Active Sessions
  console.log('\n2. Testing Non-Active Sessions...');
  const idleRes = engine.evaluate({ sessionState: WorkSessionState.IDLE });
  assert(idleRes.decision === FlowDecision.STAY_SILENT, 'IDLE session returns STAY_SILENT');

  const pauseRes = engine.evaluate({ sessionState: WorkSessionState.PAUSED });
  assert(pauseRes.decision === FlowDecision.STAY_SILENT, 'PAUSED session returns STAY_SILENT');

  const endRes = engine.evaluate({ sessionState: WorkSessionState.ENDED });
  assert(endRes.decision === FlowDecision.STAY_SILENT, 'ENDED session returns STAY_SILENT');

  // 3. Normal Active Focus
  console.log('\n3. Testing Normal Active Flow...');
  const baseTime = 1700000000000;
  const activeRes = engine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 12 * 60 * 1000,
    presenceSignal: 'PRESENT',
    now: baseTime,
    lastInterventionAt: baseTime,
  });
  assert(activeRes.decision === FlowDecision.STAY_SILENT, 'Normal engaged active session returns STAY_SILENT');
  assert(activeRes.flowProtected === true, 'Flow is marked protected');

  // 4. Pomodoro 25m Threshold Flow Protection
  console.log('\n4. Testing 25-minute Pomodoro Boundary...');
  const pomodoroRes = engine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 25 * 60 * 1000,
    presenceSignal: 'PRESENT',
    now: baseTime + 25 * 60 * 1000,
    lastInterventionAt: baseTime,
    preference: 'minimal',
  });
  assert(pomodoroRes.decision === FlowDecision.SHOW_FLOW_STATUS, '25m threshold returns SHOW_FLOW_STATUS');
  assert(pomodoroRes.flowProtected === true, 'Does NOT force an interruption');
  assert(pomodoroRes.reason.includes('Flow protected'), 'States Flow protected — staying quiet');

  // 5. Absence Detection & Grace Period
  console.log('\n5. Testing Absence Detection with 12s Grace Period...');
  const absenceEngine = new FlowEngine({ absenceGracePeriodMs: 12000 });

  const absentEarly = absenceEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 300000,
    presenceSignal: 'ABSENT',
    now: baseTime,
  });
  assert(absentEarly.decision === FlowDecision.STAY_SILENT, 'Absence within grace period stays silent');

  const absentStillWithin = absenceEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 305000,
    presenceSignal: 'ABSENT',
    now: baseTime + 5000, // 5s elapsed < 12s
  });
  assert(absentStillWithin.decision === FlowDecision.STAY_SILENT, 'Absence at 5s stays silent');

  const absentExceeded = absenceEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 314000,
    presenceSignal: 'ABSENT',
    now: baseTime + 14000, // 14s elapsed >= 12s
  });
  assert(absentExceeded.decision === FlowDecision.ASK_PAUSE, 'Absence exceeding 12s returns ASK_PAUSE');
  assert(absentExceeded.prompt.includes('Pause session?'), 'Prompts user to confirm pause');

  // 6. Presence Return Resets Absence Timer
  console.log('\n6. Testing Presence Return Resets Timer...');
  const returnedPresent = absenceEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 316000,
    presenceSignal: 'PRESENT',
    now: baseTime + 16000,
  });
  assert(returnedPresent.decision === FlowDecision.STAY_SILENT, 'Return to PRESENT returns STAY_SILENT');

  const absentSecondTime = absenceEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 320000,
    presenceSignal: 'ABSENT',
    now: baseTime + 20000,
  });
  assert(absentSecondTime.decision === FlowDecision.STAY_SILENT, 'Subsequent absence restarts grace period from 0');

  // 7. Adaptive Interruption Preferences (Minimal, Balanced, Frequent)
  console.log('\n7. Testing Interruption Preferences...');
  const prefEngine = new FlowEngine();

  // Minimal: 45 min
  const minEarly = prefEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 30 * 60 * 1000,
    presenceSignal: 'PRESENT',
    preference: 'minimal',
    now: baseTime + 30 * 60 * 1000,
    lastInterventionAt: baseTime,
  });
  assert(minEarly.decision === FlowDecision.STAY_SILENT, 'Minimal preference stays silent at 30m');

  const minDue = prefEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 46 * 60 * 1000,
    presenceSignal: 'PRESENT',
    preference: 'minimal',
    now: baseTime + 46 * 60 * 1000,
    lastInterventionAt: baseTime,
  });
  assert(minDue.decision === FlowDecision.OFFER_CHECKIN, 'Minimal preference offers check-in at 45m+');

  // Balanced: 30 min
  const balDue = prefEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 31 * 60 * 1000,
    presenceSignal: 'PRESENT',
    preference: 'balanced',
    now: baseTime + 31 * 60 * 1000,
    lastInterventionAt: baseTime,
  });
  assert(balDue.decision === FlowDecision.OFFER_CHECKIN, 'Balanced preference offers check-in at 30m+');

  // Frequent: 15 min
  const freqDue = prefEngine.evaluate({
    sessionState: WorkSessionState.ACTIVE,
    activeDurationMs: 16 * 60 * 1000,
    presenceSignal: 'PRESENT',
    preference: 'frequent',
    now: baseTime + 16 * 60 * 1000,
    lastInterventionAt: baseTime,
  });
  assert(freqDue.decision === FlowDecision.OFFER_CHECKIN, 'Frequent preference offers check-in at 15m+');

  // 8. Cyclical Check-ins
  console.log('\n8. Testing Check-in Types...');
  const c1 = prefEngine.getNextCheckIn();
  assert(c1.id === 'water' && c1.icon === '💧', 'CheckIn 1 is Water');
  const c2 = prefEngine.getNextCheckIn();
  assert(c2.id === 'look_away' && c2.icon === '👀', 'CheckIn 2 is Look Away');
  const c3 = prefEngine.getNextCheckIn();
  assert(c3.id === 'breath' && c3.icon === '🫁', 'CheckIn 3 is Breathing');
  const c4 = prefEngine.getNextCheckIn();
  assert(c4.id === 'stretch' && c4.icon === '🧘', 'CheckIn 4 is Stretch');

  // 9. Explainability
  console.log('\n9. Testing Transparent Policy Explainability...');
  const expRemind = prefEngine.explainDecision("Why didn't you remind me?");
  assert(expRemind.topic === 'INTERVENTION_DECISION', 'Explains intervention decision');
  assert(expRemind.explanation.includes('protects your flow'), 'Cites focus protection rationale');

  const expPause = prefEngine.explainDecision('Why did you pause?');
  assert(expPause.topic === 'PAUSE_DECISION', 'Explains pause decision');
  assert(expPause.explanation.includes('grace period'), 'Cites grace period rationale');

  // 10. JOT Natural Language Intent Mapping
  console.log('\n10. Testing Natural Language Intent Parsing...');
  const intentEngine = new IntentEngine({
    aiProvider: new DeterministicLocalProvider(),
    privacyGate: new PrivacyPolicyGate(),
  });

  const cmdLess = await intentEngine.process('JOT, less reminders');
  assert(cmdLess.intent === 'SET_INTERVENTION_PREFERENCE' && cmdLess.preference === 'minimal', '"JOT, less reminders" sets minimal preference');

  const cmdBal = await intentEngine.process('JOT, balanced reminders');
  assert(cmdBal.intent === 'SET_INTERVENTION_PREFERENCE' && cmdBal.preference === 'balanced', '"JOT, balanced reminders" sets balanced preference');

  const cmdFreq = await intentEngine.process('JOT, more reminders');
  assert(cmdFreq.intent === 'SET_INTERVENTION_PREFERENCE' && cmdFreq.preference === 'frequent', '"JOT, more reminders" sets frequent preference');

  const cmdExpRemind = await intentEngine.process("Why didn't you remind me?");
  assert(cmdExpRemind.intent === 'ASK_EXPLANATION', '"Why didn\'t you remind me?" parses to ASK_EXPLANATION');

  const cmdExpPause = await intentEngine.process('Why did you pause?');
  assert(cmdExpPause.intent === 'ASK_EXPLANATION', '"Why did you pause?" parses to ASK_EXPLANATION');

  console.log(`\n====================================================`);
  console.log(` Stage 5 Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStep5Tests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runStep5Tests };
