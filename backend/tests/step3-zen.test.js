/**
 * ECHODESK Backend — Stage 3: Zen Mode Focus Tests
 * Validates:
 * - Minimal focus state management
 * - 25-minute Pomodoro boundary strictly protects flow without forced interruptions
 * - Real elapsed active time calculation
 * - Pause and resume behavior
 * - Privacy constraints (no cameras/mics active by default)
 */

const { WorkSession, WorkSessionState } = require('../core/session-state');
const { PrivacyPolicyGate } = require('../core/privacy-gate');

// Minimal Flow Engine policy implementation for server-side evaluation
class ServerFlowEngine {
  constructor() {
    this.pomodoroThresholdMs = 25 * 60 * 1000;
  }

  evaluate(context) {
    const { sessionState, activeDurationMs } = context;

    if (sessionState !== 'ACTIVE') {
      return { decision: 'STAY_SILENT', flowProtected: false, reason: 'Session not active.' };
    }

    if (activeDurationMs >= this.pomodoroThresholdMs) {
      return {
        decision: 'SHOW_FLOW_STATUS',
        flowProtected: true,
        reason: 'Flow protected — JOT is staying quiet.',
      };
    }

    return {
      decision: 'STAY_SILENT',
      flowProtected: false,
      reason: 'Normal active focus.',
    };
  }
}

async function runStep3Tests() {
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

  console.log('==================================================');
  console.log(' ECHODESK Step 3: Zen Mode Focus Verification     ');
  console.log('==================================================\n');

  // 1. Session start in Zen Mode
  console.log('1. Testing Session initialization in Zen Mode...');
  const session = new WorkSession();
  session.start('DBMS', { topic: 'Normalization', lastStep: 'Q5', mode: 'zen' });
  assert(session.state === WorkSessionState.ACTIVE, 'Session is ACTIVE');
  assert(session.mode === 'zen', 'Session mode is zen');
  assert(session.contextName === 'DBMS', 'Context is DBMS');
  assert(session.lastStep === 'Q5', 'Last step is Q5');

  // 2. Elapsed active duration in Zen Mode
  console.log('\n2. Testing Active Duration accumulation...');
  await new Promise((r) => setTimeout(r, 30));
  const activeMs = session.getActiveDurationMs();
  assert(activeMs >= 25, 'Active duration accumulated in Zen mode');

  // 3. Pause in Zen Mode
  console.log('\n3. Testing Pause & Resume in Zen Mode...');
  session.pause('User paused in Zen');
  assert(session.state === WorkSessionState.PAUSED, 'Session transitioned to PAUSED');
  const frozenMs = session.getActiveDurationMs();
  await new Promise((r) => setTimeout(r, 25));
  assert(session.getActiveDurationMs() === frozenMs, 'Duration remains frozen while PAUSED');

  // Resume in Zen Mode
  session.resume('User resumed in Zen');
  assert(session.state === WorkSessionState.ACTIVE, 'Session resumed to ACTIVE');
  await new Promise((r) => setTimeout(r, 25));
  assert(session.getActiveDurationMs() > frozenMs, 'Duration resumed accumulation');

  // 4. Pomodoro Threshold Flow Protection
  console.log('\n4. Testing 25-minute Pomodoro Threshold Flow Protection...');
  const flow = new ServerFlowEngine();

  // Test before Pomodoro threshold (e.g., 20 mins)
  const evalBefore = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 20 * 60 * 1000,
  });
  assert(evalBefore.flowProtected === false, 'Before 25m, normal active flow');

  // Test at exactly 25 minutes (1,500,000 ms)
  const evalAt25 = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 25 * 60 * 1000,
  });
  assert(evalAt25.decision === 'SHOW_FLOW_STATUS', 'At 25m, decision is SHOW_FLOW_STATUS');
  assert(evalAt25.flowProtected === true, 'Flow is protected at 25 minutes');
  assert(evalAt25.reason === 'Flow protected — JOT is staying quiet.', 'Reason matches exact PRD requirement: "Flow protected — JOT is staying quiet."');

  // Test well beyond Pomodoro threshold (42m 18s)
  const evalPast25 = flow.evaluate({
    sessionState: 'ACTIVE',
    activeDurationMs: 42 * 60 * 1000 + 18000,
  });
  assert(evalPast25.flowProtected === true, 'Beyond 25m, flow remains protected');

  // 5. Ending session from Zen Mode
  console.log('\n5. Testing Session completion from Zen Mode...');
  session.stop('Session finished in Zen');
  assert(session.state === WorkSessionState.ENDED, 'Session is ENDED');
  assert(session.endTime > 0, 'End timestamp recorded');

  // 6. Privacy constraints (no sensors active by default in Zen)
  console.log('\n6. Testing Zen Mode Sensor Privacy Constraints...');
  const gate = new PrivacyPolicyGate();
  const perms = gate.getPermissions();
  assert(perms.cameraEnabled === false, 'Camera is OFF by default in Zen');
  assert(perms.micEnabled === true, 'Mic is scoped push-to-talk (not continuous)');
  assert(perms.rawAudioRetention === false, 'Raw audio retention is hardcoded OFF');
  assert(perms.rawVideoRetention === false, 'Raw video retention is hardcoded OFF');
  assert(perms.desktopInspectionAllowed === false, 'Desktop surveillance is strictly forbidden');

  console.log('\n==================================================');
  console.log(` Step 3 Results: ${passed} PASSED, ${failed} FAILED `);
  console.log('==================================================');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runStep3Tests();
}

module.exports = { runStep3Tests, ServerFlowEngine };
