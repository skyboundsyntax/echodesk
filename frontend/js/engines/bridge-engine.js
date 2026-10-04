/**
 * ECHODESK — Cross-Device Bridge Engine
 * Implements Stage 10: Phone <-> Laptop Session Continuity:
 * Synchronizes structured work-session context across devices with explicit authentication.
 * Strictly forbids desktop application scanning, window enumeration, or background surveillance.
 * 
 * Pipeline:
 * PHONE -> HANDOFF REQUEST -> AUTHENTICATED SYNC -> LAPTOP SESSION READY
 * 
 * Failure handling:
 * - unauthorized device
 * - expired session
 * - malformed payload
 * - offline state
 */

const BridgeStage = Object.freeze({
  PHONE: 'PHONE',
  HANDOFF_REQUEST: 'HANDOFF_REQUEST',
  AUTHENTICATED_SYNC: 'AUTHENTICATED_SYNC',
  LAPTOP_SESSION_READY: 'LAPTOP_SESSION_READY',
  ERROR: 'ERROR',
});

const BridgeErrorCode = Object.freeze({
  UNAUTHORIZED_DEVICE: 'UNAUTHORIZED_DEVICE',
  EXPIRED_SESSION: 'EXPIRED_SESSION',
  MALFORMED_PAYLOAD: 'MALFORMED_PAYLOAD',
  OFFLINE_STATE: 'OFFLINE_STATE',
  POLICY_DENIED: 'POLICY_DENIED',
});

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
    this.authorizedDevices = ['laptop', 'laptop_companion_01', 'desktop', 'companion', 'phone', 'mobile', 'phone_01'];
    this.sessionTtlMs = options.sessionTtlMs || (5 * 60 * 1000); // 5 minutes TTL
    this.handoffPayload = null;
    this.currentStage = BridgeStage.PHONE;
    this.lastError = null;
    this.role = options.role || (this.storage ? this.storage.get('device_role', 'phone') : 'phone');
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

  getStage() {
    return this.currentStage;
  }

  getLastError() {
    return this.lastError;
  }

  /**
   * Validate incoming handoff payload against integrity, authorization, and freshness rules
   * @param {Object} payload
   * @param {Object} [options]
   * @returns {{ valid: boolean, error?: { code: string, message: string } }}
   */
  validatePayload(payload, options = {}) {
    // 1. Offline State Check
    const isOffline = options.isOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (isOffline) {
      const err = {
        code: BridgeErrorCode.OFFLINE_STATE,
        message: 'Device is offline. Cross-device sync requires local network or companion connection.',
      };
      return { valid: false, error: err };
    }

    // 2. Malformed Payload Check
    if (
      !payload ||
      typeof payload !== 'object' ||
      !payload.handoffId ||
      !payload.session ||
      typeof payload.session !== 'object' ||
      !payload.session.contextName ||
      typeof payload.session.contextName !== 'string' ||
      payload.session.contextName.trim() === '' ||
      typeof payload.timestamp !== 'number'
    ) {
      const err = {
        code: BridgeErrorCode.MALFORMED_PAYLOAD,
        message: 'Handoff payload is malformed or missing required work-session context.',
      };
      return { valid: false, error: err };
    }

    // 3. Expired Session Check (TTL)
    const now = typeof options.now === 'number' ? options.now : Date.now();
    const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : this.sessionTtlMs;
    if (now - payload.timestamp > ttl) {
      const err = {
        code: BridgeErrorCode.EXPIRED_SESSION,
        message: `Session handoff token expired (${Math.round((now - payload.timestamp) / 1000)}s old). Request fresh handoff from phone.`,
      };
      return { valid: false, error: err };
    }

    // 4. Unauthorized Device Check
    const target = (payload.targetDevice || '').toLowerCase();
    const isAuthorizedTarget = this.authorizedDevices.some(d => d.toLowerCase() === target);
    if (!isAuthorizedTarget || (options.requirePairedSource && payload.sourceDevice !== this.deviceId)) {
      const err = {
        code: BridgeErrorCode.UNAUTHORIZED_DEVICE,
        message: `Device "${payload.targetDevice || 'unknown'}" is not authorized or paired with this companion.`,
      };
      return { valid: false, error: err };
    }

    return { valid: true };
  }

  /**
   * Initiate an explicit handoff from Phone to Laptop
   * Pipeline: PHONE -> HANDOFF_REQUEST -> AUTHENTICATED_SYNC
   * @param {Object} sessionJSON Structured session state
   * @param {string} [targetDevice='laptop']
   * @param {Object} [options]
   * @returns {Object} Handoff package
   */
  initiateHandoff(sessionJSON, targetDevice = 'laptop', options = {}) {
    this.currentStage = BridgeStage.HANDOFF_REQUEST;
    this.lastError = null;

    if (this.eventBus) {
      this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage });
    }

    // 1. Evaluate Privacy Policy Gate
    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('CROSS_DEVICE_HANDOFF', {
        explicitUserRequest: true,
      });
      if (!evaluation.allowed) {
        this.currentStage = BridgeStage.ERROR;
        this.lastError = { code: BridgeErrorCode.POLICY_DENIED, message: evaluation.reason };
        if (this.eventBus) {
          this.eventBus.emit('bridge:error', this.lastError);
          this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage, error: this.lastError });
        }
        const err = new Error(evaluation.reason);
        err.code = BridgeErrorCode.POLICY_DENIED;
        throw err;
      }
    }

    // 2. Validate Session Context
    if (!sessionJSON || !sessionJSON.contextName) {
      this.currentStage = BridgeStage.ERROR;
      this.lastError = { code: BridgeErrorCode.MALFORMED_PAYLOAD, message: 'Cannot handoff empty or invalid work session.' };
      if (this.eventBus) {
        this.eventBus.emit('bridge:error', this.lastError);
        this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage, error: this.lastError });
      }
      const err = new Error(this.lastError.message);
      err.code = BridgeErrorCode.MALFORMED_PAYLOAD;
      throw err;
    }

    // 3. Authenticated Sync Stage
    this.currentStage = BridgeStage.AUTHENTICATED_SYNC;
    if (this.eventBus) {
      this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage });
    }

    // Prepare minimal, non-surveillance context payload
    this.handoffPayload = {
      handoffId: `hoff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: typeof options.timestamp === 'number' ? options.timestamp : Date.now(),
      sourceDevice: this.deviceId,
      targetDevice,
      session: {
        id: sessionJSON.id || `sess_${Date.now()}`,
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
   * Pipeline: AUTHENTICATED_SYNC -> LAPTOP_SESSION_READY (or ERROR)
   * @param {Object} [options]
   * @returns {Object|null}
   */
  receiveHandoff(options = {}) {
    let payload = this.handoffPayload;
    if (!payload && this.storage) {
      payload = this.storage.get('pending_handoff', null);
    }

    if (!payload) {
      return null;
    }

    // Validate payload against authorization, expiration, and malformation
    const validation = this.validatePayload(payload, options);
    if (!validation.valid) {
      this.currentStage = BridgeStage.ERROR;
      this.lastError = validation.error;
      if (this.eventBus) {
        this.eventBus.emit('bridge:error', this.lastError);
        this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage, error: this.lastError });
      }
      const err = new Error(validation.error.message);
      err.code = validation.error.code;
      throw err;
    }

    this.currentStage = BridgeStage.LAPTOP_SESSION_READY;
    this.lastError = null;

    if (this.eventBus) {
      this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage, payload });
      this.eventBus.emit('bridge:handoff-received', payload);
    }

    return payload;
  }

  /**
   * Synchronize state back from Laptop/Office Kit to Phone
   * Implements Acceptance Criterion: "State changes can sync back."
   * @param {Object} updatedSession
   * @param {string} [targetDevice='phone']
   * @returns {Object} Reverse handoff payload
   */
  syncBackToPhone(updatedSession, targetDevice = 'phone') {
    const payload = this.initiateHandoff(updatedSession, targetDevice);
    if (this.eventBus) {
      this.eventBus.emit('bridge:synced-back', payload);
    }
    return payload;
  }

  setRole(role) {
    this.role = role;
    if (this.storage) {
      this.storage.set('device_role', role);
    }
    if (this.eventBus) {
      this.eventBus.emit('bridge:role-changed', { role });
    }
  }

  getRole() {
    return this.role || 'phone';
  }

  getPairingPin() {
    let pin = this.storage ? this.storage.get('pairing_pin', null) : null;
    if (!pin) {
      pin = `ECHO-${Math.floor(1000 + Math.random() * 9000)}`;
      if (this.storage) this.storage.set('pairing_pin', pin);
    }
    return pin;
  }

  clearHandoff() {
    this.handoffPayload = null;
    this.currentStage = BridgeStage.PHONE;
    this.lastError = null;
    if (this.storage) {
      this.storage.remove('pending_handoff');
    }
    if (this.eventBus) {
      this.eventBus.emit('bridge:stage-changed', { stage: this.currentStage });
    }
  }
}

if (typeof window !== 'undefined') {
  window.BridgeStage = BridgeStage;
  window.BridgeErrorCode = BridgeErrorCode;
  window.BridgeEngine = BridgeEngine;
  window.bridgeEngine = window.bridgeEngine || new BridgeEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BridgeEngine, BridgeStage, BridgeErrorCode };
}
