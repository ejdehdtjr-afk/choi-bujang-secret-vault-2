// Standalone rules mirrored from patterns.json. No imports, I/O, or network.
const PATTERNS = Object.freeze({
  untrusted_service_registration: {
    service: /서비스|\bservice\b/iu,
    unsigned: /서명(?:이|은)?\s*(?:없는|없|되지)|unsigned|untrusted/iu,
    changed: /새|등록|바뀌|변경|생성|new|register|chang/iu,
    unlisted: /평소\s*목록에\s*없는|unlisted|unknown service/iu,
  },
  unfamiliar_scheduled_task: {
    task: /예약\s*작업|scheduled\s*task/iu,
    unfamiliar: /처음\s*보는|낯선|임의\s*문자열|unknown|random|unfamiliar/iu,
    temporary: /임시\s*폴더|\\temp\\|\btemp\b/iu,
  },
  unlisted_startup_change: {
    startup: /시작\s*(?:폴더|프로그램|항목)|startup/iu,
    unlisted: /평소\s*목록에\s*없는|unlisted|unknown/iu,
    added: /추가|등록|added|created/iu,
    scheduled: /예약\s*작업|scheduled\s*task/iu,
    sharedTemporary: /같은\s*임시\s*파일|same\s+temp/iu,
  },
});

function text(value) { return typeof value === 'string' ? value : ''; }

export function decide(alert) {
  const item = alert && typeof alert === 'object' ? alert : {};
  const description = text(item.rule?.description ?? item.description);
  const path = text(item.data?.path ?? item.path);
  const level = Number(item.rule?.level ?? item.level ?? 0);
  const safeLevel = Number.isFinite(level) ? level : 0;
  const service = PATTERNS.untrusted_service_registration;
  const task = PATTERNS.unfamiliar_scheduled_task;
  const startup = PATTERNS.unlisted_startup_change;
  const confirmedAbsence = /등록은\s*없|추가는\s*없|변경은\s*없|실행은\s*없|no\s+(?:service|task|startup)\s+(?:registration|change|addition)/iu.test(description);

  // An ATT&CK tag or service name alone is never enough to isolate a user.
  if (safeLevel >= 10 && !confirmedAbsence) {
    if (service.service.test(description)
        && ((service.unsigned.test(description) && service.changed.test(description))
          || (service.unlisted.test(description) && service.changed.test(description)))) {
      return { action: 'block', confidence: 0.92, reason: 'untrusted_service_registration' };
    }
    if (task.task.test(description) && task.unfamiliar.test(description)
        && (task.temporary.test(`${description}\n${path}`) || /수업\s*시간\s*밖/iu.test(description))) {
      return { action: 'block', confidence: 0.9, reason: 'unfamiliar_scheduled_task' };
    }
    if (startup.startup.test(description)
        && ((startup.unlisted.test(description) && startup.added.test(description))
          || (startup.scheduled.test(description) && startup.sharedTemporary.test(description)))) {
      return { action: 'block', confidence: 0.9, reason: 'unlisted_startup_change' };
    }
  }

  if (safeLevel <= 3 || /기존.*서명된.*서비스|기존.*서비스.*서명된|정상.*서비스|existing\s+signed\s+service/iu.test(description)) {
    return { action: 'record', confidence: 0.05, reason: 'normal_event' };
  }
  if (service.service.test(description)) {
    return { action: 'alert', confidence: 0.6, reason: 'untrusted_service_registration' };
  }
  if (task.task.test(description)) {
    return { action: 'alert', confidence: 0.6, reason: 'unfamiliar_scheduled_task' };
  }
  if (startup.startup.test(description) || /임시\s*폴더.*실행\s*파일|temporary\s+executable/iu.test(description)) {
    return { action: 'alert', confidence: 0.6, reason: 'unlisted_startup_change' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_event' };
}
