/**
 * ECHODESK — AI Provider Abstraction
 * Supports both deterministic local intent parsing (zero network required)
 * and optional cloud-backed reasoning (Gemini API) behind a unified interface.
 */

class AIProvider {
  /**
   * Parse user natural language input into a structured intent object
   * @param {string} input
   * @param {Object} [sessionContext]
   * @returns {Promise<Object>}
   */
  async parseIntent(input, sessionContext = {}) {
    throw new Error('AIProvider.parseIntent must be implemented by subclass.');
  }

  /**
   * Reason over context to provide a concise assistant explanation or plan
   * @param {string} prompt
   * @param {Object} [context]
   * @returns {Promise<string>}
   */
  async reason(prompt, context = {}) {
    throw new Error('AIProvider.reason must be implemented by subclass.');
  }
}

/**
 * Deterministic Local Provider
 * Fast, 100% offline, privacy-first intent parser.
 * Handles the complete hackathon core interaction set reliably.
 */
class DeterministicLocalProvider extends AIProvider {
  async parseIntent(input, sessionContext = {}) {
    if (!input || typeof input !== 'string') {
      return {
        intent: 'UNKNOWN',
        confidence: 0.0,
        explanation: 'Empty or invalid input.',
      };
    }

    let clean = input.trim();
    // 1. Remove trailing sentence punctuation added by speech recognizers (e.g. "Jot." -> "Jot", "J.O.T." -> "J.O.T")
    clean = clean.replace(/[.,!?;:]+$/, '').trim();

    // 2. Normalize all spellings of "J.O.T" / "J-O-T" / "J O T" / "jay o tee" / "jay oh tee" into "JOT"
    clean = clean.replace(/\b(?:j\.?\s*o\.?\s*t\.?|jay\s*(?:o|oh)\s*tee|j-o-t)\b/gi, 'JOT');

    // 3. Normalize speech-to-text phonetic mishearings for "JOT" / "Hey JOT"
    const normalized = clean
      .replace(/^(?:hey|hi|ok|okay|a|eight|hate)\s+(?:jot|john|job|josh|jock|joy|chat|judge|george|shot|dot|yacht|chuck|jar|jaw|doc|jack|just|jaunt|jott|jatt|judd|jake|jaat|jolt|joint|jump|junk|jug|chad|geoff|jeff)\b/i, 'Hey JOT')
      .replace(/^(?:jot|john|job|josh|jock|chat|judge|shot|dot|yacht|jott|jatt)\s*([,:]|\s+(?:studying|working|pause|stop|resume|continue|less|more|balanced|why|what|status|i\s+stopped|forget))\b/i, 'JOT, $2');

    // 4. Strip wake prefixes and any residual punctuation
    let lower = normalized.toLowerCase().replace(/^(hey jot|jot|ok jot)[,\s.]*/i, '').trim();
    lower = lower.replace(/^[.,!?;:\s]+|[.,!?;:\s]+$/g, '').trim();

    // 0. Standalone Wake / Greeting / Status ("Hey JOT", "JOT", "J.O.T", "Hi JOT", "Hello JOT", or empty after strip)
    const isBareWakeWord = /^(?:jot|j\.?o\.?t\.?|hey\s+jot|ok\s+jot|hi\s+jot|hello\s+jot|john|job|chat|shot|dot)$/i.test(clean.replace(/[.,!?;:]+/g, ''));
    if (!lower || isBareWakeWord || /^(hi|hello|hey|yo|what'?s up)$/i.test(lower)) {
      return {
        intent: 'ASK_STATUS',
        confidence: 0.98,
        reason: 'User addressed JOT wake word',
        source: 'user_declared',
      };
    }

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

      // If active session exists, calculate adjusted duration
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

    // 5. Cross-Device Handoff ("continue on laptop", "continue dbms on laptop", "switch to laptop")
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

    // 6. User Intervention Preference ("less reminders", "balanced reminders", "frequent reminders")
    if (/(less|fewer|minimal|quiet)\s+reminders?|quiet\s+mode/i.test(lower)) {
      return {
        intent: 'SET_INTERVENTION_PREFERENCE',
        confidence: 0.95,
        preference: 'minimal',
        source: 'user_declared',
      };
    }
    if (/(balanced|normal|moderate)\s+reminders?/i.test(lower)) {
      return {
        intent: 'SET_INTERVENTION_PREFERENCE',
        confidence: 0.95,
        preference: 'balanced',
        source: 'user_declared',
      };
    }
    if (/(more|frequent)\s+reminders?/i.test(lower)) {
      return {
        intent: 'SET_INTERVENTION_PREFERENCE',
        confidence: 0.95,
        preference: 'frequent',
        source: 'user_declared',
      };
    }

    // 7. Policy Explainability Queries ("why didn't you remind me", "why did you pause", "why are you quiet")
    if (/why\s+(did|didn['’]?t|were)\s+you\s+(remind|pause|stay\s+quiet|quiet)|why\s+no\s+reminder|why\s+pause/i.test(lower)) {
      return {
        intent: 'ASK_EXPLANATION',
        confidence: 0.95,
        query: input,
        source: 'user_declared',
      };
    }

    // 8. Status & Memory Queries ("what was i doing", "status", "what was my last step")
    if (/what\s+(was|am)\s+i\s+doing|status|last\s+step|current\s+session/i.test(lower)) {
      return {
        intent: 'ASK_STATUS',
        confidence: 0.95,
        source: 'user_declared',
      };
    }

    // 8. Forget / Memory Erasure ("forget this session", "clear memory", "forget dbms")
    if (/forget\s+(this\s+session|memory|everything|dbms)|clear\s+memory/i.test(lower)) {
      return {
        intent: 'FORGET_MEMORY',
        confidence: 0.95,
        target: lower.includes('everything') ? 'all' : 'current',
        source: 'user_declared',
      };
    }

    // 9. Start Work Session ("studying DBMS", "coding compiler", "researching transformers", "working on DBMS")
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

    // Short phrase fallback for start ("DBMS", "Physics homework")
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

    // Low confidence fallback
    return {
      intent: 'UNCERTAIN',
      confidence: 0.35,
      rawInput: input,
      prompt: `I heard "${input}". Would you like to start a work session with this context?`,
      source: 'inferred',
    };
  }

  async reason(prompt, context = {}) {
    // Deterministic concise reasoning
    if (context.lastStep && context.topic) {
      return `Welcome back. You were working on ${context.lastStep} — ${context.topic}.`;
    }
    if (context.contextName) {
      return `Welcome back. Resuming ${context.contextName}.`;
    }
    return 'Ready to assist. Tell JOT what you are working on.';
  }
}

/**
 * Gemini Interactions Cloud Provider Adapter
 * Uses Google Gemini API with fallback to deterministic local provider.
 */
class GeminiInteractionsProvider extends AIProvider {
  constructor(apiKey = '', localFallback = new DeterministicLocalProvider()) {
    super();
    this.apiKey = apiKey;
    this.localFallback = localFallback;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async parseIntent(input, sessionContext = {}) {
    // If no API key configured or offline, delegate directly to local provider
    if (!this.apiKey || !navigator.onLine) {
      return this.localFallback.parseIntent(input, sessionContext);
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const systemInstruction = `You are JOT, the intent parser for ECHODESK. Convert user input to JSON:
{
  "intent": "START_WORK_SESSION" | "PAUSE_SESSION" | "RESUME_SESSION" | "STOP_SESSION" | "CORRECT_SESSION_TIME" | "REQUEST_HANDOFF" | "SET_INTERVENTION_PREFERENCE" | "ASK_EXPLANATION" | "ASK_STATUS" | "FORGET_MEMORY" | "UNCERTAIN",
  "contextName": string,
  "topic": string,
  "activity": string,
  "confidence": number between 0 and 1,
  "minutesAgo": number (only for time corrections),
  "preference": "minimal" | "balanced" | "frequent",
  "query": string
}
Input to evaluate: "${input}"`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        return { ...parsed, source: 'cloud_ai' };
      }
    } catch (err) {
      console.warn('[GeminiProvider] Cloud intent parsing failed, falling back to local:', err);
    }

    // Resilient fallback
    return this.localFallback.parseIntent(input, sessionContext);
  }

  async reason(prompt, context = {}) {
    if (!this.apiKey || !navigator.onLine) {
      return this.localFallback.reason(prompt, context);
    }
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `Concise assistant status for context ${JSON.stringify(context)}: ${prompt}` }],
            },
          ],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || this.localFallback.reason(prompt, context);
      }
    } catch (e) {
      // fallback
    }
    return this.localFallback.reason(prompt, context);
  }
}

if (typeof window !== 'undefined') {
  window.AIProvider = AIProvider;
  window.DeterministicLocalProvider = DeterministicLocalProvider;
  window.GeminiInteractionsProvider = GeminiInteractionsProvider;
  window.defaultAiProvider = new DeterministicLocalProvider();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIProvider, DeterministicLocalProvider, GeminiInteractionsProvider };
}
