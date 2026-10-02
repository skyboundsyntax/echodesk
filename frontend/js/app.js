/**
 * ECHODESK — Application Bootstrap
 * Connects all engines, sensors, UI controllers, and session state.
 */

class EchoDeskApp {
  constructor() {
    this.session = null;
    this.currentView = 'jot';
    this.tickInterval = null;

    this.initEngines();
    this.initControllers();
    this.bindGlobalNavigation();
    this.startHeartbeat();
  }

  initEngines() {
    // 1. Storage
    this.storage = window.appStorage || new StorageAdapter();

    // 2. Event Bus
    this.events = window.appEvents || new EventBus();

    // 3. Privacy Policy Gate
    this.privacyGate = window.privacyGate || new PrivacyPolicyGate({ storage: this.storage, eventBus: this.events });

    // 4. AI Provider (supports local deterministic + Gemini cloud key)
    const savedKey = this.storage.get('gemini_api_key', '');
    this.aiProvider = new GeminiInteractionsProvider(savedKey, new DeterministicLocalProvider());

    // 5. Intent Engine
    this.intentEngine = window.intentEngine || new IntentEngine({
      aiProvider: this.aiProvider,
      privacyGate: this.privacyGate,
      eventBus: this.events,
    });

    // 6. Echo Memory Engine
    this.echoMemory = window.echoMemory || new EchoMemoryEngine({
      storage: this.storage,
      privacyGate: this.privacyGate,
      eventBus: this.events,
    });

    // 7. Flow Engine
    this.flowEngine = window.flowEngine || new FlowEngine({
      storage: this.storage,
      eventBus: this.events,
    });

    // 8. Bridge Engine
    this.bridgeEngine = window.bridgeEngine || new BridgeEngine({
      storage: this.storage,
      privacyGate: this.privacyGate,
      eventBus: this.events,
    });

    // 9. Sensors
    this.voiceInput = window.voiceInput || new VoiceInput({
      privacyGate: this.privacyGate,
      eventBus: this.events,
    });

    this.cameraPresence = window.cameraPresence || new CameraPresenceSensor({
      privacyGate: this.privacyGate,
      eventBus: this.events,
    });

    // Restore last session if one was active or saved
    const latestMem = this.echoMemory.getLatest();
    if (latestMem) {
      this.session = new WorkSession({ eventBus: this.events });
      this.session.contextName = latestMem.contextName;
      this.session.topic = latestMem.topic;
      this.session.lastStep = latestMem.lastStep;
      this.session.nextAction = latestMem.nextAction;
      this.session.state = WorkSessionState.PAUSED;
      this.session.activeDurationMs = latestMem.activeDurationMs || 0;
    } else {
      this.session = new WorkSession({ eventBus: this.events });
    }
  }

  initControllers() {
    this.jotController = new JotController(this);
    this.zenController = new ZenController(this);
    this.memoryController = new MemoryController(this);
    this.privacyController = new PrivacyController(this);
    this.bridgeController = new BridgeController(this);

    // Initial renders
    this.jotController.renderSessionState();
    this.zenController.render();
    this.memoryController.render();
    this.privacyController.renderToggles();
    this.privacyController.renderAuditLog();
    this.bridgeController.render();
    if (this.events) {
      this.events.on('flow:preference-changed', () => this.updateTopbarSensorPills());
      this.events.on('voice:started', () => this.updateTopbarSensorPills());
      this.events.on('voice:ended', () => this.updateTopbarSensorPills());
      this.events.on('voice:result', () => this.updateTopbarSensorPills());
      this.events.on('voice:error', () => this.updateTopbarSensorPills());
    }
    this.updateTopbarSensorPills();
  }

  bindGlobalNavigation() {
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Demo shortcut triggers (for live evaluation)
    const demoSimAbsentBtn = document.getElementById('demo-simulate-absence');
    if (demoSimAbsentBtn) {
      demoSimAbsentBtn.addEventListener('click', () => {
        if (this.cameraPresence) {
          this.cameraPresence.setSignal('ABSENT', 0.95);
          if (this.zenController) {
            this.zenController.showPauseProposal(`Looks like you stepped away. Pause ${this.session.contextName || 'session'}?`);
          }
        }
      });
    }

    const demoSimPresentBtn = document.getElementById('demo-simulate-present');
    if (demoSimPresentBtn) {
      demoSimPresentBtn.addEventListener('click', () => {
        if (this.cameraPresence) {
          this.cameraPresence.setSignal('PRESENT', 0.95);
          if (this.zenController) {
            this.zenController.hidePauseProposal();
          }
        }
      });
    }

    const demoSimPomodoroBtn = document.getElementById('demo-simulate-pomodoro');
    if (demoSimPomodoroBtn) {
      demoSimPomodoroBtn.addEventListener('click', () => {
        if (this.session) {
          // Adjust elapsed to 26 minutes to test Pomodoro flow protection
          this.session.correctElapsedTime(26 * 60 * 1000, 'Demo: testing 25m Pomodoro threshold');
          this.jotController.renderSessionState();
          this.zenController.render();
          alert('Simulated 26m active flow. Notice flow badge: "Flow protected — JOT is staying quiet".');
        }
      });
    }

    const demoSimCheckinBtn = document.getElementById('demo-simulate-checkin');
    if (demoSimCheckinBtn) {
      demoSimCheckinBtn.addEventListener('click', () => {
        if (this.flowEngine) {
          const checkIn = this.flowEngine.getNextCheckIn();
          this.zenController.showCheckIn(checkIn);
        }
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update active nav button
    document.querySelectorAll('.nav-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-view') === viewName);
    });

    // Update active panel
    document.querySelectorAll('.view-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `view-${viewName}`);
    });

    // Trigger subcontroller renders
    if (viewName === 'zen') {
      this.zenController.render();
      // If camera presence enabled in privacy gate, start presence sensor
      if (this.privacyGate.getPermissions().cameraEnabled && !this.cameraPresence.isActive) {
        this.cameraPresence.start(true); // default to simulated local presence for safety
      }
    } else {
      if (this.cameraPresence.isActive) {
        this.cameraPresence.stop();
      }
    }

    if (viewName === 'memory') this.memoryController.render();
    if (viewName === 'privacy') {
      this.privacyController.renderToggles();
      this.privacyController.renderAuditLog();
    }
    if (viewName === 'bridge') this.bridgeController.render();

    this.updateTopbarSensorPills();
  }

  startSession(contextName, meta = {}) {
    if (!this.session || this.session.state === WorkSessionState.ENDED) {
      this.session = new WorkSession({ eventBus: this.events });
    }

    if (this.session.state === WorkSessionState.ACTIVE) {
      this.session.updateContext({ contextName, ...meta });
    } else {
      this.session.start(contextName, meta);
    }

    // Persist to Echo Memory
    this._syncToMemory();
    this.switchView('zen');
  }

  pauseSession(reason = 'User paused') {
    if (!this.session || this.session.state !== WorkSessionState.ACTIVE) return;
    this.session.pause(reason);
    this._syncToMemory();
  }

  resumeSession(reason = 'User resumed') {
    if (!this.session) return;
    if (this.session.state === WorkSessionState.PAUSED || this.session.state === WorkSessionState.UNCERTAIN) {
      this.session.resume(reason);
      this._syncToMemory();
    }
  }

  stopSession(reason = 'User stopped') {
    if (!this.session) return;
    if (this.session.state !== WorkSessionState.ENDED && this.session.state !== WorkSessionState.IDLE) {
      this.session.stop(reason);
      this._syncToMemory('ended');
    }
  }

  initiateCrossDeviceHandoff() {
    if (!this.session || this.session.state === WorkSessionState.IDLE) {
      alert('Start a work session first before handing off to laptop.');
      return;
    }
    this.bridgeEngine.initiateHandoff(this.session.toJSON());
    this.switchView('bridge');
  }

  _syncToMemory(statusOverride) {
    if (!this.session || !this.echoMemory) return;
    const json = this.session.toJSON();
    this.echoMemory.save({
      contextName: json.contextName,
      topic: json.topic,
      lastStep: json.lastStep,
      nextAction: json.nextAction,
      status: statusOverride || json.state.toLowerCase(),
      activeDurationMs: json.activeDurationMs,
      formattedDuration: json.formattedDuration,
      corrections: json.corrections,
      source: json.source,
    });
  }

  startHeartbeat() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  tick() {
    if (!this.session || this.session.state !== WorkSessionState.ACTIVE) return;

    // Update timer displays
    this.jotController.updateTimerTick();
    this.zenController.updateTimerTick();

    // Evaluate Flow Policy
    if (this.flowEngine) {
      const evaluation = this.flowEngine.evaluate({
        sessionState: this.session.state,
        activeDurationMs: this.session.getActiveDurationMs(),
        presenceSignal: this.cameraPresence ? this.cameraPresence.currentSignal : 'PRESENT',
      });

      if (evaluation.decision === FlowDecision.ASK_PAUSE && this.currentView === 'zen') {
        this.zenController.showPauseProposal(evaluation.prompt);
      } else if (evaluation.decision === FlowDecision.OFFER_CHECKIN && this.currentView === 'zen') {
        this.zenController.showCheckIn(evaluation.checkIn);
      }
    }

    this.updateTopbarSensorPills();
  }

  updateTopbarSensorPills() {
    const micPill = document.getElementById('pill-sensor-mic');
    const camPill = document.getElementById('pill-sensor-cam');

    if (micPill) {
      const isListening = this.voiceInput && this.voiceInput.isListening;
      micPill.className = isListening ? 'sensor-pill active' : 'sensor-pill';
      micPill.querySelector('.pill-text').textContent = isListening ? 'Mic: Listening' : 'Mic: Push-to-Talk';
    }

    if (camPill) {
      const isCamActive = this.cameraPresence && this.cameraPresence.isActive;
      camPill.className = isCamActive ? 'sensor-pill active' : 'sensor-pill';
      camPill.querySelector('.pill-text').textContent = isCamActive ? `Cam: ${this.cameraPresence.currentSignal}` : 'Cam: Off (Zen Only)';
    }

    const flowPill = document.getElementById('pill-flow-preference');
    if (flowPill && this.flowEngine) {
      const pref = this.flowEngine.getPreference();
      const prefText = pref ? (pref.charAt(0).toUpperCase() + pref.slice(1)) : 'Minimal';
      const textElem = flowPill.querySelector('.pill-text');
      if (textElem) {
        textElem.textContent = `Flow: ${prefText}`;
      }
    }
  }
}

// Bootstrap on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.echoDeskApp = new EchoDeskApp();
});
