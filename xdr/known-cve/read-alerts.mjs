const text = value => typeof value === 'string' ? value.trim() : '';

function redact(value) {
  return text(value)
    .replace(/\$\{jndi:[^}]*\}/giu, '[remote-lookup-redacted]')
    .replace(/\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, '[credential-redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/giu, '[credential-redacted]')
    .replace(/\b[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/gu, '[credential-redacted]');
}

export function readAlerts(alerts) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts must be an array');
  return alerts.map(alert => ({
    timestamp: text(alert?.timestamp),
    sourceIp: text(alert?.data?.srcip),
    account: redact(alert?.data?.srcuser),
    level: Number.isInteger(alert?.rule?.level) ? alert.rule.level : 0,
    description: redact(alert?.rule?.description),
  }));
}

export function alertLine(alert) {
  const item = readAlerts([alert])[0];
  return `${item.timestamp} ${item.sourceIp} ${item.account} L${item.level} ${item.description}`;
}
