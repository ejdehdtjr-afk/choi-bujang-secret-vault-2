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


const SQL = /SQL.*(?:구문|표식|주입)|데이터베이스 조회|sql injection|union\s+select/iu;
const SCRIPT = /스크립트.*(?:삽입|표식|주입)|script injection|cross.site scripting|<script\b/iu;
const TRAVERSAL = /경로.*(?:거슬러|이탈|탐색)|path traversal|(?:\.\.\/){2}/iu;
const SEPARATOR = /명령 구분자|command injection/iu;
const AMBIGUOUS = /따옴표|select|스크립트|경로.*up|SQL|이상한 검색|주입처럼|구분 문자/u;

async function askJev(item) {
  const endpoint = typeof process !== 'undefined' ? process.env?.JEV_DECISION_URL : undefined;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'web_injection_review', alertId: item.id,
        sourceIp: item.sourceIp, level: item.level, count: item.count }),
      signal: AbortSignal.timeout(3000),
    });
    const verdict = await response.json();
    return typeof verdict?.confidence === 'number' && verdict.confidence >= 0 && verdict.confidence <= 1
      ? verdict.confidence : null;
  } catch {
    return null;
  }
}

export async function decide(alert) {
  const item = normalizeAlert(alert);
  if (!item.description) return { action: 'record', confidence: 0, reason: 'invalid_alert' };
  if (item.level <= 3 && item.count <= 1) {
    return { action: 'record', confidence: 0.05, reason: 'normal_web_request' };
  }
  const repeated = item.level >= 10 && item.count >= 8;
  const match = repeated && ([
    [SQL, 'repeated_sql_syntax'], [SCRIPT, 'repeated_script_injection'],
    [TRAVERSAL, 'repeated_path_traversal'], [SEPARATOR, 'repeated_command_separator'],
  ].find(([expression]) => expression.test(item.description)));
  if (match) return { action: 'block', confidence: 0.9, reason: match[1] };

  if (AMBIGUOUS.test(item.description)) {
    const confidence = await askJev(item);
    if (confidence === null) return { action: 'alert', confidence: 0.5, reason: 'ambiguous_web_input' };
    if (confidence >= 0.85) return { action: 'block', confidence, reason: 'ambiguous_web_input' };
    if (confidence >= 0.5) return { action: 'alert', confidence, reason: 'ambiguous_web_input' };
    return { action: 'record', confidence, reason: 'ambiguous_web_input' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_web_request' };
}
