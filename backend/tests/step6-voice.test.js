/**
 * ECHODESK Backend — Stage 6: Voice Input & Intent Verification Suite
 * Validates backend VoiceInput sensor, Privacy Policy Gate enforcement,
 * and the 5 mandatory voice commands.
 */

const { VoiceInput } = require('../sensors/voice-input');
const { PrivacyPolicyGate } = require('../core/privacy-gate');
const { IntentEngine, DeterministicLocalProvider } = require('../engines/intent-engine');

async function runStep6Tests() {
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
  console.log(' ECHODESK Step 6: Voice Interaction & Gate Tests    ');
  console.log('====================================================\n');

  const gate = new PrivacyPolicyGate();
  const voice = new VoiceInput({ privacyGate: gate });
  const ai = new DeterministicLocalProvider();
  const intentEngine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

  // 1. Rejection of passive always-listening without user gesture
  console.log('1. Testing Passive Always-Listening Rejection...');
  const passiveEval = voice.evaluateActivation({ explicitUserGesture: false });
  assert(!passiveEval.allowed, 'Passive activation without gesture is blocked');
  assert(passiveEval.code === 'DENY_PASSIVE_MIC', 'Returns DENY_PASSIVE_MIC error code');
  assert(passiveEval.reason.includes('Always-listening passive microphone is prohibited'), 'Correct privacy rejection reason');

  // 2. Authorized scoped push-to-talk
  console.log('\n2. Testing Scoped Push-to-Talk Authorization...');
  const scopedEval = voice.evaluateActivation({ explicitUserGesture: true });
  assert(scopedEval.allowed, 'Explicit user gesture activates scoped mic');
  assert(scopedEval.code === 'ALLOW_SCOPED_MIC', 'Returns ALLOW_SCOPED_MIC code');

  // 3. Microphone disable toggle enforcement
  console.log('\n3. Testing Privacy Center Microphone Revocation...');
  gate.savePermissions({ micEnabled: false });
  const disabledEval = voice.evaluateActivation({ explicitUserGesture: true });
  assert(!disabledEval.allowed, 'Mic activation rejected when disabled in settings');
  assert(disabledEval.code === 'DENY_MIC_DISABLED', 'Returns DENY_MIC_DISABLED code');
  gate.savePermissions({ micEnabled: true }); // Re-enable for subsequent tests

  // 4. Raw audio retention hard lock
  console.log('\n4. Testing Raw Audio Retention Hard Lock...');
  const perms = gate.savePermissions({ rawAudioRetention: true });
  assert(perms.rawAudioRetention === false, 'rawAudioRetention cannot be forced to true');

  // 5. Voice Command 1: "Hey JOT, studying DBMS"
  console.log('\n5. Testing Voice Command 1: "Hey JOT, studying DBMS"...');
  const utterance1 = await voice.simulateVoiceUtterance('Hey JOT, studying DBMS', { explicitUserGesture: true });
  const cmd1 = await intentEngine.process(utterance1, {}, { explicitUserGesture: true });
  assert(cmd1.intent === 'START_WORK_SESSION', 'Command 1 parsed as START_WORK_SESSION');
  assert(cmd1.contextName === 'DBMS', 'Context is DBMS');

  // 6. Voice Command 2: "JOT, pause"
  console.log('\n6. Testing Voice Command 2: "JOT, pause"...');
  const utterance2 = await voice.simulateVoiceUtterance('JOT, pause', { explicitUserGesture: true });
  const cmd2 = await intentEngine.process(utterance2, { state: 'ACTIVE' }, { explicitUserGesture: true });
  assert(cmd2.intent === 'PAUSE_SESSION', 'Command 2 parsed as PAUSE_SESSION');

  // 7. Voice Command 3: "JOT, stop"
  console.log('\n7. Testing Voice Command 3: "JOT, stop"...');
  const utterance3 = await voice.simulateVoiceUtterance('JOT, stop', { explicitUserGesture: true });
  const cmd3 = await intentEngine.process(utterance3, { state: 'ACTIVE' }, { explicitUserGesture: true });
  assert(cmd3.intent === 'STOP_SESSION', 'Command 3 parsed as STOP_SESSION');

  // 8. Voice Command 4: "JOT, I stopped an hour ago"
  console.log('\n8. Testing Voice Command 4: "JOT, I stopped an hour ago"...');
  const utterance4 = await voice.simulateVoiceUtterance('JOT, I stopped an hour ago', { explicitUserGesture: true });
  const cmd4 = await intentEngine.process(utterance4, {
    state: 'ACTIVE',
    activeDurationMs: 90 * 60 * 1000,
  }, { explicitUserGesture: true });
  assert(cmd4.intent === 'CORRECT_SESSION_TIME', 'Command 4 parsed as CORRECT_SESSION_TIME');
  assert(cmd4.minutesAgo === 60, 'Calculated 60 minutes ago');
  assert(cmd4.adjustedDurationMs === 30 * 60 * 1000, 'Adjusted duration to 30m');

  // 9. Voice Command 5: "JOT, resume DBMS"
  console.log('\n9. Testing Voice Command 5: "JOT, resume DBMS"...');
  const utterance5 = await voice.simulateVoiceUtterance('JOT, resume DBMS', { explicitUserGesture: true });
  const cmd5 = await intentEngine.process(utterance5, { state: 'PAUSED' }, { explicitUserGesture: true });
  assert(cmd5.intent === 'RESUME_SESSION', 'Command 5 parsed as RESUME_SESSION');
  assert(cmd5.contextName === 'DBMS', 'Resumed context is DBMS');

  console.log(`\n====================================================`);
  console.log(` Stage 6 Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStep6Tests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runStep6Tests };
