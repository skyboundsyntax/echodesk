/**
 * ECHODESK — JOT UI Controller
 * Manages user interactions with JOT: typing, voice push-to-talk, intent feed, and session controls.
 */

class JotController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.input = document.getElementById('jot-input');
    this.sendBtn = document.getElementById('jot-send-btn');
    this.voiceBtn = document.getElementById('jot-voice-btn');
    this.feedContainer = document.getElementById('jot-feed-container');

    // Active session card elements
    this.activeCard = document.getElementById('active-session-card');
    this.sessionContextTitle = document.getElementById('session-context-title');
    this.sessionStepPill = document.getElementById('session-step-pill');
    this.sessionTopicText = document.getElementById('session-topic-text');
    this.sessionTimer = document.getElementById('session-timer-display');
    this.sessionStateBadge = document.getElementById('session-state-badge');
    this.flowProtectedTag = document.getElementById('flow-protected-tag');

    // Session control buttons
    this.pauseBtn = document.getElementById('btn-session-pause');
    this.resumeBtn = document.getElementById('btn-session-resume');
    this.stopBtn = document.getElementById('btn-session-stop');
    this.enterZenBtn = document.getElementById('btn-session-zen');
  }

  bindEvents() {
    // Send message on Enter or Click
    if (this.sendBtn && this.input) {
      this.sendBtn.addEventListener('click', () => this.handleUserInput());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleUserInput();
        }
      });
    }

    // Voice Push-to-Talk
    if (this.voiceBtn) {
      this.voiceBtn.addEventListener('click', () => this.handleVoiceInput());
    }

    // Quick chip buttons
    document.querySelectorAll('.quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-input') || chip.textContent.trim();
        if (this.input) {
          this.input.value = text;
          this.handleUserInput();
        }
      });
    });

    // Session control buttons
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => {
        this.app.pauseSession('User clicked Pause');
      });
    }
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => {
        this.app.resumeSession('User clicked Resume');
      });
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => {
        this.app.stopSession('User clicked End');
      });
    }
    if (this.enterZenBtn) {
      this.enterZenBtn.addEventListener('click', () => {
        this.app.switchView('zen');
      });
    }

    // Listen to session state changes from EventBus
    if (window.appEvents) {
      window.appEvents.on('session:state-change', () => this.renderSessionState());
      window.appEvents.on('session:context-updated', () => this.renderSessionState());
      window.appEvents.on('session:corrected', (e) => {
        this.addFeedItem('TIME_CORRECTION', `Elapsed time corrected to ${WorkSession.formatDuration(e.session.activeDurationMs)} (${e.record.reason})`, true);
        this.renderSessionState();
      });
    }
  }

  async handleUserInput() {
    if (!this.input) return;
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    await this.processCommand(text);
  }

  async handleVoiceInput() {
    if (!window.voiceInput) return;

    if (window.voiceInput.isListening) {
      window.voiceInput.stopListening();
      this.voiceBtn.classList.remove('active');
      return;
    }

    this.voiceBtn.classList.add('active');
    try {
      const transcript = await window.voiceInput.startListening({ explicitUserGesture: true });
      this.voiceBtn.classList.remove('active');
      if (transcript) {
        if (this.input) this.input.value = transcript;
        await this.processCommand(transcript);
      }
    } catch (err) {
      this.voiceBtn.classList.remove('active');
      console.warn('[JotController] Voice input stopped:', err.message);
      if (err.code !== 'NOT_SUPPORTED') {
        this.addFeedItem('VOICE_NOTICE', err.message, false);
      }
    }
  }

  async processCommand(input) {
    if (!window.intentEngine) return;

    const currentSession = this.app.session ? this.app.session.toJSON() : {};
    const command = await window.intentEngine.process(input, currentSession, { explicitUserGesture: true });

    // Check policy gate
    if (!command.allowed) {
      this.addFeedItem('POLICY_DENIED', `Blocked by ECHOSHIELD: ${command.policyCheck.reason}`, false);
      return;
    }

    // Dispatch action to App
    switch (command.intent) {
      case 'START_WORK_SESSION':
        this.app.startSession(command.contextName, {
          topic: command.topic,
          lastStep: 'Q1',
          nextAction: 'Begin reading',
          mode: command.mode,
        });
        this.addFeedItem('START_SESSION', `Zen session started for ${command.contextName}${command.topic ? ` (${command.topic})` : ''}.`, true);
        break;

      case 'PAUSE_SESSION':
        this.app.pauseSession('User intent command');
        this.addFeedItem('PAUSE_SESSION', `Paused ${currentSession.contextName || 'session'}. Flow preserved.`, true);
        break;

      case 'RESUME_SESSION':
        this.app.resumeSession('User intent command');
        const greeting = window.echoMemory ? window.echoMemory.formatResumeGreeting(command.contextName) : 'Resuming session.';
        this.addFeedItem('RESUME_SESSION', greeting, true);
        break;

      case 'STOP_SESSION':
        this.app.stopSession('User intent command');
        this.addFeedItem('STOP_SESSION', `Session ended. Total active time: ${WorkSession.formatDuration(currentSession.activeDurationMs || 0)}.`, true);
        break;

      case 'CORRECT_SESSION_TIME':
        if (this.app.session && typeof command.adjustedDurationMs === 'number') {
          this.app.session.correctElapsedTime(command.adjustedDurationMs, command.reason);
        }
        break;

      case 'REQUEST_HANDOFF':
        this.app.initiateCrossDeviceHandoff();
        this.addFeedItem('CROSS_DEVICE_HANDOFF', `Session state prepared for laptop continuation without surveillance.`, true);
        break;

      case 'SET_INTERVENTION_PREFERENCE':
        if (window.flowEngine) {
          window.flowEngine.setPreference(command.preference);
          this.addFeedItem('PREFERENCE_UPDATED', `Intervention preference set to "${command.preference}". JOT will respect your focus.`, true);
        }
        break;

      case 'FORGET_MEMORY':
        if (window.echoMemory) {
          if (command.target === 'all') {
            window.echoMemory.clearAll();
            this.addFeedItem('MEMORY_CLEARED', 'All stored Echo memories were permanently deleted.', true);
          } else {
            const ctx = currentSession.contextName;
            if (ctx) {
              window.echoMemory.delete(ctx);
              this.addFeedItem('MEMORY_FORGOTTEN', `Deleted memory record for ${ctx}.`, true);
            }
          }
        }
        break;

      case 'ASK_STATUS':
        const statusMsg = this.app.session
          ? `Current session: ${this.app.session.contextName} (${this.app.session.state}). Active: ${WorkSession.formatDuration(this.app.session.getActiveDurationMs())}.`
          : 'No active session. Tell JOT what you are working on to begin.';
        this.addFeedItem('STATUS_INQUIRY', statusMsg, true);
        break;

      case 'ASK_EXPLANATION':
        if (window.flowEngine) {
          const explanation = window.flowEngine.explainDecision(command.query || input, {
            preference: window.flowEngine.getPreference(),
            sessionState: this.app.session ? this.app.session.state : 'IDLE',
          });
          this.addFeedItem('JOT_EXPLANATION', explanation.explanation, true);
        } else {
          this.addFeedItem('JOT_EXPLANATION', 'JOT protects your flow based on active session state and your minimal interruption preference.', true);
        }
        break;

      case 'UNCERTAIN':
      default:
        this.addFeedItem('UNCERTAIN_INTENT', command.prompt || `I heard "${input}". Could you clarify your work context?`, false);
    }
  }

  addFeedItem(title, description, isSuccess = true) {
    if (!this.feedContainer) return;

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="feed-icon">${isSuccess ? '⚡' : '🛡️'}</div>
      <div class="feed-content">
        <div class="feed-header">
          <span class="feed-intent-name">${title}</span>
          <span class="feed-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="feed-desc">${description}</div>
        <span class="feed-policy-badge">
          ${isSuccess ? '✓ Policy Passed' : '⚠ Policy Notice'}
        </span>
      </div>
    `;

    this.feedContainer.insertBefore(card, this.feedContainer.firstChild);

    // Keep feed trimmed to 10 items
    while (this.feedContainer.children.length > 10) {
      this.feedContainer.removeChild(this.feedContainer.lastChild);
    }
  }

  renderSessionState() {
    if (!this.app.session || this.app.session.state === WorkSessionState.IDLE) {
      if (this.activeCard) this.activeCard.style.display = 'none';
      return;
    }

    if (this.activeCard) this.activeCard.style.display = 'flex';

    const s = this.app.session;
    if (this.sessionContextTitle) this.sessionContextTitle.textContent = s.contextName || 'Work Session';
    if (this.sessionStepPill) this.sessionStepPill.textContent = s.lastStep || 'In Progress';
    if (this.sessionTopicText) this.sessionTopicText.textContent = s.topic ? `• ${s.topic}` : '';

    // State badge
    if (this.sessionStateBadge) {
      this.sessionStateBadge.className = `session-state-badge badge-${s.state.toLowerCase()}`;
      this.sessionStateBadge.textContent = s.state;
    }

    // Controls visibility
    if (this.pauseBtn) this.pauseBtn.style.display = s.state === WorkSessionState.ACTIVE ? 'inline-flex' : 'none';
    if (this.resumeBtn) this.resumeBtn.style.display = (s.state === WorkSessionState.PAUSED || s.state === WorkSessionState.UNCERTAIN) ? 'inline-flex' : 'none';
    if (this.stopBtn) this.stopBtn.style.display = s.state !== WorkSessionState.ENDED ? 'inline-flex' : 'none';

    // Flow protection tag past 25 minutes
    const isFlowProtected = s.getActiveDurationMs() >= 25 * 60 * 1000;
    if (this.flowProtectedTag) {
      this.flowProtectedTag.style.display = (s.state === WorkSessionState.ACTIVE && isFlowProtected) ? 'inline-flex' : 'none';
    }
    if (this.activeCard) {
      this.activeCard.classList.toggle('flow-glow', isFlowProtected);
    }
  }

  updateTimerTick() {
    if (!this.app.session || this.app.session.state === WorkSessionState.IDLE) return;
    const durMs = this.app.session.getActiveDurationMs();
    if (this.sessionTimer) {
      this.sessionTimer.textContent = WorkSession.formatDuration(durMs);
    }
  }
}

if (typeof window !== 'undefined') {
  window.JotController = JotController;
}
