/**
 * ECHODESK — Stage 7: Camera & Zen Presence Assistance Test Suite
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Optional Zen camera assistance with explicit user enablement flow
 * - Camera is OFF by default
 * - Clear camera-active state indication
 * - Local-only processing (downsampling & frame luminance delta)
 * - Zero raw frame retention, zero cloud video upload
 * - Minimal local output signals: PRESENT / ABSENT / UNCERTAIN
 * - Absence grace period & confidence threshold (does not auto-pause from momentary glance away)
 * - Asking user rather than assuming when confidence is insufficient
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { CameraPresenceSensor } = isNode
    ? require('../js/sensors/camera-presence.js')
    : window;
  const { PrivacyPolicyGate } = isNode
    ? require('../js/engines/privacy-gate.js')
    : window;
  const { FlowEngine, FlowDecision } = isNode
    ? require('../js/engines/flow-engine.js')
    : window;
  const { EventBus } = isNode
    ? require('../js/core/events.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 7 — Camera / Zen Presence Assistance', () => {
    test('Camera presence assistance is OFF by default', () => {
      const gate = new PrivacyPolicyGate();
      exp(gate.getPermissions().cameraEnabled).toBe(false);

      const sensor = new CameraPresenceSensor({ privacyGate: gate });
      exp(sensor.isActive).toBe(false);
    });

    test('Activating camera while disabled in Privacy Center is strictly DENIED', async () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ cameraEnabled: false });
      const sensor = new CameraPresenceSensor({ privacyGate: gate });

      try {
        await sensor.start(true);
        exp(true).toBe(false); // Should not reach here
      } catch (err) {
        exp(err.message.includes('disabled in Privacy Center')).toBe(true);
      }
    });

    test('Explicit enablement allows local presence assistance', async () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ cameraEnabled: true });
      const events = new EventBus();
      const sensor = new CameraPresenceSensor({ privacyGate: gate, eventBus: events });

      let started = false;
      events.on('presence:started', () => { started = true; });

      const ok = await sensor.start(true);
      exp(ok).toBe(true);
      exp(sensor.isActive).toBe(true);
      exp(started).toBe(true);
      sensor.stop();
      exp(sensor.isActive).toBe(false);
    });

    test('Cloud video streaming request is strictly BLOCKED by policy gate', () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ cameraEnabled: true });

      const evalResult = gate.evaluate('ACTIVATE_CAMERA', { cloudStreamRequested: true });
      exp(evalResult.allowed).toBe(false);
      exp(evalResult.code).toBe('DENY_CLOUD_VIDEO_STREAM');
      exp(evalResult.reason.includes('Streaming raw video frames to the cloud')).toBe(true);
    });

    test('Presence signal emits minimal classified enum: PRESENT, ABSENT, UNCERTAIN', () => {
      const sensor = new CameraPresenceSensor();
      const signals = [];

      sensor.setSignal('PRESENT', 0.95);
      signals.push(sensor.currentSignal);

      sensor.setSignal('ABSENT', 0.88);
      signals.push(sensor.currentSignal);

      sensor.setSignal('UNCERTAIN', 0.50);
      signals.push(sensor.currentSignal);

      exp(signals).toEqual(['PRESENT', 'ABSENT', 'UNCERTAIN']);
    });

    test('Momentary glance away (under grace period) does NOT trigger auto-pause in FlowEngine', () => {
      const flow = new FlowEngine({ absenceGracePeriodMs: 12000 });
      const baseTime = 1700000000000;

      // Frame indicates user glanced away (ABSENT for 3 seconds)
      const res1 = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 400000,
        presenceSignal: 'ABSENT',
        now: baseTime,
      });
      exp(res1.decision).toBe(FlowDecision.STAY_SILENT);

      const res2 = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 403000,
        presenceSignal: 'ABSENT',
        now: baseTime + 3000,
      });
      exp(res2.decision).toBe(FlowDecision.STAY_SILENT);
      exp(res2.reason.includes('grace period')).toBe(true);

      // User glances back (PRESENT)
      const res3 = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 405000,
        presenceSignal: 'PRESENT',
        now: baseTime + 5000,
      });
      exp(res3.decision).toBe(FlowDecision.STAY_SILENT);
    });

    test('Sustained absence exceeding grace period triggers ASK_PAUSE prompt rather than silent assumption', () => {
      const flow = new FlowEngine({ absenceGracePeriodMs: 12000 });
      const baseTime = 1700000000000;

      // Start absence
      flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 400000,
        presenceSignal: 'ABSENT',
        now: baseTime,
      });

      // 13 seconds later (exceeds 12s)
      const res = flow.evaluate({
        sessionState: 'ACTIVE',
        activeDurationMs: 413000,
        presenceSignal: 'ABSENT',
        now: baseTime + 13000,
      });

      exp(res.decision).toBe(FlowDecision.ASK_PAUSE);
      exp(res.prompt).toBe('Looks like you stepped away. Pause session?');
    });

    test('Raw video frame retention is permanently false in Privacy Policy Gate', () => {
      const gate = new PrivacyPolicyGate();
      exp(gate.getPermissions().rawVideoRetention).toBe(false);

      gate.savePermissions({ rawVideoRetention: true });
      exp(gate.getPermissions().rawVideoRetention).toBe(false);
    });
  });
})();
