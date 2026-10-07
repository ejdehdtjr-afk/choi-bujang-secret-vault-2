import patterns from './patterns.json' with { type: 'json' };
import { normalizeAlert } from '../normalize-alert.mjs';

const FAILURE = /실패|failed|failure|brute.?force|password guessing/iu;
const SUCCESS = /로그인이 성공|로그아웃|세션 유지|자료실 화면|비밀번호 변경이 성공|뒤에 성공|그 뒤 성공/u;
const NO_SUCCESS = /성공은 없습니다/u;
const T1110 = 'T1110';

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function base(alert) {
  return {
    id: typeof alert?.id === 'string' ? alert.id : '',
    level: Number.isInteger(alert?.rule?.level) ? alert.rule.level : 0,
    description: typeof alert?.rule?.description === 'string' ? alert.rule.description : '',
    count: count(alert?.data?.count),
    sourceIp: typeof alert?.data?.srcip === 'string' ? alert.data.srcip : '',
    accountCount: typeof alert?.data?.accounts === 'string'
      ? alert.data.accounts.split(',').filter(Boolean).length : 0,
    mitre: Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [],
  };
}

function namedPattern(name) {
  return patterns.patterns.find(item => item.name === name)?.name ?? name;
}

async function askJev(summary) {
  const endpoint = process.env.JEV_DECISION_URL;
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
      reason: namedPattern(rapid ? 'same_source_rapid_failures' : 'same_password_many_accounts') };
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
