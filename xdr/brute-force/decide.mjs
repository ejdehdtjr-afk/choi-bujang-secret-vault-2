// Standalone decision module: no filesystem or module imports are required.
// Accept raw Wazuh events and the five-field summaries produced by readers.
function normalizeAlert(alert = {}) {
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


const FAILURE = /실패|failed|failure|brute.?force|password guessing/iu;

async function askJev(summary) {
  const endpoint = typeof process !== 'undefined' ? process.env?.JEV_DECISION_URL : undefined;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'brute_force_review', alertId: summary.id,
        sourceIp: summary.sourceIp, level: summary.level, failureCount: summary.count }),
      signal: AbortSignal.timeout(3000),
    });
    const verdict = await response.json();
    return typeof verdict?.confidence === 'number' && verdict.confidence >= 0 && verdict.confidence <= 1
      ? verdict.confidence : null;
  } catch {
    return null;
  }
}

// Jev is only consulted for a failure pattern that is below the local block
// threshold. If it is unavailable, leave an alert for a human instead.
export async function decide(alert) {
  const item = normalizeAlert(alert);
  if (!item.description) return { action: 'record', confidence: 0, reason: 'invalid_alert' };
  if (item.level <= 3 && item.count <= 1) {
    return { action: 'record', confidence: 0.05, reason: 'normal_login_event' };
  }

  const rapid = item.level >= 10 && item.count >= 20 && FAILURE.test(item.description);
  const spray = /같은 비밀번호|same password|password spray/iu.test(item.description);
  const manyAccounts = item.level >= 10 && spray && (item.accountCount >= 5 || /여러 계정|계정\s*\d+개|multiple accounts/iu.test(item.description));
  if (rapid || manyAccounts) {
    return { action: 'block', confidence: rapid && manyAccounts ? 0.98 : 0.9,
      reason: (rapid ? 'same_source_rapid_failures' : 'same_password_many_accounts') };
  }

  if (FAILURE.test(item.description)) {
    const confidence = await askJev(item);
    if (confidence === null) return { action: 'alert', confidence: 0.5, reason: 'ambiguous_login_failures' };
    if (confidence >= 0.85) return { action: 'block', confidence, reason: 'ambiguous_login_failures' };
    if (confidence >= 0.5) return { action: 'alert', confidence, reason: 'ambiguous_login_failures' };
    return { action: 'record', confidence, reason: 'ambiguous_login_failures' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_login_event' };
}
