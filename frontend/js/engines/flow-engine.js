/**
 * ECHODESK — Flow & Intervention Policy Engine
 * Implements Stage 5 of the Antigravity Build Plan:
 * Adaptive, respectful focus protection.
 * Evaluates session state, elapsed duration, presence signals, and user preferences.
 * At 25 minutes (Pomodoro threshold), strictly protects flow rather than forcing an interruption.
 */

const FlowDecision = Object.freeze({
  STAY_SILENT: 'STAY_SILENT',
  SHOW_FLOW_STATUS: 'SHOW_FLOW_STATUS',
  OFFER_CHECKIN: 'OFFER_CHECKIN',
  ASK_PAUSE: 'ASK_PAUSE',
});

const CheckInType = Object.freeze({
  WATER: { id: 'water', icon: '💧', title: 'Quick Reset', text: 'Grab some water before continuing.' },
  LOOK_AWAY: { id: 'look_away', icon: '👀', title: 'Micro Reset', text: 'Look away from the screen for 20 seconds.' },
  BREATH: { id: 'breath', icon: '🫁', title: 'Three Breaths', text: 'Three deep breaths to ground your focus.' },
  STRETCH: { id: 'stretch', icon: '🧘', title: 'Posture Check', text: 'Roll your shoulders back and relax your jaw.' },
});

class FlowEngine {
  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.appStorage : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    // Intervention preference: 'minimal' | 'balanced' | 'frequent'
    this.preference = this._loadPreference();
    this.lastInterventionAt = 0;
    this.checkInIndex = 0;
    this.checkInQueue = [CheckInType.WATER, CheckInType.LOOK_AWAY, CheckInType.BREATH, CheckInType.STRETCH];

    // Absence tracking for pause detection
    this.absenceStartedAt = null;
    this.absenceGracePeriodMs = 12000; // 12 seconds in demo mode before asking
  }

  _loadPreference() {
    if (this.storage) {
      return this.storage.get('intervention_preference', 'minimal');
    }
    return 'minimal';
  }

  setPreference(pref) {
    if (['minimal', 'balanced', 'frequent'].includes(pref)) {
      this.preference = pref;
      if (this.storage) {
        this.storage.set('intervention_preference', pref);
      }
      if (this.eventBus) {
        this.eventBus.emit('flow:preference-changed', pref);
      }
    }
  }

  getPreference() {
    return this.preference;
  }

  /**
   * Evaluate whether JOT should speak, check in, or stay silent.
   * @param {Object} context
   * @param {string} context.sessionState 'ACTIVE' | 'PAUSED' | 'ENDED' | 'UNCERTAIN'
   * @param {number} context.activeDurationMs
   * @param {string} [context.presenceSignal] 'PRESENT' | 'ABSENT' | 'UNCERTAIN'
   * @returns {{ decision: string, reason: string, checkIn?: Object, flowProtected?: boolean }}
   */
  evaluate(context) {
    const { sessionState, activeDurationMs, presenceSignal } = context;
    const now = Date.now();

    // 1. If not active, stay silent
    if (sessionState !== 'ACTIVE') {
      this.absenceStartedAt = null;
      return {
        decision: FlowDecision.STAY_SILENT,
        reason: `Session is ${sessionState}. No active flow to monitor.`,
      };
    }

    // 2. Absence / Pause Detection
    if (presenceSignal === 'ABSENT') {
      if (!this.absenceStartedAt) {
        this.absenceStartedAt = now;
      }
      const absenceElapsedMs = now - this.absenceStartedAt;
      if (absenceElapsedMs >= this.absenceGracePeriodMs) {
        return {
          decision: FlowDecision.ASK_PAUSE,
          reason: `User absence detected for ${Math.round(absenceElapsedMs / 1000)}s exceeding grace period.`,
          prompt: 'Looks like you stepped away. Pause session?',
        };
      }
      return {
        decision: FlowDecision.STAY_SILENT,
        reason: `Absence detected within ${Math.round(this.absenceGracePeriodMs / 1000)}s grace period. Giving user time.`,
      };
    } else {
      this.absenceStartedAt = null;
    }

    // 3. Pomodoro Threshold Flow Protection (e.g. 25 minutes = 1,500,000 ms)
    // In demo environment, we check >= 25s for fast demonstration or normal threshold
    const pomodoroThresholdMs = 25 * 60 * 1000;
    const isPastPomodoro = activeDurationMs >= pomodoroThresholdMs;

    // Minimum gap between check-ins based on user preference
    const minIntervalMs =
      this.preference === 'minimal' ? 45 * 60 * 1000 :
      this.preference === 'balanced' ? 30 * 60 * 1000 :
      15 * 60 * 1000;

    const timeSinceLastIntervention = now - this.lastInterventionAt;

    // Rule: If user is actively engaged past 25 minutes, protect flow and stay silent!
    if (isPastPomodoro && timeSinceLastIntervention < minIntervalMs) {
      return {
        decision: FlowDecision.SHOW_FLOW_STATUS,
        flowProtected: true,
        reason: 'Flow protected — 25m reached, user engaged. JOT is staying quiet.',
      };
    }

    // Rule: If minimal reminders preferred, stay silent unless explicitly scheduled
    if (this.preference === 'minimal') {
      return {
        decision: FlowDecision.STAY_SILENT,
        flowProtected: true,
        reason: 'Intervention preference is minimal. JOT remains silent.',
      };
    }

    // Check-in interval reached
    if (timeSinceLastIntervention >= minIntervalMs) {
      const checkIn = this.checkInQueue[this.checkInIndex % this.checkInQueue.length];
      this.checkInIndex++;
      this.lastInterventionAt = now;

      return {
        decision: FlowDecision.OFFER_CHECKIN,
        reason: `Check-in interval reached (${this.preference} policy). Offering gentle micro reset.`,
        checkIn,
      };
    }

    return {
      decision: FlowDecision.STAY_SILENT,
      flowProtected: true,
      reason: 'Session in normal active flow.',
    };
  }

  /**
   * Manually trigger a safe check-in suggestion (e.g. at a natural stopping point)
   * @returns {Object} CheckIn item
   */
  getNextCheckIn() {
    const checkIn = this.checkInQueue[this.checkInIndex % this.checkInQueue.length];
    this.checkInIndex++;
    this.lastInterventionAt = Date.now();
    return checkIn;
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
