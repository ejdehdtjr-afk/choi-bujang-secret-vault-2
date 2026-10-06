// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step === 3) {
    const attempts = [];
    for (const [path, method, attackId, expected] of [
      ['/api/notes', 'GET', 'anonymous_note_list', '로그인 없는 목록 조회는 HTTP 401로 거부'],
      ['/api/notes', 'POST', 'anonymous_note_create', '로그인 없는 메모 추가는 HTTP 401로 거부'],
      ['/api/notes/00000000-0000-4000-8000-000000000099', 'PUT', 'anonymous_note_update', '로그인 없는 메모 수정은 HTTP 401로 거부'],
      ['/api/notes/00000000-0000-4000-8000-000000000099', 'DELETE', 'anonymous_note_delete', '로그인 없는 메모 삭제는 HTTP 401로 거부'],
    ]) {
      const response = await fetch(new URL(path, config.publicAppUrl), {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      attempts.push({ attackId, expected, observed: `HTTP ${response.status}` });
    }
    return attempts;
  }
  if (config.step === 2) {
    const results = [];
    for (const [path, method, id, expected] of [
      ['/data.json', 'GET', 'static_notes_removed', '정적 JSON의 notes 배열이 비어 있음'],
      ['/api/notes', 'GET', 'public_api_remaining', '인증 없는 API에서 가상 메모 4건 조회 가능: 남은 약점'],
      ['/api/notes', 'POST', 'api_method_rejected', '쓰기 요청은 HTTP 405로 거부'],
    ]) {
      const response = await fetch(new URL(path, config.publicAppUrl), {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      let count = null;
      if (method === 'GET' && response.ok) {
        const data = await response.json();
        if (Array.isArray(data.notes)) count = data.notes.length;
      }
      results.push({ attackId: id, expected,
        observed: `HTTP ${response.status}${count === null ? '' : `, notes ${count}건`}` });
    }
    return results;
  }
  if (config.step !== 1) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
