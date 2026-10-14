// This file is intentionally standalone for the isolated XDR judge.
// Names and conditions mirror patterns.json; no imports, I/O or network calls.
const PATTERNS = Object.freeze({
  log4shell_remote_lookup: /\$\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns|iiop|http|https)\s*:\s*\/\//iu,
  known_cve_probe: /CVE[- ]?2021[- ]?44228|\bjndi\b|취약점|원격 조회|조회 구문|점검 도구|중괄호|라이브러리|조회 형태|lookup|vulnerab|probe/iu,
});

function text(value) { return typeof value === 'string' ? value : ''; }

export function decide(alert) {
  const item = alert && typeof alert === 'object' ? alert : {};
  const level = Number(item.rule?.level ?? item.level ?? 0);
  const description = text(item.rule?.description ?? item.description);
  const url = text(item.data?.url ?? item.url);
  const header = text(item.data?.useragent ?? item.data?.userAgent ?? item.useragent ?? item.userAgent);
  const requestText = `${url}\n${header}`;
  const validLevel = Number.isFinite(level) ? level : 0;

  // A low-level ordinary event is not promoted solely by an ATT&CK tag.
  if (validLevel <= 3 && !PATTERNS.log4shell_remote_lookup.test(requestText)) {
    return { action: 'record', confidence: 0.05, reason: 'normal_event' };
  }
  if (PATTERNS.log4shell_remote_lookup.test(requestText)) {
    return { action: 'block', confidence: 0.95, reason: 'log4shell_remote_lookup' };
  }
  // Summarized Wazuh alerts may omit request fields. Treat an explicit remote
  // lookup report at a high rule level as clear, but a CVE name alone as review.
  if (validLevel >= 10 && /원격 조회 구문|CVE[- ]?2021[- ]?44228 형태|\bJNDI\s+(?:lookup|payload)/iu.test(description)
      && !/없습니다|없음|아닙니다|검색어|글자만/iu.test(description)) {
    return { action: 'block', confidence: 0.9, reason: 'log4shell_remote_lookup' };
  }
  if (PATTERNS.known_cve_probe.test(`${description}\n${requestText}`)) {
    return { action: 'alert', confidence: 0.6, reason: 'known_cve_probe' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_event' };
}
