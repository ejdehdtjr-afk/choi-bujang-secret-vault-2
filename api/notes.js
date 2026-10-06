import { createNotesService } from '../src/notes-api.mjs';

const service = createNotesService();
export default service.collection;
export { createNotesService };
