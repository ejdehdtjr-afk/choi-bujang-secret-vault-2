import patterns from './patterns.json' with { type: 'json' };
import { normalizeAlert } from '../normalize-alert.mjs';

const T1190 = 'T1190';
const NORMAL = /자료 목록|정적 화면|내 메모|반 공지|새로고침|검색어 week3|파일 이름|로그아웃|정상 조회/u;
const SQL = /SQL.*(?:구문|표식|주입)|데이터베이스 조회|sql injection|union\s+select/iu;
const SCRIPT = /스크립트.*(?:삽입|표식|주입)|script injection|cross.site scripting|<script\b/iu;
const TRAVERSAL = /경로.*(?:거슬러|이탈|탐색)|path traversal|(?:\.\.\/){2}/iu;
const SEPARATOR = /명령 구분자|command injection/iu;
const AMBIGUOUS = /따옴표|select|스크립트|경로.*up|SQL|이상한 검색|주입처럼|구분 문자/u;

function summary(alert) {
  return {
    id: typeof alert?.id === 'string' ? alert.id : '',
    level: Number.isInteger(alert?.rule?.level) ? alert.rule.level : 0,
    description: typeof alert?.rule?.description === 'string' ? alert.rule.description : '',
    sourceIp: typeof alert?.data?.srcip === 'string' ? alert.data.srcip : '',
    count: Number(alert?.data?.count) || 0,
    mitre: Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [],
  };
}

function patternName(name) {
  return patterns.patterns.find(item => item.name === name)?.name ?? name;
}

async function askJev(item) {
  const endpoint = process.env.JEV_DECISION_URL;
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
  if (match) return { action: 'block', confidence: 0.9, reason: patternName(match[1]) };

  if (AMBIGUOUS.test(item.description)) {
    const confidence = await askJev(item);
    if (confidence === null) return { action: 'alert', confidence: 0.5, reason: 'ambiguous_web_input' };
    if (confidence >= 0.85) return { action: 'block', confidence, reason: 'ambiguous_web_input' };
    if (confidence >= 0.5) return { action: 'alert', confidence, reason: 'ambiguous_web_input' };
    return { action: 'record', confidence, reason: 'ambiguous_web_input' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_web_request' };
}
