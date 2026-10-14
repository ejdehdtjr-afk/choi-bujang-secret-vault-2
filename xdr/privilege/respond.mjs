import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REASONS = new Set(['admin_group_escalation', 'unusual_admin_command', 'unexpected_admin_session']);

export async function applyActions({ root, alerts, decisions }) {
  const byId = new Map(alerts.map(alert => [alert.id, alert]));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const rules = decisions.flatMap(decision => {
    if (decision.action !== 'block' || decision.confidence < 0.85 || !REASONS.has(decision.reason)) return [];
    const data = byId.get(decision.alertId)?.data;
    const account = data?.srcuser;
    const sourceIp = data?.srcip;
    if (typeof account !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/iu.test(account)
        || typeof sourceIp !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(sourceIp)) return [];
    // Scope the candidate to the observed account and source. Another user
    // or the same user's ordinary session at a different address stays open.
    return [{ id: `privilege-${decision.alertId}`, action: 'deny', account, sourceIp,
      expiresAt, evidenceAlertId: decision.alertId, reason: decision.reason }];
  });
  const moduleDir = join(root, 'xdr', 'privilege');
  await mkdir(moduleDir, { recursive: true });
  await writeFile(join(moduleDir, 'ztna-deny-rules.json'),
    `${JSON.stringify({ schema: 'aleph.xdr.ztna-rules.v1', rules }, null, 2)}\n`);
  const notices = decisions.filter(decision => decision.action !== 'record').map(decision => JSON.stringify({
    moduleKey: 'privilege', alertId: decision.alertId, action: decision.action,
    confidence: decision.confidence, reason: decision.reason,
  }));
  if (notices.length) await appendFile(join(root, 'xdr', 'alerts.log'), `${notices.join('\n')}\n`);
  return rules;
}
