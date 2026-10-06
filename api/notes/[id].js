import { createNotesService } from '../../src/notes-api.mjs';

const service = createNotesService();
export default function handler(request, response) {
  return service.item(request, response, request.query?.id);
}
