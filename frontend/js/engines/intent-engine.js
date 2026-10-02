/**
 * ECHODESK — Intent Engine
 * Converts natural language into validated, policy-checked agent commands.
 * Connects AIProvider, PrivacyPolicyGate, and Context Engine.
 */

class IntentEngine {
  constructor(options = {}) {
    this.aiProvider = options.aiProvider || (typeof window !== 'undefined' ? window.defaultAiProvider : null);
    this.privacyGate = options.privacyGate || (typeof window !== 'undefined' ? window.privacyGate : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);
  }

  setAIProvider(provider) {
    this.aiProvider = provider;
  }

  /**
   * Parse input string and execute policy check
   * @param {string} input Natural text or transcribed speech
   * @param {Object} [sessionContext] Current session state for relative resolution
   * @param {Object} [meta] Flags like explicitUserGesture
   * @returns {Promise<Object>} Structured command result
   */
  async process(input, sessionContext = {}, meta = {}) {
    if (!this.aiProvider) {
      throw new Error('IntentEngine: No AIProvider configured.');
    }

    // 1. Parse structured intent via configured provider
    const parsed = await this.aiProvider.parseIntent(input, sessionContext);

    // Whitelist of allowed conversational and workflow intents
    const VALID_INTENTS = new Set([
      'START_WORK_SESSION', 'PAUSE_SESSION', 'RESUME_SESSION', 'STOP_SESSION',
      'CORRECT_SESSION_TIME', 'UPDATE_CONTEXT', 'REQUEST_HANDOFF',
      'SET_INTERVENTION_PREFERENCE', 'ASK_EXPLANATION', 'ASK_STATUS',
      'FORGET_MEMORY', 'UNCERTAIN', 'UNKNOWN',
    ]);

    // 2. Map intent to PolicyActionType for gate verification
    const policyAction = this._mapIntentToPolicyAction(parsed.intent);

    // 3. Evaluate against PrivacyPolicyGate with fail-closed default
    let policyCheck = { allowed: true, reason: 'Benign intent authorized', code: 'ALLOW_BENIGN' };

    const isSurveillance = policyAction === 'DESKTOP_SURVEILLANCE' ||
      (typeof window !== 'undefined' && window.PolicyActionType && policyAction === window.PolicyActionType.DESKTOP_SURVEILLANCE);

    if (!VALID_INTENTS.has(parsed.intent) || isSurveillance) {
      if (this.privacyGate) {
        policyCheck = this.privacyGate.evaluate(policyAction || parsed.intent, {
          explicitUserGesture: meta.explicitUserGesture !== false,
          explicitUserRequest: false,
        });
      } else {
        policyCheck = {
          allowed: false,
          reason: `Unrecognized or prohibited action "${parsed.intent}". Failing closed.`,
          code: 'DENY_UNKNOWN_ACTION',
        };
      }
    } else if (this.privacyGate && policyAction) {
      policyCheck = this.privacyGate.evaluate(policyAction, {
        explicitUserGesture: meta.explicitUserGesture !== false,
        explicitUserRequest: true,
        containsRawSensorData: false,
      });
    }

    const result = {
      rawInput: input,
      intent: parsed.intent,
      confidence: parsed.confidence || 0.9,
      contextName: parsed.contextName || sessionContext.contextName || '',
      topic: parsed.topic || '',
      activity: parsed.activity || 'working',
      mode: parsed.mode || 'standard',
      minutesAgo: parsed.minutesAgo,
      adjustedDurationMs: parsed.adjustedDurationMs,
      targetDevice: parsed.targetDevice,
      preference: parsed.preference,
      source: parsed.source || 'user_declared',
      policyCheck,
      prompt: parsed.prompt,
      allowed: policyCheck.allowed,
    };

    if (this.eventBus) {
      this.eventBus.emit('intent:processed', result);
    }

    return result;
  }

  _mapIntentToPolicyAction(intent) {
    const PAT = (typeof window !== 'undefined' && window.PolicyActionType)
      ? window.PolicyActionType
      : (typeof PolicyActionType !== 'undefined' ? PolicyActionType : null);

    if (PAT) {
      switch (intent) {
        case 'START_WORK_SESSION': return PAT.START_SESSION;
        case 'PAUSE_SESSION': return PAT.PAUSE_SESSION;
        case 'RESUME_SESSION': return PAT.RESUME_SESSION;
        case 'STOP_SESSION': return PAT.STOP_SESSION;
        case 'CORRECT_SESSION_TIME': return PAT.CORRECT_TIME;
        case 'REQUEST_HANDOFF': return PAT.CROSS_DEVICE_HANDOFF;
        case 'FORGET_MEMORY': return PAT.DELETE_MEMORY;
        case 'ACTIVATE_MIC': return PAT.ACTIVATE_MIC;
        case 'ACTIVATE_CAMERA': return PAT.ACTIVATE_CAMERA;
        case 'PROCESS_PRESENCE': return PAT.PROCESS_PRESENCE;
        case 'DESKTOP_SURVEILLANCE':
        case 'DESKTOP_INSPECTION':
        case 'SILENT_APP_INVENTORY':
        case 'ENUMERATE_OPEN_WINDOWS':
          return PAT.DESKTOP_SURVEILLANCE;
        case 'CLOUD_REASONING': return PAT.CLOUD_REASONING;
        default: return null;
      }
    }
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.IntentEngine = IntentEngine;
  window.intentEngine = window.intentEngine || new IntentEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IntentEngine };
}
