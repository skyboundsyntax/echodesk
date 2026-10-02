/**
 * ECHODESK Backend — Stage 7: Camera & Zen Presence Assistance Test Suite
 * Validates backend CameraPresenceSensor, Privacy Policy Gate enforcement,
 * local-only signal processing, and FlowEngine grace period interaction.
 */

const { CameraPresenceSensor } = require('../sensors/camera-presence');
const { PrivacyPolicyGate } = require('../core/privacy-gate');
const { FlowEngine, FlowDecision } = require('../engines/flow-engine');

async function runStep7Tests() {
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
  console.log(' ECHODESK Step 7: Camera Presence Assistance Tests  ');
  console.log('====================================================\n');

  const gate = new PrivacyPolicyGate();
  const sensor = new CameraPresenceSensor({ privacyGate: gate });
  const flow = new FlowEngine({ absenceGracePeriodMs: 12000 });

  // 1. Off by default
  console.log('1. Testing Camera Presence Sensor Defaults...');
  assert(gate.getPermissions().cameraEnabled === false, 'Camera assistance is disabled by default');
  assert(sensor.isActive === false, 'Sensor is not active initially');

  // 2. Gate check when disabled
  console.log('\n2. Testing Gate Rejection when Camera Disabled...');
  const disabledEval = sensor.evaluateActivation({ cloudStreamRequested: false });
  assert(!disabledEval.allowed, 'Activation rejected when disabled');
  assert(disabledEval.code === 'DENY_CAMERA_DISABLED', 'Returns DENY_CAMERA_DISABLED code');

  // 3. Explicit Enablement
  console.log('\n3. Testing Explicit Enablement in Privacy Settings...');
  gate.savePermissions({ cameraEnabled: true });
  const enabledEval = sensor.evaluateActivation({ cloudStreamRequested: false });
  assert(enabledEval.allowed, 'Activation allowed after explicit permission grant');
  assert(enabledEval.code === 'ALLOW_LOCAL_PRESENCE', 'Returns ALLOW_LOCAL_PRESENCE code');

  // 4. Cloud Video Stream Block
  console.log('\n4. Testing Cloud Video Stream Prohibition...');
  const cloudEval = sensor.evaluateActivation({ cloudStreamRequested: true });
  assert(!cloudEval.allowed, 'Cloud stream request is strictly blocked');
  assert(cloudEval.code === 'DENY_CLOUD_VIDEO_STREAM', 'Returns DENY_CLOUD_VIDEO_STREAM code');

  // 5. Local frame processing & immediate discard
  console.log('\n5. Testing Local Frame Processing & Frame Discarding...');
  sensor.start();
  // Simulated dark frame (empty desk)
  const darkFrame = new Array(768).fill(5);
  const darkResult = sensor.processFrameLocally(darkFrame);
  assert(darkResult.signal === 'ABSENT', 'Dark scene classified as ABSENT');
  assert(darkResult.frameRetained === false, 'Raw frame buffer is immediately discarded');

  // Simulated lit/active frame (user present)
  const litFrame = new Array(768).fill(120);
  const litResult = sensor.processFrameLocally(litFrame);
  assert(litResult.signal === 'PRESENT', 'Lit scene classified as PRESENT');
  assert(litResult.frameRetained === false, 'Frame is not retained in memory');

  // 6. Momentary glance away (under 12s grace period)
  console.log('\n6. Testing Momentary Glance Away (Grace Period Protection)...');
  const baseTime = 1700000000000;
  const glance1 = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 600000,
    presenceSignal: 'ABSENT',
    now: baseTime,
  });
  assert(glance1.decision === FlowDecision.STAY_SILENT, 'Initial glance away stays silent');

  const glance2 = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 604000,
    presenceSignal: 'ABSENT',
    now: baseTime + 4000, // 4s < 12s
  });
  assert(glance2.decision === FlowDecision.STAY_SILENT, 'Glance away at 4s stays silent within grace period');

  // 7. Sustained absence past grace period
  console.log('\n7. Testing Sustained Absence Exceeding Grace Period...');
  const sustainedAbsence = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 614000,
    presenceSignal: 'ABSENT',
    now: baseTime + 14000, // 14s >= 12s
  });
  assert(sustainedAbsence.decision === FlowDecision.ASK_PAUSE, 'Sustained absence returns ASK_PAUSE');
  assert(sustainedAbsence.prompt.includes('Pause session?'), 'Prompts user rather than silently pausing');

  // 8. Raw video retention lock
  console.log('\n8. Testing Raw Video Retention Lock...');
  const perms = gate.savePermissions({ rawVideoRetention: true });
  assert(perms.rawVideoRetention === false, 'rawVideoRetention cannot be enabled');

  console.log(`\n====================================================`);
  console.log(` Stage 7 Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`====================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStep7Tests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runStep7Tests };
