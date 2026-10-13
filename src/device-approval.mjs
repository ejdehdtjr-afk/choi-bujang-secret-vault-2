import { readFileSync } from 'node:fs';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));

function write(response, status, body, headers = {}) {
  response.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  return response.status(status).json(body);
}

// The engine's verified device-registration result is not currently exposed
// to this app. Never infer approval from a browser flag, installation state,
// login token, or an unverified device identifier.
export async function verifyApprovedDevice() {
  return false;
}

export function createDeviceApprovalService(verifierFactory = createLoginVerifier,
  deviceVerifier = verifyApprovedDevice) {
  let verify;
  async function authorized(request, response) {
    const authorization = request.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      write(response, 401, { error: 'LOGIN_REQUIRED' });
      return false;
    }
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
      const identity = await verify(authorization);
      if (identity?.userId) return identity;
    } catch {
      // Fail closed when verification is unavailable.
    }
    write(response, 401, { error: 'LOGIN_REQUIRED' });
    return false;
  }

  return {
    async status(request, response) {
      if (request.method !== 'GET') return write(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
      const identity = await authorized(request, response);
      if (!identity) return;
      let approved = false;
      try { approved = await deviceVerifier(request, identity) === true; } catch { /* Fail closed. */ }
      return write(response, 200, approved
        ? { approved: true } : { approved: false, reason: 'device_verification_unavailable' });
    },
    async request(request, response) {
      if (request.method !== 'POST') return write(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
      if (!await authorized(request, response)) return;
      return write(response, 503, { error: 'DEVICE_APPROVAL_NOT_CONNECTED' });
    },
  };
}
