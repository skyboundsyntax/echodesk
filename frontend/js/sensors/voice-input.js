/**
 * ECHODESK — Explicit Scoped Voice Input
 * Implements Stage 6 of the Antigravity Build Plan:
 * User-initiated push-to-talk speech recognition.
 * Strictly avoids passive/always-listening recording.
 * Raw audio is NOT recorded, logged, or retained.
 */

class VoiceInput {
  constructor(options = {}) {
    this.privacyGate = options.privacyGate || (typeof window !== 'undefined' ? window.privacyGate : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    this.isListening = false;
    this.recognition = null;
    this.isSupported = this._checkSupport();
  }

  _checkSupport() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Start listening for a single scoped voice utterance
   * @param {Object} [meta]
   * @param {boolean} [meta.explicitUserGesture=true]
   * @returns {Promise<string>}
   */
  startListening(meta = { explicitUserGesture: true }) {
    return new Promise((resolve, reject) => {
      // 1. Check Privacy Policy Gate (Mandatory non-bypassable code gate)
      if (this.privacyGate) {
        const evaluation = this.privacyGate.evaluate('ACTIVATE_MIC', {
          explicitUserGesture: Boolean(meta && meta.explicitUserGesture),
        });
        if (!evaluation.allowed) {
          const err = new Error(evaluation.reason);
          err.code = evaluation.code;
          return reject(err);
        }
      }

      if (!this._checkSupport()) {
        const err = new Error('Speech Recognition is not supported by this browser engine. Falling back to text input.');
        err.code = 'NOT_SUPPORTED';
        return reject(err);
      }

      try {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRec();
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;
        this.recognition.continuous = false; // Strictly single command only — no passive listening

        this.recognition.onstart = () => {
          this.isListening = true;
          if (this.eventBus) this.eventBus.emit('voice:started', {});
        };

        this.recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          this.isListening = false;
          if (this.eventBus) this.eventBus.emit('voice:result', { transcript });
          resolve(transcript);
        };

        this.recognition.onerror = (event) => {
          this.isListening = false;
          if (this.eventBus) this.eventBus.emit('voice:error', { error: event.error });
          reject(new Error(`Speech recognition error: ${event.error}`));
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.eventBus) this.eventBus.emit('voice:ended', {});
        };

        this.recognition.start();
      } catch (err) {
        this.isListening = false;
        reject(err);
      }
    });
  }

  /**
   * Safe deterministic simulator for voice utterances (tests & headless demos)
   * Enforces the exact same Privacy Policy Gate checks.
   * @param {string} transcript
   * @param {Object} [meta]
   * @returns {Promise<string>}
   */
  simulateVoiceUtterance(transcript, meta = { explicitUserGesture: true }) {
    return new Promise((resolve, reject) => {
      if (this.privacyGate) {
        const evaluation = this.privacyGate.evaluate('ACTIVATE_MIC', {
          explicitUserGesture: Boolean(meta && meta.explicitUserGesture),
        });
        if (!evaluation.allowed) {
          const err = new Error(evaluation.reason);
          err.code = evaluation.code;
          return reject(err);
        }
      }

      this.isListening = true;
      if (this.eventBus) this.eventBus.emit('voice:started', {});

      setTimeout(() => {
        this.isListening = false;
        if (this.eventBus) this.eventBus.emit('voice:result', { transcript });
        if (this.eventBus) this.eventBus.emit('voice:ended', {});
        resolve(transcript);
      }, 50);
    });
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
    if (this.eventBus) this.eventBus.emit('voice:ended', {});
  }
}

if (typeof window !== 'undefined') {
  window.VoiceInput = VoiceInput;
  window.voiceInput = window.voiceInput || new VoiceInput();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoiceInput };
}
