/**
 * ECHODESK Backend — Production HTTP REST Server
 * Zero-dependency native Node.js implementation.
 * Exposes endpoints for JOT Intent Engine (Step 2), Session State, Echo Memory, Privacy Center, and Bridge.
 */

const http = require('http');
const { WorkSession, WorkSessionState } = require('./core/session-state');
const { PrivacyPolicyGate } = require('./core/privacy-gate');
const { IntentEngine, DeterministicLocalProvider, GeminiInteractionsProvider } = require('./engines/intent-engine');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// Server State Singletons
const privacyGate = new PrivacyPolicyGate();
const aiProvider = process.env.GEMINI_API_KEY
  ? new GeminiInteractionsProvider(process.env.GEMINI_API_KEY)
  : new DeterministicLocalProvider();
const intentEngine = new IntentEngine({ aiProvider, privacyGate });

let activeSession = new WorkSession();
const storedMemories = [];
let pendingHandoff = null;

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

    // 4. Echo Memory Endpoints (GET /api/memory, POST /api/memory, DELETE /api/memory)
    if (req.method === 'GET' && path === '/api/memory') {
      return sendJSON(res, 200, storedMemories);
    }

    if (req.method === 'POST' && path === '/api/memory') {
      const body = await parseBody(req);
      const gateCheck = privacyGate.evaluate('SAVE_MEMORY', {
        containsRawSensorData: Boolean(body.rawAudio || body.rawVideo),
      });

      if (!gateCheck.allowed) {
        return sendJSON(res, 403, { error: gateCheck.reason, code: gateCheck.code });
      }

      if (body.contextName) {
        const idx = storedMemories.findIndex((m) => m.contextName.toLowerCase() === body.contextName.toLowerCase());
        const record = { ...body, updatedAt: Date.now() };
        if (idx >= 0) storedMemories[idx] = record;
        else storedMemories.unshift(record);
      }
      return sendJSON(res, 200, storedMemories);
    }

    if (req.method === 'DELETE' && path === '/api/memory') {
      storedMemories.length = 0;
      return sendJSON(res, 200, { message: 'All memories purged permanently.' });
    }

    // 5. Privacy Center Endpoints (GET /api/privacy, POST /api/privacy)
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

    // 6. Cross-Device Bridge Endpoints (POST /api/bridge/handoff, GET /api/bridge/handoff)
    if (req.method === 'POST' && path === '/api/bridge/handoff') {
      const body = await parseBody(req);
      const gateCheck = privacyGate.evaluate('CROSS_DEVICE_HANDOFF', { explicitUserRequest: true });
      if (!gateCheck.allowed) {
        return sendJSON(res, 403, { error: gateCheck.reason });
      }

      pendingHandoff = {
        handoffId: `hoff_${Date.now()}`,
        timestamp: Date.now(),
        sourceDevice: body.sourceDevice || 'phone',
        targetDevice: 'laptop',
        session: body.session || activeSession.toJSON(),
      };
      return sendJSON(res, 200, pendingHandoff);
    }

    if (req.method === 'GET' && path === '/api/bridge/handoff') {
      return sendJSON(res, 200, pendingHandoff || { message: 'No pending handoff' });
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

module.exports = { server, activeSession, privacyGate, intentEngine };
