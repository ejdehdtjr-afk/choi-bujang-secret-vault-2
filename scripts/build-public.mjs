import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'data.json');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (![2, 3, 4, 5].includes(config.step)) throw new Error('2~5단계 설정을 확인하세요.');
const data = JSON.parse(await readFile(source, 'utf8'));
if (!Array.isArray(data.notes) || data.notes.length !== 0) {
  throw new Error('정적 파일에 메모를 포함할 수 없습니다.');
}
await mkdir(resolve(root, 'public'), { recursive: true });
await writeFile(output, '{"notes":[]}\n', 'utf8');
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
