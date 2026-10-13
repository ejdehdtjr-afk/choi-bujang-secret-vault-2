// 반 엔진이 검증한 가명 신원의 조회 사건만 처리합니다.
// 이 함수는 회수를 제안할 뿐, 세션이나 기기 권한을 직접 바꾸지 않습니다.
const WINDOW_MS = 10 * 60 * 1000;
const READ_LIMIT = 120;

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');

  const readsBySubject = new Map();
  for (const event of events) {
    if (event?.method !== 'GET' || typeof event.at !== 'string'
        || typeof event.identity?.sub !== 'string' || !event.identity.sub) continue;
    const time = Date.parse(event.at);
    if (!Number.isFinite(time)) continue;
    const subject = event.identity.sub;
    if (!readsBySubject.has(subject)) readsBySubject.set(subject, []);
    readsBySubject.get(subject).push(time);
  }

  for (const [subject, times] of readsBySubject) {
    times.sort((a, b) => a - b);
    let start = 0;
    for (let end = 0; end < times.length; end += 1) {
      while (times[end] - times[start] >= WINDOW_MS) start += 1;
      if (end - start + 1 > READ_LIMIT) {
        return { action: 'propose_revocation', reasonCode: 'burst_read', subject };
      }
    }
  }
  return { action: 'observe' };
}
