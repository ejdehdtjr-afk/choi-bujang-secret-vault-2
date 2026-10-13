import { createNotesService } from '../src/notes-api.mjs';

const service = createNotesService();
// Listing is deliberately available only through /api/my/notes.  Keeping the
// legacy collection handler for POST preserves note creation without leaving a
// second list endpoint that could be confused with an all-notes resource.
export default function handler(request, response) {
  if (request.method === 'GET') {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(403).json({ error: 'USE_SELF_LIST_ROUTE' });
  }
  return service.collection(request, response);
}
export { createNotesService };
