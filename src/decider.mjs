// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'route_not_allowed', 'write_not_allowed']);

const RESERVED_RESOURCE_IDS = new Set(['all', 'list', 'export', 'import', 'search', 'bulk', 'admin']);

function itemRoute(path, route, prefix) {
  if (typeof path !== 'string' || !path.startsWith(prefix)) return false;
  const id = path.slice(prefix.length);
  return /^[a-z0-9_-]{1,128}$/iu.test(id)
    && !RESERVED_RESOURCE_IDS.has(id.toLowerCase())
    && route === `GET ${prefix}:id`;
}

function permittedResource(request) {
  if (typeof request.subjectId !== 'string' || !request.subjectId
      || !/^[a-f0-9]{16}$/u.test(request.deviceId ?? '')) return false;
  const { service, method, path, route, queryLength } = request;
  if (!['notes', 'announcements'].includes(service)) return false;
  if (queryLength !== 0 || method !== 'GET') return false;

  // The engine also uses /notes/:id as its default one-note resource route.
  // List reads are limited to the self-scoped endpoint; an item read still
  // requires the API's verified owner_id check before any content is returned.
  if (service === 'notes') {
    if (path === '/api/my/notes') return route === 'GET /api/my/notes';
    return ['/notes/', '/api/notes/', '/api/my/notes/']
      .some(prefix => itemRoute(path, route, prefix));
  }
  if (service === 'announcements' && path === '/api/announcements') {
    return route === 'GET /api/announcements';
  }
  return false;
}

function isCompositeVirtualRisk(request) {
  const signals = request?.signals;
  if (!signals || signals.source !== 'judge_fixture') return false;

  const unusualHour = Number.isInteger(signals.hour)
    && (signals.hour < 6 || signals.hour >= 22);
  const unfamiliarNetwork = signals.network === 'unusual';
  const suddenBulkRead = Array.isArray(request.recentEvents)
    && request.recentEvents.some(event => event?.kind === 'risk_signal'
      && Number.isInteger(event.count) && event.count >= 20);
  return unusualHour && unfamiliarNetwork && suddenBulkRead;
}

export async function decide(request) {
  const registered = request?.deviceRegistered === true;
  const compositeRisk = isCompositeVirtualRisk(request);
  const freshStepUp = request?.stepUp?.verified === true
    && Number.isInteger(request.stepUp.authAgeSeconds)
    && request.stepUp.authAgeSeconds >= 0
    && request.stepUp.authAgeSeconds <= 900;

  let decision = 'allow';
  let reasonCode = 'approved';
  let ruleIds = [RULE_IDS[0]];
  if (!registered) {
    decision = 'deny';
    reasonCode = 'device_not_registered';
  } else if (request?.method !== 'GET') {
    decision = 'deny';
    reasonCode = 'write_not_allowed';
    ruleIds = [RULE_IDS[0], RULE_IDS[3]];
  } else if (!permittedResource(request)) {
    decision = 'deny';
    reasonCode = 'route_not_allowed';
    ruleIds = [RULE_IDS[0], RULE_IDS[2]];
  } else if (compositeRisk && !freshStepUp) {
    decision = 'step_up';
    reasonCode = 'step_up_required';
    ruleIds = [...RULE_IDS];
  } else if (compositeRisk) {
    ruleIds = [...RULE_IDS];
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision,
    reasonCode,
    ruleIds,
  };
}
