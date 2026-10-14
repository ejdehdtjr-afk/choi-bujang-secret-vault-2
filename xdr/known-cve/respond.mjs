import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function applyActions({ root, alerts, decisions }) {
  const byId = new Map(alerts.map(alert => [alert.id, alert]));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const rules = decisions.flatMap(decision => {
    if (decision.action !== 'block' || decision.confidence < 0.85
        || decision.reason !== 'log4shell_remote_lookup') return [];
    const sourceIp = byId.get(decision.alertId)?.data?.srcip;
    if (typeof sourceIp !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(sourceIp)) return [];
    return [{ id: `known-cve-${decision.alertId}`, action: 'deny', sourceIp,
      expiresAt, evidenceAlertId: decision.alertId, reason: decision.reason }];
  });
  const moduleDir = join(root, 'xdr', 'known-cve');
  await mkdir(moduleDir, { recursive: true });
  await writeFile(join(moduleDir, 'ztna-deny-rules.json'),
    `${JSON.stringify({ schema: 'aleph.xdr.ztna-rules.v1', rules }, null, 2)}\n`);
  const notices = decisions.filter(decision => decision.action !== 'record').map(decision => JSON.stringify({
    moduleKey: 'known-cve', alertId: decision.alertId, action: decision.action,
    confidence: decision.confidence, reason: decision.reason,
  }));
  if (notices.length) await appendFile(join(root, 'xdr', 'alerts.log'), `${notices.join('\n')}\n`);
  return rules;
}
