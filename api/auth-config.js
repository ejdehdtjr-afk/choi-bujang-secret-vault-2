function write(response, status, body, headers = {}) {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  return response.status(status).json(body);
}

export default function authConfig(request, response) {
  if (request.method !== 'GET') {
    return write(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
  }
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || !/^https:\/\/[a-z0-9]+\.supabase\.co$/iu.test(url)) {
    return write(response, 503, { error: 'AUTH_CONFIGURATION_UNAVAILABLE' }, { 'Cache-Control': 'no-store' });
  }
  return write(response, 200, { url, publishableKey }, { 'Cache-Control': 'no-store' });
}
