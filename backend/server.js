/**
 * ECHODESK Backend — Production HTTP REST Server
 * Zero-dependency native Node.js implementation.
 * Exposes endpoints for JOT Intent Engine (Step 2), Session State, Echo Memory, Privacy Center, and Bridge.
 */

const http = require('http');
const { WorkSession, WorkSessionState } = require('./core/session-state');
const { PrivacyPolicyGate } = require('./core/privacy-gate');
const { IntentEngine, DeterministicLocalProvider, GeminiInteractionsProvider } = require('./engines/intent-engine');
const { EchoMemoryEngine } = require('./engines/memory-engine');
const { FlowEngine, FlowDecision, CheckInType } = require('./engines/flow-engine');
const { BridgeEngine, BridgeStage, BridgeErrorCode } = require('./engines/bridge-engine');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// Server State Singletons
const privacyGate = new PrivacyPolicyGate();
const aiProvider = process.env.GEMINI_API_KEY
  ? new GeminiInteractionsProvider(process.env.GEMINI_API_KEY)
  : new DeterministicLocalProvider();
const intentEngine = new IntentEngine({ aiProvider, privacyGate });
const echoMemory = new EchoMemoryEngine({ privacyGate });
const flowEngine = new FlowEngine();
const bridgeEngine = new BridgeEngine({ privacyGate });

let activeSession = new WorkSession();

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit for privacy / safety
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    // 1. Health Check
    if (req.method === 'GET' && path === '/health') {
      return sendJSON(res, 200, {
        status: 'healthy',
        service: 'echodesk-backend',
        privacyPolicy: 'zero-surveillance-active',
        version: '1.0.0',
      });
    }

    // 2. Stage 2: Intent Processing (POST /api/intent)
    if (req.method === 'POST' && path === '/api/intent') {
      const body = await parseBody(req);
      const input = body.input || '';
      const sessionContext = body.sessionContext || activeSession.toJSON();

      const result = await intentEngine.process(input, sessionContext, {
        explicitUserGesture: body.explicitUserGesture !== false,
      });

      return sendJSON(res, 200, result);
    }

    // 3. Session Endpoints (GET /api/session, POST /api/session/start, etc.)
    if (req.method === 'GET' && path === '/api/session') {
      return sendJSON(res, 200, activeSession.toJSON());
    }

    if (req.method === 'POST' && path === '/api/session/start') {
      const body = await parseBody(req);
      if (activeSession.state === WorkSessionState.ACTIVE) {
        activeSession.updateContext(body);
      } else {
        if (activeSession.state === WorkSessionState.ENDED) {
          activeSession = new WorkSession();
        }
        activeSession.start(body.contextName || 'General Focus', body);
      }
      return sendJSON(res, 200, activeSession.toJSON());
    }

    if (req.method === 'POST' && path === '/api/session/pause') {
      const body = await parseBody(req);
      if (activeSession.state === WorkSessionState.ACTIVE) {
        activeSession.pause(body.reason || 'User paused');
      }
      return sendJSON(res, 200, activeSession.toJSON());
    }

    if (req.method === 'POST' && path === '/api/session/resume') {
      const body = await parseBody(req);
      if (activeSession.state === WorkSessionState.PAUSED || activeSession.state === WorkSessionState.UNCERTAIN) {
        activeSession.resume(body.reason || 'User resumed');
      }
      return sendJSON(res, 200, activeSession.toJSON());
    }

    if (req.method === 'POST' && path === '/api/session/stop') {
      const body = await parseBody(req);
      if (activeSession.state !== WorkSessionState.ENDED && activeSession.state !== WorkSessionState.IDLE) {
        activeSession.stop(body.reason || 'User ended session');
      }
      return sendJSON(res, 200, activeSession.toJSON());
    }

    if (req.method === 'POST' && path === '/api/session/correct') {
      const body = await parseBody(req);
      if (typeof body.adjustedDurationMs === 'number') {
        activeSession.correctElapsedTime(body.adjustedDurationMs, body.reason || 'User correction');
      }
      return sendJSON(res, 200, activeSession.toJSON());
    }

    // 4. Echo Memory Endpoints (GET, POST, PUT, DELETE)
    if (req.method === 'GET' && path === '/api/memory/resume') {
      const ctx = url.searchParams.get('context') || '';
      return sendJSON(res, 200, { greeting: echoMemory.formatResumeGreeting(ctx) });
    }

    if (req.method === 'GET' && path.startsWith('/api/memory/')) {
      const ctx = decodeURIComponent(path.replace('/api/memory/', ''));
      const found = echoMemory.get(ctx);
      if (!found) return sendJSON(res, 404, { error: `Memory for "${ctx}" not found.` });
      return sendJSON(res, 200, found);
    }

    if (req.method === 'GET' && path === '/api/memory') {
      return sendJSON(res, 200, echoMemory.getAll());
    }

    if (req.method === 'POST' && path === '/api/memory') {
      const body = await parseBody(req);
      try {
        const saved = echoMemory.save(body);
        return sendJSON(res, 201, saved);
      } catch (err) {
        return sendJSON(res, 403, { error: err.message });
      }
    }

    if (req.method === 'PUT' && path.startsWith('/api/memory/')) {
      const ctx = decodeURIComponent(path.replace('/api/memory/', ''));
      const body = await parseBody(req);
      const updated = echoMemory.update(ctx, body);
      if (!updated) return sendJSON(res, 404, { error: `Memory for "${ctx}" not found.` });
      return sendJSON(res, 200, updated);
    }

    if (req.method === 'DELETE' && path.startsWith('/api/memory/')) {
      const ctx = decodeURIComponent(path.replace('/api/memory/', ''));
      const deleted = echoMemory.delete(ctx);
      return sendJSON(res, 200, { deleted, contextName: ctx });
    }

    if (req.method === 'DELETE' && path === '/api/memory') {
      const count = echoMemory.clearAll();
      return sendJSON(res, 200, { message: `All ${count} memories purged permanently.` });
    }

    // 5. Flow & Intervention Engine Endpoints (GET /api/flow/status, POST /api/flow/evaluate, etc.)
    if (req.method === 'GET' && path === '/api/flow/status') {
      return sendJSON(res, 200, flowEngine.getPolicyInfo());
    }

    if (req.method === 'POST' && path === '/api/flow/evaluate') {
      const body = await parseBody(req);
      const evalContext = {
        sessionState: body.sessionState || activeSession.state,
        activeDurationMs: typeof body.activeDurationMs === 'number' ? body.activeDurationMs : activeSession.getActiveDurationMs(),
        presenceSignal: body.presenceSignal || 'PRESENT',
        now: body.now,
        preference: body.preference,
        lastInterventionAt: body.lastInterventionAt,
        absenceGracePeriodMs: body.absenceGracePeriodMs,
      };
      const result = flowEngine.evaluate(evalContext);
      return sendJSON(res, 200, result);
    }

    if (req.method === 'POST' && path === '/api/flow/preference') {
      const body = await parseBody(req);
      const pref = body.preference;
      const success = flowEngine.setPreference(pref);
      if (!success) {
        return sendJSON(res, 400, { error: 'Invalid preference. Must be "minimal", "balanced", or "frequent".' });
      }
      return sendJSON(res, 200, { preference: flowEngine.getPreference() });
    }

    if (req.method === 'POST' && path === '/api/flow/explain') {
      const body = await parseBody(req);
      const explanation = flowEngine.explainDecision(body.query || '', body.context || {});
      return sendJSON(res, 200, explanation);
    }

    if (req.method === 'GET' && path === '/api/flow/checkin') {
      return sendJSON(res, 200, flowEngine.getNextCheckIn());
    }

    if (req.method === 'POST' && path === '/api/flow/checkin/response') {
      const body = await parseBody(req);
      const recorded = flowEngine.recordInterventionResponse(body.response);
      return sendJSON(res, 200, recorded);
    }

    // 6. Privacy Center Endpoints (GET /api/privacy, POST /api/privacy)
    if (req.method === 'GET' && path === '/api/privacy') {
      return sendJSON(res, 200, {
        permissions: privacyGate.getPermissions(),
        auditLog: privacyGate.getAuditLog(),
      });
    }

    if (req.method === 'POST' && path === '/api/privacy') {
      const body = await parseBody(req);
      const updated = privacyGate.savePermissions(body);
      return sendJSON(res, 200, { permissions: updated });
    }

    // 7. Cross-Device Bridge Endpoints (POST /api/bridge/handoff, GET /api/bridge/handoff)
    if (req.method === 'POST' && path === '/api/bridge/handoff') {
      const body = await parseBody(req);
      try {
        const handoff = bridgeEngine.initiateHandoff(body.session || activeSession.toJSON(), body.targetDevice || 'laptop');
        return sendJSON(res, 200, handoff);
      } catch (err) {
        return sendJSON(res, 403, { error: err.message, code: err.code || 'BRIDGE_ERROR' });
      }
    }

    if (req.method === 'GET' && path === '/api/bridge/handoff') {
      try {
        const callerDevice = req.headers['x-device-id'] || url.searchParams.get('deviceId') || 'laptop';
        const handoff = bridgeEngine.receiveHandoff({ targetDevice: callerDevice });
        return sendJSON(res, 200, handoff || { message: 'No pending handoff' });
      } catch (err) {
        const status = err.code === 'UNAUTHORIZED_DEVICE' ? 403 : 400;
        return sendJSON(res, status, { error: err.message, code: err.code || 'BRIDGE_ERROR' });
      }
    }

    if (req.method === 'DELETE' && path === '/api/bridge/handoff') {
      bridgeEngine.clearHandoff();
      return sendJSON(res, 200, { message: 'Handoff cleared' });
    }

    // Fallthrough 404
    sendJSON(res, 404, { error: `Route ${req.method} ${path} not found.` });
  } catch (err) {
    console.error(`[Server] Error processing request ${req.method} ${path}:`, err);
    sendJSON(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[ECHODESK] Backend server running on http://${HOST}:${PORT}`);
    console.log(`[ECHODESK] Zero passive surveillance active • ECHOSHIELD gate enforced.`);
  });
}

module.exports = { server, activeSession, privacyGate, intentEngine, echoMemory, flowEngine, bridgeEngine, FlowDecision, CheckInType, BridgeStage, BridgeErrorCode };
