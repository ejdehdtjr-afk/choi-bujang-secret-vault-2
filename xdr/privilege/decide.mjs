// Standalone pattern definitions mirrored from patterns.json. No imports or I/O.
const PATTERNS = Object.freeze({
  admin_group_escalation: {
    addition: /관리자\s*그룹.*(?:추가|들어가)|다시\s*관리자로\s*(?:들어와|들어왔)|added\s+to\s+administrators/iu,
    excluded: /관리자\s*그룹은\s*아닙|관리자\s*그룹.*(?:아님|아니|취소)/iu,
  },
  unusual_admin_command: {
    command: /관리자\s*명령|admin(?:istrator)?\s+command/iu,
    context: /방금\s*관리자가\s*된|처음\s*보는\s*주소|수업\s*시간\s*밖|업무.*시각|다른\s*계정의\s*권한|newly\s+admin|unfamiliar\s+(?:address|network)|off.hours|another\s+account/iu,
    failed: /실패|취소|failed|cancelled/iu,
  },
  unexpected_admin_session: {
    changed: /세션.*관리자\s*권한.*(?:바뀌|변경)|session.*admin.*(?:chang|elevat)/iu,
    unfamiliar: /처음\s*(?:보|봅)|낯선\s*주소|unfamiliar|unknown\s+address/iu,
  },
  privilege_change_review: /권한|관리자|그룹|계정\s*종류|세션|privileg|admin|group|session/iu,
});

function text(value) { return typeof value === 'string' ? value : ''; }

export function decide(alert) {
  const item = alert && typeof alert === 'object' ? alert : {};
  const description = text(item.rule?.description ?? item.description);
  const group = text(item.data?.group ?? item.group);
  const level = Number(item.rule?.level ?? item.level ?? 0);
  const safeLevel = Number.isFinite(level) ? level : 0;

  // A technique tag or administrator account name by itself is not a block signal.
  if (safeLevel <= 3) return { action: 'record', confidence: 0.05, reason: 'normal_event' };
  if (safeLevel >= 10) {
    const groupPattern = PATTERNS.admin_group_escalation;
    const groupAdded = groupPattern.addition.test(description)
      && !groupPattern.excluded.test(description)
      && (!group || /^administrators?$/iu.test(group));
    if (groupAdded) {
      return { action: 'block', confidence: 0.93, reason: 'admin_group_escalation' };
    }
    const commandPattern = PATTERNS.unusual_admin_command;
    if (commandPattern.command.test(description) && commandPattern.context.test(description)
        && !commandPattern.failed.test(description)) {
      return { action: 'block', confidence: 0.9, reason: 'unusual_admin_command' };
    }
    const sessionPattern = PATTERNS.unexpected_admin_session;
    if (sessionPattern.changed.test(description) && sessionPattern.unfamiliar.test(description)) {
      return { action: 'block', confidence: 0.9, reason: 'unexpected_admin_session' };
    }
  }
  if (PATTERNS.privilege_change_review.test(description)) {
    return { action: 'alert', confidence: 0.6, reason: 'privilege_change_review' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_event' };
}
