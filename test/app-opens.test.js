/**
 * 화면이 실제로 열리는지 본다.
 *
 * 서버(Code.gs)만 확인하는 테스트로는, 화면이 시작하다 죽어서 '여는 중…'에
 * 멈춰 있는 걸 못 잡는다. 진짜로 페이지를 열어 로그인부터 목록까지 확인한다.
 *
 * jsdom 이 없으면 건너뛴다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGas } from './helpers/gas-sandbox.js';

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  JSDOM = null;
}

const 지민 = 'jimin@example.com';
const 수호 = 'suho@example.com';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const skip = JSDOM ? false : 'jsdom 없음';
const API_URL = 'https://script.google.com/macros/s/TEST/exec';
const CLIENT_ID = 'test.apps.googleusercontent.com';

/**
 * 바깥에서 받아오는 것(글꼴·구글 로그인 코드)을 걷어내고 우리 파일을 끼워 넣는다.
 *
 * 끼워 넣을 내용은 반드시 함수로 넘긴다. 글자로 넘기면 replace 가 그 안의 $$ 를
 * $ 로 바꿔버려서, app.js 의 두 도우미($ 와 $$)가 서로 덮어쓴다. 그러면 앱은
 * 멀쩡한데 테스트만 깨져서, 없는 버그를 쫓게 된다.
 */
function inline(html, tag, body) {
  if (!html.includes(tag)) throw new Error(`${tag} 를 찾지 못했습니다`);
  return html.replace(tag, () => body);
}

function testPage() {
  let h = read('index.html');
  h = inline(h, '<link rel="stylesheet" href="styles.css" />', `<style>${read('styles.css')}</style>`);
  // 배포되는 config.js 는 비어 있으므로, 채워진 것으로 갈아 끼운다
  h = inline(h, '<script src="config.js"></script>',
    `<script>var CONFIG = { apiUrl: ${JSON.stringify(API_URL)}, clientId: ${JSON.stringify(CLIENT_ID)} };</script>`);
  h = inline(h, '<script src="app.js"></script>', `<script>${read('app.js')}</script>`);
  return h
    .replace(/<script src="https:\/\/accounts\.google\.com[^>]*><\/script>/, '')
    .replace(/<link rel="stylesheet"[^>]*fonts\.googleapis[^>]*\/>/g, '');
}

/**
 * 앱을 연다. 서버 응답은 진짜 Code.gs 가 만든다 — 화면과 서버를 한 번에 확인한다.
 * signedIn 이면 이미 로그인된 상태로 시작한다.
 */
function openApp({ signedIn = true, who = 지민 } = {}) {
  const gas = loadGas({ owner: 지민, editors: [수호] });
  gas.context.CLIENT_ID = CLIENT_ID;
  gas.call('ensureSheets_');
  gas.issueToken('TOKEN', { email: who });

  const calls = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));

  const dom = new JSDOM(testPage(), {
    runScripts: 'dangerously',
    virtualConsole: vc,
    pretendToBeVisual: true,
    url: 'https://nkrrrt.github.io/kkineun/',
    beforeParse(w) {
      w.fetch = (url, opts) => {
        const body = JSON.parse(opts.body);
        calls.push(body.fn);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(gas.post(body)) });
      };
      // 구글 로그인 코드 대신, 단추를 그리는 흉내만 낸다
      w.google = {
        accounts: {
          id: {
            initialize(o) { w.__cb = o.callback; },
            renderButton(box) { box.innerHTML = '<button id="fake-google">구글로 로그인</button>'; },
            prompt() {},
          },
        },
      };
      if (signedIn) w.sessionStorage.setItem('idt', 'TOKEN');
    },
  });

  const w = dom.window;
  return { win: w, doc: w.document, gas, calls, errors };
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const st = (doc, id) => {
  const el = doc.getElementById(id);
  return el ? (el.hidden ? '숨김' : '보임') : '없음';
};

test('로그인한 상태로 열면 가계부가 그려진다', { skip }, async () => {
  const { doc, gas, errors } = openApp();
  gas.call('addTransaction', {
    date: '2026-08-10', kind: 'expense', amount: 12000, category: '식비', memo: '점심', month: '',
  });
  gas.call('addTransaction', {
    date: '2026-08-05', kind: 'income', amount: 3000000, category: '급여', memo: '월급', month: '',
  });
  await wait();

  assert.deepEqual(errors, [], '페이지에서 오류가 났습니다');
  assert.equal(st(doc, 'loading'), '숨김', '여는 중… 화면에 멈춰 있습니다');
  assert.equal(st(doc, 'signin'), '숨김', '로그인 화면이 남아 있습니다');
  assert.equal(st(doc, 'fatal'), '숨김', '오류: ' + doc.getElementById('fatal-msg').textContent);
  assert.equal(st(doc, 'screens'), '보임');
  assert.equal(st(doc, 'tabbar'), '보임');
  assert.match(doc.getElementById('month-label').textContent, /2026년 8월/);
});

test('로그인 전에는 로그인 화면만 보인다', { skip }, async () => {
  const { doc, calls } = openApp({ signedIn: false });
  await wait();

  assert.equal(st(doc, 'signin'), '보임', '로그인 화면이 안 보입니다');
  assert.equal(st(doc, 'screens'), '숨김', '로그인 전에 가계부가 보입니다');
  assert.equal(st(doc, 'loading'), '숨김');
  assert.deepEqual(calls, [], '로그인도 안 했는데 서버를 불렀습니다');
  assert.ok(doc.getElementById('fake-google'), '구글 로그인 단추가 없습니다');
});

test('로그인하면 가계부로 넘어간다', { skip }, async () => {
  const { win, doc } = openApp({ signedIn: false });
  await wait(200);

  win.__cb({ credential: 'TOKEN' });   // 구글이 증명서를 준 상황
  await wait();

  assert.equal(st(doc, 'signin'), '숨김', '로그인해도 로그인 화면이 남아 있습니다');
  assert.equal(st(doc, 'screens'), '보임', '가계부가 안 나옵니다');
  assert.equal(win.sessionStorage.getItem('idt'), 'TOKEN');
});

test('초대받지 않은 계정은 로그인 화면으로 되돌아간다', { skip }, async () => {
  const { doc } = openApp({ who: 'stranger@example.com' });
  await wait();

  assert.equal(st(doc, 'screens'), '숨김', '명단에 없는데 가계부가 열렸습니다');
  assert.equal(st(doc, 'signin'), '보임', '로그인 화면으로 안 돌아갔습니다');
  assert.match(doc.getElementById('signin-note').textContent, /초대되지 않은/);
});

test('앱으로 설치될 준비가 돼 있다', { skip }, async () => {
  const { doc } = openApp();
  await wait(200);

  // 이 셋이 있어야 브라우저가 '앱이다'라고 인정하고 주소창을 없앤다
  assert.ok(doc.querySelector('link[rel="manifest"]'), '설명서 연결이 없습니다');
  const mf = JSON.parse(read('manifest.webmanifest'));
  assert.equal(mf.display, 'standalone', '주소창이 안 사라지는 설정입니다');
  assert.ok(mf.icons.some((i) => i.sizes === '512x512'), '큰 아이콘이 없습니다');
  assert.ok(mf.icons.some((i) => i.purpose === 'maskable'), '안드로이드용 아이콘이 없습니다');
  assert.match(read('sw.js'), /addEventListener\('fetch'/, '일꾼이 요청을 못 받습니다');
});

test('두 도우미가 서로를 덮어쓰지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // $ 는 하나, $$ 는 목록. 붙여넣기·묶기 과정에서 $$ 가 $ 로 뭉개진 적이 두 번 있었다.
  assert.equal(typeof win.$('#month-label').addEventListener, 'function', '$ 가 요소를 안 돌려줍니다');
  assert.ok(Array.isArray(win.$$('.tabbar button')), '$$ 가 목록을 안 돌려줍니다');
  assert.ok(win.$$('.tabbar button').length >= 4, '탭이 안 그려졌습니다');
});
