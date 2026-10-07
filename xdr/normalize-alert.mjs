// Accept raw Wazuh events and the five-field summaries produced by readers.
export function normalizeAlert(alert = {}) {
  const description = String(alert.rule?.description ?? alert.description ?? '');
  const rawCount = alert.data?.count ?? alert.count;
  const describedCount = description.match(/(\d+)\s*(?:건|번|회|failures|attempts)/iu)?.[1];
  const count = Number(rawCount ?? describedCount ?? 0);
  const level = Number(alert.rule?.level ?? alert.level ?? 0);
  const accounts = alert.data?.accounts ?? alert.accounts;
  return {
    id: String(alert.id ?? alert.alertId ?? ''), description,
    level: Number.isFinite(level) ? level : 0,
    count: Number.isFinite(count) && count >= 0 ? count : 0,
    sourceIp: String(alert.data?.srcip ?? alert.sourceIp ?? alert.srcip ?? ''),
    accountCount: Array.isArray(accounts) ? new Set(accounts).size
      : typeof accounts === 'string' ? new Set(accounts.split(',').map(s => s.trim()).filter(Boolean)).size : 0,
  };
}
