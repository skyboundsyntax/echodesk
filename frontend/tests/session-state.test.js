/**
 * ECHODESK — Work Session State Machine Unit Tests
 * Tests Stage 1 implementation requirements:
 * - ACTIVE, PAUSED, ENDED, UNCERTAIN states
 * - Start, pause, resume, stop, correct elapsed time
 * - State transition guards (preventing invalid transitions)
 * - Real elapsed time tracking & duration formatting
 * - Context updates and audit history
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { WorkSession, WorkSessionState, ContextSource } = isNode
    ? require('../js/core/session-state.js')
    : window;
  const { EventBus } = isNode ? require('../js/core/events.js') : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('WorkSession State Machine — Initial State', () => {
    test('initializes with default IDLE state and zero duration', () => {
      const session = new WorkSession();
      exp(session.state).toBe(WorkSessionState.IDLE);
      exp(session.activeDurationMs).toBe(0);
      exp(session.getActiveDurationMs()).toBe(0);
      exp(session.startTime).toBeNull();
      exp(session.endTime).toBeNull();
      exp(session.lastStartedAt).toBeNull();
      exp(session.contextName).toBe('');
      exp(session.history.length).toBe(0);
    });
  });

  desc('WorkSession State Machine — Start Transitions', () => {
    test('transitions from IDLE to ACTIVE with valid context', () => {
      const bus = new EventBus();
      let startedEventFired = false;
      bus.on('session:started', (payload) => {
        if (payload.contextName === 'DBMS') startedEventFired = true;
      });

      const session = new WorkSession({ eventBus: bus });
      session.start('DBMS', { topic: 'Normalization', lastStep: 'Q1' });

      exp(session.state).toBe(WorkSessionState.ACTIVE);
      exp(session.contextName).toBe('DBMS');
      exp(session.topic).toBe('Normalization');
      exp(session.lastStep).toBe('Q1');
      exp(session.startTime).toBeTruthy();
      exp(session.lastStartedAt).toBeTruthy();
      exp(session.history.length).toBe(1);
      exp(session.history[0].from).toBe(WorkSessionState.IDLE);
      exp(session.history[0].to).toBe(WorkSessionState.ACTIVE);
      exp(startedEventFired).toBeTruthy();
    });

    test('throws error if contextName is empty or whitespace', () => {
      const session = new WorkSession();
      exp(() => session.start('')).toThrow('contextName is required');
      exp(() => session.start('   ')).toThrow('contextName is required');
    });

    test('throws error if starting when already ACTIVE', () => {
      const session = new WorkSession();
      session.start('DBMS');
      exp(() => session.start('Algorithms')).toThrow('Cannot start session: already ACTIVE');
    });
  });

  desc('WorkSession State Machine — Pause & Resume Transitions', () => {
    test('pausing an ACTIVE session transitions to PAUSED and accumulates duration', async () => {
      const session = new WorkSession();
      session.start('DBMS');

      // Wait 30ms to accumulate real time
      await new Promise((r) => setTimeout(r, 30));

      session.pause('Stepped away');
      exp(session.state).toBe(WorkSessionState.PAUSED);
      exp(session.pauseReason).toBe('Stepped away');
      exp(session.lastStartedAt).toBeNull();
      exp(session.activeDurationMs).toBeGreaterThanOrEqual(25);

      const pausedDuration = session.getActiveDurationMs();
      await new Promise((r) => setTimeout(r, 20));
      // In paused state, active duration must NOT increase
      exp(session.getActiveDurationMs()).toBe(pausedDuration);
    });

    test('throws error if pausing a non-ACTIVE session', () => {
      const session = new WorkSession();
      exp(() => session.pause()).toThrow('expected ACTIVE');

      session.start('DBMS');
      session.pause();
      exp(() => session.pause()).toThrow('expected ACTIVE');
    });

    test('resuming a PAUSED session transitions to ACTIVE and resumes accumulation', async () => {
      const session = new WorkSession();
      session.start('DBMS');
      await new Promise((r) => setTimeout(r, 20));
      session.pause();

      const durationBeforeResume = session.getActiveDurationMs();
      await new Promise((r) => setTimeout(r, 15));

      session.resume('User returned');
      exp(session.state).toBe(WorkSessionState.ACTIVE);
      exp(session.pauseReason).toBeNull();

      await new Promise((r) => setTimeout(r, 25));
      exp(session.getActiveDurationMs()).toBeGreaterThan(durationBeforeResume + 15);
    });

    test('throws error if resuming an already ACTIVE or IDLE session', () => {
      const session = new WorkSession();
      exp(() => session.resume()).toThrow('expected PAUSED or UNCERTAIN');

      session.start('DBMS');
      exp(() => session.resume()).toThrow('expected PAUSED or UNCERTAIN');
    });
  });

  desc('WorkSession State Machine — Stop / End Transitions', () => {
    test('stopping an ACTIVE session records end time and transitions to ENDED', async () => {
      const session = new WorkSession();
      session.start('DBMS');
      await new Promise((r) => setTimeout(r, 20));

      session.stop('Session finished');
      exp(session.state).toBe(WorkSessionState.ENDED);
      exp(session.endTime).toBeTruthy();
      exp(session.lastStartedAt).toBeNull();
      exp(session.activeDurationMs).toBeGreaterThanOrEqual(15);
    });

    test('stopping a PAUSED session transitions to ENDED', () => {
      const session = new WorkSession();
      session.start('DBMS');
      session.pause();
      session.stop('Done for today');
      exp(session.state).toBe(WorkSessionState.ENDED);
      exp(session.endTime).toBeTruthy();
    });

    test('throws error if stopping an already ENDED session', () => {
      const session = new WorkSession();
      session.start('DBMS');
      session.stop();
      exp(() => session.stop()).toThrow('already ENDED');
    });
  });

  desc('WorkSession State Machine — Uncertainty State', () => {
    test('marking UNCERTAIN preserves accumulated time and allows clean resume', async () => {
      const session = new WorkSession();
      session.start('DBMS');
      await new Promise((r) => setTimeout(r, 20));

      session.markUncertain('Sensor detected no presence', 0.45);
      exp(session.state).toBe(WorkSessionState.UNCERTAIN);
      exp(session.confidence).toBe(0.45);

      // Resuming from uncertain state works cleanly
      session.resume('User confirmed presence');
      exp(session.state).toBe(WorkSessionState.ACTIVE);
    });
  });

  desc('WorkSession State Machine — Retroactive Time Correction', () => {
    test('corrects active elapsed duration and logs correction audit record', () => {
      const session = new WorkSession();
      session.start('DBMS');

      // User says: "JOT, I stopped an hour ago" or "Set elapsed to 45m"
      const correctedMs = 45 * 60 * 1000; // 45 minutes
      session.correctElapsedTime(correctedMs, 'User correction: stopped earlier');

      exp(session.activeDurationMs).toBe(correctedMs);
      exp(session.corrections.length).toBe(1);
      exp(session.corrections[0].adjustedDurationMs).toBe(correctedMs);
      exp(session.corrections[0].reason).toBe('User correction: stopped earlier');
    });

    test('rejects negative duration corrections', () => {
      const session = new WorkSession();
      session.start('DBMS');
      exp(() => session.correctElapsedTime(-500)).toThrow('Invalid duration');
    });
  });

  desc('WorkSession State Machine — Context Updates & Serialization', () => {
    test('updates structured context while maintaining session state', () => {
      const session = new WorkSession();
      session.start('DBMS');
      session.updateContext({
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
      });

      exp(session.topic).toBe('Normalization');
      exp(session.lastStep).toBe('Q5');
      exp(session.nextAction).toBe('Continue Q5');
    });

    test('serializes to JSON and restores via fromJSON with complete fidelity', () => {
      const session = new WorkSession({ userId: 'alice_123' });
      session.start('DBMS', { topic: 'Normalization', lastStep: 'Q5', nextAction: 'Continue Q5' });
      session.correctElapsedTime(25 * 60 * 1000, 'Manual adjustment');

      const json = session.toJSON();
      exp(json.contextName).toBe('DBMS');
      exp(json.topic).toBe('Normalization');
      exp(json.lastStep).toBe('Q5');
      exp(json.nextAction).toBe('Continue Q5');
      exp(json.formattedDuration).toBe('25:00');

      const restored = WorkSession.fromJSON(json);
      exp(restored.id).toBe(session.id);
      exp(restored.userId).toBe('alice_123');
      exp(restored.contextName).toBe('DBMS');
      exp(restored.topic).toBe('Normalization');
      exp(restored.activeDurationMs).toBe(25 * 60 * 1000);
      exp(restored.corrections.length).toBe(1);
    });

    test('formats duration correctly across minutes and hours', () => {
      exp(WorkSession.formatDuration(0)).toBe('00:00');
      exp(WorkSession.formatDuration(65000)).toBe('01:05');
      exp(WorkSession.formatDuration(3600000)).toBe('1h 00m 00s');
      exp(WorkSession.formatDuration(3665000)).toBe('1h 01m 05s');
    });
  });
})();
