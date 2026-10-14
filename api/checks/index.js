import { runRuleCheck } from '../../src/rule-check.mjs';
import { operationsStatus } from '../../src/operations.mjs';

// Only fixed, read-only practice cases are accepted. No note or credential is read here.
export default async function handler(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (request.query?.case !== undefined) {
    const result = await runRuleCheck(request.query.case);
    return result ? response.status(200).json(result)
      : response.status(400).json({ error: 'UNKNOWN_CHECK' });
  }
  const status = await operationsStatus();
  return response.status(status.error ? 503 : 200).json(status);
}
