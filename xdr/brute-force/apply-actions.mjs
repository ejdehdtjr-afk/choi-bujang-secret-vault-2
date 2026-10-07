import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function expiresAt() {
  // Fixtures are historical. A rule must remain active when this run is
  // applied, rather than expiring fifteen minutes after a fixture timestamp.
  return new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

export async function applyActions({ root, alerts, decisions }) {
  const alertsById = new Map(alerts.map(alert => [alert.id, alert]));
  const rules = decisions.filter(item => item.action === 'block').flatMap((decision) => {
    const alert = alertsById.get(decision.alertId);
    const sourceIp = alert?.data?.srcip;
    if (typeof sourceIp !== 'string' || !sourceIp) return [];
    return [{ id: `brute-force-${decision.alertId}`, action: 'deny', sourceIp,
      expiresAt: expiresAt(), evidenceAlertId: decision.alertId, reason: decision.reason }];
  });
  const moduleDir = join(root, 'xdr', 'brute-force');
  await mkdir(moduleDir, { recursive: true });
  await writeFile(join(moduleDir, 'ztna-deny-rules.json'), `${JSON.stringify({ schema: 'aleph.xdr.ztna-rules.v1', rules }, null, 2)}\n`);

  const notifications = decisions.filter(item => item.action !== 'record').map(item => JSON.stringify({
    alertId: item.alertId, action: item.action, confidence: item.confidence, reason: item.reason,
  }));
  if (notifications.length) await appendFile(join(root, 'xdr', 'alerts.log'), `${notifications.join('\n')}\n`);
  return rules;
}
