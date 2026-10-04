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
   * Normalizes speech-to-text transcripts to reliably recognize "Hey JOT" / "JOT".
   * @param {string} text
   * @returns {string}
   */
  static normalizeTranscript(text) {
    if (!text || typeof text !== 'string') return '';
    let t = text.trim();

    t = t.replace(/[.,!?;:]+$/, '').trim();
    t = t.replace(/\b(?:j\.?\s*o\.?\s*t\.?|jay\s*(?:o|oh)\s*tee|j-o-t)\b/gi, 'JOT');
    t = t.replace(/^hey\s+(?:jot|john|job|josh|jock|joy|chat|judge|george|shot|dot|yacht|chuck|jar|jaw|doc|jack|just|jaunt|jott|jatt|judd|jake|jaat|jolt|joint|jump|junk|jug|chad|geoff|jeff)\b/i, 'Hey JOT');
    t = t.replace(/^(?:a|eight|hate|hi|ok|okay)\s+jot\b/i, 'Hey JOT');
    t = t.replace(/^(?:a|eight|hate|hi|ok|okay)\s+(?:john|job|chat|judge|george|shot|dot)\b/i, 'Hey JOT');
    t = t.replace(/^(?:jot|john|job|josh|jock|chat|judge|shot|dot|yacht|jott|jatt)\s*([,:]|\s+(?:studying|working|pause|stop|resume|continue|less|more|balanced|why|what|status|i\s+stopped|forget))\b/i, 'JOT, $2');

    const strippedWord = t.replace(/[.,!?;:]+/g, '').trim().toLowerCase();
    const isJotWakeWord = /^(?:jot|jott|jatt|john|job|josh|jock|chat|shot|dot|yacht|chuck|judge|joint|jump|junk|jug|doc|jack|jar|jaw|just|jaunt|jake|judd|chad|geoff|jeff)$/i.test(strippedWord);
    if (isJotWakeWord) {
      t = 'Hey JOT';
    }

    t = t.replace(/\bhey\s+jot\b/i, 'Hey JOT');
    t = t.replace(/\bjot\b/i, 'JOT');

    return t;
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

      const normalized = VoiceInput.normalizeTranscript(transcript);

      this.isListening = true;
      setTimeout(() => {
        this.isListening = false;
        resolve(normalized);
      }, 10);
    });
  }

  stopListening() {
    this.isListening = false;
  }
}

module.exports = { VoiceInput };
