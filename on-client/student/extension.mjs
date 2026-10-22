// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
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
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
