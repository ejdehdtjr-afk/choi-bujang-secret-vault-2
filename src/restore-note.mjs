import { readFileSync } from 'node:fs';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export function createRestoreHandler(verifierFactory = createLoginVerifier, dbRequest = fetch) {
  let verify;
  return async function restore(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const auth = request.headers?.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    let identity;
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
      identity = await verify(auth);
    } catch {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    if (!identity || !UUID.test(identity.userId ?? '')) {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    const id = request.query?.noteId;
    const body = request.body ?? {};
    if (typeof id !== 'string' || !UUID.test(id)
        || Object.keys(request.query ?? {}).some(key => key !== 'noteId')
        || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 0) {
      return response.status(400).json({ error: 'INVALID_RESTORE_REQUEST' });
    }
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) return response.status(503).json({ error: 'RESTORE_NOT_CONFIGURED' });
    let url;
    try {
      url = new URL('/rest/v1/rpc/restore_vault_note', base);
      if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/u.test(url.hostname)) {
        throw new Error('invalid_database_host');
      }
    } catch {
      return response.status(503).json({ error: 'RESTORE_NOT_CONFIGURED' });
    }
    try {
      const result = await dbRequest(url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_note_id: id, p_owner_id: identity.userId }),
      });
      if (!result.ok) return response.status(502).json({ error: 'RESTORE_UNAVAILABLE' });
      const rows = await result.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return response.status(404).json({ error: 'BACKUP_NOT_FOUND' });
      }
      if (rows.length !== 1 || rows[0]?.restored_note_id !== id
          || rows[0]?.restored_owner_id !== identity.userId
          || !SHA256.test(rows[0]?.restored_content_sha256 ?? '')) {
        return response.status(502).json({ error: 'RESTORE_VERIFICATION_FAILED' });
      }
      return response.status(200).json({
        id, ownerId: identity.userId, contentSha256: rows[0].restored_content_sha256,
      });
    } catch {
      return response.status(502).json({ error: 'RESTORE_UNAVAILABLE' });
    }
  };
}
