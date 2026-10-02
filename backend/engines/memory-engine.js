/**
 * ECHODESK Backend — Stage 4: Echo Memory Engine
 * Implements structured work-session context persistence.
 * Stores: context, topic, last step, next action, status, active duration, user corrections, source, confidence.
 * Hard policy check forbids storing raw audio or raw video.
 */

class EchoMemoryEngine {
  constructor(options = {}) {
    this.privacyGate = options.privacyGate || null;
    this.memories = [];
  }

  save(memoryRecord) {
    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('SAVE_MEMORY', {
        containsRawSensorData: Boolean(memoryRecord.rawAudio || memoryRecord.rawVideo || memoryRecord.rawFrames),
      });
      if (!evaluation.allowed) {
        throw new Error(`Privacy Gate Denied: ${evaluation.reason}`);
      }
    }

    if (!memoryRecord || !memoryRecord.contextName) {
      throw new Error('contextName is required to save an Echo Memory record.');
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

    const existingIndex = this.memories.findIndex(
      (m) => m.contextName.toLowerCase() === cleanRecord.contextName.toLowerCase()
    );

    if (existingIndex >= 0) {
      this.memories[existingIndex] = { ...this.memories[existingIndex], ...cleanRecord };
    } else {
      this.memories.unshift(cleanRecord);
    }

    return cleanRecord;
  }

  get(contextName) {
    if (!contextName) return null;
    return this.memories.find((m) => m.contextName.toLowerCase() === contextName.toLowerCase()) || null;
  }

  getLatest() {
    return this.memories.length > 0 ? this.memories[0] : null;
  }

  getAll() {
    return [...this.memories];
  }

  update(contextName, updates = {}) {
    if (!contextName) return null;
    const index = this.memories.findIndex(
      (m) => m.contextName.toLowerCase() === contextName.toLowerCase()
    );
    if (index === -1) {
      return null;
    }

    const existing = this.memories[index];
    const updated = {
      ...existing,
      ...updates,
      contextName: existing.contextName, // preserve original context
      updatedAt: Date.now(),
    };

    this.memories[index] = updated;
    return updated;
  }

  delete(contextName) {
    const originalLength = this.memories.length;
    this.memories = this.memories.filter(
      (m) => m.contextName.toLowerCase() !== contextName.toLowerCase()
    );
    return this.memories.length < originalLength;
  }

  clearAll() {
    const count = this.memories.length;
    this.memories = [];
    return count;
  }

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

module.exports = { EchoMemoryEngine };
