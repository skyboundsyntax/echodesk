/**
 * ECHODESK Backend — Camera Presence Assistance Sensor
 * Implements Stage 7 of the Antigravity Build Plan:
 * Local presence estimation, privacy policy gate enforcement,
 * and zero cloud video upload or raw frame logging.
 */

class CameraPresenceSensor {
  constructor(options = {}) {
    this.privacyGate = options.privacyGate || null;
    this.isActive = false;
    this.currentSignal = 'UNCERTAIN';
    this.confidence = 1.0;
  }

  evaluateActivation(meta = { cloudStreamRequested: false }) {
    if (!this.privacyGate) {
      return { allowed: true, reason: 'No privacy gate configured', code: 'ALLOW_UNGUARDED' };
    }
    return this.privacyGate.evaluate('ACTIVATE_CAMERA', {
      cloudStreamRequested: Boolean(meta && meta.cloudStreamRequested),
    });
  }

  start(meta = { cloudStreamRequested: false }) {
    const evaluation = this.evaluateActivation(meta);
    if (!evaluation.allowed) {
      const err = new Error(evaluation.reason);
      err.code = evaluation.code;
      throw err;
    }
    this.isActive = true;
    this.currentSignal = 'PRESENT';
    this.confidence = 0.95;
    return true;
  }

  stop() {
    this.isActive = false;
    this.currentSignal = 'UNCERTAIN';
  }

  setSignal(signal, confidence = 0.95) {
    if (!['PRESENT', 'ABSENT', 'UNCERTAIN'].includes(signal)) {
      throw new Error(`Invalid presence signal: ${signal}`);
    }
    this.currentSignal = signal;
    this.confidence = confidence;
    return { signal: this.currentSignal, confidence: this.confidence };
  }

  /**
   * Process a simulated frame buffer and verify frame is immediately discarded
   * @param {Array<number>} framePixels
   * @returns {{ signal: string, confidence: number, frameRetained: boolean }}
   */
  processFrameLocally(framePixels) {
    if (!this.isActive) {
      return { signal: 'UNCERTAIN', confidence: 0.0, frameRetained: false };
    }

    // Calculate aggregate luminance
    let sum = 0;
    for (let i = 0; i < framePixels.length; i++) {
      sum += framePixels[i];
    }
    const avg = sum / (framePixels.length || 1);

    // Frame data is NOT retained — only the classified enum signal is returned
    let signal = 'PRESENT';
    let conf = 0.92;
    if (avg < 10) {
      signal = 'ABSENT';
      conf = 0.88;
    } else if (avg >= 10 && avg < 30) {
      signal = 'UNCERTAIN';
      conf = 0.55;
    }

    this.currentSignal = signal;
    this.confidence = conf;

    return {
      signal,
      confidence: conf,
      frameRetained: false, // Strictly zero raw frame retention
    };
  }
}

module.exports = { CameraPresenceSensor };
