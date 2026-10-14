// Standalone patterns mirrored from patterns.json. No imports, I/O or network.
const PATTERNS = Object.freeze({
  large_unfamiliar_destination: /처음\s*보는\s*(?:목적지|주소)|낯선\s*(?:목적지|주소)|first.seen|unfamiliar\s+destination/iu,
  repeated_large_transfer: /대용량.*(?:반복|연속)|(?:전송|자료).*\d+번|반복\s*전송|repeated\s+(?:large|bulk)\s+transfer/iu,
  unusual_channel_bulk_copy: /평소.*쓰지\s*않던\s*포트|자료실\s*전체.*외부\s*주소|명령\s*통로.*큰\s*파일|unusual\s+port|entire\s+vault.*external/iu,
  transfer_review: /전송|나갔|올라갔|목적지|외부|압축|백업|자료.*읽|명령\s*통로|transfer|upload|destination|archive/iu,
});

function text(value) { return typeof value === 'string' ? value : ''; }
function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function decide(alert) {
  const item = alert && typeof alert === 'object' ? alert : {};
  const description = text(item.rule?.description ?? item.description);
  const level = count(item.rule?.level ?? item.level);
  const bytes = count(item.data?.bytes ?? item.bytes);
  const destination = text(item.data?.dstip ?? item.destinationIp ?? item.dstip);
  const repeated = count(item.data?.count ?? item.count);
  const files = count(item.data?.files ?? item.files);
  const completedTransfer = !/전송은\s*(?:아직\s*)?없|전송이\s*실패|나가지\s*않|no\s+transfer|failed\s+transfer/iu.test(description);
  const large = bytes >= 50_000_000;

  // A technique tag or destination alone cannot justify a block.
  if (level <= 3) return { action: 'record', confidence: 0.05, reason: 'normal_event' };
  if (level >= 10 && large && destination && completedTransfer) {
    if (PATTERNS.large_unfamiliar_destination.test(description)) {
      return { action: 'block', confidence: 0.94, reason: 'large_unfamiliar_destination' };
    }
    if (PATTERNS.repeated_large_transfer.test(description) && (repeated >= 8 || files >= 50)) {
      return { action: 'block', confidence: 0.9, reason: 'repeated_large_transfer' };
    }
    if (PATTERNS.unusual_channel_bulk_copy.test(description)) {
      return { action: 'block', confidence: 0.9, reason: 'unusual_channel_bulk_copy' };
    }
  }
  if (PATTERNS.transfer_review.test(description)) {
    return { action: 'alert', confidence: 0.6, reason: 'transfer_review' };
  }
  return { action: 'record', confidence: 0.1, reason: 'normal_event' };
}
