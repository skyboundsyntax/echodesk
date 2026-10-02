/**
 * ECHODESK Backend — Privacy Policy Gate (ECHOSHIELD)
 * Non-bypassable server-side policy enforcement.
 */

const PolicyActionType = Object.freeze({
  START_SESSION: 'START_SESSION',
  PAUSE_SESSION: 'PAUSE_SESSION',
  RESUME_SESSION: 'RESUME_SESSION',
  STOP_SESSION: 'STOP_SESSION',
  CORRECT_TIME: 'CORRECT_TIME',
  SAVE_MEMORY: 'SAVE_MEMORY',
  READ_MEMORY: 'READ_MEMORY',
  DELETE_MEMORY: 'DELETE_MEMORY',
  ACTIVATE_MIC: 'ACTIVATE_MIC',
  ACTIVATE_CAMERA: 'ACTIVATE_CAMERA',
  PROCESS_PRESENCE: 'PROCESS_PRESENCE',
  DESKTOP_SURVEILLANCE: 'DESKTOP_SURVEILLANCE', // Strictly FORBIDDEN
  CROSS_DEVICE_HANDOFF: 'CROSS_DEVICE_HANDOFF',
  CLOUD_REASONING: 'CLOUD_REASONING',
});

class PrivacyPolicyGate {
  constructor(initialPermissions = {}) {
    this.permissions = {
      micEnabled: true,
      cameraEnabled: false,
      localPresenceEnabled: false,
      memoryEnabled: true,
      cloudReasoningAllowed: true,
      laptopCompanionAllowed: true,
      rawAudioRetention: false, // Strictly OFF
      rawVideoRetention: false, // Strictly OFF
      desktopInspectionAllowed: false, // Strictly OFF
      ...initialPermissions,
    };
    this.auditLog = [];
  }

  savePermissions(updates) {
    this.permissions = {
      ...this.permissions,
      ...updates,
      rawAudioRetention: false,
      rawVideoRetention: false,
      desktopInspectionAllowed: false,
    };
    return this.permissions;
  }

  getPermissions() {
    return { ...this.permissions };
  }

  evaluate(actionType, payload = {}) {
    let result = { allowed: false, reason: 'Unknown policy evaluation', code: 'DENY_DEFAULT' };

    switch (actionType) {
      case PolicyActionType.DESKTOP_SURVEILLANCE:
        result = {
          allowed: false,
          reason: 'Desktop surveillance and silent application inventory are strictly prohibited by ECHODESK privacy policy.',
          code: 'DENY_PROHIBITED_FEATURE',
        };
        break;

      case PolicyActionType.ACTIVATE_MIC:
        if (!this.permissions.micEnabled) {
          result = { allowed: false, reason: 'Microphone is disabled in Privacy Center.', code: 'DENY_MIC_DISABLED' };
        } else if (!payload.explicitUserGesture) {
          result = { allowed: false, reason: 'Always-listening passive microphone is prohibited. Explicit user gesture required.', code: 'DENY_PASSIVE_MIC' };
        } else {
          result = { allowed: true, reason: 'Scoped voice interaction authorized via explicit user gesture. Raw audio not retained.', code: 'ALLOW_SCOPED_MIC' };
        }
        break;

      case PolicyActionType.ACTIVATE_CAMERA:
      case PolicyActionType.PROCESS_PRESENCE:
        if (!this.permissions.cameraEnabled) {
          result = { allowed: false, reason: 'Camera presence assistance is disabled in Privacy Center.', code: 'DENY_CAMERA_DISABLED' };
        } else if (payload.cloudStreamRequested) {
          result = { allowed: false, reason: 'Streaming raw video frames to cloud is prohibited.', code: 'DENY_CLOUD_VIDEO_STREAM' };
        } else {
          result = { allowed: true, reason: 'Local presence classification allowed. Zero cloud video uploads.', code: 'ALLOW_LOCAL_PRESENCE' };
        }
        break;

      case PolicyActionType.SAVE_MEMORY:
        if (!this.permissions.memoryEnabled) {
          result = { allowed: false, reason: 'Echo Memory is disabled by user.', code: 'DENY_MEMORY_DISABLED' };
        } else if (payload.containsRawSensorData) {
          result = { allowed: false, reason: 'Storing raw sensor data in memory records is prohibited.', code: 'DENY_RAW_SENSOR_STORAGE' };
        } else {
          result = { allowed: true, reason: 'Structured context memory persistence authorized.', code: 'ALLOW_STRUCTURED_MEMORY' };
        }
        break;

      case PolicyActionType.READ_MEMORY:
      case PolicyActionType.DELETE_MEMORY:
        result = { allowed: true, reason: 'User memory inspection/deletion is always permitted.', code: 'ALLOW_MEMORY_MANAGEMENT' };
        break;

      case PolicyActionType.CROSS_DEVICE_HANDOFF:
        if (!this.permissions.laptopCompanionAllowed) {
          result = { allowed: false, reason: 'Cross-device handoff is disabled in Privacy Center.', code: 'DENY_BRIDGE_DISABLED' };
        } else if (!payload.explicitUserRequest) {
          result = { allowed: false, reason: 'Background device telemetry synchronization is prohibited. Explicit request required.', code: 'DENY_IMPLICIT_BRIDGE' };
        } else {
          result = { allowed: true, reason: 'Explicit session context handoff authorized.', code: 'ALLOW_EXPLICIT_BRIDGE' };
        }
        break;

      case PolicyActionType.START_SESSION:
      case PolicyActionType.PAUSE_SESSION:
      case PolicyActionType.RESUME_SESSION:
      case PolicyActionType.STOP_SESSION:
      case PolicyActionType.CORRECT_TIME:
        result = { allowed: true, reason: 'Standard session lifecycle action authorized.', code: 'ALLOW_SESSION_ACTION' };
        break;

      case PolicyActionType.CLOUD_REASONING:
        if (!this.permissions.cloudReasoningAllowed) {
          result = { allowed: false, reason: 'Cloud reasoning is disabled. Local deterministic mode only.', code: 'DENY_CLOUD_REASONING' };
        } else {
          result = { allowed: true, reason: 'Cloud reasoning authorized for text intent parsing.', code: 'ALLOW_CLOUD_REASONING' };
        }
        break;

      default:
        result = { allowed: false, reason: `Unrecognized action type "${actionType}". Failing closed.`, code: 'DENY_UNKNOWN_ACTION' };
    }

    const logEntry = {
      timestamp: Date.now(),
      actionType,
      allowed: result.allowed,
      code: result.code,
      reason: result.reason,
    };
    this.auditLog.unshift(logEntry);
    if (this.auditLog.length > 50) this.auditLog.pop();

    return result;
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

module.exports = { PrivacyPolicyGate, PolicyActionType };
