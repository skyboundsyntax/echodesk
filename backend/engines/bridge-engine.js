/**
 * ECHODESK Backend — Cross-Device Bridge Engine
 * Implements Stage 10 Phone <-> Laptop Session Continuity:
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
    this.privacyGate = options.privacyGate || null;
    this.deviceId = options.deviceId || 'dev_server_host';
    this.authorizedDevices = ['laptop', 'laptop_companion_01', 'desktop', 'companion'];
    this.sessionTtlMs = options.sessionTtlMs || (5 * 60 * 1000);
    this.handoffPayload = null;
    this.currentStage = BridgeStage.PHONE;
    this.lastError = null;
  }

  getStage() {
    return this.currentStage;
  }

  getLastError() {
    return this.lastError;
  }

  validatePayload(payload, options = {}) {
    if (options.isOffline) {
      return {
        valid: false,
        error: {
          code: BridgeErrorCode.OFFLINE_STATE,
          message: 'Device is offline. Cross-device sync requires local network or companion connection.',
        },
      };
    }

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
      return {
        valid: false,
        error: {
          code: BridgeErrorCode.MALFORMED_PAYLOAD,
          message: 'Handoff payload is malformed or missing required work-session context.',
        },
      };
    }

    const now = typeof options.now === 'number' ? options.now : Date.now();
    const ttl = typeof options.ttlMs === 'number' ? options.ttlMs : this.sessionTtlMs;
    if (now - payload.timestamp > ttl) {
      return {
        valid: false,
        error: {
          code: BridgeErrorCode.EXPIRED_SESSION,
          message: `Session handoff token expired (${Math.round((now - payload.timestamp) / 1000)}s old). Request fresh handoff from phone.`,
        },
      };
    }

    const target = (payload.targetDevice || '').toLowerCase();
    const isAuthorizedTarget = this.authorizedDevices.some(d => d.toLowerCase() === target);
    if (!isAuthorizedTarget || (options.requirePairedSource && payload.sourceDevice !== this.deviceId)) {
      return {
        valid: false,
        error: {
          code: BridgeErrorCode.UNAUTHORIZED_DEVICE,
          message: `Device "${payload.targetDevice || 'unknown'}" is not authorized or paired with this companion.`,
        },
      };
    }

    return { valid: true };
  }

  initiateHandoff(sessionJSON, targetDevice = 'laptop', options = {}) {
    this.currentStage = BridgeStage.HANDOFF_REQUEST;
    this.lastError = null;

    if (this.privacyGate) {
      const evaluation = this.privacyGate.evaluate('CROSS_DEVICE_HANDOFF', {
        explicitUserRequest: true,
      });
      if (!evaluation.allowed) {
        this.currentStage = BridgeStage.ERROR;
        this.lastError = { code: BridgeErrorCode.POLICY_DENIED, message: evaluation.reason };
        const err = new Error(evaluation.reason);
        err.code = BridgeErrorCode.POLICY_DENIED;
        throw err;
      }
    }

    if (!sessionJSON || !sessionJSON.contextName) {
      this.currentStage = BridgeStage.ERROR;
      this.lastError = { code: BridgeErrorCode.MALFORMED_PAYLOAD, message: 'Cannot handoff empty or invalid work session.' };
      const err = new Error(this.lastError.message);
      err.code = BridgeErrorCode.MALFORMED_PAYLOAD;
      throw err;
    }

    this.currentStage = BridgeStage.AUTHENTICATED_SYNC;

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

    return this.handoffPayload;
  }

  receiveHandoff(options = {}) {
    if (!this.handoffPayload) {
      return null;
    }

    const validation = this.validatePayload(this.handoffPayload, options);
    if (!validation.valid) {
      this.currentStage = BridgeStage.ERROR;
      this.lastError = validation.error;
      const err = new Error(validation.error.message);
      err.code = validation.error.code;
      throw err;
    }

    this.currentStage = BridgeStage.LAPTOP_SESSION_READY;
    this.lastError = null;
    return this.handoffPayload;
  }

  clearHandoff() {
    this.handoffPayload = null;
    this.currentStage = BridgeStage.PHONE;
    this.lastError = null;
  }
}

module.exports = { BridgeEngine, BridgeStage, BridgeErrorCode };
