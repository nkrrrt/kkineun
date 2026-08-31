/**
 * 판 번호를 올린다.
 *
 * 화면 파일을 고치면 반드시 이걸 돌려야 한다. 안 그러면 폰이 옛 파일을 계속
 * 붙들고 있어서, 고친 것이 사용자에게 안 보인다. 번호가 세 곳(index.html ·
 * config.js · sw.js)에 흩어져 있으므로 손으로 맞추면 언젠가 어긋난다.
 *
 *   node tools/bump.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = (f) => fileURLToPath(new URL(f, root));
const read = (f) => readFileSync(path(f), 'utf8');

/** 20260831a → 20260831b → … 같은 날 여러 번 고쳐도 번호가 겹치지 않게 */
function nextVersion(current) {
  const d = new Date();
  const today = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  if (!current.startsWith(today)) return `${today}a`;
  const letter = current.slice(today.length) || 'a';
  return today + String.fromCharCode(letter.charCodeAt(0) + 1);
}

export function bump() {
  const config = read('config.js');
  const found = config.match(/APP_VERSION = '([^']+)'/);
  if (!found) throw new Error('config.js 에서 APP_VERSION 을 찾지 못했습니다.');

  const from = found[1];
  const to = nextVersion(from);

  writeFileSync(path('config.js'), config.replace(`APP_VERSION = '${from}'`, `APP_VERSION = '${to}'`));
  writeFileSync(path('index.html'), read('index.html').split(`?v=${from}`).join(`?v=${to}`));
  writeFileSync(path('sw.js'), read('sw.js').replace(`kkineun-${from}`, `kkineun-${to}`));
  return { from, to };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { from, to } = bump();
  console.log(`판 ${from} → ${to}`);
}
