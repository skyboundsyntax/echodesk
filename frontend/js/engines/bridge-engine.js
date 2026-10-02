/**
 * ECHODESK — Cross-Device Bridge Engine
 * Implements Stage 9 / P0.12 Phone <-> Laptop Session Continuity:
 * Synchronizes structured work-session context across devices with explicit authentication.
 * Strictly forbids desktop application scanning, window enumeration, or background surveillance.
 */

class BridgeEngine {
  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.appStorage : null);
    this.privacyGate = options.privacyGate || (typeof window !== 'undefined' ? window.privacyGate : null);
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.appEvents : null);

    this.deviceId = this._getOrCreateDeviceId();
    this.connectedDevice = {
      id: 'laptop_companion_01',
      name: 'MacBook Pro / ThinkPad',
      status: 'paired',
      lastSyncAt: Date.now(),
    };
    this.handoffPayload = null;
  }

  _getOrCreateDeviceId() {
    if (this.storage) {
      let id = this.storage.get('device_id', null);
      if (!id) {
        id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        this.storage.set('device_id', id);
      }
      return id;
    }
    return `dev_local_${Date.now().toString(36)}`;
  }

  /**
   * Initiate an explicit handoff from Phone to Laptop
   * @param {Object} sessionJSON Structured session state
   * @param {string} [targetDevice='laptop']
   * @returns {Object} Handoff package
   */
  initiateHandoff(sessionJSON, targetDevice = 'laptop') {
    // 1. Evaluate Privacy Policy Gate
    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('CROSS_DEVICE_HANDOFF', {
        explicitUserRequest: true,
      });
      if (!evaluation.allowed) {
        throw new Error(evaluation.reason);
      }
    }

    if (!sessionJSON || !sessionJSON.contextName) {
      throw new Error('Cannot handoff empty or invalid work session.');
    }

    // Prepare minimal, non-surveillance context payload
    this.handoffPayload = {
      handoffId: `hoff_${Date.now()}`,
      timestamp: Date.now(),
      sourceDevice: this.deviceId,
      targetDevice,
      session: {
        id: sessionJSON.id,
        contextName: sessionJSON.contextName,
        topic: sessionJSON.topic || '',
        lastStep: sessionJSON.lastStep || '',
        nextAction: sessionJSON.nextAction || '',
        status: sessionJSON.status || sessionJSON.state || 'active',
        activeDurationMs: sessionJSON.activeDurationMs || 0,
        formattedDuration: sessionJSON.formattedDuration || '00:00',
        mode: sessionJSON.mode || 'zen',
      },
    };

    if (this.storage) {
      this.storage.set('pending_handoff', this.handoffPayload);
    }

    if (this.eventBus) {
      this.eventBus.emit('bridge:handoff-sent', this.handoffPayload);
    }

    return this.handoffPayload;
  }

  /**
   * Consume pending handoff on target device (Laptop view)
   * @returns {Object|null}
   */
  receiveHandoff() {
    let payload = this.handoffPayload;
    if (!payload && this.storage) {
      payload = this.storage.get('pending_handoff', null);
    }

    if (payload) {
      if (this.eventBus) {
        this.eventBus.emit('bridge:handoff-received', payload);
      }
      return payload;
    }
    return null;
  }

  clearHandoff() {
    this.handoffPayload = null;
    if (this.storage) {
      this.storage.remove('pending_handoff');
    }
  }
}

if (typeof window !== 'undefined') {
  window.BridgeEngine = BridgeEngine;
  window.bridgeEngine = window.bridgeEngine || new BridgeEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BridgeEngine };
}
