/**
 * ECHODESK — Zen Mode UI Controller
 * Implements Stage 3 Focus Mode:
 * Minimal UI, big real-time timer, flow protection state, natural pause suggestions, and gentle check-ins.
 */

class ZenController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.container = document.getElementById('view-zen');
    this.contextTitle = document.getElementById('zen-context-title');
    this.topicTag = document.getElementById('zen-topic-tag');
    this.timerDisplay = document.getElementById('zen-timer-huge');
    this.flowBanner = document.getElementById('zen-flow-banner');
    this.flowStatusText = document.getElementById('zen-flow-status-text');

    // Controls
    this.pauseBtn = document.getElementById('zen-btn-pause');
    this.resumeBtn = document.getElementById('zen-btn-resume');
    this.stopBtn = document.getElementById('zen-btn-stop');
    this.exitZenBtn = document.getElementById('zen-btn-exit');

    // Natural Pause Proposal Card
    this.pauseCard = document.getElementById('zen-pause-card');
    this.pauseConfirmBtn = document.getElementById('zen-pause-confirm-btn');
    this.pauseDismissBtn = document.getElementById('zen-pause-dismiss-btn');

    // Check-in Banner
    this.checkinCard = document.getElementById('zen-checkin-card');
    this.checkinTitle = document.getElementById('zen-checkin-title');
    this.checkinDesc = document.getElementById('zen-checkin-desc');
    this.checkinAcceptBtn = document.getElementById('zen-checkin-accept-btn');
    this.checkinDismissBtn = document.getElementById('zen-checkin-dismiss-btn');

    // Sensor status
    this.cameraStatusPill = document.getElementById('zen-camera-status');
    this.presenceIndicator = document.getElementById('zen-presence-indicator');

    // Camera Controls & OpenCV HUD
    this.cameraToggleBtn = document.getElementById('zen-btn-camera-toggle');
    this.cameraHud = document.getElementById('zen-camera-hud');
    this.cameraPreviewContainer = document.getElementById('zen-camera-preview-container');
    this.hudCloseCamBtn = document.getElementById('zen-btn-close-cam');
    this.hudSwitchSourceBtn = document.getElementById('zen-btn-switch-source');
    this.hudEngineVal = document.getElementById('zen-hud-engine-val');
    this.hudPresenceVal = document.getElementById('zen-hud-presence-val');
    this.hudMotionVal = document.getElementById('zen-hud-motion-val');
    this.hudGestureVal = document.getElementById('zen-hud-gesture-val');
    this.hudModeBadge = document.getElementById('zen-camera-mode-badge');
    this.gestureHint = document.getElementById('zen-gesture-zone-hint');

    // Dual-Bay Split Cockpit Elements
    this.infeedTimerDisplay = document.getElementById('zen-infeed-timer-display');
    this.visionMonitor = document.getElementById('zen-vision-monitor');
    this.standbySlate = document.getElementById('zen-camera-standby-slate');
    this.standbyOpenCamBtn = document.getElementById('zen-standby-open-cam-btn');
    this.cameraActiveActions = document.getElementById('zen-camera-active-actions');
    this.monitorStatusDot = document.getElementById('zen-monitor-status-dot');
    this.monitorTitle = document.getElementById('zen-monitor-title');
  }

  bindEvents() {
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => this.app.pauseSession('User clicked Pause in Zen'));
    }
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => this.app.resumeSession('User clicked Resume in Zen'));
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => {
        this.app.stopSession('User finished session in Zen');
        this.app.switchView('jot');
      });
    }
    if (this.exitZenBtn) {
      this.exitZenBtn.addEventListener('click', () => this.app.switchView('jot'));
    }

    // Camera Toggle Button & Standby Activate Button
    const triggerCameraStart = async () => {
      const cam = this.app.cameraPresence;
      if (!cam) return;

      if (cam.isActive) {
        // Turn OFF camera
        cam.stop();
        if (this.app.privacyGate) {
          this.app.privacyGate.savePermissions({ cameraEnabled: false });
        }
        if (this.app.jotController) {
          this.app.jotController.addFeedItem('CAMERA_OFF', '📷 Camera and OpenCV vision sensor turned off in Zen Focus.', false);
        }
      } else {
        // Turn ON camera
        if (this.app.privacyGate) {
          this.app.privacyGate.savePermissions({ cameraEnabled: true });
        }
        if (this.cameraToggleBtn) this.cameraToggleBtn.textContent = '⏳ Starting Camera...';
        try {
          await cam.start(false); // Request real webcam
          if (this.app.jotController) {
            const srcMsg = cam.simulatedMode ? 'Simulated local optical feed' : 'Physical webcam with OpenCV.js vision';
            this.app.jotController.addFeedItem('CAMERA_ON', `📷 Camera activated: ${srcMsg}. Zero frames stored.`, true);
          }
        } catch (err) {
          console.warn('[ZenController] Physical camera unavailable, fallback to simulated:', err);
          await cam.start(true);
        }
      }
      this.render();
    };

    if (this.cameraToggleBtn) {
      this.cameraToggleBtn.addEventListener('click', triggerCameraStart);
    }
    if (this.standbyOpenCamBtn) {
      this.standbyOpenCamBtn.addEventListener('click', triggerCameraStart);
    }

    // HUD Close Camera Button
    if (this.hudCloseCamBtn) {
      this.hudCloseCamBtn.addEventListener('click', () => {
        if (this.app.cameraPresence && this.app.cameraPresence.isActive) {
          this.app.cameraPresence.stop();
          if (this.app.privacyGate) {
            this.app.privacyGate.savePermissions({ cameraEnabled: false });
          }
          this.render();
        }
      });
    }

    // HUD Switch Source Button (Webcam vs Simulation)
    if (this.hudSwitchSourceBtn) {
      this.hudSwitchSourceBtn.addEventListener('click', async () => {
        const cam = this.app.cameraPresence;
        if (!cam || !cam.isActive) return;

        const targetSimulated = !cam.simulatedMode;
        cam.stop();
        await cam.start(targetSimulated);
        this.render();
      });
    }

    // Pause card confirmation
    if (this.pauseConfirmBtn) {
      this.pauseConfirmBtn.addEventListener('click', () => {
        this.app.pauseSession('Natural pause confirmed by user');
        this.hidePauseProposal();
      });
    }
    if (this.pauseDismissBtn) {
      this.pauseDismissBtn.addEventListener('click', () => {
        this.hidePauseProposal();
      });
    }

    // Check-in actions
    if (this.checkinAcceptBtn) {
      this.checkinAcceptBtn.addEventListener('click', () => {
        if (window.flowEngine) {
          window.flowEngine.recordInterventionResponse('accepted');
        }
        this.hideCheckIn();
      });
    }
    if (this.checkinDismissBtn) {
      this.checkinDismissBtn.addEventListener('click', () => {
        if (window.flowEngine) {
          window.flowEngine.recordInterventionResponse('dismissed');
        }
        this.hideCheckIn();
      });
    }

    // Keyboard shortcuts in Zen Mode
    window.addEventListener('keydown', (e) => {
      // Only process when in Zen view
      if (this.app && this.app.currentView === 'zen') {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const s = this.app.session;
          if (s && s.state === WorkSessionState.ACTIVE) {
            this.app.pauseSession('Spacebar pause in Zen');
          } else if (s && (s.state === WorkSessionState.PAUSED || s.state === WorkSessionState.UNCERTAIN)) {
            this.app.resumeSession('Spacebar resume in Zen');
          }
        } else if (e.code === 'Escape') {
          e.preventDefault();
          this.app.switchView('jot');
        }
      }
    });

    // Listen to session changes
    if (window.appEvents) {
      window.appEvents.on('session:state-change', () => this.render());
      window.appEvents.on('presence:signal', (e) => this.handlePresenceSignal(e));
      window.appEvents.on('presence:started', () => this.render());
      window.appEvents.on('presence:stopped', () => this.render());
      window.appEvents.on('camera:gesture-control', (e) => this.handleGestureControl(e));
      window.appEvents.on('opencv:ready', () => this.render());
    }

    // Gesture simulation button for hackathon demo / test strip
    const simGestureBtn = document.getElementById('demo-simulate-gesture');
    if (simGestureBtn) {
      simGestureBtn.addEventListener('click', () => {
        if (this.app.cameraPresence) {
          this.app.cameraPresence.simulateGesture('TOGGLE_PAUSE');
        }
      });
    }
  }

  handleGestureControl(gesture) {
    if (gesture.action === 'TOGGLE_PAUSE') {
      const s = this.app.session;
      if (!s) return;

      if (this.gestureHint) {
        this.gestureHint.classList.add('gesture-triggered');
        setTimeout(() => this.gestureHint && this.gestureHint.classList.remove('gesture-triggered'), 1500);
      }
      if (this.hudGestureVal) {
        this.hudGestureVal.textContent = '🖐️ GESTURE TRIGGERED (Toggle Pause)';
        setTimeout(() => {
          if (this.hudGestureVal) this.hudGestureVal.textContent = 'ACTIVE (Pause / Resume)';
        }, 3000);
      }

      if (s.state === WorkSessionState.ACTIVE) {
        this.app.pauseSession('OpenCV hand gesture detected (Wave/Raise)');
        if (this.app.jotController) {
          this.app.jotController.addFeedItem('CAMERA_GESTURE', '🖐️ OpenCV touchless gesture detected: Paused focus session.', true);
        }
      } else if (s.state === WorkSessionState.PAUSED || s.state === WorkSessionState.UNCERTAIN) {
        this.app.resumeSession('OpenCV hand gesture detected (Wave/Raise)');
        if (this.app.jotController) {
          this.app.jotController.addFeedItem('CAMERA_GESTURE', '🖐️ OpenCV touchless gesture detected: Resumed focus session.', true);
        }
      }
    }
  }

  render() {
    const s = this.app.session;
    if (!s || s.state === WorkSessionState.IDLE) {
      if (this.contextTitle) this.contextTitle.textContent = 'NO ACTIVE SESSION';
      if (this.topicTag) this.topicTag.textContent = 'Start a session with JOT';
      if (this.timerDisplay) this.timerDisplay.textContent = '00:00';
      if (this.infeedTimerDisplay) this.infeedTimerDisplay.textContent = '00:00';
      return;
    }

    if (this.contextTitle) this.contextTitle.textContent = s.contextName || 'FOCUS';
    if (this.topicTag) {
      const topicText = s.lastStep ? `${s.lastStep} — ${s.topic || 'In Progress'}` : (s.topic || 'Active Flow');
      this.topicTag.textContent = topicText;
    }

    // Controls visibility
    if (this.pauseBtn) this.pauseBtn.style.display = s.state === WorkSessionState.ACTIVE ? 'inline-block' : 'none';
    if (this.resumeBtn) this.resumeBtn.style.display = (s.state === WorkSessionState.PAUSED || s.state === WorkSessionState.UNCERTAIN) ? 'inline-block' : 'none';

    // Flow protection status
    const isFlowProtected = s.getActiveDurationMs() >= 25 * 60 * 1000;
    if (this.flowBanner) {
      if (s.state === WorkSessionState.ACTIVE) {
        this.flowBanner.style.display = 'inline-flex';
        this.flowStatusText.textContent = isFlowProtected
          ? 'Flow protected — JOT is staying quiet.'
          : 'Flow active — JOT is protecting focus';
      } else if (s.state === WorkSessionState.PAUSED) {
        this.flowBanner.style.display = 'inline-flex';
        this.flowStatusText.textContent = 'Session paused — Context preserved';
      } else {
        this.flowBanner.style.display = 'none';
      }
    }

    // Camera Sensor & Split-Cockpit Vision Monitor synchronization
    const isCamActive = this.app.cameraPresence && this.app.cameraPresence.isActive;
    const isSimulated = this.app.cameraPresence && this.app.cameraPresence.simulatedMode;
    const isOpenCv = this.app.cameraPresence && (this.app.cameraPresence.isOpenCvReady || (typeof cv !== 'undefined' && cv.Mat));
    const engineLabel = isOpenCv ? 'OpenCV.js' : 'Local Sensor';

    if (this.cameraToggleBtn) {
      if (isCamActive) {
        this.cameraToggleBtn.innerHTML = `📷 Close Camera (${engineLabel})`;
        this.cameraToggleBtn.classList.add('active');
      } else {
        this.cameraToggleBtn.innerHTML = `📷 Open Camera (${engineLabel})`;
        this.cameraToggleBtn.classList.remove('active');
      }
    }

    if (this.visionMonitor) {
      if (isCamActive) {
        this.visionMonitor.classList.remove('camera-off');
        this.visionMonitor.classList.add('camera-on');
        if (this.standbySlate) this.standbySlate.style.display = 'none';
        if (this.cameraActiveActions) this.cameraActiveActions.style.display = 'flex';
        if (this.gestureHint) this.gestureHint.style.display = 'block';
        if (this.monitorStatusDot) this.monitorStatusDot.classList.add('live');
        if (this.monitorTitle) this.monitorTitle.textContent = isSimulated ? 'LOCAL OPTICAL RADAR' : 'OPENCV.JS VISION STREAM';
        if (this.hudModeBadge) {
          this.hudModeBadge.textContent = isSimulated ? 'SIMULATED FEED' : 'HARDWARE WEBCAM';
          this.hudModeBadge.className = isSimulated ? 'hud-badge badge-simulated' : 'hud-badge badge-hardware';
        }
        if (this.hudEngineVal) {
          this.hudEngineVal.textContent = isOpenCv ? 'OpenCV.js (WebAssembly)' : 'Baseline Delta Classifier';
        }
        if (this.hudSwitchSourceBtn) {
          this.hudSwitchSourceBtn.textContent = isSimulated ? '📹 Switch to Webcam' : '🧪 Switch to Simulation';
        }
        if (this.app.cameraPresence && this.cameraPreviewContainer) {
          this.app.cameraPresence.mountPreview(this.cameraPreviewContainer);
        }
      } else {
        this.visionMonitor.classList.add('camera-off');
        this.visionMonitor.classList.remove('camera-on');
        if (this.standbySlate) this.standbySlate.style.display = 'flex';
        if (this.cameraActiveActions) this.cameraActiveActions.style.display = 'none';
        if (this.gestureHint) this.gestureHint.style.display = 'none';
        if (this.monitorStatusDot) this.monitorStatusDot.classList.remove('live');
        if (this.monitorTitle) this.monitorTitle.textContent = 'FOCUS VISION MONITOR';
        if (this.hudModeBadge) {
          this.hudModeBadge.textContent = 'CAMERA OFF';
          this.hudModeBadge.className = 'hud-badge badge-standby';
        }
        if (this.hudEngineVal) {
          this.hudEngineVal.textContent = isOpenCv ? 'OpenCV.js Ready (Standby)' : 'Local Sensor (Standby)';
        }
        if (this.cameraPreviewContainer) {
          this.cameraPreviewContainer.innerHTML = '';
        }
      }
    }

    // Camera Sensor Pill
    if (this.cameraStatusPill) {
      this.cameraStatusPill.textContent = isCamActive ? `📷 ${engineLabel}: Active` : `📷 ${engineLabel}: Off`;
      this.cameraStatusPill.className = isCamActive ? 'zen-sensor-indicator on' : 'zen-sensor-indicator';
    }
  }

  showPauseProposal(prompt = 'Looks like you stepped away. Pause DBMS?') {
    if (this.pauseCard) {
      const desc = this.pauseCard.querySelector('.zen-pause-desc');
      if (desc) desc.textContent = prompt;
      this.pauseCard.classList.add('active');
    }
  }

  hidePauseProposal() {
    if (this.pauseCard) {
      this.pauseCard.classList.remove('active');
    }
  }

  showCheckIn(checkIn) {
    if (!this.checkinCard || !checkIn) return;
    if (this.checkinTitle) this.checkinTitle.textContent = `${checkIn.icon} ${checkIn.title}`;
    if (this.checkinDesc) this.checkinDesc.textContent = checkIn.text;
    this.checkinCard.classList.add('active');
  }

  hideCheckIn() {
    if (this.checkinCard) {
      this.checkinCard.classList.remove('active');
    }
  }

  handlePresenceSignal(signalData) {
    if (this.presenceIndicator) {
      const engineTag = signalData.engine === 'OpenCV.js' ? ' • OpenCV' : '';
      this.presenceIndicator.textContent = `Presence: ${signalData.signal} (${Math.round(signalData.confidence * 100)}%)${engineTag}`;
      this.presenceIndicator.className = signalData.signal === 'PRESENT' ? 'zen-sensor-indicator on' : 'zen-sensor-indicator';
    }

    if (this.hudPresenceVal) {
      const conf = Math.round((signalData.confidence || 0.95) * 100);
      this.hudPresenceVal.textContent = `${signalData.signal} (${conf}%)`;
      this.hudPresenceVal.className = signalData.signal === 'PRESENT' ? 'telemetry-val text-success' : 'telemetry-val text-warning';
    }

    if (this.hudMotionVal) {
      if (typeof signalData.motionRatio === 'number') {
        const pct = (signalData.motionRatio * 100).toFixed(1);
        const level = signalData.motionRatio > 0.15 ? 'Active Movement' : (signalData.motionRatio > 0.02 ? 'Focused Motion' : 'Quiet Focus');
        this.hudMotionVal.textContent = `${level} (${pct}% delta)`;
      } else {
        this.hudMotionVal.textContent = signalData.signal === 'PRESENT' ? 'Focused Motion' : 'No Motion Detected';
      }
    }
  }

  updateTimerTick() {
    if (!this.app.session || this.app.session.state === WorkSessionState.IDLE) return;
    const durMs = this.app.session.getActiveDurationMs();
    const formatted = WorkSession.formatDuration(durMs);
    if (this.timerDisplay) {
      this.timerDisplay.textContent = formatted;
    }
    if (this.infeedTimerDisplay) {
      this.infeedTimerDisplay.textContent = formatted;
    }
  }
}

if (typeof window !== 'undefined') {
  window.ZenController = ZenController;
}
