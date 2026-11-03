// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
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
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
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
