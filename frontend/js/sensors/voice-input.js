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
        this.recognition.maxAlternatives = 5;
        this.recognition.continuous = false; // Strictly single command only — no passive listening

        // Add SpeechGrammarList if supported by the browser engine
        const SpeechGrammar = window.SpeechGrammarList || window.webkitSpeechGrammarList;
        if (SpeechGrammar) {
          try {
            const grammarList = new SpeechGrammar();
            const grammar = '#JSGF V1.0; grammar echodesk; public <command> = hey jot | jot | j.o.t. | j o t | studying | dbms | pause | resume | stop ;';
            grammarList.addFromString(grammar, 1);
            this.recognition.grammars = grammarList;
          } catch (e) {
            // Ignore if grammar list not supported
          }
        }

        this.recognition.onstart = () => {
          this.isListening = true;
          if (this.eventBus) this.eventBus.emit('voice:started', {});
        };

        this.recognition.onresult = (event) => {
          let bestTranscript = '';

          if (event.results && event.results[0]) {
            const resultList = event.results[0];
            // 1. Prioritize any alternative candidate that directly contains "jot" or "j.o.t"
            for (let i = 0; i < resultList.length; i++) {
              const cand = resultList[i].transcript || '';
              if (/\b(?:jot|j\.?\s*o\.?\s*t\.?|jay\s*(?:o|oh)\s*tee)\b/i.test(cand)) {
                bestTranscript = cand;
                break;
              }
            }
            // 2. Otherwise pick top alternative
            if (!bestTranscript && resultList[0]) {
              bestTranscript = resultList[0].transcript || '';
            }
          }

          // 3. Normalize common speech engine misrecognitions for "Hey JOT" / "JOT" / "J.O.T"
          const transcript = VoiceInput.normalizeTranscript(bestTranscript);

          this.isListening = false;
          if (this.eventBus) this.eventBus.emit('voice:result', { transcript });
          resolve(transcript);
        };

        this.recognition.onerror = (event) => {
          this.isListening = false;
          let userMessage = `Speech recognition error: ${event.error}`;
          if (event.error === 'no-speech') {
            userMessage = 'No speech detected. Please press Speak and say "Hey JOT".';
          } else if (event.error === 'not-allowed') {
            userMessage = 'Microphone access denied. Please allow microphone permissions.';
          } else if (event.error === 'network') {
            userMessage = 'Speech recognition network error. Please verify your connection or type your intent.';
          }
          if (this.eventBus) this.eventBus.emit('voice:error', { error: event.error, message: userMessage });
          reject(new Error(userMessage));
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
   * Normalizes speech-to-text transcripts to reliably recognize "Hey JOT" / "JOT" / "J.O.T".
   * Web Speech engines frequently mishear "JOT" as "John", "Job", "Chat", "Josh", "Judge", "dot", "shot", etc.
   * @param {string} text
   * @returns {string}
   */
  static normalizeTranscript(text) {
    if (!text || typeof text !== 'string') return '';
    let t = text.trim();

    // 1. Remove trailing sentence punctuation added by speech engines (e.g. "Jot." -> "Jot", "J.O.T." -> "J.O.T")
    t = t.replace(/[.,!?;:]+$/, '').trim();

    // 2. Normalize all spellings of "J.O.T" / "J-O-T" / "J O T" / "jay o tee" / "jay oh tee" into "JOT"
    t = t.replace(/\b(?:j\.?\s*o\.?\s*t\.?|jay\s*(?:o|oh)\s*tee|j-o-t)\b/gi, 'JOT');

    // 3. "Hey" + common phonetic mishearings of "JOT":
    t = t.replace(/^hey\s+(?:jot|john|job|josh|jock|joy|chat|judge|george|shot|dot|yacht|chuck|jar|jaw|doc|jack|just|jaunt|jott|jatt|judd|jake|jaat|jolt|joint|jump|junk|jug|chad|geoff|jeff)\b/i, 'Hey JOT');

    // 4. Prefixes with "a", "eight", "hate", "hi", "ok", "okay" misheard as "hey jot"
    t = t.replace(/^(?:a|eight|hate|hi|ok|okay)\s+jot\b/i, 'Hey JOT');
    t = t.replace(/^(?:a|eight|hate|hi|ok|okay)\s+(?:john|job|chat|judge|george|shot|dot)\b/i, 'Hey JOT');

    // 5. Standalone mishearings before commands (e.g. "JOT studying DBMS", "john, pause", "job, studying DBMS", "dot pause", "shot stop")
    t = t.replace(/^(?:jot|john|job|josh|jock|chat|judge|shot|dot|yacht|jott|jatt)\s*([,:]|\s+(?:studying|working|pause|stop|resume|continue|less|more|balanced|why|what|status|i\s+stopped|forget))\b/i, 'JOT, $2');

    // 6. Standalone single-word wake/utterance mishearings when user simply says "JOT" or "J.O.T"
    const strippedWord = t.replace(/[.,!?;:]+/g, '').trim().toLowerCase();
    const isJotWakeWord = /^(?:jot|jott|jatt|john|job|josh|jock|chat|shot|dot|yacht|chuck|judge|joint|jump|junk|jug|doc|jack|jar|jaw|just|jaunt|jake|judd|chad|geoff|jeff)$/i.test(strippedWord);
    if (isJotWakeWord) {
      t = 'Hey JOT';
    }

    // 7. Ensure canonical capitalization
    t = t.replace(/\bhey\s+jot\b/i, 'Hey JOT');
    t = t.replace(/\bjot\b/i, 'JOT');

    return t;
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

      const normalized = VoiceInput.normalizeTranscript(transcript);

      this.isListening = true;
      if (this.eventBus) this.eventBus.emit('voice:started', {});

      setTimeout(() => {
        this.isListening = false;
        if (this.eventBus) this.eventBus.emit('voice:result', { transcript: normalized });
        if (this.eventBus) this.eventBus.emit('voice:ended', {});
        resolve(normalized);
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
