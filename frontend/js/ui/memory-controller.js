/**
 * ECHODESK — Echo Memory Center UI Controller
 * Implements Stage 4 Echo Memory view:
 * Visualizes structured work-session context, resume points, and user deletion controls.
 */

class MemoryController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.container = document.getElementById('memory-list-container');
    this.resumeGreetingCard = document.getElementById('memory-resume-greeting');
    this.clearAllBtn = document.getElementById('btn-memory-clear-all');
  }

  bindEvents() {
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => {
        if (confirm('Permanently delete all stored Echo memories? This action cannot be undone.')) {
          if (window.echoMemory) {
            window.echoMemory.clearAll();
          }
        }
      });
    }

    if (window.appEvents) {
      window.appEvents.on('memory:updated', () => this.render());
      window.appEvents.on('memory:cleared', () => this.render());
    }
  }

  render() {
    if (!this.container || !window.echoMemory) return;

    const memories = window.echoMemory.getAll();

    // Update resume greeting banner
    if (this.resumeGreetingCard) {
      const greeting = window.echoMemory.formatResumeGreeting();
      this.resumeGreetingCard.textContent = greeting;
    }

    if (memories.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          No saved memories yet. Start a session with JOT and work state will be remembered here without tracking raw sensor data.
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';
    memories.forEach((mem) => {
      const card = document.createElement('div');
      card.className = 'feed-card';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';

      card.innerHTML = `
        <div style="display: flex; gap: 16px; align-items: center;">
          <div class="feed-icon" style="background: rgba(56, 189, 248, 0.1); color: var(--primary);">🧠</div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <span style="font-size: 16px; font-weight: 700; color: #fff;">${mem.contextName}</span>
              ${mem.topic ? `<span class="session-state-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">${mem.topic}</span>` : ''}
              <span class="session-state-badge badge-${(mem.status || 'paused').toLowerCase()}">${mem.status || 'paused'}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary);">
              Last Step: <strong style="color: var(--primary);">${mem.lastStep || 'None'}</strong> • Next: ${mem.nextAction || 'Continue'}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Active Duration: ${mem.formattedDuration || '00:00'} • Updated: ${new Date(mem.updatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-ctrl btn-resume-memory" data-context="${mem.contextName}">▶ Resume</button>
          <button class="btn-ctrl btn-delete-memory" data-context="${mem.contextName}" style="color: #f87171;">🗑 Forget</button>
        </div>
      `;

      // Bind button actions
      card.querySelector('.btn-resume-memory').addEventListener('click', () => {
        this.app.startSession(mem.contextName, {
          topic: mem.topic,
          lastStep: mem.lastStep,
          nextAction: mem.nextAction,
          mode: 'zen',
        });
        this.app.switchView('zen');
      });

      card.querySelector('.btn-delete-memory').addEventListener('click', () => {
        window.echoMemory.delete(mem.contextName);
      });

      this.container.appendChild(card);
    });
  }
}

if (typeof window !== 'undefined') {
  window.MemoryController = MemoryController;
}
