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

    // Camera Sensor Pill
    if (this.cameraStatusPill) {
      const isCamActive = this.app.cameraPresence && this.app.cameraPresence.isActive;
      const isOpenCv = this.app.cameraPresence && (this.app.cameraPresence.isOpenCvReady || (typeof cv !== 'undefined' && cv.Mat));
      const engineLabel = isOpenCv ? 'OpenCV.js' : 'Local Sensor';
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
  }

  updateTimerTick() {
    if (!this.app.session || this.app.session.state === WorkSessionState.IDLE) return;
    const durMs = this.app.session.getActiveDurationMs();
    if (this.timerDisplay) {
      this.timerDisplay.textContent = WorkSession.formatDuration(durMs);
    }
  }
}

if (typeof window !== 'undefined') {
  window.ZenController = ZenController;
}
