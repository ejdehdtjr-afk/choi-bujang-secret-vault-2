import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function expiresAt(timestamp) {
  const instant = Date.parse(timestamp);
  return new Date((Number.isFinite(instant) ? instant : Date.now()) + 15 * 60 * 1000).toISOString();
}

export async function applyActions({ root, alerts, decisions }) {
  const alertsById = new Map(alerts.map(alert => [alert.id, alert]));
  const rules = decisions.filter(item => item.action === 'block').flatMap((decision) => {
    const alert = alertsById.get(decision.alertId);
    const sourceIp = alert?.data?.srcip;
    if (typeof sourceIp !== 'string' || !sourceIp) return [];
    return [{ id: `web-injection-${decision.alertId}`, action: 'deny', sourceIp,
      expiresAt: expiresAt(alert.timestamp), evidenceAlertId: decision.alertId, reason: decision.reason }];
  });
  const moduleDir = join(root, 'xdr', 'web-injection');
  await mkdir(moduleDir, { recursive: true });
  await writeFile(join(moduleDir, 'ztna-deny-rules.json'), `${JSON.stringify({ schema: 'aleph.xdr.ztna-rules.v1', rules }, null, 2)}\n`);
  const notifications = decisions.filter(item => item.action !== 'record').map(item => JSON.stringify({
    alertId: item.alertId, action: item.action, confidence: item.confidence, reason: item.reason,
  }));
  if (notifications.length) await appendFile(join(root, 'xdr', 'alerts.log'), `${notifications.join('\n')}\n`);
  return rules;
}
