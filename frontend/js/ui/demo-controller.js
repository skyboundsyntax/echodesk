/**
 * ECHODESK — Live Demo & Hackathon Rehearsal Controller (Stage 12)
 * Coordinates the complete 11-step hackathon demo sequence:
 * 1. "Hey JOT, studying DBMS."
 * 2. Zen session starts.
 * 3. Fixed timer threshold passes; JOT remains quiet.
 * 4. User steps away.
 * 5. Possible pause detected.
 * 6. JOT asks to pause.
 * 7. Natural check-in appears.
 * 8. User returns.
 * 9. JOT restores DBMS / Q5 context.
 * 10. Phone → laptop handoff.
 * 11. Privacy Center (ECHOSHIELD).
 */

class DemoController {
  constructor(app) {
    this.app = app;
    this.currentStepIndex = 0;
    this.autoPlayTimer = null;
    this.isPlaying = false;
    this.stepDelayMs = 3200; // 3.2s per step during automated walkthrough

    this.steps = [
      {
        id: 1,
        title: 'Declare Intent',
        label: '1. Hey JOT',
        desc: 'User says: "Hey JOT, studying DBMS." Minimal intent declared without forms.',
        guarantee: 'Zero passive audio recording',
        action: async () => {
          this.app.switchView('jot');
          const input = document.getElementById('jot-text-input');
          if (input) input.value = 'Hey JOT, studying DBMS';
          this.showToast('Step 1: JOT Intent', 'User says: "Hey JOT, studying DBMS." Zero always-listening mic.');
        },
      },
      {
        id: 2,
        title: 'Zen Mode Focus',
        label: '2. Zen Starts',
        desc: 'Zen session starts cleanly. Focused UI with topic (Normalization) and real-time active timer.',
        guarantee: 'Local presence sensing',
        action: async () => {
          this.app.startSession('DBMS', {
            topic: 'Normalization',
            lastStep: 'Q5',
            nextAction: 'Continue Q5',
            mode: 'zen',
          });
          this.app.switchView('zen');
          this.showToast('Step 2: Zen Mode', 'Zen Mode active for DBMS (Q5 — Normalization). Distractions eliminated.');
        },
      },
      {
        id: 3,
        title: 'Flow Protection',
        label: '3. 25m Threshold',
        desc: 'Fixed 25-minute Pomodoro mark passes. JOT does not forcibly interrupt deep work.',
        guarantee: 'Flow protected over rigid timers',
        action: async () => {
          this.app.switchView('zen');
          if (this.app.session) {
            this.app.session.correctElapsedTime(26 * 60 * 1000, 'Demo: 25m Pomodoro boundary');
            this.app.zenController.render();
            const flowText = document.getElementById('zen-flow-status-text');
            if (flowText) flowText.textContent = 'Flow protected — JOT is staying quiet (26m active focus)';
          }
          this.showToast('Step 3: Flow Protection', '25m threshold passed: JOT stays quiet instead of forcing a break.');
        },
      },
      {
        id: 4,
        title: 'User Steps Away',
        label: '4. Step Away',
        desc: 'User walks away from desk. Local sensor notes absence signal with confidence threshold.',
        guarantee: 'Zero raw video upload',
        action: async () => {
          this.app.switchView('zen');
          if (this.app.cameraPresence) {
            this.app.cameraPresence.setSignal('ABSENT', 0.94);
            const camStatus = document.getElementById('zen-presence-indicator');
            if (camStatus) camStatus.textContent = 'Presence: ABSENT (94%)';
          }
          this.showToast('Step 4: User Stepped Away', 'Presence signal: ABSENT. Processed locally, frames discarded.');
        },
      },
      {
        id: 5,
        title: 'Pause Evaluation',
        label: '5. Pause Detected',
        desc: 'FlowEngine evaluates sustained absence beyond grace period without momentary twitch.',
        guarantee: 'No auto-pause on glance away',
        action: async () => {
          this.app.switchView('zen');
          this.showToast('Step 5: Grace Period Passed', 'FlowEngine detected sustained absence: evaluating gentle pause proposal.');
        },
      },
      {
        id: 6,
        title: 'Ask to Pause',
        label: '6. JOT Asks Pause',
        desc: 'JOT asks to confirm pause rather than assuming: "Looks like you stepped away. Pause DBMS?"',
        guarantee: 'Transparent consent UI',
        action: async () => {
          this.app.switchView('zen');
          if (this.app.zenController) {
            this.app.zenController.showPauseProposal('Looks like you stepped away. Pause DBMS?');
          }
          this.showToast('Step 6: Pause Proposal', 'JOT asks: "Looks like you stepped away. Pause DBMS?"');
        },
      },
      {
        id: 7,
        title: 'Natural Check-In',
        label: '7. Smart Check-In',
        desc: 'Session paused. Context-aware gentle reset offered: Hydration Reset (💧 Grab some water).',
        guarantee: 'No pushy gamification',
        action: async () => {
          this.app.switchView('zen');
          this.app.pauseSession('Natural stepped-away pause');
          if (this.app.zenController) {
            this.app.zenController.hidePauseProposal();
            this.app.zenController.showCheckIn({
              id: 'water',
              icon: '💧',
              title: 'Hydration Reset',
              text: 'Grab a sip of water before continuing.',
            });
          }
          this.showToast('Step 7: Gentle Check-In', '💧 Quick Reset: Grab some water before continuing.');
        },
      },
      {
        id: 8,
        title: 'User Returns',
        label: '8. User Returns',
        desc: 'User returns to desk. Sensor immediately updates presence signal back to PRESENT.',
        guarantee: 'Instant return detection',
        action: async () => {
          this.app.switchView('zen');
          if (this.app.cameraPresence) {
            this.app.cameraPresence.setSignal('PRESENT', 0.95);
            const camStatus = document.getElementById('zen-presence-indicator');
            if (camStatus) camStatus.textContent = 'Presence: PRESENT (95%)';
          }
          if (this.app.zenController) {
            this.app.zenController.hideCheckIn();
          }
          this.showToast('Step 8: User Returns', 'Presence restored to PRESENT. Check-in dismissed.');
        },
      },
      {
        id: 9,
        title: 'Context Restored',
        label: '9. Restore Q5',
        desc: 'JOT restores exact work context: "Welcome back. You were working on Q5 — Normalization."',
        guarantee: 'State from Echo Memory',
        action: async () => {
          this.app.resumeSession('User return restoration');
          this.app.switchView('zen');
          const flowText = document.getElementById('zen-flow-status-text');
          if (flowText) {
            flowText.textContent = 'Welcome back! Restored Q5 — Normalization focus.';
          }
          this.showToast('Step 9: Context Restored', 'Welcome back! You were working on Q5 — Normalization.');
        },
      },
      {
        id: 10,
        title: 'Phone ↔ Laptop Bridge',
        label: '10. Laptop Bridge',
        desc: 'User says: "JOT, continue DBMS on laptop." Authenticated handoff synchronizes state, not surveillance.',
        guarantee: 'Zero laptop app inspection',
        action: async () => {
          this.app.initiateCrossDeviceHandoff();
          this.app.switchView('bridge');
          // Automatically trigger target receive on laptop companion
          setTimeout(() => {
            if (this.app.bridgeEngine) {
              this.app.bridgeEngine.receiveHandoff();
              this.app.bridgeController.render();
            }
          }, 800);
          this.showToast('Step 10: Phone → Laptop Handoff', 'Synchronized DBMS / Q5 state with laptop. Zero desktop inspection.');
        },
      },
      {
        id: 11,
        title: 'Privacy Center',
        label: '11. ECHOSHIELD',
        desc: 'ECHOSHIELD Privacy Center: live gate audit trail, hard-locked zero raw retention, and full memory controls.',
        guarantee: 'Non-bypassable code gate',
        action: async () => {
          this.app.switchView('privacy');
          this.showToast('Step 11: Privacy Center', 'ECHOSHIELD non-bypassable code gates & real-time audit stream.');
        },
      },
    ];

    this.render();
    this.bindEvents();
  }

  render() {
    let bar = document.getElementById('demo-presenter-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-presenter-bar';
      bar.className = 'demo-presenter-bar';
      document.body.appendChild(bar);
    }

    const currentStep = this.steps[this.currentStepIndex];

    bar.innerHTML = `
      <div class="demo-bar-header">
        <div class="demo-badge-title">
          <span class="demo-badge-pill">Hackathon Showcase</span>
          <span>ECHODESK Live Demo Flow (11 Steps)</span>
        </div>
        <div class="demo-controls-group">
          <button id="demo-btn-prev" class="demo-action-btn" ${this.currentStepIndex === 0 ? 'disabled' : ''}>◀ Prev</button>
          <button id="demo-btn-play" class="demo-action-btn ${this.isPlaying ? 'active' : 'primary'}">
            ${this.isPlaying ? '⏸ Pause Tour' : '▶ Auto-Play Tour'}
          </button>
          <button id="demo-btn-next" class="demo-action-btn" ${this.currentStepIndex === this.steps.length - 1 ? 'disabled' : ''}>Next ▶</button>
          <button id="demo-btn-reset" class="demo-action-btn" title="Reset all state to initial">⏹ Reset</button>
          <button id="demo-btn-minimize" class="demo-action-btn" style="padding: 4px 8px;" title="Minimize / Expand bar">_</button>
        </div>
      </div>

      <div class="demo-bar-expanded-content">
        <div class="demo-stepper-row">
          ${this.steps.map((s, idx) => `
            <div class="demo-step-pill ${idx === this.currentStepIndex ? 'active' : (idx < this.currentStepIndex ? 'completed' : '')}" data-step-idx="${idx}">
              ${s.label}
            </div>
          `).join('')}
        </div>

        <div class="demo-step-info-box">
          <span class="demo-step-num">Step ${currentStep.id}/${this.steps.length}: ${currentStep.title}</span>
          <span class="demo-step-description">${currentStep.desc}</span>
          <span class="demo-step-guarantee">🛡️ ${currentStep.guarantee}</span>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const bar = document.getElementById('demo-presenter-bar');
    if (!bar) return;

    bar.addEventListener('click', (e) => {
      const stepPill = e.target.closest('.demo-step-pill');
      if (stepPill) {
        const idx = parseInt(stepPill.getAttribute('data-step-idx'), 10);
        this.goToStep(idx);
        return;
      }

      if (e.target.closest('#demo-btn-prev')) {
        this.prevStep();
      } else if (e.target.closest('#demo-btn-next')) {
        this.nextStep();
      } else if (e.target.closest('#demo-btn-play')) {
        if (this.isPlaying) {
          this.stopAutoPlay();
        } else {
          this.startAutoPlay();
        }
      } else if (e.target.closest('#demo-btn-reset')) {
        this.resetDemo();
      } else if (e.target.closest('#demo-btn-minimize')) {
        bar.classList.toggle('minimized');
      }
    });

    // Also connect header shortcut button if present
    const headerBtn = document.getElementById('btn-open-demo-modal');
    if (headerBtn) {
      headerBtn.addEventListener('click', () => {
        bar.classList.remove('minimized');
        bar.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  async goToStep(index) {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStepIndex = index;
    this.render();
    const step = this.steps[this.currentStepIndex];
    if (step && typeof step.action === 'function') {
      await step.action();
    }
  }

  nextStep() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.goToStep(this.currentStepIndex + 1);
    } else {
      this.stopAutoPlay();
    }
  }

  prevStep() {
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1);
    }
  }

  startAutoPlay() {
    this.isPlaying = true;
    this.render();
    this.autoPlayTimer = setInterval(() => {
      if (this.currentStepIndex < this.steps.length - 1) {
        this.nextStep();
      } else {
        this.stopAutoPlay();
      }
    }, this.stepDelayMs);
  }

  stopAutoPlay() {
    this.isPlaying = false;
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.render();
  }

  resetDemo() {
    this.stopAutoPlay();
    if (this.app.session) {
      this.app.session.stop('Demo reset');
    }
    if (this.app.echoMemory) {
      this.app.echoMemory.clearAll();
    }
    if (this.app.bridgeEngine) {
      this.app.bridgeEngine.clearHandoff();
    }
    if (this.app.cameraPresence) {
      this.app.cameraPresence.stop();
    }
    this.currentStepIndex = 0;
    this.app.switchView('jot');
    this.render();
    this.showToast('Demo Reset', 'All demo sessions, memories, and bridge states reset to initial.');
  }

  showToast(title, message) {
    let toast = document.querySelector('.demo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'demo-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-weight: 700; font-size: 13px; color: #38bdf8;">${title}</span>
        <span style="font-size: 10px; color: var(--text-muted);">ECHODESK</span>
      </div>
      <div style="font-size: 12px; color: #e2e8f0; line-height: 1.4;">${message}</div>
    `;

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3800);
  }
}

if (typeof window !== 'undefined') {
  window.DemoController = DemoController;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DemoController };
}
