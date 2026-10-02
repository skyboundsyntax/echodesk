/**
 * ECHODESK — Cross-Device Bridge UI Controller
 * Implements Stage 9 Phone <-> Laptop Session Handoff.
 */

class BridgeController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.phoneContextName = document.getElementById('bridge-phone-context');
    this.phoneMeta = document.getElementById('bridge-phone-meta');
    this.phoneTimer = document.getElementById('bridge-phone-timer');
    this.handoffBtn = document.getElementById('btn-initiate-handoff');

    this.laptopBox = document.getElementById('bridge-laptop-box');
    this.laptopContextName = document.getElementById('bridge-laptop-context');
    this.laptopMeta = document.getElementById('bridge-laptop-meta');
    this.laptopTimer = document.getElementById('bridge-laptop-timer');
    this.laptopResumeBtn = document.getElementById('btn-laptop-resume');
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
      });
    }

    if (window.appEvents) {
      window.appEvents.on('bridge:handoff-sent', () => this.render());
      window.appEvents.on('session:state-change', () => this.render());
    }
  }

  render() {
    const s = this.app.session;

    // Render Phone view
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

    // Render Laptop receiver view
    if (window.bridgeEngine) {
      const pending = window.bridgeEngine.receiveHandoff();
      if (pending && pending.session) {
        if (this.laptopBox) this.laptopBox.style.display = 'block';
        if (this.laptopContextName) this.laptopContextName.textContent = pending.session.contextName;
        if (this.laptopMeta) this.laptopMeta.textContent = `${pending.session.lastStep} — ${pending.session.topic} (Synced from phone)`;
        if (this.laptopTimer) this.laptopTimer.textContent = pending.session.formattedDuration || '00:00';
      } else {
        if (this.laptopBox) this.laptopBox.style.display = 'none';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.BridgeController = BridgeController;
}
