import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REASONS = new Set(['large_unfamiliar_destination', 'repeated_large_transfer', 'unusual_channel_bulk_copy']);

export async function applyActions({ root, alerts, decisions }) {
  const byId = new Map(alerts.map(alert => [alert.id, alert]));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const rules = decisions.flatMap(decision => {
    if (decision.action !== 'block' || decision.confidence < 0.85 || !REASONS.has(decision.reason)) return [];
    const destinationIp = byId.get(decision.alertId)?.data?.dstip;
    if (typeof destinationIp !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(destinationIp)) return [];
    return [{ id: `exfiltration-${decision.alertId}`, action: 'deny', destinationIp,
      expiresAt, evidenceAlertId: decision.alertId, reason: decision.reason }];
  });
  const moduleDir = join(root, 'xdr', 'exfiltration');
  await mkdir(moduleDir, { recursive: true });
  await writeFile(join(moduleDir, 'ztna-deny-rules.json'),
    `${JSON.stringify({ schema: 'aleph.xdr.ztna-rules.v1', rules }, null, 2)}\n`);
  const notices = decisions.filter(decision => decision.action !== 'record').map(decision => JSON.stringify({
    moduleKey: 'exfiltration', alertId: decision.alertId, action: decision.action,
    confidence: decision.confidence, reason: decision.reason,
  }));
  if (notices.length) await appendFile(join(root, 'xdr', 'alerts.log'), `${notices.join('\n')}\n`);
  return rules;
}
