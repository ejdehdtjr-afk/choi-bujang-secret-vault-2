import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function validText(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}

function write(response, status, body, headers = {}) {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  return response.status(status).json(body);
}

export function createNotesService(verifierFactory = createLoginVerifier, resource = 'notes') {
  if (!['notes', 'announcements'].includes(resource)) throw new Error('invalid_resource');
  const announcement = resource === 'announcements';
  const table = announcement ? 'vault_announcements' : 'vault_notes';
  let verify;
  async function authorize(request, response) {
    const authorization = request.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      write(response, 401, { error: 'LOGIN_REQUIRED' });
      return null;
    }
    try {
      verify ??= verifierFactory({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
      const identity = await verify(authorization);
      if (!identity) write(response, 401, { error: 'LOGIN_REQUIRED' });
      return identity;
    } catch {
      write(response, 401, { error: 'LOGIN_REQUIRED' });
      return null;
    }
  }

  async function requestDatabase(path, init = {}) {
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) throw new Error('service_not_configured');
    const url = new URL(path, base);
    if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/u.test(url.hostname)) {
      throw new Error('invalid_database_host');
    }
    const response = await fetch(url, {
      ...init,
      headers: { apikey: key, ...(init.headers ?? {}) },
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('database_request_failed');
    return response;
  }

  function toNote(row) {
    if (!row || !UUID.test(row.note_id ?? '') || !validText(row.title, 120)
        || !validText(row.content, 5000)) throw new Error('invalid_database_response');
    return { id: row.note_id, title: row.title, body: row.content };
  }

  async function checkResource(request, response, identity) {
    response.setHeader('X-Resource-ID', resource);
    // Only routing's item id may appear in query. Queries never select a zone or action.
    if (Object.keys(request.query ?? {}).some(key => key !== 'id')) {
      write(response, 400, { error: 'RESOURCE_QUERY_NOT_ALLOWED' });
      return false;
    }
    if (!announcement || request.method === 'GET') return true;
    // Judge and student token labels are not instructor grants.
    if (identity.kind !== 'student') {
      write(response, 403, { error: 'INSTRUCTOR_REQUIRED' });
      return false;
    }
    try {
      const rows = await (await requestDatabase(`/rest/v1/vault_instructors?user_id=eq.${encodeURIComponent(identity.userId)}&select=user_id`)).json();
      if (Array.isArray(rows) && rows.length === 1 && rows[0].user_id === identity.userId) return true;
    } catch {
      // A missing/unavailable role registry must never grant a write.
    }
    write(response, 403, { error: 'INSTRUCTOR_REQUIRED' });
    return false;
  }

  async function collection(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    const identity = await authorize(request, response);
    if (!identity) return;
    if (!await checkResource(request, response, identity)) return;
    if (request.method === 'GET') {
      try {
        const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
        url.searchParams.set('select', 'note_id,title,content');
        if (!announcement) url.searchParams.set('owner_id', `eq.${identity.userId}`);
        url.searchParams.set('order', 'id.asc');
        const rows = await (await requestDatabase(`${url.pathname}${url.search}`)).json();
        if (!Array.isArray(rows)) throw new Error('invalid_database_response');
        return write(response, 200, rows.map(toNote));
      } catch {
        return write(response, 502, { error: 'NOTES_UNAVAILABLE' });
      }
    }
    if (request.method === 'POST') {
      const input = request.body ?? {};
      const id = input.id === undefined ? randomUUID() : input.id;
      if (!UUID.test(id) || !validText(input.title, 120) || !validText(input.body, 5000)) {
        return write(response, 400, { error: 'INVALID_NOTE' });
      }
      try {
        const result = await requestDatabase(`/rest/v1/${table}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ note_id: id, owner_id: identity.userId, title: input.title.trim(), content: input.body.trim() }),
        });
        const rows = await result.json();
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error('invalid_database_response');
        return write(response, 201, toNote(rows[0]));
      } catch {
        return write(response, 502, { error: 'NOTES_UNAVAILABLE' });
      }
    }
    return write(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST' });
  }

  async function item(request, response, id) {
    response.setHeader('Cache-Control', 'no-store');
    const identity = await authorize(request, response);
    if (!identity) return;
    if (!await checkResource(request, response, identity)) return;
    if (!UUID.test(id ?? '')) return write(response, 404, { error: 'NOTE_NOT_FOUND' });
    // Every item operation binds the record to the verified identity, never to
    // a user ID supplied through the URL or request body.
    const ownerFilter = announcement ? '' : `&owner_id=eq.${encodeURIComponent(identity.userId)}`;
    const path = `/rest/v1/${table}?note_id=eq.${encodeURIComponent(id)}${ownerFilter}&select=note_id,title,content`;
    try {
      if (request.method === 'GET') {
        const rows = await (await requestDatabase(path)).json();
        return Array.isArray(rows) && rows.length === 1
          ? write(response, 200, toNote(rows[0])) : write(response, 404, { error: 'NOTE_NOT_FOUND' });
      }
      if (request.method === 'PUT') {
        const input = request.body ?? {};
        if (!validText(input.title, 120) || !validText(input.body, 5000)) return write(response, 400, { error: 'INVALID_NOTE' });
        const rows = await (await requestDatabase(path, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          // The filter proves the prior owner and this value preserves the same
          // server-verified owner on the updated row.
          body: JSON.stringify({ owner_id: identity.userId, title: input.title.trim(), content: input.body.trim() }),
        })).json();
        return Array.isArray(rows) && rows.length === 1
          ? write(response, 200, toNote(rows[0])) : write(response, 404, { error: 'NOTE_NOT_FOUND' });
      }
      if (request.method === 'DELETE') {
        const rows = await (await requestDatabase(path, { method: 'DELETE', headers: { Prefer: 'return=representation' } })).json();
        return Array.isArray(rows) && rows.length === 1
          ? write(response, 204, {}) : write(response, 404, { error: 'NOTE_NOT_FOUND' });
      }
      return write(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, PUT, DELETE' });
    } catch {
      return write(response, 502, { error: 'NOTES_UNAVAILABLE' });
    }
  }
  return { collection, item };
}
