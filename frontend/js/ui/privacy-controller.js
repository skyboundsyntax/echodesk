/**
 * ECHODESK — ECHOSHIELD Privacy Center UI Controller
 * Implements Stage 8: Real-time permissions, hard security locks, audit telemetry, and memory purge.
 */

class PrivacyController {
  constructor(app) {
    this.app = app;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.micToggle = document.getElementById('priv-toggle-mic');
    this.cameraToggle = document.getElementById('priv-toggle-camera');
    this.memoryToggle = document.getElementById('priv-toggle-memory');
    this.cloudToggle = document.getElementById('priv-toggle-cloud');
    this.auditTableBody = document.getElementById('privacy-audit-tbody');
    this.purgeAllBtn = document.getElementById('btn-purge-all-data');
    this.apiKeyInput = document.getElementById('gemini-api-key-input');
    this.saveApiKeyBtn = document.getElementById('btn-save-api-key');
    this.flowSelect = document.getElementById('priv-select-flow');
  }

  bindEvents() {
    if (this.micToggle) {
      this.micToggle.addEventListener('change', (e) => {
        window.privacyGate.savePermissions({ micEnabled: e.target.checked });
      });
    }
    if (this.cameraToggle) {
      this.cameraToggle.addEventListener('change', (e) => {
        window.privacyGate.savePermissions({ cameraEnabled: e.target.checked });
      });
    }
    if (this.memoryToggle) {
      this.memoryToggle.addEventListener('change', (e) => {
        window.privacyGate.savePermissions({ memoryEnabled: e.target.checked });
      });
    }
    if (this.cloudToggle) {
      this.cloudToggle.addEventListener('change', (e) => {
        window.privacyGate.savePermissions({ cloudReasoningAllowed: e.target.checked });
      });
    }

    if (this.flowSelect) {
      this.flowSelect.addEventListener('change', (e) => {
        if (window.flowEngine) {
          window.flowEngine.setPreference(e.target.value);
        }
      });
    }

    if (this.purgeAllBtn) {
      this.purgeAllBtn.addEventListener('click', () => {
        if (confirm('Permanently purge all sessions, memories, and audit logs from this device?')) {
          if (window.appStorage) window.appStorage.clearAll();
          if (window.echoMemory) window.echoMemory.clearAll();
          alert('Privacy Purge Complete: All local data was destroyed.');
          location.reload();
        }
      });
    }

    if (this.saveApiKeyBtn && this.apiKeyInput) {
      this.saveApiKeyBtn.addEventListener('click', () => {
        const key = this.apiKeyInput.value.trim();
        if (window.appStorage) {
          window.appStorage.set('gemini_api_key', key);
        }
        if (window.defaultAiProvider && window.defaultAiProvider.setApiKey) {
          window.defaultAiProvider.setApiKey(key);
        }
        alert(key ? 'Gemini API key saved securely in browser storage.' : 'API key cleared. Deterministic local mode active.');
      });
    }

    if (window.appEvents) {
      window.appEvents.on('privacy:gate-evaluated', () => this.renderAuditLog());
      window.appEvents.on('privacy:permissions-changed', () => this.renderToggles());
      window.appEvents.on('flow:preference-changed', () => this.renderToggles());
    }
  }

  renderToggles() {
    if (!window.privacyGate) return;
    const perms = window.privacyGate.getPermissions();
    if (this.micToggle) this.micToggle.checked = perms.micEnabled;
    if (this.cameraToggle) this.cameraToggle.checked = perms.cameraEnabled;
    if (this.memoryToggle) this.memoryToggle.checked = perms.memoryEnabled;
    if (this.cloudToggle) this.cloudToggle.checked = perms.cloudReasoningAllowed;

    if (this.flowSelect && window.flowEngine) {
      this.flowSelect.value = window.flowEngine.getPreference();
    }

    if (this.apiKeyInput && window.appStorage) {
      this.apiKeyInput.value = window.appStorage.get('gemini_api_key', '');
    }
  }

  renderAuditLog() {
    if (!this.auditTableBody || !window.privacyGate) return;
    const logs = window.privacyGate.getAuditLog();

    this.auditTableBody.innerHTML = '';
    logs.slice(0, 15).forEach((entry) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-family: var(--font-mono);">${new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td><strong>${entry.actionType}</strong></td>
        <td>
          <span class="${entry.allowed ? 'audit-status-allow' : 'audit-status-deny'}">
            ${entry.allowed ? '✓ ALLOW' : '✕ DENY'}
          </span>
        </td>
        <td>${entry.reason}</td>
      `;
      this.auditTableBody.appendChild(row);
    });
  }
}

if (typeof window !== 'undefined') {
  window.PrivacyController = PrivacyController;
}
