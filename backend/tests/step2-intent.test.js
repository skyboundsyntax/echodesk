/**
 * ECHODESK Backend — Stage 2: JOT Text Intent Test Suite
 * Tests all required Stage 2 intent commands, privacy policy gating, and offline fallback.
 */

const { WorkSession, WorkSessionState } = require('../core/session-state');
const { PrivacyPolicyGate, PolicyActionType } = require('../core/privacy-gate');
const {
  IntentEngine,
  DeterministicLocalProvider,
  GeminiInteractionsProvider,
} = require('../engines/intent-engine');

async function runStep2Tests() {
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
  console.log(' ECHODESK Step 2: JOT Text Intent Verification Suite ');
  console.log('====================================================\n');

  const gate = new PrivacyPolicyGate();
  const localProvider = new DeterministicLocalProvider();
  const engine = new IntentEngine({ aiProvider: localProvider, privacyGate: gate });

  // 1. START_WORK_SESSION
  console.log('1. Testing START_WORK_SESSION...');
  const resStart1 = await engine.process('studying DBMS');
  assert(resStart1.intent === 'START_WORK_SESSION', '"studying DBMS" parses as START_WORK_SESSION');
  assert(resStart1.contextName === 'DBMS', 'Context parsed as DBMS');
  assert(resStart1.mode === 'zen', 'Default mode is zen');
  assert(resStart1.allowed === true, 'Policy gate allows session start');

  const resStart2 = await engine.process('Hey JOT, studying DBMS - Normalization');
  assert(resStart2.intent === 'START_WORK_SESSION', '"Hey JOT, studying DBMS - Normalization" parses');
  assert(resStart2.contextName === 'DBMS', 'Context is DBMS');
  assert(resStart2.topic === 'Normalization', 'Topic is Normalization');

  // 2. PAUSE_SESSION
  console.log('\n2. Testing PAUSE_SESSION...');
  const resPause = await engine.process('JOT, pause');
  assert(resPause.intent === 'PAUSE_SESSION', '"JOT, pause" parses as PAUSE_SESSION');
  assert(resPause.allowed === true, 'Policy gate allows pause');

  // 3. RESUME_SESSION
  console.log('\n3. Testing RESUME_SESSION...');
  const resResume = await engine.process('JOT, resume DBMS');
  assert(resResume.intent === 'RESUME_SESSION', '"JOT, resume DBMS" parses as RESUME_SESSION');
  assert(resResume.contextName === 'DBMS', 'Resume context parsed as DBMS');

  // 4. STOP_SESSION
  console.log('\n4. Testing STOP_SESSION...');
  const resStop = await engine.process('JOT, stop');
  assert(resStop.intent === 'STOP_SESSION', '"JOT, stop" parses as STOP_SESSION');

  // 5. CORRECT_SESSION_TIME ("JOT, I stopped an hour ago")
  console.log('\n5. Testing CORRECT_SESSION_TIME...');
  const resCorrect = await engine.process('JOT, I stopped an hour ago', {
    activeDurationMs: 90 * 60 * 1000, // 90 min
  });
  assert(resCorrect.intent === 'CORRECT_SESSION_TIME', '"JOT, I stopped an hour ago" parses as CORRECT_SESSION_TIME');
  assert(resCorrect.minutesAgo === 60, 'Parsed 60 minutes ago');
  assert(resCorrect.adjustedDurationMs === 30 * 60 * 1000, 'Calculated adjusted duration: 90m - 60m = 30m');

  // 6. UPDATE_CONTEXT
  console.log('\n6. Testing UPDATE_CONTEXT...');
  const resUpdate = await engine.process('working on Q5', { state: 'ACTIVE', contextName: 'DBMS' });
  assert(resUpdate.intent === 'UPDATE_CONTEXT', '"working on Q5" parses as UPDATE_CONTEXT');
  assert(resUpdate.lastStep === 'Q5', 'Updated last step is Q5');

  // 7. ASK_STATUS
  console.log('\n7. Testing ASK_STATUS...');
  const resStatus = await engine.process('what was I doing?');
  assert(resStatus.intent === 'ASK_STATUS', '"what was I doing?" parses as ASK_STATUS');

  // 8. REQUEST_HANDOFF
  console.log('\n8. Testing REQUEST_HANDOFF...');
  const resHandoff = await engine.process('JOT, continue DBMS on laptop');
  assert(resHandoff.intent === 'REQUEST_HANDOFF', '"continue DBMS on laptop" parses as REQUEST_HANDOFF');
  assert(resHandoff.targetDevice === 'laptop', 'Target device is laptop');
  assert(resHandoff.contextName === 'DBMS', 'Context name is DBMS');

  // 9. SET_INTERVENTION_PREFERENCE
  console.log('\n9. Testing SET_INTERVENTION_PREFERENCE...');
  const resPref = await engine.process('JOT, less reminders');
  assert(resPref.intent === 'SET_INTERVENTION_PREFERENCE', '"JOT, less reminders" parses preference');
  assert(resPref.preference === 'minimal', 'Preference set to minimal');

  // 10. FORGET_MEMORY
  console.log('\n10. Testing FORGET_MEMORY...');
  const resForget = await engine.process('forget this session');
  assert(resForget.intent === 'FORGET_MEMORY', '"forget this session" parses as FORGET_MEMORY');

  // 11. Policy Gate Rejection Enforcement
  console.log('\n11. Testing Privacy Gate Rejections...');
  gate.savePermissions({ micEnabled: false });
  const evalMic = gate.evaluate(PolicyActionType.ACTIVATE_MIC, { explicitUserGesture: true });
  assert(evalMic.allowed === false, 'Mic denied when disabled in policy');

  const evalSurveillance = gate.evaluate(PolicyActionType.DESKTOP_SURVEILLANCE);
  assert(evalSurveillance.allowed === false, 'Desktop surveillance strictly forbidden');
  assert(evalSurveillance.code === 'DENY_PROHIBITED_FEATURE', 'Correct denial code returned');

  // 12. Fallback when AI service is unavailable
  console.log('\n12. Testing AI Fallback Behavior...');
  const cloudProvider = new GeminiInteractionsProvider('', localProvider);
  const fallbackEngine = new IntentEngine({ aiProvider: cloudProvider, privacyGate: gate });
  const resFallback = await fallbackEngine.process('studying DBMS');
  assert(resFallback.intent === 'START_WORK_SESSION', 'Falls back seamlessly to local parser when cloud unconfigured');
  assert(resFallback.contextName === 'DBMS', 'Fallback parsed DBMS context correctly');

  console.log('\n====================================================');
  console.log(` Step 2 Results: ${passed} PASSED, ${failed} FAILED `);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runStep2Tests();
}

module.exports = { runStep2Tests };
