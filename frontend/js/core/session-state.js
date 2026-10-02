/**
 * ECHODESK — Work Session State Machine
 * Implements Stage 1 of the Antigravity Build Plan:
 * States: IDLE, ACTIVE, PAUSED, ENDED, UNCERTAIN
 * Real duration math, timestamp accounting, retroactive time adjustments, and state transition validation.
 */

const WorkSessionState = Object.freeze({
  IDLE: 'IDLE',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  UNCERTAIN: 'UNCERTAIN',
});

const ContextSource = Object.freeze({
  USER_DECLARED: 'user_declared',
  USER_SHARED: 'user_shared',
  LOCAL_SENSOR: 'local_sensor_signal',
  APPLICATION_STATE: 'application_state',
  INFERRED: 'inferred',
});

class WorkSession {
  /**
   * @param {Object} [options]
   * @param {string} [options.id]
   * @param {string} [options.userId]
   * @param {EventBus} [options.eventBus]
   */
  constructor(options = {}) {
    this.id = options.id || this._generateId();
    this.userId = options.userId || 'user_local';
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    // Context attributes
    this.contextName = '';
    this.topic = '';
    this.lastStep = '';
    this.nextAction = '';
    this.mode = 'standard'; // 'standard' | 'zen'
    this.source = ContextSource.USER_DECLARED;
    this.confidence = 1.0;

    // State machine attributes
    this.state = WorkSessionState.IDLE;
    this.startTime = null; // ms timestamp
    this.endTime = null; // ms timestamp
    this.activeDurationMs = 0; // accumulated ms spent in ACTIVE state
    this.lastStartedAt = null; // timestamp when the current ACTIVE segment began
    this.pauseReason = null;

    // Audit and transition history
    this.history = [];
    this.corrections = [];
  }

  _generateId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Start a work session
   * @param {string} contextName e.g. "DBMS"
   * @param {Object} [meta] additional metadata
   * @returns {WorkSession}
   */
  start(contextName, meta = {}) {
    if (this.state === WorkSessionState.ACTIVE) {
      throw new Error(`Cannot start session: already ACTIVE in context "${this.contextName}".`);
    }

    if (!contextName || typeof contextName !== 'string' || !contextName.trim()) {
      throw new Error('Cannot start session: contextName is required.');
    }

    const now = Date.now();
    const previousState = this.state;

    this.contextName = contextName.trim();
    this.topic = meta.topic || this.topic || '';
    this.lastStep = meta.lastStep || this.lastStep || '';
    this.nextAction = meta.nextAction || this.nextAction || '';
    this.mode = meta.mode || 'standard';
    this.source = meta.source || ContextSource.USER_DECLARED;
    this.confidence = typeof meta.confidence === 'number' ? meta.confidence : 1.0;

    this.startTime = now;
    this.endTime = null;
    this.lastStartedAt = now;
    this.activeDurationMs = 0;
    this.pauseReason = null;
    this.state = WorkSessionState.ACTIVE;

    this._recordTransition(previousState, WorkSessionState.ACTIVE, 'Session started', meta);
    this._emit('session:started', this.toJSON());
    this._emit('session:state-change', { from: previousState, to: WorkSessionState.ACTIVE, session: this.toJSON() });

    return this;
  }

  /**
   * Pause the active session
   * @param {string} [reason]
   * @returns {WorkSession}
   */
  pause(reason = 'User paused') {
    if (this.state !== WorkSessionState.ACTIVE) {
      throw new Error(`Cannot pause session: current state is ${this.state}, expected ACTIVE.`);
    }

    const now = Date.now();
    const elapsedSinceLastStart = now - (this.lastStartedAt || now);
    this.activeDurationMs += Math.max(0, elapsedSinceLastStart);
    this.lastStartedAt = null;
    this.pauseReason = reason;

    const previousState = this.state;
    this.state = WorkSessionState.PAUSED;

    this._recordTransition(previousState, WorkSessionState.PAUSED, reason);
    this._emit('session:paused', { reason, activeDurationMs: this.activeDurationMs, session: this.toJSON() });
    this._emit('session:state-change', { from: previousState, to: WorkSessionState.PAUSED, session: this.toJSON() });

    return this;
  }

  /**
   * Resume a paused session
   * @param {string} [reason]
   * @returns {WorkSession}
   */
  resume(reason = 'User resumed') {
    if (this.state !== WorkSessionState.PAUSED && this.state !== WorkSessionState.UNCERTAIN) {
      throw new Error(`Cannot resume session: current state is ${this.state}, expected PAUSED or UNCERTAIN.`);
    }

    const now = Date.now();
    this.lastStartedAt = now;
    this.pauseReason = null;

    const previousState = this.state;
    this.state = WorkSessionState.ACTIVE;

    this._recordTransition(previousState, WorkSessionState.ACTIVE, reason);
    this._emit('session:resumed', { reason, session: this.toJSON() });
    this._emit('session:state-change', { from: previousState, to: WorkSessionState.ACTIVE, session: this.toJSON() });

    return this;
  }

  /**
   * Stop and end the session
   * @param {string} [reason]
   * @returns {WorkSession}
   */
  stop(reason = 'User stopped') {
    if (this.state === WorkSessionState.ENDED || this.state === WorkSessionState.IDLE) {
      throw new Error(`Cannot stop session: session is already ${this.state}.`);
    }

    const now = Date.now();
    if (this.state === WorkSessionState.ACTIVE && this.lastStartedAt) {
      this.activeDurationMs += Math.max(0, now - this.lastStartedAt);
    }
    this.lastStartedAt = null;
    this.endTime = now;

    const previousState = this.state;
    this.state = WorkSessionState.ENDED;

    this._recordTransition(previousState, WorkSessionState.ENDED, reason);
    this._emit('session:stopped', { reason, activeDurationMs: this.activeDurationMs, session: this.toJSON() });
    this._emit('session:state-change', { from: previousState, to: WorkSessionState.ENDED, session: this.toJSON() });

    return this;
  }

  /**
   * Mark session as UNCERTAIN (e.g. sensor detected possible absence, awaiting confirmation)
   * @param {string} reason
   * @param {number} confidence
   */
  markUncertain(reason = 'Potential pause detected', confidence = 0.5) {
    if (this.state !== WorkSessionState.ACTIVE) {
      return this;
    }

    const now = Date.now();
    if (this.lastStartedAt) {
      this.activeDurationMs += Math.max(0, now - this.lastStartedAt);
      this.lastStartedAt = now; // reset anchor while uncertain
    }

    const previousState = this.state;
    this.state = WorkSessionState.UNCERTAIN;
    this.confidence = confidence;

    this._recordTransition(previousState, WorkSessionState.UNCERTAIN, reason);
    this._emit('session:uncertain', { reason, confidence, session: this.toJSON() });
    this._emit('session:state-change', { from: previousState, to: WorkSessionState.UNCERTAIN, session: this.toJSON() });

    return this;
  }

  /**
   * Correct elapsed time retroactively (e.g. "JOT, I stopped an hour ago")
   * @param {number} adjustedDurationMs The corrected active duration in ms
   * @param {string} [reason] Explanation for audit log
   */
  correctElapsedTime(adjustedDurationMs, reason = 'User retroactive correction') {
    if (typeof adjustedDurationMs !== 'number' || adjustedDurationMs < 0) {
      throw new Error('Invalid duration: must be a positive number of milliseconds.');
    }

    const originalDurationMs = this.getActiveDurationMs();
    const diffMs = adjustedDurationMs - originalDurationMs;

    this.activeDurationMs = adjustedDurationMs;
    if (this.state === WorkSessionState.ACTIVE) {
      // Re-anchor lastStartedAt to current time so delta begins from here
      this.lastStartedAt = Date.now();
    }

    const record = {
      timestamp: Date.now(),
      originalDurationMs,
      adjustedDurationMs,
      diffMs,
      reason,
    };
    this.corrections.push(record);

    this._emit('session:corrected', { record, session: this.toJSON() });
    return this;
  }

  /**
   * Update structured context (topic, step, next action)
   * @param {Object} updates
   */
  updateContext(updates = {}) {
    if (updates.contextName) this.contextName = updates.contextName.trim();
    if (updates.topic !== undefined) this.topic = updates.topic;
    if (updates.lastStep !== undefined) this.lastStep = updates.lastStep;
    if (updates.nextAction !== undefined) this.nextAction = updates.nextAction;
    if (updates.mode) this.mode = updates.mode;
    if (updates.source) this.source = updates.source;
    if (typeof updates.confidence === 'number') this.confidence = updates.confidence;

    this._emit('session:context-updated', this.toJSON());
    return this;
  }

  /**
   * Get accurate active duration in milliseconds based on current real time.
   * If currently ACTIVE, calculates base active duration + time since current segment began.
   * @returns {number}
   */
  getActiveDurationMs() {
    if (this.state === WorkSessionState.ACTIVE && this.lastStartedAt) {
      return this.activeDurationMs + Math.max(0, Date.now() - this.lastStartedAt);
    }
    return this.activeDurationMs;
  }

  /**
   * Format active duration into "MM:SS" or "Xh Ym"
   * @param {number} [durationMs]
   * @returns {string}
   */
  static formatDuration(durationMs) {
    if (typeof durationMs !== 'number' || isNaN(durationMs) || durationMs < 0) {
      return '00:00';
    }
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  _recordTransition(from, to, reason, meta = {}) {
    this.history.push({
      from,
      to,
      reason,
      timestamp: Date.now(),
      activeDurationMsAtTransition: this.activeDurationMs,
      meta,
    });
  }

  _emit(event, data) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(event, data);
    }
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      contextName: this.contextName,
      topic: this.topic,
      lastStep: this.lastStep,
      nextAction: this.nextAction,
      mode: this.mode,
      source: this.source,
      confidence: this.confidence,
      state: this.state,
      startTime: this.startTime,
      endTime: this.endTime,
      activeDurationMs: this.getActiveDurationMs(),
      formattedDuration: WorkSession.formatDuration(this.getActiveDurationMs()),
      pauseReason: this.pauseReason,
      historyCount: this.history.length,
      corrections: [...this.corrections],
    };
  }

  /**
   * Create WorkSession instance from stored plain JSON object
   * @param {Object} json
   * @param {EventBus} [eventBus]
   * @returns {WorkSession}
   */
  static fromJSON(json, eventBus = null) {
    const session = new WorkSession({ id: json.id, userId: json.userId, eventBus });
    session.contextName = json.contextName || '';
    session.topic = json.topic || '';
    session.lastStep = json.lastStep || '';
    session.nextAction = json.nextAction || '';
    session.mode = json.mode || 'standard';
    session.source = json.source || ContextSource.USER_DECLARED;
    session.confidence = typeof json.confidence === 'number' ? json.confidence : 1.0;
    session.state = json.state || WorkSessionState.IDLE;
    session.startTime = json.startTime || null;
    session.endTime = json.endTime || null;
    session.activeDurationMs = json.activeDurationMs || 0;
    session.pauseReason = json.pauseReason || null;
    session.corrections = Array.isArray(json.corrections) ? [...json.corrections] : [];
    return session;
  }
}

if (typeof window !== 'undefined') {
  window.WorkSession = WorkSession;
  window.WorkSessionState = WorkSessionState;
  window.ContextSource = ContextSource;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkSession, WorkSessionState, ContextSource };
}
