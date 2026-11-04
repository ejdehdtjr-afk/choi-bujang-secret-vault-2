// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 마무리 제작: 로컬 관측 파일은 제공 SDP/XDR·AI 연결과 별개의 학생 기능이다.

export function normalizePcSnapshot(input, now = Date.now()) {
  if (!input || input.schema !== 'keshev.pc-observation.v1' || input.source !== 'local-readonly'
    || typeof input.sampleId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.sampleId)
    || !Number.isFinite(Date.parse(input.checkedAt)) || Date.parse(input.checkedAt) > now + 120000) {
    throw new Error('관측 파일 형식 또는 측정 시각을 확인할 수 없습니다. 학생 측정 도구로 다시 생성하세요.');
  }
  const allowedSources = {
    cpu: 'node:os.cpus delta', memory: 'node:os.totalmem/freemem',
    disk: 'Get-CimInstance Win32_LogicalDisk', network: 'Get-NetAdapter',
    firewall: 'Get-NetFirewallProfile', systemEvents: 'Get-WinEvent System', applicationEvents: 'Get-WinEvent Application',
  };
  const result = {schema: input.schema, source: input.source, sampleId: input.sampleId, checkedAt: input.checkedAt, metrics: {}};
  const number = (n, max = Number.MAX_SAFE_INTEGER) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  for (const [key, source] of Object.entries(allowedSources)) {
    const metric = input.metrics?.[key];
    const validTime = metric && Number.isFinite(Date.parse(metric.checkedAt))
      && Date.parse(metric.checkedAt) <= Date.parse(input.checkedAt) + 1000
      && Date.parse(input.checkedAt) - Date.parse(metric.checkedAt) <= 60000;
    let valid = metric?.status === 'ok' && metric.source === source && validTime;
    let values = {};
    if (key === 'cpu') {
      valid &&= number(metric.value, 100) && number(metric.intervalMs, 10000) && metric.intervalMs >= 500;
      values = {value: metric?.value, intervalMs: metric?.intervalMs};
    } else if (key === 'memory' || key === 'disk') {
      valid &&= number(metric.totalGiB) && metric.totalGiB > 0 && number(metric.freeGiB, metric.totalGiB);
      values = {totalGiB: metric?.totalGiB, freeGiB: metric?.freeGiB};
    } else if (key === 'network') {
      valid &&= Number.isSafeInteger(metric.upAdapters) && number(metric.upAdapters, 10000);
      values = {upAdapters: metric?.upAdapters};
    } else if (key === 'firewall') {
      valid &&= Array.isArray(metric.enabled) && metric.enabled.length === 3 && metric.enabled.every(v => typeof v === 'boolean');
      values = {enabled: Array.isArray(metric?.enabled) ? metric.enabled.slice() : []};
    } else {
      valid &&= number(metric.warning, 1001) && Number.isSafeInteger(metric.warning)
        && number(metric.error, 1001) && Number.isSafeInteger(metric.error)
        && typeof metric.capped === 'boolean' && metric.windowHours === 24;
      values = {warning: metric?.warning, error: metric?.error, capped: metric?.capped, windowHours: 24};
    }
    result.metrics[key] = valid ? {status: 'ok', source, checkedAt: metric.checkedAt, ...values}
      : {status: 'unverifiable', source, checkedAt: validTime ? metric.checkedAt : input.checkedAt,
        reason: '조회 실패·권한 제한·지원하지 않는 형식 중 하나입니다. 정상으로 대체하지 않습니다.'};
  }
  return result;
}

export function createLocalDashboard() {
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const root = el('section', undefined, 'card student');
  root.id = 'student-local-dashboard';
  root.setAttribute('aria-label', '케셰브 개인 보안 관제 대시보드');
  root.appendChild(el('h2', '케셰브 · 개인 보안 관제 대시보드'));
  root.appendChild(el('p', '핵심 기능 ① 내 PC 실측 ② 연결·방화벽 설정 조회 ③ 최근 Windows 경고·오류 건수', 'muted'));
  root.appendChild(el('p', '학생 추가 기능 · 읽기 전용 · 파일은 이 브라우저에서만 읽습니다. 외부로 전송하지 않습니다.', 'tag tag-student'));
  const controls = el('div', undefined, 'row');
  const choose = el('button', '측정 폴더 선택', 'btn'); choose.type = 'button';
  const refresh = el('button', '다시 조회', 'btn'); refresh.type = 'button';
  const label = el('label', '관측 JSON 파일 선택(폴더 선택을 지원하지 않을 때): ');
  const input = el('input'); input.type = 'file'; input.accept = '.json,application/json';
  label.appendChild(input);
  controls.appendChild(choose); controls.appendChild(refresh); root.appendChild(controls); root.appendChild(label);
  const notice = el('p'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); root.appendChild(notice);
  const body = el('div'); root.appendChild(body);
  const history = [];
  let directory = null, snapshot = null, state = 'idle', message = '', generation = 0, ageTimer;
  const time = iso => new Date(iso).toLocaleString('ko-KR', {hour12: false, timeZoneName: 'short'});
  const num = n => n.toLocaleString('ko-KR', {maximumFractionDigits: 1});
  const table = (title, heads, rows) => {
    const wrap = el('div', undefined, 'vulnerabilities-result');
    const t = el('table'); t.appendChild(el('caption', title));
    const thead = el('thead'), tr = el('tr');
    for (const h of heads) { const th = el('th', h); th.setAttribute('scope', 'col'); tr.appendChild(th); }
    thead.appendChild(tr); t.appendChild(thead);
    const tbody = el('tbody');
    for (const row of rows) { const r = el('tr'); for (const value of row) r.appendChild(el('td', String(value))); tbody.appendChild(r); }
    t.appendChild(tbody); wrap.appendChild(t); return wrap;
  };
  const paint = () => {
    body.replaceChildren();
    const stale = snapshot && Date.now() - Date.parse(snapshot.checkedAt) > 120000;
    notice.className = `state state-${state === 'error' ? 'error' : state === 'loading' ? 'loading' : 'empty'}`;
    notice.textContent = state === 'loading' ? '로컬 관측 파일을 읽는 중입니다.' : state === 'error' ? `조회 실패: ${message} 이전 값을 현재 결과로 표시하지 않습니다.`
      : snapshot ? `${stale ? '오래된 관측 · 현재 상태 확인 불가' : '로컬 관측 파일 읽음'} · 측정 ${time(snapshot.checkedAt)} · 검증되지 않은 로컬 파일이며 운영 연결 성공을 뜻하지 않습니다.`
        : '요청 전 · 학생 측정 도구를 실행한 뒤 측정 폴더 또는 JSON 파일을 선택하세요.';
    choose.disabled = refresh.disabled = input.disabled = state === 'loading';
    const metrics = snapshot?.metrics;
    const textFor = key => {
      const m = metrics?.[key];
      if (state !== 'ok' || stale || m?.status !== 'ok') return stale ? '확인 불가 · 2분이 지난 측정' : '확인 불가';
      if (key === 'cpu') return `${num(m.value)} % · ${num(m.intervalMs / 1000)}초 구간 평균`;
      if (key === 'memory') return `${num(m.totalGiB - m.freeGiB)} / ${num(m.totalGiB)} GiB 사용`;
      if (key === 'disk') return `${num(m.freeGiB)} / ${num(m.totalGiB)} GiB 여유`;
      return `활성 어댑터 ${m.upAdapters}개 · 인터넷·SDP 연결 보장 아님`;
    };
    const cards = el('div', undefined, 'grid-2');
    for (const group of [[['CPU 사용률', 'cpu'], ['메모리 사용량', 'memory']], [['시스템 디스크 여유 공간', 'disk'], ['네트워크 인터페이스', 'network']]]) {
      const pair = el('div', undefined, 'grid-2');
      for (const [title, key] of group) {
        const card = el('section', undefined, 'card'); card.setAttribute('data-student-pc-card', key);
        card.appendChild(el('h3', title)); card.appendChild(el('p', textFor(key)));
        const m = metrics?.[key];
        card.appendChild(el('p', m && state === 'ok' ? `${m.source} · ${time(m.checkedAt)}` : '측정 근거 없음', 'muted'));
        if (state === 'ok' && !stale && m?.status === 'ok' && ['cpu', 'memory'].includes(key)) {
          const meter = el('meter'); meter.min = 0; meter.max = 100;
          meter.value = key === 'cpu' ? m.value : (1 - m.freeGiB / m.totalGiB) * 100;
          meter.setAttribute('aria-label', `${title} ${num(meter.value)} 퍼센트`); card.appendChild(meter);
        }
        pair.appendChild(card);
      }
      cards.appendChild(pair);
    }
    body.appendChild(cards);
    body.appendChild(el('h3', '측정 추이 · 이 화면에서 읽은 최근 12개 관측'));
    body.appendChild(table('과거 관측 기록 · 현재 조회 실패와 별도로 보존', ['측정 시각', 'CPU (%)', '메모리 사용 (GiB)'],
      history.length ? history.map(s => [time(s.checkedAt), s.metrics.cpu.status === 'ok' ? num(s.metrics.cpu.value) : '확인 불가',
        s.metrics.memory.status === 'ok' ? num(s.metrics.memory.totalGiB - s.metrics.memory.freeGiB) : '확인 불가']) : [['아직 없음', '확인 불가', '확인 불가']]));
    const details = [];
    const firewall = metrics?.firewall;
    details.push(['방화벽 설정', state !== 'ok' || stale || firewall?.status !== 'ok' ? '확인 불가' : ['도메인', '개인', '공용'].map((name, i) => `${name}: ${firewall.enabled[i] ? '켜짐' : '꺼짐'}`).join(' / '), firewall?.source ?? '미조회', firewall ? time(firewall.checkedAt) : '미조회']);
    for (const [key, title] of [['systemEvents', 'System 로그'], ['applicationEvents', 'Application 로그']]) {
      const m = metrics?.[key];
      details.push([title, state !== 'ok' || stale || m?.status !== 'ok' ? '확인 불가' : `최근 24시간 · 경고 ${m.warning}건 · 오류 ${m.error}건${m.capped ? ' · 최신 1,001건까지만 집계(일부)' : ''}`, m?.source ?? '미조회', m ? time(m.checkedAt) : '미조회']);
    }
    body.appendChild(el('h3', '연결·기록 조회'));
    body.appendChild(table('보안 설정·로그의 읽기 전용 관측', ['대상', '관측 결과', '출처', '측정 시각'], details));
    body.appendChild(el('p', '경고·오류 건수는 침해·공격 탐지 판정이 아닙니다. 방화벽 설정을 변경하지 않습니다. PC 조회와 SDP/XDR·AI 연결 상태는 별개이며 제공 화면에서 각각 확인하세요.', 'notice'));
    const help = el('details'), summary = el('summary', '확인 불가일 때 · 측정과 재현 방법'); help.appendChild(summary);
    help.appendChild(el('p', 'on-client 폴더의 PowerShell에서 node tools/student-dashboard.mjs 명령으로 서버와 측정을 함께 실행할 수 있습니다. 출력된 측정 폴더를 선택한 뒤 다시 조회를 누르세요. 폴더 선택을 지원하지 않으면 그 폴더의 최신 pc-observation.json 파일을 매번 다시 선택하세요.'));
    help.appendChild(el('p', '값은 조회한 PC의 것입니다. 파일 출처를 확인하고 작업 관리자와 비슷한 시각·단위로 비교하세요. 권한 부족은 관리자 권한 상승 대신 확인 불가로 남깁니다. JSON에는 인증값이나 로그 본문이 필요하지 않습니다.'));
    body.appendChild(help);
  };
  const load = async getFile => {
    const gen = ++generation; clearTimeout(ageTimer); state = 'loading'; snapshot = null; paint();
    try {
      const file = await getFile();
      if (!file || file.size > 128 * 1024) throw Error('관측 파일은 128 KiB 이하 JSON이어야 합니다.');
      const next = normalizePcSnapshot(JSON.parse(await file.text()));
      if (gen !== generation) return;
      snapshot = next; state = 'ok';
      if (!history.some(s => s.sampleId === next.sampleId)) {
        history.push(next); history.sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
        if (history.length > 12) history.shift();
      }
      ageTimer = setTimeout(paint, Math.max(1, Date.parse(next.checkedAt) + 120001 - Date.now()));
    } catch {
      if (gen !== generation) return;
      snapshot = null; state = 'error'; message = '파일 선택·읽기·형식을 확인할 수 없습니다. 학생 측정 도구가 생성한 최신 JSON을 다시 선택하세요.';
    }
    paint();
  };
  choose.addEventListener('click', async () => {
    if (typeof globalThis.showDirectoryPicker !== 'function') {
      notice.textContent = '이 브라우저는 폴더 선택을 지원하지 않습니다. 관측 JSON 파일 선택을 사용하세요.'; input.focus(); return;
    }
    try {
      const selected = await globalThis.showDirectoryPicker({mode: 'read', id: 'keshev-observations'});
      directory = selected;
      await load(async () => (await directory.getFileHandle('pc-observation.json')).getFile());
    } catch (error) {
      if (error?.name !== 'AbortError') await load(async () => { throw Error('folder unavailable'); });
    }
  });
  input.addEventListener('change', async () => { directory = null; const file = input.files?.[0]; if (file) await load(async () => file); input.value = ''; });
  refresh.addEventListener('click', () => {
    if (directory) return load(async () => (await directory.getFileHandle('pc-observation.json')).getFile());
    notice.textContent = '최신 관측 JSON 파일을 다시 선택하세요. 파일을 고르기 전에는 새로 측정한 것으로 표시하지 않습니다.';
    input.click();
  });
  paint();
  return root;
}
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  // 제공 파일·메뉴는 유지하고 학생 대시보드만 보호 현황 앞에 추가한다.
  if (typeof document.getElementById === 'function') {
    const panel = document.getElementById('view-protection');
    if (panel && !document.getElementById('student-local-dashboard')) panel.prepend(createLocalDashboard());
  }
  // 제공 UI가 정규화한 오류만 표시한다. 알 수 없는 원문·설정은 노출하지 않는다.
  const describeAiError = (error) => {
    const account = '담당자에게 계정 연결과 앱 권한의 준비 상태를 확인하세요.';
    const retry = '잠시 후 사용자가 버튼을 직접 눌러 다시 점검하세요.';
    const cancelled = '요청이 취소됐습니다. 이전 응답은 현재 결과가 아닙니다.';
    const models = '담당자에게 현재 앱 권한의 모델 허용 설정을 확인하세요.';
    const guides = {
      ON_AI_PROVISIONING_PENDING: `권한 준비 중입니다. 학생 코드 오류로 단정하지 않습니다. ${account}`,
      AI_REQUEST_UNVERIFIED: `AI 연결 또는 응답 확인 불가입니다. ${account}`,
      WB_CLCO_AUTH_REQUIRED: '인증 확인이 필요합니다. 계정 연결을 다시 확인하고 담당자에게 문의하세요.',
      WB_CLCO_ACCESS_BLOCKED: 'AI 접근이 제한됐습니다. 담당자에게 앱 이용 권한과 운영 상태를 확인하세요.',
      ON_AI_AUTHORIZATION_CHANGED: `점검 도중 앱 권한이 변경됐습니다. ${account}`,
      WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진됐습니다. 담당자에게 확인하세요.',
      WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.',
      WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
      WB_CLCO_RATE_LIMITED: `AI 요청이 제한됐습니다. ${retry}`,
      WB_CLCO_TIMEOUT: `AI 응답 시간 초과입니다. ${retry}`,
      REQUEST_TIMEOUT: `요청 시간 초과입니다. ${retry}`,
      ENGINE_TIMEOUT: `서버 확인 시간 초과입니다. ${retry}`,
      TIMEOUT: `응답 시간 초과입니다. ${retry}`,
      WB_CLCO_NETWORK_ERROR: `AI 서버와 네트워크 연결을 확인할 수 없습니다. ${retry}`,
      WB_CLCO_CANCELLED: cancelled,
      CANCELLED: cancelled,
      REQUEST_CANCELLED: cancelled,
      MODEL_NOT_CONFIGURED: `사용할 모델이 설정되지 않았습니다. ${models}`,
      ON_AI_MODEL_LIST_EMPTY: `현재 권한으로 사용할 모델이 없습니다. ${models}`,
      SUBJECT_SCOPE_UNVERIFIED: `현재 계정과 사건의 연결을 확인할 수 없습니다. ${account}`,
      ON_AI_INVALID_INPUT: '설명에 필요한 사건 근거와 규칙을 확인할 수 없습니다. 기존 기록을 확인하세요.',
      ON_AI_INVALID_OUTPUT: '사건 설명의 응답 형식이나 근거를 확인할 수 없습니다. 기존 기록을 확인하세요.',
    };
    const code = typeof error?.code === 'string' && Object.hasOwn(guides, error.code)
      ? error.code : 'AI_REQUEST_UNVERIFIED';
    const message = error?.message;
    // 알려진 코드라도 비밀값 형태·원문 스택이 섞이면 고정된 안전 안내로 대체한다.
    const sensitive = /Bearer\s+\S+|\b(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:token|password|api[_ -]?key|secret)\s*[:=]\s*\S+|-----BEGIN|https?:\/\/|\n\s*at\s/i;
    const safeMessage = code === error?.code && typeof message === 'string' && message.length > 0
      && message.length <= 1000 && !sensitive.test(message) ? message : '오류 원문을 표시하지 않습니다. 아래 안내를 확인하세요.';
    return { code, message: safeMessage, guide: guides[code] };
  };
  return {
    renderIdentity({ me, devices, sessions }) {
      // 호출마다 새 요소를 반환한다. 제공 UI가 이전 학생 영역을 교체한다.
      const root = document.createElement('div');
      const deviceStates = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionStates = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const line = (parent, text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        parent.appendChild(paragraph);
      };
      const value = (text) => typeof text === 'string' && text ? text : '확인 불가';
      const deviceText = (device) =>
        `${value(device?.label)} · ID: ${value(device?.id)} · 상태: ${deviceStates[device?.status] ?? '확인 불가'}(${value(device?.status)})`;
      const sessionText = (session) =>
        `ID: ${value(session?.id)} · 상태: ${sessionStates[session?.status] ?? '확인 불가'}(${value(session?.status)})`;

      for (const [title, resource, showData] of [
        ['현재 계정·기기·세션', me, (section, data) => {
          line(section, `사용자: ${value(data?.user?.label)} · ID: ${value(data?.user?.id)}`);
          line(section, `현재 기기: ${deviceText(data?.device)}`);
          line(section, `현재 세션: ${sessionText(data?.session)}`);
        }],
        ['기기 목록', devices, (section, data) => {
          if (!Array.isArray(data)) return line(section, '기기 목록 확인 불가');
          if (data.length === 0) return line(section, '기기 목록이 비어 있습니다.');
          for (const device of data) line(section, `기기: ${deviceText(device)}`);
        }],
        ['세션 목록', sessions, (section, data) => {
          if (!Array.isArray(data)) return line(section, '세션 목록 확인 불가');
          if (data.length === 0) return line(section, '세션 목록이 비어 있습니다.');
          for (const session of data) line(section, `세션: ${sessionText(session)}`);
        }],
      ]) {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);
        root.appendChild(section);

        // 자료 상태와 연결 모드는 독립적이다. 로딩·오류에서도 모드를 표시한다.
        if (resource?.mode === 'demo') line(section, '예제 자료');
        else if (resource?.mode === 'disconnected') line(section, '연결 없음');
        else if (resource?.mode !== 'connected') line(section, '연결 상태: 확인 불가');

        if (resource?.status === 'loading') line(section, '불러오는 중');
        else if (resource?.status === 'error') {
          line(section, `연결 실패: ${value(resource.error?.message)}`);
        } else if (resource?.status === 'ok') showData(section, resource.data);
        else line(section, '확인 불가');
      }
      return root;
    },
    renderDecision({ status, mode, data, error, appId }) {
      const root = document.createElement('div');
      const line = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.appendChild(paragraph);
      };
      const value = (text) => typeof text === 'string' && text ? text : '확인 불가';

      if (mode === 'demo') line('예제 자료');
      else if (mode === 'disconnected') line('연결 없음');
      else if (mode !== 'connected') line('연결 상태: 확인 불가');

      if (status === 'idle') {
        line('앱을 골라 접속을 요청하세요.');
        return root;
      }

      // 로딩·실패 때는 이전 응답의 data를 현재 판정으로 표시하지 않는다.
      line(`업무 앱 ID: ${value(status === 'ok' ? data?.appId ?? appId : appId)}`);
      if (status === 'loading') {
        line('판정 확인 중');
      } else if (status === 'error') {
        line(`요청 실패: ${value(error?.message)}`);
        line('요청 실패는 접근 거부 판정이 아닙니다. 접근 판정을 확인할 수 없습니다.');
      } else if (status === 'ok') {
        const decisions = {
          allow: '접근 허용',
          deny: '접근 거부',
          challenge: '추가 인증 또는 확인 필요',
          unknown: '판정 확인 불가',
        };
        const decision = typeof data?.decision === 'string' && Object.hasOwn(decisions, data.decision)
          ? data.decision : 'unknown';
        line(`접근 판정: ${decisions[decision]}(${decision})`);
        line(`판정 이유: ${value(data?.reason)}`);
        line(`판정 시각: ${value(data?.checkedAt)}`);
        if (decision === 'allow') line('정책상 접근 허용이며 실제 업무 앱 접속 성공을 보장하지 않습니다.');
        if (decision === 'challenge') line('추가 인증 또는 확인이 필요합니다. 이 앱이 확인 절차를 대신 수행하지 않습니다.');
      } else {
        line('판정 확인 불가(unknown)');
      }
      return root;
    },
    renderEvents({ status, mode, data, error }) {
      // 필터와 상세 선택은 이번 입력의 DOM 안에서만 유지한다.
      const root = document.createElement('div');
      const add = (parent, tag, text) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node);
        return node;
      };
      const value = (text) => typeof text === 'string' && text ? text : '확인 불가';
      const kindText = (kind) => kind === 'access' ? '접속 기록(access)'
        : kind === 'xdr' ? 'XDR 경보(xdr)' : `확인 불가(${value(kind)})`;
      const accessStates = { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' };
      const sessionStates = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
      const deviceStates = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
      const stateText = (labels, state) => {
        const code = typeof state === 'string' && state ? state : 'unknown';
        return `${Object.hasOwn(labels, code) ? labels[code] : '확인 불가'}(${code})`;
      };
      const appText = (appId) => appId ? value(appId) : '앱 확인 불가';

      if (mode === 'demo') add(root, 'p', '예제 자료');
      else if (mode === 'disconnected') add(root, 'p', '연결 없음');
      else if (mode !== 'connected') add(root, 'p', '연결 상태: 확인 불가');

      if (status === 'loading') {
        add(root, 'p', '기록을 불러오는 중');
        return root;
      }
      if (status === 'error') {
        add(root, 'p', `기록을 불러오지 못했습니다: ${value(error?.message)}`);
        if (error?.code === 'CONTRACT_MISMATCH') add(root, 'p', '기록 확인 불가(CONTRACT_MISMATCH)');
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        add(root, 'p', '기록 확인 불가(CONTRACT_MISMATCH)');
        return root;
      }

      const time = (event) => {
        const at = Date.parse(event.at);
        return Number.isFinite(at) ? at : 0;
      };
      const events = [...data].sort((a, b) => time(b) - time(a));
      const filters = add(root, 'div');
      const createFilter = (name, values, labelFor) => {
        const label = add(filters, 'label', name);
        const select = add(label, 'select');
        select.setAttribute('aria-label', name);
        const all = add(select, 'option', '전체');
        all.value = 'all';
        for (const original of new Set(values)) {
          const option = add(select, 'option', labelFor(original));
          option.value = original;
        }
        select.value = 'all';
        return select;
      };
      const kind = createFilter('기록 종류', events.map((event) => event.kind), kindText);
      const app = createFilter('업무 앱', events.map((event) => event.appId ?? ''), appText);
      const access = createFilter('접속 상태', events.map((event) => event.state.access),
        (state) => stateText(accessStates, state));
      const count = add(root, 'p');
      count.setAttribute('role', 'status');
      const list = add(root, 'ul');
      const detail = add(root, 'div');

      const showDetail = (event) => {
        detail.replaceChildren();
        const section = add(detail, 'section');
        section.setAttribute('data-student-event-detail', event.id);
        add(section, 'h3', `${event.id} 상세`);
        add(section, 'p', `사건 ID: ${value(event.id)}`);
        add(section, 'p', `업무 앱: ${appText(event.appId)}`);
        for (const [title, entries] of [['근거', event.evidence], ['규칙', event.rules]]) {
          add(section, 'h4', title);
          if (!entries?.length) add(section, 'p', `${title} 정보가 없습니다.`);
          else {
            const items = add(section, 'ul');
            for (const entry of entries) add(items, 'li', `${value(entry.id)}: ${value(entry.text)}`);
          }
        }
        add(section, 'p', `접속 상태: ${stateText(accessStates, event.state.access)}`);
        add(section, 'p', `세션 상태: ${stateText(sessionStates, event.state.session)}`);
        add(section, 'p', `기기 상태: ${stateText(deviceStates, event.state.device)}`);
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          add(section, 'p', '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중입니다.');
          for (const action of event.supportedActions) {
            const button = add(section, 'button', `${action} 미지원`);
            button.type = 'button';
            button.disabled = true;
          }
        }
      };
      const renderList = () => {
        list.replaceChildren();
        detail.replaceChildren();
        const visible = events.filter((event) =>
          (kind.value === 'all' || event.kind === kind.value)
          && (app.value === 'all' || (event.appId ?? '') === app.value)
          && (access.value === 'all' || event.state.access === access.value));
        count.textContent = `표시 ${visible.length}건 / 받은 기록 ${events.length}건`;
        if (visible.length === 0) add(list, 'li', '표시할 기록이 없습니다');
        for (const event of visible) {
          const row = add(list, 'li');
          row.setAttribute('data-student-event-id', event.id);
          add(row, 'p', `사건 ID: ${value(event.id)}`);
          add(row, 'p', `시각: ${value(event.at)}`);
          add(row, 'p', `종류: ${kindText(event.kind)}`);
          add(row, 'p', `업무 앱: ${appText(event.appId)}`);
          add(row, 'p', `요약: ${value(event.summary)}`);
          const button = add(row, 'button', `${event.id} 상세`);
          button.type = 'button';
          button.addEventListener('click', () => showDetail(event));
        }
      };
      for (const select of [kind, app, access]) select.addEventListener('change', renderList);
      renderList();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode }) {
      // 새 입력마다 새 DOM을 반환해 이전 목록·오류·복사 대상을 교체한다.
      const root = document.createElement('div');
      const add = (parent, tag, text) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node);
        return node;
      };
      const value = (text) => typeof text === 'string' && text ? text : '확인 불가';
      const showMode = (parent, currentMode) => {
        if (currentMode === 'demo') add(parent, 'p', '예제 자료');
        else if (currentMode === 'disconnected') add(parent, 'p', '연결 없음');
        else if (currentMode !== 'connected') add(parent, 'p', '연결 상태: 확인 불가');
      };
      const stateText = (labels, state) => {
        const code = typeof state === 'string' && state ? state : 'unknown';
        return `${Object.hasOwn(labels, code) ? labels[code] : '확인 불가'}(${code})`;
      };
      const failure = (parent, title, error) => {
        const timeout = /TIMEOUT|TIMED_OUT/i.test(error?.code ?? '') ? '(시간 초과)' : '';
        add(parent, 'p', `${title} 조회에 실패했습니다${timeout}: ${value(error?.message)}`);
        add(parent, 'p', `오류 코드: ${value(error?.code)}`);
        add(parent, 'p', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.');
      };
      const deviceStates = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
      const sessionStates = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };

      showMode(root, mode);
      for (const [title, resource, empty, describe] of [
        ['기기 목록', devices, '등록된 기기가 없습니다', (device) =>
          `${value(device.label)} · ID: ${value(device.id)} · 상태: ${stateText(deviceStates, device.status)}`],
        ['현재 연결', sessions, '현재 연결이 없습니다', (session) =>
          `세션 ID: ${value(session.id)} · 상태: ${stateText(sessionStates, session.status)}`],
      ]) {
        const section = add(root, 'section');
        add(section, 'h3', title);
        if (title === '현재 연결') add(section, 'p', '세션 조회 범위는 현재 검증된 연결 한 개입니다.');
        showMode(section, resource?.mode);
        if (resource?.status === 'loading') add(section, 'p', `${title} 불러오는 중`);
        else if (resource?.status === 'error') failure(section, title, resource.error);
        else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.length === 0) add(section, 'p', empty);
          else {
            const list = add(section, 'ul');
            for (const item of resource.data) add(list, 'li', describe(item));
          }
        } else add(section, 'p', `${title} 확인 불가`);
      }

      const alerts = add(root, 'section');
      add(alerts, 'h3', '알림');
      if (!Array.isArray(notifications)) add(alerts, 'p', '알림 확인 불가');
      else if (notifications.length === 0) add(alerts, 'p', '주의할 알림이 없습니다');
      else {
        const list = add(alerts, 'ul');
        for (const notification of notifications) {
          add(list, 'li', `자료: ${value(notification.resource)} · 코드: ${value(notification.code)} · 메시지: ${value(notification.message)}`);
        }
      }

      const help = add(root, 'section');
      add(help, 'h3', '진단 도움정보');
      showMode(help, diagnostics?.mode);
      let safeText = '';
      if (diagnostics?.status === 'loading') add(help, 'p', '진단 도움정보 불러오는 중');
      else if (diagnostics?.status === 'idle') add(help, 'p', '진단 정보 조회 전입니다. 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      else if (diagnostics?.status === 'error') {
        failure(help, '진단 도움정보', diagnostics.error);
        add(help, 'p', '진단 정보는 제공 화면의 도움정보 불러오기 버튼을 직접 눌러 다시 조회하세요.');
      } else if (diagnostics?.status === 'ok' && diagnostics.data && typeof diagnostics.data === 'object' && !Array.isArray(diagnostics.data)) {
        const data = diagnostics.data;
        // 전체 응답이나 설정을 직렬화하지 않고 허용된 여섯 필드만 투영한다.
        const safe = {
          requestId: value(data.requestId),
          component: value(data.component),
          version: value(data.version),
          checkedAt: value(data.checkedAt),
          engine: { mode: value(data.engine?.mode), code: value(data.engine?.code) },
        };
        safeText = JSON.stringify(safe, null, 2);
        add(help, 'pre', safeText);
      } else add(help, 'p', '진단 도움정보 확인 불가');

      add(help, 'p', '도움 요청에 쓸 진단 정보입니다. 내용을 확인한 뒤 도움정보 복사를 직접 누를 때만 클립보드에 복사합니다.');
      const copy = add(help, 'button', '도움정보 복사');
      copy.type = 'button';
      copy.disabled = !safeText;
      const copyStatus = add(help, 'p');
      copyStatus.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        if (!safeText) return;
        try {
          await navigator.clipboard.writeText(safeText);
          copyStatus.textContent = '도움정보를 클립보드에 복사했습니다.';
        } catch {
          copyStatus.textContent = '도움정보를 복사하지 못했습니다. 위 진단 도움정보를 직접 선택해 복사하세요.';
        }
      });
      return root;
    },
    renderVulnerabilities({ status, mode, data, error }) {
      // 현재 입력의 새 표만 반환한다. 조회·취소·재시도는 제공 UI가 담당한다.
      const root = document.createElement('div');
      const add = (parent, tag, text) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node);
        return node;
      };
      const value = (text) => typeof text === 'string' && text ? text : '확인 불가';
      const field = (name, content) => {
        if (typeof content === 'string' && content || typeof content === 'number' && Number.isFinite(content)) {
          add(root, 'p', `${name}: ${content}`);
        }
      };
      if (mode === 'demo') add(root, 'p', '예제 자료(demo) · 실제 설치 프로젝트의 외부 조회 확인이 아닙니다.');
      else if (mode === 'disconnected') add(root, 'p', '연결 없음(disconnected)');
      else if (mode !== 'connected') add(root, 'p', '연결 상태 확인 불가(unknown)');
      add(root, 'p', 'OSV는 알려진 취약점 데이터베이스입니다. 조회 결과만으로 패키지나 앱 전체의 안전을 보장할 수 없습니다.');

      if (status === 'idle') add(root, 'p', '설치 패키지 조회 전(idle)');
      else if (status === 'loading') add(root, 'p', '설치 패키지 조회 중(loading) · 이전 표는 현재 결과가 아닙니다.');
      else if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message.length <= 1000
          && !/Bearer\s+\S+|(?:token|password|api[_ -]?key|secret)\s*[:=]\s*\S+|-----BEGIN|\bsk-[A-Za-z0-9_-]+/i.test(error.message)
          ? value(error.message) : '패키지 조회를 확인할 수 없습니다.';
        add(root, 'p', `조회 실패: ${message}`);
        if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)) field('오류 코드', error.code);
        add(root, 'p', '실패와 미조회는 취약점 없음이 아닙니다. 제공 화면의 설치 패키지 조회 버튼을 직접 눌러 다시 조회하세요. 자동으로 재요청하지 않습니다.');
      } else if (status === 'ok') {
        const scanStates = {
          complete: '모두 조회', partial: '일부 조회 실패', not_checked: '아직 조회 안 함',
          not_configured: '조회 준비 미완료', unverifiable: 'lock 파일 확인 불가',
        };
        if (typeof data?.status !== 'string' || !Object.hasOwn(scanStates, data.status) || !Array.isArray(data.packages)) {
          add(root, 'p', '조회 결과 확인 불가(CONTRACT_MISMATCH) · 이전 표는 현재 결과가 아닙니다.');
          return root;
        }
        add(root, 'p', `전체 조회 상태: ${scanStates[data.status]}(${data.status})`);
        field('잠금 파일 형식(lockfileVersion)', data.lockfileVersion);
        field('잠금 파일 해시(lockfileHash)', data.lockfileHash);
        field('전체 조회 시각(checkedAt)', data.checkedAt);
        if (data.status === 'not_configured') add(root, 'p', '조회 대상 프로젝트 설정이 필요합니다. 담당자가 대상 경로와 공개 조회 허용 패키지를 준비해야 합니다.');
        if (data.status === 'not_checked') add(root, 'p', '승인된 공개 조회 대상이 없어 아직 조회하지 않았습니다. 취약점 없음으로 해석하지 마세요.');
        if (data.status === 'unverifiable') add(root, 'p', 'lock 파일과 설치 메타데이터를 확인할 수 없어 조회 결과를 판정할 수 없습니다.');
        if (data.status === 'partial') add(root, 'p', '일부 패키지의 전체 조회를 확인할 수 없습니다. 이미 받은 취약점 ID는 아래에 유지합니다.');
        if (data.packages.length === 0) {
          add(root, 'p', '표시할 패키지 조회 결과가 없습니다.');
          return root;
        }

        const table = add(root, 'table');
        add(table, 'caption', '전달된 정확한 설치 버전의 OSV 조회 결과');
        const headers = add(add(table, 'thead'), 'tr');
        for (const label of ['패키지', '정확한 설치 버전', '조회 상태', '취약점 ID·수정 시각', '출처', '확인 시각']) {
          add(headers, 'th', label).setAttribute('scope', 'col');
        }
        const rows = add(table, 'tbody');
        const packageStates = { known_vulnerabilities: '알려진 항목 있음', none_found: '알려진 항목 없음', unverifiable: '조회 확인 불가' };
        for (const pkg of data.packages) {
          const row = add(rows, 'tr');
          row.setAttribute('data-student-package-name', pkg.name);
          // 범위·태그를 설치 버전으로 바꾸거나 추정하지 않는다.
          const exact = typeof pkg.version === 'string'
            && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(pkg.version);
          if (exact) row.setAttribute('data-student-package-version', pkg.version);
          add(row, 'td', value(pkg.name));
          add(row, 'td', exact ? pkg.version : '정확한 설치 버전 확인 불가');
          const knownStatus = typeof pkg.status === 'string' && Object.hasOwn(packageStates, pkg.status);
          const state = add(row, 'td', knownStatus ? `${packageStates[pkg.status]}(${pkg.status})` : '조회 확인 불가');
          const findings = Array.isArray(pkg.vulnerabilities) ? pkg.vulnerabilities : [];
          if (pkg.status === 'none_found') add(state, 'p', '조회 시점·범위에서 알려진 항목이 없다는 뜻이며 안전 보장이 아닙니다.');
          if (pkg.status === 'unverifiable') add(state, 'p', findings.length > 0
            ? '일부 확인·전체 조회 확인 불가. 이미 받은 취약점 ID를 표시합니다.'
            : '전체 조회 확인 불가이며 취약점 없음이 아닙니다.');
          const findingCell = add(row, 'td');
          for (const finding of findings) add(findingCell, 'p', `취약점 ID: ${value(finding.id)} · 수정 시각(modified): ${value(finding.modified)}`);
          add(row, 'td', value(pkg.source));
          add(row, 'td', value(pkg.checkedAt));
        }
      } else add(root, 'p', '설치 패키지 조회 상태 확인 불가');
      return root;
    },
    renderAiConnection({ status, mode, data, error, checkedAt }) {
      const root = document.createElement('div');
      const line = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.appendChild(paragraph);
      };
      if (mode === 'demo') line('예제 자료(demo) · 실제 연결 확인이 아닙니다.');
      else if (mode === 'disconnected') line('연결 없음(disconnected)');
      else if (mode !== 'connected') line('연결 상태 확인 불가(unknown)');

      if (status === 'idle') line('AI 연결 점검 전');
      else if (status === 'loading') line('AI 연결 점검 중');
      else if (status === 'error') {
        const failure = describeAiError(error);
        line(`AI 연결 점검 실패: ${failure.code} · ${failure.message}`);
        line(failure.guide);
      } else if (status === 'ok') {
        if (data?.transportChecked === true && ['test', 'verified'].includes(data.audienceAuthorization)) {
          line(data.audienceAuthorization === 'test' ? '시험 연결 점검(test)' : '앱 권한 확인 후 점검(verified)');
          line(`응답 모델 수: ${Number.isInteger(data.modelCount) && data.modelCount >= 0 ? data.modelCount : '확인 불가'}`);
          line(`점검 시각: ${typeof checkedAt === 'string' && checkedAt ? checkedAt : '확인 불가'}`);
        } else line('AI 연결 점검 결과 확인 불가');
        line('연결 점검과 사건 설명은 별개입니다. 사건 설명은 아직 실행하지 않았습니다.');
        line('사건 설명은 보안 기록에서 별도로 요청하고 결과를 확인하세요.');
      } else line('AI 연결 점검 상태 확인 불가');

      line('자동으로 다시 점검하지 않습니다. 다시 점검은 제공 화면의 AI 연결 점검 버튼을 사용자가 직접 누르세요.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt }) {
      // 현재 입력만으로 새 DOM을 만든다. 이전 사건의 설명·성공 표식을 재사용하지 않는다.
      const root = document.createElement('div');
      const add = (parent, tag, text) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        parent.appendChild(node);
        return node;
      };
      const line = (text) => add(root, 'p', text);
      const unchanged = () => line('업무 앱 판정과 보안 기록은 그대로 유지됩니다. 이전 설명은 현재 결과가 아닙니다.');
      const reject = (reason) => {
        line(`AI 설명을 사용할 수 없습니다: ${reason}`);
        line('오류 코드: ON_AI_INVALID_OUTPUT');
        unchanged();
        return root;
      };
      if (explanation?.mode === 'demo') line('예제 자료(demo) · 실제 사건 설명의 성공 확인이 아닙니다.');
      // 근거 부족으로 event가 null이어도 실제 실패 원인을 먼저 알린다.
      if (explanation?.status === 'error') {
        const failure = describeAiError(explanation.error);
        line(`AI 설명 실패: ${failure.code} · ${failure.message}`);
        line(failure.guide);
        unchanged();
        line('AI 연결·설명 오류 자체가 공식 과제 판정 결과는 아닙니다.');
        line('다시 요청하려면 사용자가 보안 기록의 AI 설명 요청 버튼을 직접 누르세요.');
        return root;
      }
      if (!event) {
        line('보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }
      if (explanation?.status === 'loading') {
        line(`사건 ID: ${event.id}`);
        line('AI 설명 요청 중입니다. 보안 기록은 그대로 유지됩니다.');
        return root;
      }
      if (!explanation || explanation.status === 'idle') {
        line('사건 설명 요청 전입니다. 선택한 기록의 AI 설명 요청 버튼을 직접 누르세요.');
        return root;
      }
      if (explanation.status !== 'ok') return reject('설명 상태를 확인할 수 없습니다.');

      const data = explanation.data;
      if (data?.executed === true) return reject('AI가 이미 실행했다고 답한 설명은 사용할 수 없습니다.');
      if (data?.executed !== false || data?.requiresHumanConfirmation !== true) {
        return reject('미실행 상태와 사람 확인 필요 여부를 확인할 수 없습니다.');
      }
      const text = (value) => typeof value === 'string' && value.length > 0;
      if (!text(event.id) || !text(data.summary) || !Array.isArray(event.evidence)
        || event.evidence.length === 0 || !event.evidence.every((row) => text(row?.id) && text(row?.text))
        || !Array.isArray(event.rules) || !event.rules.every((row) => text(row?.id) && text(row?.text))
        || !event.state || !Array.isArray(event.supportedActions)) {
        return reject('현재 기록의 근거·규칙·상태 또는 설명 자료를 확인할 수 없습니다.');
      }
      const evidence = new Map(event.evidence.map((row) => [row.id, row.text]));
      const validRefs = (ids) => Array.isArray(ids) && ids.length > 0
        && new Set(ids).size === ids.length && ids.every((id) => evidence.has(id));
      if (evidence.size !== event.evidence.length || !validRefs(data.evidenceIds)
        || data.evidenceIds.length !== evidence.size) {
        return reject('설명의 근거가 현재 기록과 맞지 않습니다. 근거 ID가 없거나 중복·누락됐습니다.');
      }
      if (!Array.isArray(data.proposals) || !data.proposals.every((proposal) =>
        text(proposal?.action) && text(proposal?.reason) && event.supportedActions.includes(proposal.action)
        && validRefs(proposal.evidenceIds))) {
        return reject('제안의 조치 또는 근거가 현재 기록과 맞지 않습니다.');
      }

      // 모든 대조가 끝난 성공 설명에만 표식을 붙인다.
      root.setAttribute('data-student-explanation-event', event.id);
      line(`사건 ID: ${event.id}`);
      add(root, 'h3', 'AI 설명(참고용)');
      line(data.summary);
      line('AI 요약은 해석입니다. 사실 판단은 근거 글과 연동 시스템이 알려 준 현재 상태를 기준으로 하세요.');
      line(`확인 시각: ${text(checkedAt) ? checkedAt : '확인 불가'}`);
      add(root, 'h4', '인용한 근거');
      const cited = add(root, 'ul');
      for (const id of data.evidenceIds) add(cited, 'li', `${id} — ${evidence.get(id)}`);
      add(root, 'h4', '현재 규칙');
      if (event.rules.length === 0) line('규칙 정보가 없습니다.');
      else {
        const rules = add(root, 'ul');
        for (const rule of event.rules) add(rules, 'li', `${rule.id} — ${rule.text}`);
      }
      add(root, 'h4', '현재 상태');
      const labels = {
        access: { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };
      const states = add(root, 'ul');
      let unknownCount = 0;
      for (const [key, name] of [['access', '접속'], ['session', '세션'], ['device', '기기']]) {
        const original = event.state[key];
        const code = typeof original === 'string' && Object.hasOwn(labels[key], original) ? original : 'unknown';
        add(states, 'li', `${name}: ${labels[key][code]}(${code})`);
        if (code === 'unknown') unknownCount++;
      }
      if (unknownCount === 0) line('확인 불가 상태: 없음');
      add(root, 'h4', '조치 제안');
      if (data.proposals.length === 0) {
        line(event.supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 이 기록에 제안한 조치가 없습니다.');
      } else {
        const proposals = add(root, 'ul');
        for (const proposal of data.proposals) {
          add(proposals, 'li', `${proposal.action} — ${proposal.reason} · 근거: ${proposal.evidenceIds.join(', ')} · 사람 확인이 필요하며 실행되지 않았습니다.`);
        }
      }
      line('실행 상태: 미실행(executed:false). 설명·제안만으로 보안 조치가 실행되지는 않습니다.');
      return root;
    },
    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error }) {
      // 표시 전용이다. 호출마다 현재 입력으로 새 요소를 반환한다.
      const root = document.createElement('div');
      const line = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.appendChild(paragraph);
      };
      const scalar = (value) => typeof value === 'string' && value.length > 0
        || typeof value === 'number' && Number.isFinite(value);
      const field = (name, value) => { if (scalar(value)) line(`${name}: ${value}`); };
      const labels = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 연동 시스템 결과 조회 중(loading) · 현재 결과 확인 전',
        prepared: '준비됨·미실행(prepared)',
        executing: '서버에 전달 중(executing) · 결과가 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending) · 접수 응답(ACK)은 효과 확인이 아닙니다.',
        succeeded: '효과 확인(succeeded)',
        denied: '연동 시스템 거절(denied)',
        failed: '연동 시스템 실패(failed)',
        unknown: '결과 불명(unknown) · 성공이나 효과 없음으로 판단하지 마세요.',
        error: '요청이 처리되지 않았습니다(error)',
        expired: '확인 기한 지남(expired) · 현재 사건으로 다시 준비하세요.',
      };
      const effectConfirmed = status === 'succeeded' && observation?.effectApplied === true;
      const currentStatus = status === 'succeeded' && !effectConfirmed
        ? 'unknown' : typeof status === 'string' && Object.hasOwn(labels, status) ? status : 'unknown';
      line(labels[currentStatus]);

      if (scalar(event?.id)) {
        root.setAttribute('data-student-action-event', String(event.id));
        field('사건 ID', event.id);
      }
      if (Array.isArray(event?.evidence)) {
        for (const evidence of event.evidence) field('근거 ID', evidence?.id);
      }
      field('조치 ID', actionId);
      field('실제 대상 ID', target?.id);
      field('대상 세대(generation)', target?.generation);
      if (scalar(receipt?.requestId)) {
        root.setAttribute('data-student-action-request', String(receipt.requestId));
        field('요청 ID(requestId)', receipt.requestId);
      }
      field('영수증 ID(receiptId)', receipt?.receiptId);
      field('결과 버전(version)', receipt?.version);

      if (currentStatus === 'prepared') {
        field('사람 확인 기한(confirmationExpiresAt)', confirmationExpiresAt);
        line('아직 실행되지 않았습니다. 제공 화면에서 사건·근거·실제 대상·조치·확인 기한을 읽고 사람이 별도로 확인해야 합니다.');
      }
      if (currentStatus === 'executing' || currentStatus === 'pending') {
        line('요청 전달·접수와 실제 효과 관측은 다릅니다. 결과는 제공 화면에서 별도로 재조회해 확인하세요.');
      }
      if (effectConfirmed) {
        field('관측 시각(observedAt)', observation.observedAt);
        line('effectApplied: true');
      }
      if (currentStatus === 'unknown') {
        line('효과가 없었다고도, 성공했다고도 단정할 수 없습니다. 재집행하지 말고 제공 화면의 결과 재조회 버튼으로 연동 시스템 결과만 다시 확인하세요.');
      }

      // 안전한 표시 필드만 읽고 응답 전체나 인증 티켓은 직렬화하지 않는다.
      const sensitive = /Bearer\s+\S+|\b(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:token|password|api[_ -]?key|secret)\s*[:=]\s*\S+|-----BEGIN|https?:\/\/|\n\s*at\s/i;
      const safeMessage = (value) => typeof value === 'string' && value.length > 0
        && value.length <= 1000 && !sensitive.test(value) ? value : null;
      const notice = safeMessage(message);
      if (notice) line(`안내: ${notice}`);
      const errorCodes = [
        'ACTION_UNSUPPORTED', 'ACTION_INPUT_INVALID', 'ACTION_DENIED', 'ACTION_CONFIRMATION_EXPIRED',
        'ACTION_CONFIRMATION_INVALID', 'ACTION_SCOPE_CHANGED', 'ACTION_SCOPE_UNVERIFIED',
        'SUBJECT_SCOPE_UNVERIFIED', 'ACTION_SNAPSHOT_CHANGED', 'ACTION_EVENT_UNAVAILABLE',
        'ACTION_TIMEOUT', 'ACTION_STORE_FAILED', 'ACTION_RESULT_UNVERIFIED', 'ACTION_CANCELLED',
      ];
      if (error || currentStatus === 'error') {
        const code = errorCodes.includes(error?.code) ? error.code : 'ACTION_RESULT_UNVERIFIED';
        line(`오류 코드: ${code}`);
        line(`오류 안내: ${safeMessage(error?.message) ?? '안전한 오류 안내를 확인할 수 없습니다. 담당자에게 확인하세요.'}`);
      }
      if ((currentStatus === 'denied' || currentStatus === 'failed') && !notice && !error) {
        line('거절·실패 사유를 확인할 수 없습니다. 제공 화면에서 현재 결과를 확인하세요.');
      }
      if (typeof receipt?.replayed === 'boolean') {
        line(`동일 요청 재전송 여부(replayed): ${receipt.replayed}`);
        line('같은 요청의 재전송 응답은 새 집행이나 새 효과의 증거가 아닙니다. 자동 재집행하지 않습니다.');
      }
      if (receipt?.superseded === true) line('이전 조회는 최신 결과를 대신하지 않습니다(superseded:true).');
      line('AI 제안만으로 실행되지 않습니다. 학생 화면은 상태만 표시하며 실제 조치 버튼은 제공 화면에 있습니다.');
      line('조치 화면 취소는 이미 서버에 전달된 조치 효과를 되돌리지 않습니다.');
      line('실제 학생 계정의 연동 시스템 집행·결과 확인은 기다림(UNV)입니다.');
      return root;
    },
  };
}
