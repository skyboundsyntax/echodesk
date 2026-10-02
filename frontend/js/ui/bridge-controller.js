/**
 * ECHODESK — Cross-Device Bridge UI Controller
 * Implements Stage 10 Phone <-> Laptop Session Continuity:
 * Visual pipeline stepper (PHONE -> HANDOFF REQUEST -> AUTHENTICATED SYNC -> LAPTOP SESSION READY),
 * real-time failure handling banners, and hackathon evaluation triggers.
 */

class BridgeController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Phone Device Mockup
    this.phoneContextName = document.getElementById('bridge-phone-context');
    this.phoneMeta = document.getElementById('bridge-phone-meta');
    this.phoneTimer = document.getElementById('bridge-phone-timer');
    this.handoffBtn = document.getElementById('btn-initiate-handoff');

    // Laptop Companion Mockup
    this.laptopBox = document.getElementById('bridge-laptop-box');
    this.laptopEmpty = document.getElementById('bridge-laptop-empty');
    this.laptopContextName = document.getElementById('bridge-laptop-context');
    this.laptopMeta = document.getElementById('bridge-laptop-meta');
    this.laptopTimer = document.getElementById('bridge-laptop-timer');
    this.laptopResumeBtn = document.getElementById('btn-laptop-resume');

    // Pipeline Stepper Steps
    this.stepPhone = document.getElementById('step-phone');
    this.stepRequest = document.getElementById('step-request');
    this.stepSync = document.getElementById('step-sync');
    this.stepReady = document.getElementById('step-ready');

    // Error Banner
    this.errorBanner = document.getElementById('bridge-error-banner');
    this.errorTitle = document.getElementById('bridge-error-title');
    this.errorDesc = document.getElementById('bridge-error-desc');

    // Hackathon Simulation Buttons
    this.demoUnauthorizedBtn = document.getElementById('demo-bridge-unauthorized');
    this.demoExpiredBtn = document.getElementById('demo-bridge-expired');
    this.demoMalformedBtn = document.getElementById('demo-bridge-malformed');
    this.demoOfflineBtn = document.getElementById('demo-bridge-offline');
    this.demoResetBtn = document.getElementById('demo-bridge-reset');
  }

  bindEvents() {
    if (this.handoffBtn) {
      this.handoffBtn.addEventListener('click', () => {
        this.app.initiateCrossDeviceHandoff();
      });
    }

    if (this.laptopResumeBtn) {
      this.laptopResumeBtn.addEventListener('click', () => {
        if (!window.bridgeEngine) return;
        try {
          const payload = window.bridgeEngine.receiveHandoff();
          if (payload && payload.session) {
            const s = payload.session;
            this.app.startSession(s.contextName, {
              topic: s.topic,
              lastStep: s.lastStep,
              nextAction: s.nextAction,
              mode: s.mode || 'zen',
            });
            if (typeof s.activeDurationMs === 'number') {
              this.app.session.correctElapsedTime(s.activeDurationMs, 'Synchronized from Phone via ECHODESK Bridge');
            }
            this.app.switchView('zen');
            window.bridgeEngine.clearHandoff();
            this.render();
          }
        } catch (err) {
          this.showError(err.code || 'SYNC_ERROR', err.message);
        }
      });
    }

    // Hackathon Simulation Triggers
    if (this.demoUnauthorizedBtn) {
      this.demoUnauthorizedBtn.addEventListener('click', () => {
        this.simulateFailure('UNAUTHORIZED_DEVICE', {
          handoffId: 'hoff_unauth',
          timestamp: Date.now(),
          targetDevice: 'untrusted_rogue_device_99',
          session: { contextName: 'DBMS' },
        });
      });
    }

    if (this.demoExpiredBtn) {
      this.demoExpiredBtn.addEventListener('click', () => {
        this.simulateFailure('EXPIRED_SESSION', {
          handoffId: 'hoff_expired',
          timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes old (exceeds 5m TTL)
          targetDevice: 'laptop',
          session: { contextName: 'DBMS' },
        });
      });
    }

    if (this.demoMalformedBtn) {
      this.demoMalformedBtn.addEventListener('click', () => {
        this.simulateFailure('MALFORMED_PAYLOAD', {
          handoffId: 'hoff_broken',
          session: null, // missing context
        });
      });
    }

    if (this.demoOfflineBtn) {
      this.demoOfflineBtn.addEventListener('click', () => {
        if (window.bridgeEngine) {
          const s = this.app.session ? this.app.session.toJSON() : { contextName: 'DBMS', topic: 'Normalization' };
          try {
            window.bridgeEngine.initiateHandoff(s, 'laptop');
            window.bridgeEngine.receiveHandoff({ isOffline: true });
          } catch (err) {
            this.showError('OFFLINE_STATE', err.message);
          }
          this.render();
        }
      });
    }

    if (this.demoResetBtn) {
      this.demoResetBtn.addEventListener('click', () => {
        if (window.bridgeEngine) {
          window.bridgeEngine.clearHandoff();
        }
        this.hideError();
        this.render();
      });
    }

    if (window.appEvents) {
      window.appEvents.on('bridge:handoff-sent', () => this.render());
      window.appEvents.on('bridge:handoff-received', () => this.render());
      window.appEvents.on('bridge:stage-changed', () => this.render());
      window.appEvents.on('session:state-change', () => this.render());
    }
  }

  simulateFailure(failureType, mockPayload) {
    if (!window.bridgeEngine) return;
    window.bridgeEngine.handoffPayload = mockPayload;
    try {
      window.bridgeEngine.receiveHandoff();
    } catch (err) {
      this.showError(failureType, err.message);
    }
    this.render();
  }

  showError(title, desc) {
    if (this.errorBanner) {
      this.errorBanner.classList.add('active');
      if (this.errorTitle) this.errorTitle.textContent = `Sync Error: ${title}`;
      if (this.errorDesc) this.errorDesc.textContent = desc;
    }
  }

  hideError() {
    if (this.errorBanner) {
      this.errorBanner.classList.remove('active');
    }
  }

  render() {
    const s = this.app.session;
    const engine = window.bridgeEngine;

    // 1. Render Phone Device State
    if (s && s.state !== WorkSessionState.IDLE) {
      if (this.phoneContextName) this.phoneContextName.textContent = s.contextName;
      if (this.phoneMeta) this.phoneMeta.textContent = `${s.lastStep || 'Q5'} — ${s.topic || 'In Progress'} (${s.state})`;
      if (this.phoneTimer) this.phoneTimer.textContent = WorkSession.formatDuration(s.getActiveDurationMs());
      if (this.handoffBtn) this.handoffBtn.disabled = false;
    } else {
      if (this.phoneContextName) this.phoneContextName.textContent = 'NO ACTIVE SESSION';
      if (this.phoneMeta) this.phoneMeta.textContent = 'Start a session on phone to enable handoff';
      if (this.phoneTimer) this.phoneTimer.textContent = '00:00';
      if (this.handoffBtn) this.handoffBtn.disabled = true;
    }

    // 2. Render Pipeline Stepper: PHONE -> HANDOFF REQUEST -> AUTHENTICATED SYNC -> LAPTOP SESSION READY
    const stage = engine ? engine.getStage() : 'PHONE';
    this.updateStepper(stage);

    // 3. Render Laptop Receiver View
    if (engine) {
      let pending = null;
      try {
        pending = engine.receiveHandoff();
        this.hideError();
      } catch (err) {
        this.showError(err.code || 'SYNC_ERROR', err.message);
      }

      if (pending && pending.session) {
        if (this.laptopBox) this.laptopBox.style.display = 'block';
        if (this.laptopEmpty) this.laptopEmpty.style.display = 'none';
        if (this.laptopContextName) this.laptopContextName.textContent = pending.session.contextName;
        if (this.laptopMeta) this.laptopMeta.textContent = `${pending.session.lastStep} — ${pending.session.topic} (Synced from phone)`;
        if (this.laptopTimer) this.laptopTimer.textContent = pending.session.formattedDuration || '00:00';
      } else {
        if (this.laptopBox) this.laptopBox.style.display = 'none';
        if (this.laptopEmpty) this.laptopEmpty.style.display = 'block';
      }
    }
  }

  updateStepper(stage) {
    const steps = [
      { el: this.stepPhone, key: 'PHONE' },
      { el: this.stepRequest, key: 'HANDOFF_REQUEST' },
      { el: this.stepSync, key: 'AUTHENTICATED_SYNC' },
      { el: this.stepReady, key: 'LAPTOP_SESSION_READY' },
    ];

    const order = ['PHONE', 'HANDOFF_REQUEST', 'AUTHENTICATED_SYNC', 'LAPTOP_SESSION_READY'];
    const curIdx = order.indexOf(stage);

    steps.forEach((st, idx) => {
      if (!st.el) return;
      st.el.classList.remove('active', 'completed');
      if (idx < curIdx) {
        st.el.classList.add('completed');
      } else if (idx === curIdx) {
        st.el.classList.add('active');
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.BridgeController = BridgeController;
}
