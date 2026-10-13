import { createNotesService } from '../../../src/notes-api.mjs';

const service = createNotesService();

// The self-scoped route uses the same server-side owner filter as the
// existing note item API. It only exposes reading through this namespace.
export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  return service.item(request, response, request.query?.id);
}
