/**
 * ECHODESK Backend — Stage 12: Demo Polish & Live Hackathon Rehearsal Tests
 * Verifies the complete 11-step live hackathon demo flow:
 * 1. "Hey JOT, studying DBMS."
 * 2. Zen session starts.
 * 3. Fixed timer threshold passes; JOT remains quiet.
 * 4. User steps away.
 * 5. Possible pause detected.
 * 6. JOT asks to pause.
 * 7. Natural check-in appears.
 * 8. User returns.
 * 9. JOT restores DBMS / Q5 context.
 * 10. Phone → laptop handoff.
 * 11. Privacy Center (ECHOSHIELD).
 */

const { WorkSession, WorkSessionState } = require('../core/session-state');
const { PrivacyPolicyGate } = require('../core/privacy-gate');
const { IntentEngine, DeterministicLocalProvider } = require('../engines/intent-engine');
const { EchoMemoryEngine } = require('../engines/memory-engine');
const { FlowEngine, FlowDecision, CheckInType } = require('../engines/flow-engine');
const { BridgeEngine, BridgeStage } = require('../engines/bridge-engine');
const { CameraPresenceSensor } = require('../sensors/camera-presence');
const { VoiceInput } = require('../sensors/voice-input');

async function runStep12DemoTests() {
  console.log('==========================================================');
  console.log(' ECHODESK Step 12: Live Hackathon Demo Rehearsal Tests    ');
  console.log('==========================================================\n');

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

  // --- STEP 1: "Hey JOT, studying DBMS" ---
  console.log('Step 1: Testing "Hey JOT, studying DBMS" intent parsing...');
  const privacyGate = new PrivacyPolicyGate();
  const intentEngine = new IntentEngine({ privacyGate });

  const cmd1 = await intentEngine.process('Hey JOT, studying DBMS', {}, { explicitUserGesture: true });
  assert(cmd1.intent === 'START_WORK_SESSION', 'Parsed intent is START_WORK_SESSION');
  assert(cmd1.contextName === 'DBMS', 'Context resolved as DBMS');
  assert(cmd1.allowed === true, 'Policy gate authorizes work session start');

  // --- STEP 2: Zen session starts ---
  console.log('\nStep 2: Testing Zen session start & state transition...');
  const session = new WorkSession();
  session.start(cmd1.contextName, {
    topic: 'Normalization',
    lastStep: 'Q5',
    nextAction: 'Continue Q5',
    mode: 'zen',
  });

  assert(session.state === WorkSessionState.ACTIVE, 'Session state transitioned to ACTIVE');
  assert(session.contextName === 'DBMS', 'Session context stored as DBMS');
  assert(session.topic === 'Normalization', 'Topic recorded as Normalization');
  assert(session.lastStep === 'Q5', 'Last step recorded as Q5');
  assert(session.mode === 'zen', 'Mode set to zen');

  // Sync initial memory
  const memoryEngine = new EchoMemoryEngine({ privacyGate });
  memoryEngine.save({
    contextName: session.contextName,
    topic: session.topic,
    lastStep: session.lastStep,
    nextAction: session.nextAction,
    status: 'active',
    activeDurationMs: 0,
  });
  assert(memoryEngine.get('DBMS') !== null, 'Echo Memory persisted minimal structured context');

  // --- STEP 3: Fixed timer threshold passes; JOT remains quiet ---
  console.log('\nStep 3: Testing 25-minute Pomodoro boundary flow protection...');
  const flowEngine = new FlowEngine({ preference: 'minimal' });

  // Advance time past 25 minutes (e.g. 26 minutes)
  session.correctElapsedTime(26 * 60 * 1000, 'Demo: elapsed past 25m threshold');
  assert(session.getActiveDurationMs() >= 25 * 60 * 1000, 'Active duration elapsed past 25 minutes');

  const evalStep3 = flowEngine.evaluate({
    sessionState: session.state,
    activeDurationMs: session.getActiveDurationMs(),
    presenceSignal: 'PRESENT',
  });

  assert(
    evalStep3.decision === FlowDecision.STAY_SILENT || evalStep3.decision === FlowDecision.SHOW_FLOW_STATUS,
    `JOT remains quiet during active focus (${evalStep3.decision}): "${evalStep3.reason}"`
  );

  // --- STEP 4: User steps away ---
  console.log('\nStep 4: Testing user steps away (presence: ABSENT)...');
  const camera = new CameraPresenceSensor({
    privacyGate: new PrivacyPolicyGate({ cameraEnabled: true }),
  });
  camera.start();
  const absentSignal = camera.setSignal('ABSENT', 0.94);
  assert(absentSignal.signal === 'ABSENT', 'Local presence classifier signals ABSENT');
  assert(camera.currentSignal === 'ABSENT', 'Camera presence state updated to ABSENT');

  // --- STEP 5: Possible pause detected ---
  console.log('\nStep 5: Testing possible pause evaluation with grace period...');
  const now = Date.now();
  // Within grace period (e.g., 5 seconds)
  const evalWithinGrace = flowEngine.evaluate({
    sessionState: session.state,
    activeDurationMs: session.getActiveDurationMs(),
    presenceSignal: 'ABSENT',
    now: now + 5000,
  });
  assert(evalWithinGrace.decision === FlowDecision.STAY_SILENT, 'Momentary glance away within grace period does NOT auto-pause');

  // --- STEP 6: JOT asks to pause ---
  console.log('\nStep 6: Testing JOT asks to pause after sustained absence...');
  // Beyond grace period (e.g., 15 seconds)
  const evalBeyondGrace = flowEngine.evaluate({
    sessionState: session.state,
    activeDurationMs: session.getActiveDurationMs(),
    presenceSignal: 'ABSENT',
    now: now + 15000,
  });

  assert(evalBeyondGrace.decision === FlowDecision.ASK_PAUSE, 'FlowEngine returns FlowDecision.ASK_PAUSE for sustained absence');
  assert(evalBeyondGrace.prompt.includes('Pause') || evalBeyondGrace.prompt.includes('stepped away'), 'Prompt suggests pausing gently without force');

  // --- STEP 7: Natural check-in appears ---
  console.log('\nStep 7: Testing natural check-in appearance upon pause...');
  session.pause('User stepped away');
  assert(session.state === WorkSessionState.PAUSED, 'Session cleanly transitioned to PAUSED');

  const nextCheckIn = flowEngine.getNextCheckIn();
  assert(nextCheckIn && nextCheckIn.title.includes('Reset') || nextCheckIn.title.includes('Hydration') || nextCheckIn.id === 'water', 'Gentle reset check-in prepared (Hydration/Water)');

  // Record user took reset
  const responseRecorded = flowEngine.recordInterventionResponse('ACCEPTED');
  assert(responseRecorded.response === 'ACCEPTED', 'Intervention acceptance recorded');

  // --- STEP 8: User returns ---
  console.log('\nStep 8: Testing user returns to desk...');
  const presentSignal = camera.setSignal('PRESENT', 0.96);
  assert(presentSignal.signal === 'PRESENT', 'Camera presence immediately signals PRESENT upon return');
  camera.stop();

  // --- STEP 9: JOT restores DBMS / Q5 context ---
  console.log('\nStep 9: Testing context restoration (DBMS / Q5)...');
  const resumeGreeting = memoryEngine.formatResumeGreeting('DBMS');
  assert(resumeGreeting.includes('Q5') && resumeGreeting.includes('Normalization'), `Resume greeting restores exact context: "${resumeGreeting}"`);

  session.resume('Context restored');
  assert(session.state === WorkSessionState.ACTIVE, 'Session resumed to ACTIVE');
  assert(session.lastStep === 'Q5', 'Last step preserved as Q5');

  // --- STEP 10: Phone → laptop handoff ---
  console.log('\nStep 10: Testing Phone → Laptop Handoff pipeline...');
  const bridge = new BridgeEngine({ privacyGate });

  const handoff = bridge.initiateHandoff(session.toJSON(), 'laptop');
  assert(bridge.getStage() === BridgeStage.AUTHENTICATED_SYNC, 'Bridge advances to AUTHENTICATED_SYNC');
  assert(handoff.session.contextName === 'DBMS', 'Handoff contains DBMS context');
  assert(handoff.session.lastStep === 'Q5', 'Handoff contains Q5 step');

  // Target device consumes handoff
  const received = bridge.receiveHandoff({ targetDevice: 'laptop' });
  assert(bridge.getStage() === BridgeStage.LAPTOP_SESSION_READY, 'Bridge advances to LAPTOP_SESSION_READY on laptop');
  assert(received.session.topic === 'Normalization', 'Laptop session ready with Normalization topic');
  assert(!('openTabs' in received) && !('screenPixels' in received), 'Zero laptop surveillance telemetry transmitted');

  // --- STEP 11: Privacy Center ---
  console.log('\nStep 11: Testing ECHOSHIELD Privacy Center enforcement...');
  const perms = privacyGate.getPermissions();
  assert(perms.rawAudioRetention === false, 'ECHOSHIELD locks rawAudioRetention to false');
  assert(perms.rawVideoRetention === false, 'ECHOSHIELD locks rawVideoRetention to false');
  assert(perms.desktopInspectionAllowed === false, 'ECHOSHIELD locks desktopInspectionAllowed to false');
  assert(perms.silentInventoryAllowed === false, 'ECHOSHIELD locks silentInventoryAllowed to false');

  const auditLog = privacyGate.getAuditLog();
  assert(auditLog.length > 0, `Real-time ECHOSHIELD audit trail active (${auditLog.length} entries recorded)`);

  console.log('\n==========================================================');
  console.log(` Step 12 Summary: ${passed} PASSED, ${failed} FAILED `);
  console.log('==========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStep12DemoTests().catch((err) => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runStep12DemoTests };
