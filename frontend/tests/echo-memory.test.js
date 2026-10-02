/**
 * ECHODESK — Stage 4: Echo Memory Test Suite
 * Validates requirements from docs/echodesk_prd_pack/07_ANTIGRAVITY_BUILD_PLAN.md:
 * - Structured context storage (context, topic, last step, next action, status, active duration, source, confidence)
 * - Save, retrieve, update, delete, clearAll methods
 * - Strict prohibition of raw sensor storage
 * - Structured context restoration greeting (not a fake static string)
 * - Privacy Policy Gate enforcement on memory writes
 */

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const { EchoMemoryEngine } = isNode
    ? require('../js/engines/memory-engine.js')
    : window;
  const { StorageAdapter } = isNode
    ? require('../js/core/storage.js')
    : window;
  const { PrivacyPolicyGate } = isNode
    ? require('../js/engines/privacy-gate.js')
    : window;

  const desc = isNode ? describe : window.describe;
  const test = isNode ? it : window.it;
  const exp = isNode ? expect : window.expect;

  desc('Stage 4 — Echo Memory: Structured Persistence (CRUD)', () => {
    test('Saves structured memory record with required metadata', () => {
      const storage = new StorageAdapter('test_mem_crud_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      const saved = memory.save({
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
        status: 'paused',
        activeDurationMs: 47 * 60 * 1000,
        formattedDuration: '47:00',
        source: 'user_declared',
        confidence: 0.98,
      });

      exp(saved).toBe(true);

      const record = memory.get('DBMS');
      exp(record).toBeTruthy();
      exp(record.contextName).toBe('DBMS');
      exp(record.topic).toBe('Normalization');
      exp(record.lastStep).toBe('Q5');
      exp(record.nextAction).toBe('Continue Q5');
      exp(record.status).toBe('paused');
      exp(record.formattedDuration).toBe('47:00');
      exp(record.confidence).toBe(0.98);
    });

    test('Retrieves latest memory record', () => {
      const storage = new StorageAdapter('test_mem_latest_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({ contextName: 'Algorithms', lastStep: 'MergeSort' });
      memory.save({ contextName: 'DBMS', topic: 'Normalization', lastStep: 'Q5' });

      const latest = memory.getLatest();
      exp(latest).toBeTruthy();
      exp(latest.contextName).toBe('DBMS');
      exp(latest.lastStep).toBe('Q5');
    });

    test('Updates existing memory record while preserving context identity', () => {
      const storage = new StorageAdapter('test_mem_upd_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({ contextName: 'DBMS', topic: 'SQL', lastStep: 'Q1' });
      const updated = memory.update('DBMS', {
        topic: 'Normalization',
        lastStep: 'Q5',
        nextAction: 'Continue Q5',
      });

      exp(updated).toBeTruthy();
      exp(updated.topic).toBe('Normalization');
      exp(updated.lastStep).toBe('Q5');
      exp(updated.nextAction).toBe('Continue Q5');

      const retrieved = memory.get('DBMS');
      exp(retrieved.lastStep).toBe('Q5');
    });

    test('Deletes individual context memory', () => {
      const storage = new StorageAdapter('test_mem_del_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({ contextName: 'DBMS', lastStep: 'Q5' });
      memory.save({ contextName: 'CN', lastStep: 'TCP Handshake' });

      memory.delete('DBMS');
      exp(memory.get('DBMS')).toBeNull();
      exp(memory.get('CN')).toBeTruthy();
    });

    test('Clears all stored memories', () => {
      const storage = new StorageAdapter('test_mem_clear_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({ contextName: 'DBMS' });
      memory.save({ contextName: 'CN' });
      exp(memory.getAll().length).toBe(2);

      memory.clearAll();
      exp(memory.getAll().length).toBe(0);
    });
  });

  desc('Stage 4 — Echo Memory: Structured Resumption Greetings', () => {
    test('Formats greeting dynamically based on lastStep and topic', () => {
      const storage = new StorageAdapter('test_mem_greet_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({
        contextName: 'DBMS',
        topic: 'Normalization',
        lastStep: 'Q5',
      });

      const greeting = memory.formatResumeGreeting('DBMS');
      exp(greeting).toBe('Welcome back. You were working on Q5 — Normalization.');
    });

    test('Formats greeting when only lastStep is known', () => {
      const storage = new StorageAdapter('test_mem_step_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      memory.save({
        contextName: 'Compiler Design',
        lastStep: 'Parser AST',
      });

      const greeting = memory.formatResumeGreeting('Compiler Design');
      exp(greeting).toBe('Welcome back. You were on Parser AST.');
    });

    test('Provides graceful fallback greeting when no memory exists', () => {
      const storage = new StorageAdapter('test_mem_empty_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage });

      const greeting = memory.formatResumeGreeting('Unknown');
      exp(greeting).toBe('Welcome back. Ready when you are.');
    });
  });

  desc('Stage 4 — Echo Memory: Privacy Gate Protection & Sensor Prohibitions', () => {
    test('Strictly rejects storing raw sensor data in memory records', () => {
      const gate = new PrivacyPolicyGate();
      const storage = new StorageAdapter('test_mem_priv_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage, privacyGate: gate });

      // Attempt saving raw video/audio payload
      const rejectedAudio = memory.save({
        contextName: 'DBMS',
        rawAudio: 'blob:audio_bytes_raw',
      });
      exp(rejectedAudio).toBe(false);

      const rejectedVideo = memory.save({
        contextName: 'DBMS',
        rawVideo: 'blob:video_frames_raw',
      });
      exp(rejectedVideo).toBe(false);
    });

    test('Rejects memory creation when memory is disabled in Privacy Center', () => {
      const gate = new PrivacyPolicyGate();
      gate.savePermissions({ memoryEnabled: false });

      const storage = new StorageAdapter('test_mem_dis_');
      storage.clearAll();
      const memory = new EchoMemoryEngine({ storage, privacyGate: gate });

      const saved = memory.save({ contextName: 'DBMS' });
      exp(saved).toBe(false);
      exp(memory.getAll().length).toBe(0);
    });
  });
})();
