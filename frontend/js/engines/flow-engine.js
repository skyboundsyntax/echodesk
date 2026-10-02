/**
 * ECHODESK — Flow & Intervention Policy Engine
 * Implements Stage 5 of the Antigravity Build Plan:
 * Adaptive, respectful focus protection and smart check-in policy.
 * 
 * Non-negotiables:
 * - Product policy engine only: does NOT claim scientific/medical flow measurement.
 * - At 25-minute Pomodoro threshold: strictly protects flow instead of forcing an interruption.
 * - Respects user interruption preferences: minimal (45m/quiet), balanced (30m), frequent (15m).
 * - Absence grace period (12s demo default) before asking to pause; immediate reset on return.
 * - Explainable decisions: concise reasons based on observable product rules.
 */

const FlowDecision = Object.freeze({
  STAY_SILENT: 'STAY_SILENT',
  SHOW_FLOW_STATUS: 'SHOW_FLOW_STATUS',
  OFFER_CHECKIN: 'OFFER_CHECKIN',
  ASK_PAUSE: 'ASK_PAUSE',
});

const CheckInType = Object.freeze({
  WATER: { id: 'water', icon: '💧', title: 'Hydration Reset', text: 'Grab a sip of water before continuing.' },
  LOOK_AWAY: { id: 'look_away', icon: '👀', title: 'Look Away', text: 'Rest your eyes: look at something 20 feet away for 20 seconds.' },
  BREATH: { id: 'breath', icon: '🫁', title: 'Three Breaths', text: 'Take three deep breaths to ground your focus.' },
  MOVEMENT: { id: 'movement', icon: '🧘', title: 'Movement Reset', text: 'Stand up, roll your shoulders back, and release tension.' },
  STRETCH: { id: 'movement', icon: '🧘', title: 'Movement Reset', text: 'Stand up, roll your shoulders back, and release tension.' },
});

class FlowEngine {
  static get DISCLAIMER() {
    return 'ECHODESK provides a product flow-support policy engine based on observable session state and presence signals. It does not claim psychological or medical flow state measurement.';
  }

  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.appStorage : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    // Intervention preference: 'minimal' | 'balanced' | 'frequent'
    this.preference = this._loadPreference();
    this.lastInterventionAt = 0;
    this.checkInIndex = 0;
    this.checkInQueue = [
      CheckInType.WATER,
      CheckInType.LOOK_AWAY,
      CheckInType.BREATH,
      CheckInType.MOVEMENT,
    ];

    // Absence tracking for pause detection
    this.absenceStartedAt = null;
    this.absenceGracePeriodMs = options.absenceGracePeriodMs || 12000; // 12 seconds in demo mode before asking
    this.recentDecisions = [];
  }

  _loadPreference() {
    if (this.storage && typeof this.storage.get === 'function') {
      return this.storage.get('intervention_preference', 'minimal');
    }
    return 'minimal';
  }

  setPreference(pref) {
    if (['minimal', 'balanced', 'frequent'].includes(pref)) {
      this.preference = pref;
      if (this.storage && typeof this.storage.set === 'function') {
        this.storage.set('intervention_preference', pref);
      }
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('flow:preference-changed', pref);
      }
    }
  }

  getPreference() {
    return this.preference;
  }

  getPolicyInfo() {
    return {
      preference: this.preference,
      intervalsMs: {
        minimal: 45 * 60 * 1000,
        balanced: 30 * 60 * 1000,
        frequent: 15 * 60 * 1000,
      },
      absenceGracePeriodMs: this.absenceGracePeriodMs,
      pomodoroThresholdMs: 25 * 60 * 1000,
      disclaimer: FlowEngine.DISCLAIMER,
      lastInterventionAt: this.lastInterventionAt,
    };
  }

  /**
   * Evaluate whether JOT should speak, check in, or stay silent.
   * @param {Object} context
   * @param {string} context.sessionState 'ACTIVE' | 'PAUSED' | 'ENDED' | 'UNCERTAIN' | 'IDLE'
   * @param {number} context.activeDurationMs
   * @param {string} [context.presenceSignal] 'PRESENT' | 'ABSENT' | 'UNCERTAIN'
   * @param {boolean} [context.naturalPause] Whether a natural pause or break is detected
   * @param {boolean} [context.highEngagement] Whether active flow engagement is currently high
   * @param {boolean} [context.urgentCheckIn] Whether check-in is urgent
   * @param {number} [context.now] Optional timestamp override for deterministic tests
   * @param {string} [context.preference] Optional preference override
   * @param {number} [context.lastInterventionAt] Optional timestamp override
   * @param {number} [context.absenceGracePeriodMs] Optional grace period override
   * @returns {{ decision: string, reason: string, checkIn?: Object, flowProtected?: boolean, prompt?: string }}
   */
  evaluate(context = {}) {
    const { sessionState, activeDurationMs = 0, presenceSignal = 'PRESENT' } = context;
    const now = typeof context.now === 'number' ? context.now : Date.now();
    const pref = context.preference || this.preference;
    const gracePeriodMs = typeof context.absenceGracePeriodMs === 'number'
      ? context.absenceGracePeriodMs
      : this.absenceGracePeriodMs;

    // 1. Natural Pause Detected -> OFFER_CHECKIN
    if (context.naturalPause) {
      this.absenceStartedAt = null;
      const checkIn = this.getNextCheckIn(now);
      return {
        decision: FlowDecision.OFFER_CHECKIN,
        reason: 'Natural pause detected. Good opportunity for a gentle reset.',
        checkIn,
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // 2. High Engagement + Non-Urgent Check-In -> STAY_SILENT
    if ((context.highEngagement || context.flowEngagement === 'high') && !context.urgentCheckIn) {
      return {
        decision: FlowDecision.STAY_SILENT,
        flowProtected: true,
        reason: 'Active flow-support is high and check-in is non-urgent. JOT stays silent.',
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // 3. Non-active sessions: Stay silent
    if (sessionState !== 'ACTIVE') {
      this.absenceStartedAt = null;
      return {
        decision: FlowDecision.STAY_SILENT,
        reason: `Session is ${sessionState || 'IDLE'}. No active flow to monitor.`,
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // 2. Absence / Pause Detection
    if (presenceSignal === 'ABSENT') {
      if (!this.absenceStartedAt) {
        this.absenceStartedAt = now;
      }
      const absenceElapsedMs = now - this.absenceStartedAt;
      if (absenceElapsedMs >= gracePeriodMs) {
        return {
          decision: FlowDecision.ASK_PAUSE,
          reason: `User absence detected for ${Math.round(absenceElapsedMs / 1000)}s exceeding grace period.`,
          prompt: 'Looks like you stepped away. Pause session?',
          absenceDurationMs: absenceElapsedMs,
          disclaimer: FlowEngine.DISCLAIMER,
        };
      }
      return {
        decision: FlowDecision.STAY_SILENT,
        reason: `Absence detected within ${Math.round(gracePeriodMs / 1000)}s grace period. Giving user time.`,
        absenceDurationMs: absenceElapsedMs,
        disclaimer: FlowEngine.DISCLAIMER,
      };
    } else {
      this.absenceStartedAt = null;
    }

    // 3. Timing & Thresholds
    const pomodoroThresholdMs = 25 * 60 * 1000;
    const isPastPomodoro = activeDurationMs >= pomodoroThresholdMs;

    const minIntervalMs =
      pref === 'minimal' ? 45 * 60 * 1000 :
      pref === 'balanced' ? 30 * 60 * 1000 :
      15 * 60 * 1000;

    const lastAt = typeof context.lastInterventionAt === 'number'
      ? context.lastInterventionAt
      : this.lastInterventionAt;

    const timeSinceLastIntervention = now - lastAt;

    // 4. Pomodoro Threshold Flow Protection (>= 25 minutes)
    // Rule: Never force an interruption on active flow at 25 minutes
    if (isPastPomodoro && timeSinceLastIntervention < minIntervalMs) {
      return {
        decision: FlowDecision.SHOW_FLOW_STATUS,
        flowProtected: true,
        reason: 'Flow protected — 25m reached, user engaged. JOT is staying quiet.',
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // 5. Minimal Reminders Preference
    if (pref === 'minimal') {
      if (timeSinceLastIntervention >= minIntervalMs) {
        const checkIn = this.getNextCheckIn(now);
        return {
          decision: FlowDecision.OFFER_CHECKIN,
          reason: 'Extended focus threshold reached (minimal policy). Offering gentle micro reset.',
          checkIn,
          disclaimer: FlowEngine.DISCLAIMER,
        };
      }
      return {
        decision: FlowDecision.STAY_SILENT,
        flowProtected: true,
        reason: 'Intervention preference is minimal. JOT remains silent.',
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // 6. Balanced & Frequent Policy Intervals
    if (timeSinceLastIntervention >= minIntervalMs) {
      const checkIn = this.getNextCheckIn(now);
      return {
        decision: FlowDecision.OFFER_CHECKIN,
        reason: `Check-in interval reached (${pref} policy). Offering gentle micro reset.`,
        checkIn,
        disclaimer: FlowEngine.DISCLAIMER,
      };
    }

    // Default: Session in normal uninterrupted flow
    return {
      decision: FlowDecision.STAY_SILENT,
      flowProtected: true,
      reason: 'Session in normal active flow.',
      disclaimer: FlowEngine.DISCLAIMER,
    };
  }

  /**
   * Fetch the next cyclical check-in
   * @param {number} [timestamp]
   * @returns {Object}
   */
  getNextCheckIn(timestamp = Date.now()) {
    const checkIn = this.checkInQueue[this.checkInIndex % this.checkInQueue.length];
    this.checkInIndex++;
    this.lastInterventionAt = timestamp;
    return checkIn;
  }

  /**
   * User feedback after a check-in is presented
   * @param {string} response 'accepted' | 'dismissed'
   * @param {number} [timestamp]
   */
  recordInterventionResponse(response = 'accepted', timestamp = Date.now()) {
    this.lastInterventionAt = timestamp;
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('flow:intervention-response', { response, timestamp });
    }
  }

  /**
   * Transparently explain recent policy decisions without hallucination or hidden chain-of-thought
   * @param {string} query
   * @param {Object} [context]
   * @returns {{ topic: string, explanation: string, rule: string }}
   */
  explainDecision(query = '', context = {}) {
    const q = query.toLowerCase();
    const pref = context.preference || this.preference;

    if (q.includes('pause') || q.includes('step away') || q.includes('stepped away') || q.includes('away')) {
      return {
        topic: 'PAUSE_DECISION',
        explanation: 'I detected a possible absence exceeding the 12-second grace period. I asked for confirmation before pausing to protect your focus context without making assumptions.',
        rule: 'Presence absence detection with 12s grace period + user confirmation guard',
      };
    }

    if (q.includes('remind') || q.includes('checkin') || q.includes('check-in') || q.includes('interrupt') || q.includes('quiet') || q.includes('alarm')) {
      return {
        topic: 'INTERVENTION_DECISION',
        explanation: `You were in an active focus session and your interruption preference is set to "${pref}". JOT protects your flow rather than firing intrusive alarms.`,
        rule: `Intervention policy: ${pref} frequency threshold + flow protection`,
      };
    }

    if (q.includes('pomodoro') || q.includes('25')) {
      return {
        topic: 'POMODORO_POLICY',
        explanation: 'At 25 minutes, JOT does not force a break. Instead, it stays quiet with "Flow protected — JOT is staying quiet" to avoid derailing your concentration.',
        rule: 'Anti-disruption Pomodoro override',
      };
    }

    return {
      topic: 'FLOW_POLICY_GENERAL',
      explanation: `ECHODESK evaluates session state, active duration, presence, and your preference ("${pref}") to decide when to stay quiet, offer a check-in, or ask before pausing.`,
      rule: 'Product flow-support policy engine (no psychological claims)',
    };
  }
}

if (typeof window !== 'undefined') {
  window.FlowEngine = FlowEngine;
  window.FlowDecision = FlowDecision;
  window.CheckInType = CheckInType;
  window.flowEngine = window.flowEngine || new FlowEngine();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FlowEngine, FlowDecision, CheckInType };
}
