/**
 * ECHODESK — Stage 6: Voice Input Test Suite
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Explicit scoped push-to-talk voice interaction
 * - Supported commands:
 *   1. "Hey JOT, studying DBMS"
 *   2. "JOT, pause"
 *   3. "JOT, stop"
 *   4. "JOT, I stopped an hour ago"
 *   5. "JOT, resume DBMS"
 * - No hidden always-listening behavior (continuous: false, explicitUserGesture required)
 * - Zero raw audio retention or persistence
 * - Microphone active state signaling
 * - Clean text fallback when speech recognition is unavailable
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { VoiceInput } = isNode
    ? require('../js/sensors/voice-input.js')
    : window;
  const { PrivacyPolicyGate, PolicyActionType } = isNode
    ? require('../js/engines/privacy-gate.js')
    : window;
  const { IntentEngine } = isNode
    ? require('../js/engines/intent-engine.js')
    : window;
  const { DeterministicLocalProvider } = isNode
    ? require('../js/ai/ai-provider.js')
    : window;
  const { EventBus } = isNode
    ? require('../js/core/events.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 6 — Voice: Scoped Push-to-Talk & Privacy Protection', () => {
    test('Microphone activation without explicit user gesture is strictly DENIED by Privacy Policy Gate', async () => {
      const gate = new PrivacyPolicyGate();
      const voice = new VoiceInput({ privacyGate: gate });

      try {
        await voice.simulateVoiceUtterance('Hey JOT, pause', { explicitUserGesture: false });
        exp(true).toBe(false); // Should not reach here
      } catch (err) {
        exp(err.code).toBe('DENY_PASSIVE_MIC');
        exp(err.message.includes('Always-listening passive microphone is prohibited')).toBe(true);
      }
    });

    test('Microphone activation when mic is disabled in Privacy Center is DENIED', async () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ micEnabled: false });
      const voice = new VoiceInput({ privacyGate: gate });

      try {
        await voice.simulateVoiceUtterance('Hey JOT, pause', { explicitUserGesture: true });
        exp(true).toBe(false);
      } catch (err) {
        exp(err.code).toBe('DENY_MIC_DISABLED');
        exp(err.message.includes('disabled in Privacy Center')).toBe(true);
      }
    });

    test('Push-to-talk voice activation emits lifecycle events (started, result, ended)', async () => {
      const gate = new PrivacyPolicyGate();
      const events = new EventBus();
      const voice = new VoiceInput({ privacyGate: gate, eventBus: events });

      let started = false;
      let ended = false;
      let heard = '';

      events.on('voice:started', () => { started = true; });
      events.on('voice:ended', () => { ended = true; });
      events.on('voice:result', (e) => { heard = e.transcript; });

      const transcript = await voice.simulateVoiceUtterance('Hey JOT, studying DBMS', { explicitUserGesture: true });

      exp(started).toBe(true);
      exp(ended).toBe(true);
      exp(heard).toBe('Hey JOT, studying DBMS');
      exp(transcript).toBe('Hey JOT, studying DBMS');
    });

    test('Voice command 1: "Hey JOT, studying DBMS" initiates work session for DBMS', async () => {
      const gate = new PrivacyPolicyGate();
      const ai = new DeterministicLocalProvider();
      const engine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

      const parsed = await engine.process('Hey JOT, studying DBMS', {}, { explicitUserGesture: true });
      exp(parsed.allowed).toBe(true);
      exp(parsed.intent).toBe('START_WORK_SESSION');
      exp(parsed.contextName).toBe('DBMS');
    });

    test('Voice command 2: "JOT, pause" initiates session pause', async () => {
      const gate = new PrivacyPolicyGate();
      const ai = new DeterministicLocalProvider();
      const engine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

      const parsed = await engine.process('JOT, pause', { state: 'ACTIVE' }, { explicitUserGesture: true });
      exp(parsed.allowed).toBe(true);
      exp(parsed.intent).toBe('PAUSE_SESSION');
    });

    test('Voice command 3: "JOT, stop" initiates session stop', async () => {
      const gate = new PrivacyPolicyGate();
      const ai = new DeterministicLocalProvider();
      const engine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

      const parsed = await engine.process('JOT, stop', { state: 'ACTIVE' }, { explicitUserGesture: true });
      exp(parsed.allowed).toBe(true);
      exp(parsed.intent).toBe('STOP_SESSION');
    });

    test('Voice command 4: "JOT, I stopped an hour ago" calculates retroactive correction', async () => {
      const gate = new PrivacyPolicyGate();
      const ai = new DeterministicLocalProvider();
      const engine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

      const parsed = await engine.process('JOT, I stopped an hour ago', {
        state: 'ACTIVE',
        activeDurationMs: 90 * 60 * 1000,
      }, { explicitUserGesture: true });

      exp(parsed.allowed).toBe(true);
      exp(parsed.intent).toBe('CORRECT_SESSION_TIME');
      exp(parsed.minutesAgo).toBe(60);
      exp(parsed.adjustedDurationMs).toBe(30 * 60 * 1000);
    });

    test('Voice command 5: "JOT, resume DBMS" resumes session context', async () => {
      const gate = new PrivacyPolicyGate();
      const ai = new DeterministicLocalProvider();
      const engine = new IntentEngine({ aiProvider: ai, privacyGate: gate });

      const parsed = await engine.process('JOT, resume DBMS', { state: 'PAUSED' }, { explicitUserGesture: true });
      exp(parsed.allowed).toBe(true);
      exp(parsed.intent).toBe('RESUME_SESSION');
      exp(parsed.contextName).toBe('DBMS');
    });

    test('Raw audio retention is strictly false and unalterable', () => {
      const gate = new PrivacyPolicyGate();
      exp(gate.getPermissions().rawAudioRetention).toBe(false);

      // Attempt to enable raw audio retention
      gate.savePermissions({ rawAudioRetention: true });
      exp(gate.getPermissions().rawAudioRetention).toBe(false);
    });
  });
})();
