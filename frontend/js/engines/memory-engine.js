/**
 * ECHODESK — Echo Memory Engine
 * Implements Stage 4 of the Antigravity Build Plan:
 * Stores minimal, structured work-session state (context, topic, last step, next action, duration).
 * Strictly forbids storing raw sensor data.
 * Enforces PrivacyPolicyGate on write/delete and provides full user control.
 */

class EchoMemoryEngine {
  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.appStorage : null);
    this.privacyGate = options.privacyGate || (typeof window !== 'undefined' ? window.privacyGate : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);
    this.storageKey = 'echo_memories';
  }

  _load() {
    if (!this.storage) return [];
    return this.storage.get(this.storageKey, []);
  }

  _save(list) {
    if (!this.storage) return;
    this.storage.set(this.storageKey, list);
    if (this.eventBus) {
      this.eventBus.emit('memory:updated', list);
    }
  }

  /**
   * Save or update structured work-session memory
   * @param {Object} memoryRecord
   * @returns {boolean}
   */
  save(memoryRecord) {
    // 1. Privacy Gate check
    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('SAVE_MEMORY', {
        containsRawSensorData: Boolean(memoryRecord.rawAudio || memoryRecord.rawVideo || memoryRecord.rawFrames),
      });
      if (!evaluation.allowed) {
        console.warn('[EchoMemory] Save denied by privacy gate:', evaluation.reason);
        return false;
      }
    }

    if (!memoryRecord.contextName) {
      console.warn('[EchoMemory] Cannot save record without contextName.');
      return false;
    }

    const cleanRecord = {
      id: memoryRecord.id || `mem_${Date.now()}`,
      contextName: memoryRecord.contextName.trim(),
      topic: memoryRecord.topic || '',
      lastStep: memoryRecord.lastStep || '',
      nextAction: memoryRecord.nextAction || '',
      status: memoryRecord.status || 'paused',
      activeDurationMs: memoryRecord.activeDurationMs || 0,
      formattedDuration: memoryRecord.formattedDuration || '00:00',
      source: memoryRecord.source || 'user_declared',
      confidence: typeof memoryRecord.confidence === 'number' ? memoryRecord.confidence : 1.0,
      corrections: memoryRecord.corrections || [],
      updatedAt: Date.now(),
    };

    const list = this._load();
    const existingIndex = list.findIndex(
      (m) => m.contextName.toLowerCase() === cleanRecord.contextName.toLowerCase()
    );

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...cleanRecord };
    } else {
      list.unshift(cleanRecord);
    }

    this._save(list);
    return true;
  }

  /**
   * Retrieve memory record by context name
   * @param {string} contextName
   * @returns {Object|null}
   */
  get(contextName) {
    if (!contextName) return null;
    const list = this._load();
    return list.find((m) => m.contextName.toLowerCase() === contextName.toLowerCase()) || null;
  }

  /**
   * Retrieve the most recently worked-on context memory
   * @returns {Object|null}
   */
  getLatest() {
    const list = this._load();
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Retrieve all saved memories
   * @returns {Array<Object>}
   */
  getAll() {
    return this._load();
  }

  /**
   * Delete a specific context memory
   * @param {string} contextName
   */
  delete(contextName) {
    const list = this._load().filter(
      (m) => m.contextName.toLowerCase() !== contextName.toLowerCase()
    );
    this._save(list);
  }

  /**
   * Delete all stored memories (User-requested purge)
   */
  clearAll() {
    this._save([]);
    if (this.eventBus) {
      this.eventBus.emit('memory:cleared', {});
    }
  }

  /**
   * Format resume message based on real structured state
   * @param {string} [contextName]
   * @returns {string}
   */
  formatResumeGreeting(contextName) {
    const mem = contextName ? this.get(contextName) : this.getLatest();
    if (!mem) {
      return 'Welcome back. Ready when you are.';
    }

    if (mem.lastStep && mem.topic) {
      return `Welcome back. You were working on ${mem.lastStep} — ${mem.topic}.`;
    }
    if (mem.lastStep) {
      return `Welcome back. You were on ${mem.lastStep}.`;
    }
    if (mem.topic) {
      return `Welcome back. You were studying ${mem.contextName} (${mem.topic}).`;
    }
    return `Welcome back. Resuming ${mem.contextName}.`;
  }
}

if (typeof window !== 'undefined') {
  window.EchoMemoryEngine = EchoMemoryEngine;
  window.echoMemory = window.echoMemory || new EchoMemoryEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EchoMemoryEngine };
}
