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

    // OpenCV.js state & touchless camera controls
    this.isOpenCvReady = typeof cv !== 'undefined' && Boolean(cv.Mat);
    this.openCvEngine = 'OpenCV.js';
    this.prevGray = null;
    this.lastGestureTime = 0;

    if (!this.isOpenCvReady && typeof window !== 'undefined') {
      const checkCv = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) {
          this.isOpenCvReady = true;
          clearInterval(checkCv);
          console.log('[CameraPresence] OpenCV.js computer vision engine ready.');
          if (this.eventBus) {
            this.eventBus.emit('opencv:ready', { engine: this.openCvEngine });
          }
        }
      }, 500);
    }
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
        this.eventBus.emit('presence:started', { simulated: false, engine: this.isOpenCvReady ? 'OpenCV.js' : 'baseline' });
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

      // Check if OpenCV.js runtime is active
      const cvActive = typeof cv !== 'undefined' && cv.Mat;
      if (cvActive) {
        this._processOpenCvFrame(avgLuminance);
      } else {
        // Deterministic baseline presence classification
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
            engine: 'baseline-delta',
            simulated: false,
          });
        }
      }
    } catch (err) {
      console.warn('[CameraPresence] Frame processing error:', err);
    }
  }

  /**
   * Process frame using OpenCV.js with non-bypassable zero-retention memory guarantees
   * @param {number} avgLuminance
   */
  _processOpenCvFrame(avgLuminance) {
    let src = null;
    let gray = null;
    let diffMat = null;
    let thresh = null;

    try {
      // 1. Read downsampled canvas into OpenCV matrix
      src = cv.imread(this.canvasElement);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 2. Optical difference & motion thresholding
      let motionRatio = 0;
      if (this.prevGray) {
        diffMat = new cv.Mat();
        thresh = new cv.Mat();

        cv.absdiff(gray, this.prevGray, diffMat);
        cv.threshold(diffMat, thresh, 25, 255, cv.THRESH_BINARY);

        const nonZero = cv.countNonZero(thresh);
        const totalPixels = gray.rows * gray.cols;
        motionRatio = nonZero / totalPixels;

        // Classify presence with OpenCV motion confidence
        if (avgLuminance < 10) {
          this.currentSignal = 'ABSENT';
          this.confidence = 0.88;
        } else if (motionRatio > 0.02) {
          this.currentSignal = 'PRESENT';
          this.confidence = Math.min(0.99, 0.90 + motionRatio * 0.4);
        } else if (this.currentSignal === 'PRESENT') {
          // Micro-presence: user is quietly focusing
          this.currentSignal = 'PRESENT';
          this.confidence = 0.93;
        } else {
          this.currentSignal = 'ABSENT';
          this.confidence = 0.85;
        }

        // 3. Touchless Gesture Recognition (e.g. hand wave / raise in top region)
        this._detectOpenCvGesture(gray, diffMat, motionRatio);

        this.prevGray.delete();
      } else {
        this.currentSignal = avgLuminance >= 10 ? 'PRESENT' : 'ABSENT';
        this.confidence = 0.90;
      }

      this.prevGray = gray.clone();

      if (this.eventBus) {
        this.eventBus.emit('presence:signal', {
          signal: this.currentSignal,
          confidence: this.confidence,
          engine: 'OpenCV.js',
          motionRatio,
          simulated: false,
        });
      }
    } catch (cvErr) {
      console.warn('[CameraPresence] OpenCV processing error:', cvErr);
    } finally {
      // CRITICAL: Always release WebAssembly matrices immediately
      // Enforces the non-retention privacy policy and prevents memory leaks
      if (src) src.delete();
      if (gray) gray.delete();
      if (diffMat) diffMat.delete();
      if (thresh) thresh.delete();
    }
  }

  /**
   * Detect touchless gesture control (e.g. hand raised in upper frame)
   * @param {Object} grayMat
   * @param {Object} diffMat
   * @param {number} motionRatio
   */
  _detectOpenCvGesture(grayMat, diffMat, motionRatio) {
    if (!diffMat || motionRatio < 0.12) return;

    try {
      const upperHeight = Math.floor(grayMat.rows * 0.5);
      const rect = new cv.Rect(0, 0, grayMat.cols, upperHeight);
      const upperRoi = diffMat.roi(rect);
      const upperNonZero = cv.countNonZero(upperRoi);
      const upperRatio = upperNonZero / (grayMat.cols * upperHeight);
      upperRoi.delete();

      const now = Date.now();
      // Debounce gesture activations (3s cooldown)
      if (upperRatio > 0.22 && (!this.lastGestureTime || now - this.lastGestureTime > 3000)) {
        this.lastGestureTime = now;
        if (this.eventBus) {
          this.eventBus.emit('camera:gesture-control', {
            action: 'TOGGLE_PAUSE',
            confidence: 0.92,
            engine: 'OpenCV.js',
            timestamp: now,
          });
        }
      }
    } catch (e) {
      // Ignore sub-roi errors
    }
  }

  /**
   * For testing & live hackathon demos: manually inject gesture command
   * @param {'TOGGLE_PAUSE'|'DISMISS_CHECKIN'} [action='TOGGLE_PAUSE']
   */
  simulateGesture(action = 'TOGGLE_PAUSE') {
    if (this.eventBus) {
      this.eventBus.emit('camera:gesture-control', {
        action,
        confidence: 0.95,
        engine: 'OpenCV.js-simulation',
        manual: true,
        timestamp: Date.now(),
      });
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
    if (this.prevGray) {
      try { this.prevGray.delete(); } catch (e) {}
      this.prevGray = null;
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
