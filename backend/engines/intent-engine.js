/**
 * ECHODESK Backend — Stage 2: JOT Text Intent Engine & AI Abstraction
 * Supports:
 * - START_WORK_SESSION ("studying DBMS")
 * - PAUSE_SESSION ("JOT, pause")
 * - RESUME_SESSION ("JOT, resume DBMS")
 * - STOP_SESSION ("JOT, stop")
 * - CORRECT_SESSION_TIME ("JOT, I stopped an hour ago")
 * - UPDATE_CONTEXT ("working on question 5", "topic: Normalization")
 * - ASK_STATUS ("what was I doing?")
 * - REQUEST_HANDOFF ("JOT, continue DBMS on laptop")
 * - SET_INTERVENTION_PREFERENCE ("JOT, less reminders")
 * - FORGET_MEMORY ("forget this session")
 */

const { PolicyActionType } = require('../core/privacy-gate');

class AIProvider {
  async parseIntent(input, sessionContext = {}) {
    throw new Error('AIProvider.parseIntent must be implemented by subclass.');
  }

  async reason(prompt, context = {}) {
    throw new Error('AIProvider.reason must be implemented by subclass.');
  }
}

class DeterministicLocalProvider extends AIProvider {
  async parseIntent(input, sessionContext = {}) {
    if (!input || typeof input !== 'string') {
      return { intent: 'UNKNOWN', confidence: 0.0, explanation: 'Empty or invalid input.' };
    }

    const clean = input.trim();
    const lower = clean.toLowerCase().replace(/^(hey jot|jot|ok jot)[,\s]*/i, '').trim();

    // 1. Time Correction ("I stopped an hour ago", "stopped 30 minutes ago", "set elapsed to 45m")
    const stoppedAgoMatch = lower.match(/(?:i\s+)?stopped\s+(\d+|an?|half\s+an?)\s*(hour|hr|minute|min)s?\s*ago/i);
    if (stoppedAgoMatch) {
      const quantityStr = stoppedAgoMatch[1].toLowerCase();
      const unit = stoppedAgoMatch[2].toLowerCase();
      let minutesAgo = 0;

      if (quantityStr === 'a' || quantityStr === 'an') {
        minutesAgo = unit.startsWith('h') ? 60 : 1;
      } else if (quantityStr.includes('half')) {
        minutesAgo = unit.startsWith('h') ? 30 : 0.5;
      } else {
        const num = parseFloat(quantityStr);
        minutesAgo = unit.startsWith('h') ? num * 60 : num;
      }

      const currentActiveMs = sessionContext.activeDurationMs || 0;
      const adjustedDurationMs = Math.max(0, currentActiveMs - minutesAgo * 60 * 1000);

      return {
        intent: 'CORRECT_SESSION_TIME',
        confidence: 0.95,
        minutesAgo,
        adjustedDurationMs,
        reason: `User indicated they stopped ${minutesAgo} minutes ago`,
        source: 'user_declared',
      };
    }

    // 2. Pause Commands ("pause", "pause dbms", "take a break")
    if (/^(pause(\s+.*)?|take a break|hold on)$/i.test(lower)) {
      return {
        intent: 'PAUSE_SESSION',
        confidence: 0.98,
        reason: 'User explicitly requested pause',
        source: 'user_declared',
      };
    }

    // 3. Resume Commands ("resume", "resume dbms", "back to work", "continue")
    if (/^(resume(\s+.*)?|back to work|continue)$/i.test(lower)) {
      const contextMatch = lower.match(/^resume\s+(.+)$/i);
      return {
        intent: 'RESUME_SESSION',
        confidence: 0.98,
        contextName: contextMatch ? contextMatch[1].trim() : (sessionContext.contextName || ''),
        reason: 'User explicitly requested resume',
        source: 'user_declared',
      };
    }

    // 4. Stop Commands ("stop", "end session", "finish", "done")
    if (/^(stop(\s+.*)?|end(\s+session)?|finish|done)$/i.test(lower)) {
      return {
        intent: 'STOP_SESSION',
        confidence: 0.98,
        reason: 'User explicitly requested session end',
        source: 'user_declared',
      };
    }

    // 5. Update Context ("working on Q5", "topic: Normalization", "current step: question 5")
    const updateMatch = lower.match(/(?:working on|step:|question|topic:?)\s*(.+)/i);
    if (updateMatch && sessionContext.state === 'ACTIVE') {
      const detail = updateMatch[1].trim();
      const isQuestion = /^q\d+|question\s+\d+/i.test(detail);
      return {
        intent: 'UPDATE_CONTEXT',
        confidence: 0.92,
        lastStep: isQuestion ? detail.toUpperCase() : undefined,
        topic: !isQuestion ? detail : undefined,
        source: 'user_declared',
      };
    }

    // 6. Cross-Device Handoff ("continue on laptop", "continue dbms on laptop")
    if (/continue\s+(.+?\s+)?on\s+laptop|handoff\s+to\s+laptop|open\s+on\s+laptop/i.test(lower)) {
      const contextMatch = lower.match(/continue\s+(.+?)\s+on\s+laptop/i);
      return {
        intent: 'REQUEST_HANDOFF',
        confidence: 0.96,
        targetDevice: 'laptop',
        contextName: contextMatch ? contextMatch[1].trim() : (sessionContext.contextName || ''),
        source: 'user_declared',
      };
    }

    // 7. User Intervention Preference ("less reminders", "fewer reminders")
    if (/less\s+reminders?|fewer\s+reminders?|minimal\s+reminders?|quiet\s+mode/i.test(lower)) {
      return {
        intent: 'SET_INTERVENTION_PREFERENCE',
        confidence: 0.95,
        preference: 'minimal',
        source: 'user_declared',
      };
    }

    // 8. Status & Memory Queries ("what was i doing", "status", "last step")
    if (/what\s+(was|am)\s+i\s+doing|status|last\s+step|current\s+session/i.test(lower)) {
      return {
        intent: 'ASK_STATUS',
        confidence: 0.95,
        source: 'user_declared',
      };
    }

    // 9. Forget / Memory Erasure ("forget this session", "clear memory")
    if (/forget\s+(this\s+session|memory|everything|dbms)|clear\s+memory/i.test(lower)) {
      return {
        intent: 'FORGET_MEMORY',
        confidence: 0.95,
        target: lower.includes('everything') ? 'all' : 'current',
        source: 'user_declared',
      };
    }

    // 10. Start Work Session ("studying DBMS", "coding compiler", "researching transformers")
    const startMatch = lower.match(/^(?:studying|working on|revising|reading|coding|building|preparing)\s+(.+)$/i);
    if (startMatch) {
      const target = startMatch[1].trim();
      const parts = target.split(/\s*[-–—:]\s*|\s+topic:\s*/i);
      const contextName = parts[0].trim().toUpperCase();
      const topic = parts.length > 1 ? parts[1].trim() : '';

      return {
        intent: 'START_WORK_SESSION',
        confidence: 0.96,
        contextName,
        topic,
        activity: 'studying',
        mode: 'zen',
        source: 'user_declared',
      };
    }

    // Short phrase fallback
    if (/^[a-zA-Z0-9\s-]{2,30}$/.test(lower) && !/^(yes|no|ok|cancel|help)$/i.test(lower)) {
      return {
        intent: 'START_WORK_SESSION',
        confidence: 0.85,
        contextName: lower.toUpperCase(),
        activity: 'working',
        mode: 'zen',
        source: 'inferred',
      };
    }

    return {
      intent: 'UNCERTAIN',
      confidence: 0.35,
      rawInput: input,
      prompt: `I heard "${input}". Would you like to start a work session with this context?`,
      source: 'inferred',
    };
  }

  async reason(prompt, context = {}) {
    if (context.lastStep && context.topic) {
      return `Welcome back. You were working on ${context.lastStep} — ${context.topic}.`;
    }
    if (context.contextName) {
      return `Welcome back. Resuming ${context.contextName}.`;
    }
    return 'Ready to assist. Tell JOT what you are working on.';
  }
}

class GeminiInteractionsProvider extends AIProvider {
  constructor(apiKey = '', localFallback = new DeterministicLocalProvider()) {
    super();
    this.apiKey = apiKey;
    this.localFallback = localFallback;
  }

  async parseIntent(input, sessionContext = {}) {
    if (!this.apiKey) {
      return this.localFallback.parseIntent(input, sessionContext);
    }
    // Network call with localFallback on failure
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const systemInstruction = `You are JOT, the intent parser for ECHODESK. Convert user input to JSON:
{
  "intent": "START_WORK_SESSION" | "PAUSE_SESSION" | "RESUME_SESSION" | "STOP_SESSION" | "CORRECT_SESSION_TIME" | "UPDATE_CONTEXT" | "REQUEST_HANDOFF" | "SET_INTERVENTION_PREFERENCE" | "ASK_STATUS" | "FORGET_MEMORY" | "UNCERTAIN",
  "contextName": string,
  "topic": string,
  "lastStep": string,
  "activity": string,
  "confidence": number,
  "minutesAgo": number
}
Input: "${input}"`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { ...JSON.parse(text), source: 'cloud_ai' };
      }
    } catch (e) {
      // Fallback seamlessly
    }
    return this.localFallback.parseIntent(input, sessionContext);
  }

  async reason(prompt, context = {}) {
    return this.localFallback.reason(prompt, context);
  }
}

class IntentEngine {
  constructor(options = {}) {
    this.aiProvider = options.aiProvider || new DeterministicLocalProvider();
    this.privacyGate = options.privacyGate || null;
  }

  async process(input, sessionContext = {}, meta = {}) {
    const parsed = await this.aiProvider.parseIntent(input, sessionContext);
    const policyAction = this._mapIntentToPolicyAction(parsed.intent);

    let policyCheck = { allowed: true, reason: 'No policy constraint' };
    if (this.privacyGate && policyAction) {
      policyCheck = this.privacyGate.evaluate(policyAction, {
        explicitUserGesture: meta.explicitUserGesture !== false,
        explicitUserRequest: true,
        containsRawSensorData: false,
      });
    }

    return {
      rawInput: input,
      intent: parsed.intent,
      confidence: parsed.confidence || 0.9,
      contextName: parsed.contextName || sessionContext.contextName || '',
      topic: parsed.topic || '',
      lastStep: parsed.lastStep || '',
      activity: parsed.activity || 'working',
      mode: parsed.mode || 'standard',
      minutesAgo: parsed.minutesAgo,
      adjustedDurationMs: parsed.adjustedDurationMs,
      targetDevice: parsed.targetDevice,
      preference: parsed.preference,
      source: parsed.source || 'user_declared',
      policyCheck,
      prompt: parsed.prompt,
      allowed: policyCheck.allowed,
    };
  }

  _mapIntentToPolicyAction(intent) {
    switch (intent) {
      case 'START_WORK_SESSION': return PolicyActionType.START_SESSION;
      case 'PAUSE_SESSION': return PolicyActionType.PAUSE_SESSION;
      case 'RESUME_SESSION': return PolicyActionType.RESUME_SESSION;
      case 'STOP_SESSION': return PolicyActionType.STOP_SESSION;
      case 'CORRECT_SESSION_TIME': return PolicyActionType.CORRECT_TIME;
      case 'REQUEST_HANDOFF': return PolicyActionType.CROSS_DEVICE_HANDOFF;
      case 'FORGET_MEMORY': return PolicyActionType.DELETE_MEMORY;
      default: return null;
    }
  }
}

module.exports = {
  AIProvider,
  DeterministicLocalProvider,
  GeminiInteractionsProvider,
  IntentEngine,
};
