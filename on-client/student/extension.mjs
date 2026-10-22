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
      const root = document.createElement('div');
      const line = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.appendChild(paragraph);
      };
      if (explanation?.mode === 'demo') line('예제 자료(demo) · 실제 사건 설명의 성공 확인이 아닙니다.');
      if (explanation?.status === 'ok' && typeof event?.id === 'string' && event.id
        && typeof explanation.data?.summary === 'string' && explanation.data.summary) {
        root.setAttribute('data-student-explanation-event', event.id);
        line(`사건 ID: ${event.id}`);
        line(`사건 설명: ${explanation.data.summary}`);
        line(`확인 시각: ${typeof checkedAt === 'string' && checkedAt ? checkedAt : '확인 불가'}`);
        line('AI 설명과 제안은 보안 조치를 실행하지 않습니다.');
      } else if (explanation?.status === 'error') {
        const failure = describeAiError(explanation.error);
        line(`사건 설명 실패: ${failure.code} · ${failure.message}`);
        line(failure.guide);
        line('보안 기록은 그대로 유지됩니다. 이전 설명은 현재 결과가 아닙니다.');
        line('다시 요청하려면 사용자가 보안 기록의 AI 설명 요청 버튼을 직접 누르세요.');
      } else if (explanation?.status === 'loading') line('사건 설명 요청 중입니다. 보안 기록은 그대로 유지됩니다.');
      else if (!explanation || explanation.status === 'idle') line('사건 설명 요청 전입니다. 보안 기록에서 사건을 선택해 AI 설명을 직접 요청하세요.');
      else line('사건 설명 확인 불가입니다. 보안 기록은 그대로 유지됩니다.');
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
