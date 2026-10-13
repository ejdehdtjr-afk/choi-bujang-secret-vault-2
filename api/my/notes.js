import { createNotesService } from '../../src/notes-api.mjs';

// Explicit self-list endpoint. createNotesService binds the DB query to the
// user ID returned by the server-side login verifier.
export default createNotesService().collection;
