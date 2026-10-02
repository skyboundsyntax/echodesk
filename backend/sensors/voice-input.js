/**
 * ECHODESK Backend — Voice Input Sensor & Validation
 * Implements Stage 6 of the Antigravity Build Plan:
 * Validates push-to-talk gesture constraints, policy enforcement,
 * and zero raw audio persistence.
 */

class VoiceInput {
  constructor(options = {}) {
    this.privacyGate = options.privacyGate || null;
    this.isListening = false;
    this.isSupported = true; // In Node/Server context, supported via structured audio/transcript ingestion
  }

  /**
   * Validate activation against Privacy Policy Gate
   * @param {Object} [meta]
   * @param {boolean} [meta.explicitUserGesture=true]
   * @returns {{ allowed: boolean, reason: string, code: string }}
   */
  evaluateActivation(meta = { explicitUserGesture: true }) {
    if (!this.privacyGate) {
      return { allowed: true, reason: 'No privacy gate configured', code: 'ALLOW_UNGUARDED' };
    }
    return this.privacyGate.evaluate('ACTIVATE_MIC', {
      explicitUserGesture: Boolean(meta && meta.explicitUserGesture),
    });
  }

  /**
   * Simulate voice utterance with full Privacy Policy Gate checks
   * @param {string} transcript
   * @param {Object} [meta]
   * @returns {Promise<string>}
   */
  simulateVoiceUtterance(transcript, meta = { explicitUserGesture: true }) {
    return new Promise((resolve, reject) => {
      const evaluation = this.evaluateActivation(meta);
      if (!evaluation.allowed) {
        const err = new Error(evaluation.reason);
        err.code = evaluation.code;
        return reject(err);
      }

      this.isListening = true;
      setTimeout(() => {
        this.isListening = false;
        resolve(transcript);
      }, 10);
    });
  }

  stopListening() {
    this.isListening = false;
  }
}

module.exports = { VoiceInput };
