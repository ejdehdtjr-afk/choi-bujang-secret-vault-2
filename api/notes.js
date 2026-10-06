import { readFileSync } from 'node:fs';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
export function createNotesHandler(verifierFactory = createLoginVerifier) {
  let verify;
  return async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'LOGIN_REQUIRED' });
  }
  try {
    verify ??= verifierFactory({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
    const identity = await verify(authorization);
    if (!identity) return response.status(401).json({ error: 'LOGIN_REQUIRED' });
  } catch {
    return response.status(401).json({ error: 'LOGIN_REQUIRED' });
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) {
    return response.status(503).json({ error: 'SERVICE_NOT_CONFIGURED' });
  }
  try {
    const url = new URL('/rest/v1/vault_notes', base);
    if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
      throw new Error('Invalid database host');
    }
    url.searchParams.set('select', 'id,title,content');
    url.searchParams.set('order', 'id.asc');
    const upstream = await fetch(url, {
      headers: { apikey: key },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error('Database request failed');
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.some(row =>
      typeof row.title !== 'string' || typeof row.content !== 'string')) {
      throw new Error('Invalid database response');
    }
    return response.status(200).json({
      notes: rows.map(({ id, title, content }) => ({ id, title, content })),
    });
  } catch {
    // Never forward upstream errors or log credentials/response bodies.
    return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
}

export default createNotesHandler();
