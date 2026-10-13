import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const BACKUP_COMMIT = '36e7fca210064e43b6157b5e87f4bc1aacaa939f';
const backupFile = resolve(root, 'backups/safe-policy.json');
const stateFile = resolve(root, 'policy/test-policy.json');
const auditFile = resolve(root, 'policy/restore-audit.jsonl');
const hash = value => createHash('sha256').update(value).digest('hex');
const serialized = value => JSON.stringify(value);

export function comparePolicy(backup, current) {
  if (backup?.schema !== 'aleph.safe-policy.v1' || backup.sourceCommit !== BACKUP_COMMIT
      || !/^[a-f0-9]{64}$/u.test(backup.deciderSha256 ?? '')
      || !Number.isInteger(backup.policyRevision) || !Array.isArray(backup.allowedRoutes)
      || current?.schema !== 'aleph.test-policy.v1' || !Array.isArray(current.allowedRoutes)) {
    throw new Error('policy_backup_or_state_invalid');
  }
  const changed = ['policyRevision', 'deciderSha256', 'allowedRoutes']
    .filter(key => serialized(current[key]) !== serialized(backup[key]));
  return { changed, targetRevision: backup.policyRevision, backupHash: backup.deciderSha256 };
}

export function restoredTestPolicy(backup, current) {
  comparePolicy(backup, current);
  return { ...current, policyRevision: backup.policyRevision,
    deciderSha256: backup.deciderSha256, allowedRoutes: backup.allowedRoutes };
}

function verifiedBackup() {
  const backup = JSON.parse(readFileSync(backupFile, 'utf8'));
  if (backup.sourceCommit !== BACKUP_COMMIT) throw new Error('policy_backup_commit_mismatch');
  const decider = execFileSync('git', ['show', `${BACKUP_COMMIT}:src/decider.mjs`], {
    cwd: root, windowsHide: true, timeout: 5000,
  });
  const config = JSON.parse(execFileSync('git', ['show', `${BACKUP_COMMIT}:aleph.config.json`], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 5000,
  }));
  if (hash(decider) !== backup.deciderSha256
      || serialized(config.allowedRoutes) !== serialized(backup.allowedRoutes)) {
    throw new Error('policy_backup_verification_failed');
  }
  return backup;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const backup = verifiedBackup();
    const current = JSON.parse(readFileSync(stateFile, 'utf8'));
    const preview = comparePolicy(backup, current);
    process.stdout.write(`검증한 정책 사본: ${BACKUP_COMMIT.slice(0, 12)} · 버전 ${preview.targetRevision}\n`);
    process.stdout.write(`확인 해시: ${preview.backupHash}\n`);
    process.stdout.write(`시험 정책 변경 항목: ${preview.changed.length ? preview.changed.join(', ') : '없음'}\n`);
    if (preview.changed.includes('policyRevision')) {
      process.stdout.write(`policyRevision: ${current.policyRevision} -> ${backup.policyRevision}\n`);
    }
    if (preview.changed.includes('deciderSha256')) {
      process.stdout.write(`deciderSha256: ${current.deciderSha256} -> ${backup.deciderSha256}\n`);
    }
    if (preview.changed.includes('allowedRoutes')) {
      const route = item => `${item.service} ${item.method} ${item.pathPattern} ${item.zone}`;
      const before = new Set(current.allowedRoutes.map(route));
      const after = new Set(backup.allowedRoutes.map(route));
      process.stdout.write(`허용 경로 제거: ${[...before].filter(item => !after.has(item)).join(', ') || '없음'}\n`);
      process.stdout.write(`허용 경로 복원: ${[...after].filter(item => !before.has(item)).join(', ') || '없음'}\n`);
    }
    if (process.argv.includes('--apply')) {
      if (process.argv.includes('--confirm') === false
          || process.argv[process.argv.indexOf('--confirm') + 1] !== preview.backupHash) {
        throw new Error('preview_hash_confirmation_required');
      }
      if (preview.changed.length) {
        const temporary = `${stateFile}.tmp`;
        writeFileSync(temporary, `${JSON.stringify(restoredTestPolicy(backup, current), null, 2)}\n`, { flag: 'wx' });
        renameSync(temporary, stateFile);
        appendFileSync(auditFile, `${JSON.stringify({ at: new Date().toISOString(), sourceCommit: BACKUP_COMMIT,
          targetRevision: preview.targetRevision, changed: preview.changed })}\n`);
      }
      process.stdout.write('시험 정책 복원 완료; 운영 정책과 기존 감사 기록은 변경하지 않았습니다.\n');
    }
  } catch (error) {
    process.stderr.write(`정책 복원 중단: ${error.message}\n`);
    process.exitCode = 1;
  }
}
