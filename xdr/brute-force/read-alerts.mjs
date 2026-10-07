const text = value => typeof value === 'string' ? value.trim() : '';

// Keep only the analysis fields that this exercise needs. In particular, do
// not copy arbitrary Wazuh data fields into output or a decision reason.
export function readAlerts(alerts) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts must be an array');
  return alerts.map((alert) => ({
    id: text(alert?.id),
    timestamp: text(alert?.timestamp),
    sourceIp: text(alert?.data?.srcip),
    account: text(alert?.data?.srcuser),
    level: Number.isInteger(alert?.rule?.level) ? alert.rule.level : 0,
    description: text(alert?.rule?.description),
  }));
}

export function alertLine(alert) {
  const item = readAlerts([alert])[0];
  return `${item.timestamp} ${item.sourceIp} ${item.account} L${item.level} ${item.description}`;
}
