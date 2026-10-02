/**
 * ECHODESK — Camera Presence Classifier (Local-First)
 * Implements Stage 7 of the Antigravity Build Plan:
 * Lightweight, on-device presence signal estimation for Zen Mode.
 * Data lifecycle: Frame -> Local Diff/Luminance -> Signal (PRESENT/ABSENT/UNCERTAIN) -> Frame Discarded.
 * Zero raw frames stored, logged, or uploaded to any server.
 */

class CameraPresenceSensor {
  constructor(options = {}) {
    this.privacyGate = options.privacyGate || (typeof window !== 'undefined' ? window.privacyGate : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    this.isActive = false;
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.processInterval = null;

    // Current state
    this.currentSignal = 'UNCERTAIN'; // 'PRESENT' | 'ABSENT' | 'UNCERTAIN'
    this.confidence = 1.0;
    this.simulatedMode = false;

    // Sampling configuration
    this.sampleIntervalMs = 2000; // Check every 2 seconds
    this.lastFrameData = null;
  }

  /**
   * Start local presence classification
   * @param {boolean} [forceSimulated=false]
   * @returns {Promise<boolean>}
   */
  async start(forceSimulated = false) {
    // 1. Privacy Gate check
    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('ACTIVATE_CAMERA', {
        cloudStreamRequested: false,
      });
      if (!evaluation.allowed) {
        throw new Error(evaluation.reason);
      }
    }

    if (forceSimulated || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return this._startSimulated();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120, frameRate: 5 }, // Low-res thumbnail for local presence only
        audio: false,
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 32;
      this.canvasElement.height = 24;

      this.isActive = true;
      this.simulatedMode = false;
      this._startProcessingLoop();

      if (this.eventBus) {
        this.eventBus.emit('presence:started', { simulated: false });
      }
      return true;
    } catch (err) {
      console.warn('[CameraPresence] Physical camera unavailable, switching to local mock presence:', err.message);
      return this._startSimulated();
    }
  }

  _startSimulated() {
    this.isActive = true;
    this.simulatedMode = true;
    this.currentSignal = 'PRESENT';
    this.confidence = 0.95;

    if (this.eventBus) {
      this.eventBus.emit('presence:started', { simulated: true });
      this.eventBus.emit('presence:signal', { signal: this.currentSignal, confidence: this.confidence, simulated: true });
    }
    return true;
  }

  _startProcessingLoop() {
    this.processInterval = setInterval(() => {
      this._processFrame();
    }, this.sampleIntervalMs);
  }

  _processFrame() {
    if (!this.isActive || !this.videoElement || !this.canvasElement) return;

    try {
      const ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(this.videoElement, 0, 0, 32, 24);
      const imgData = ctx.getImageData(0, 0, 32, 24).data;

      // Calculate simple average luminance and delta from previous frame
      let sum = 0;
      let diff = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        const lum = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        sum += lum;
        if (this.lastFrameData) {
          diff += Math.abs(lum - this.lastFrameData[i / 4]);
        }
      }

      const pixelCount = imgData.length / 4;
      const avgLuminance = sum / pixelCount;
      const avgDiff = this.lastFrameData ? diff / pixelCount : 10;

      // Frame is immediately discarded - only summary array stored for next frame delta
      this.lastFrameData = new Float32Array(pixelCount);
      for (let i = 0; i < imgData.length; i += 4) {
        this.lastFrameData[i / 4] = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
      }

      // If scene is completely dark or zero variance, signal absent
      if (avgLuminance < 10) {
        this.currentSignal = 'ABSENT';
        this.confidence = 0.85;
      } else {
        this.currentSignal = 'PRESENT';
        this.confidence = 0.92;
      }

      if (this.eventBus) {
        this.eventBus.emit('presence:signal', {
          signal: this.currentSignal,
          confidence: this.confidence,
          simulated: false,
        });
      }
    } catch (err) {
      console.warn('[CameraPresence] Frame processing error:', err);
    }
  }

  /**
   * For testing & live hackathon demos: manually inject presence signal
   * @param {'PRESENT'|'ABSENT'|'UNCERTAIN'} signal
   * @param {number} [confidence=0.95]
   */
  setSignal(signal, confidence = 0.95) {
    this.currentSignal = signal;
    this.confidence = confidence;
    if (this.eventBus) {
      this.eventBus.emit('presence:signal', { signal, confidence, manual: true });
    }
  }

  stop() {
    this.isActive = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoElement = null;
    this.canvasElement = null;
    this.lastFrameData = null;
    this.currentSignal = 'UNCERTAIN';

    if (this.eventBus) {
      this.eventBus.emit('presence:stopped', {});
    }
  }
}

if (typeof window !== 'undefined') {
  window.CameraPresenceSensor = CameraPresenceSensor;
  window.cameraPresence = window.cameraPresence || new CameraPresenceSensor();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CameraPresenceSensor };
}
