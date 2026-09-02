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
/** 시작일 1일 기준으로 오늘이 속한 달의 화면 표시 */
function thisMonthLabel() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

const API_URL = 'https://script.google.com/macros/s/TEST/exec';
const CLIENT_ID = 'test.apps.googleusercontent.com';


/**
 * 바깥에서 받아오는 것(글꼴·구글 로그인 코드)을 걷어내고 우리 파일을 끼워 넣는다.
 *
 * 끼워 넣을 내용은 반드시 함수로 넘긴다. 글자로 넘기면 replace 가 그 안의 $$ 를
 * $ 로 바꿔버려서, app.js 의 두 도우미($ 와 $$)가 서로 덮어쓴다. 그러면 앱은
 * 멀쩡한데 테스트만 깨져서, 없는 버그를 쫓게 된다.
 */
function inline(html, pattern, body) {
  if (!pattern.test(html)) throw new Error(`${pattern} 를 찾지 못했습니다`);
  return html.replace(pattern, () => body);
}

function testPage() {
  let h = read('index.html');
  // 파일 주소에는 판 번호(?v=...)가 붙어 있을 수 있다
  h = inline(h, /<link rel="stylesheet" href="styles\.css[^"]*" \/>/, `<style>${read('styles.css')}</style>`);
  // 배포되는 config.js 는 비어 있으므로, 채워진 것으로 갈아 끼운다
  h = inline(h, /<script src="config\.js[^"]*"><\/script>/,
    `<script>var CONFIG = { apiUrl: ${JSON.stringify(API_URL)}, clientId: ${JSON.stringify(CLIENT_ID)} };` +
    `var APP_VERSION = 'test';</script>`);
  h = inline(h, /<script src="app\.js[^"]*"><\/script>/, `<script>${read('app.js')}</script>`);
  return h
    .replace(/<script src="https:\/\/accounts\.google\.com[^>]*><\/script>/, '')
    .replace(/<link rel="stylesheet"[^>]*fonts\.googleapis[^>]*\/>/g, '');
}

/**
 * 앱을 연다. 서버 응답은 진짜 Code.gs 가 만든다 — 화면과 서버를 한 번에 확인한다.
 * signedIn 이면 이미 로그인된 상태로 시작한다.
 */
function openApp({ signedIn = true, who = 지민, silent = null, secondsLeft = 3600,
  slowServer = false, deadServer = false, deadFromStart = false, ledger = null } = {}) {
  const gas = loadGas({ owner: 지민, editors: [수호] });
  gas.context.CLIENT_ID = CLIENT_ID;
  gas.call('ensureSheets_');

  const token = gas.issueToken('login', { email: who, expiresInSec: secondsLeft });
  // 구글이 조용히 새로 내주는 증명서는 늘 성한 것이다
  const freshToken = gas.issueToken('silent', { email: who });

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
        // 첫 자료는 늘 제대로 준다. 느리거나 끊긴 상황은 그 다음 요청부터 흉내 낸다.
        const first = body.fn === 'getBootstrap' && !deadFromStart;
        if (deadServer && !first) return Promise.reject(new TypeError('네트워크 없음'));
        const answer = Promise.resolve({ ok: true, json: () => Promise.resolve(gas.post(body)) });
        return (slowServer && !first) ? new Promise((r) => setTimeout(() => r(answer), 5000)) : answer;
      };
      // 구글 로그인 코드 대신, 단추를 그리고 조용한 로그인을 흉내 낸다
      w.google = {
        accounts: {
          id: {
            initialize(o) { w.__cb = o.callback; },
            renderButton(box) { box.innerHTML = '<button id="fake-google">구글로 로그인</button>'; },
            prompt(cb) {
              if (silent) setTimeout(function () { w.__cb({ credential: freshToken }); }, 0);
              else if (cb) cb({ isNotDisplayed: () => true, isSkippedMoment: () => false });
            },
          },
        },
      };
      if (signedIn) w.localStorage.setItem('idt', token);
      if (ledger) w.localStorage.setItem('ledger', ledger);
    },
  });

  const w = dom.window;
  return { win: w, doc: w.document, gas, calls, errors, token };
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const st = (doc, id) => {
  const el = doc.getElementById(id);
  return el ? (el.hidden ? '숨김' : '보임') : '없음';
};

test('로그인한 상태로 열면 가계부가 그려진다', { skip }, async () => {
  const { doc, gas, errors } = openApp();
  // 오늘이 속한 달에 넣어야 첫 화면에 보인다. 달이 바뀌어도 깨지지 않게.
  const today = new Date().toISOString().slice(0, 10);
  gas.call('addTransaction', {
    date: today, kind: 'expense', amount: 12000, category: '식비', memo: '점심', month: '',
  });
  gas.call('addTransaction', {
    date: today, kind: 'income', amount: 3000000, category: '급여', memo: '월급', month: '',
  });
  await wait();

  assert.deepEqual(errors, [], '페이지에서 오류가 났습니다');
  assert.equal(st(doc, 'loading'), '숨김', '여는 중… 화면에 멈춰 있습니다');
  assert.equal(st(doc, 'signin'), '숨김', '로그인 화면이 남아 있습니다');
  assert.equal(st(doc, 'fatal'), '숨김', '오류: ' + doc.getElementById('fatal-msg').textContent);
  assert.equal(st(doc, 'screens'), '보임');
  assert.equal(st(doc, 'tabbar'), '보임');
  assert.equal(doc.getElementById('month-label').textContent, thisMonthLabel());
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
  const extra = openApp({ signedIn: false });
  const { win, doc } = extra;
  await wait(200);

  const { token } = extra;
  win.__cb({ credential: token });   // 구글이 증명서를 준 상황
  await wait();

  assert.equal(st(doc, 'signin'), '숨김', '로그인해도 로그인 화면이 남아 있습니다');
  assert.equal(st(doc, 'screens'), '보임', '가계부가 안 나옵니다');
  assert.equal(win.localStorage.getItem('idt'), token, '다음에 열 때 쓸 증명서가 저장되지 않았습니다');
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

test('탭을 모두 열어봐도 죽지 않는다', { skip }, async () => {
  const { doc, win, errors } = openApp();
  await wait();

  // 설정 탭은 처음에 안 그려져서, 거기 있는 함수를 지워도 다른 테스트는 통과한다.
  // 실제로 다 눌러봐야 잡힌다.
  for (const btn of [...doc.querySelectorAll('.tabbar button')]) {
    btn.click();
    await wait(60);
    assert.equal(doc.getElementById('fatal').hidden, true,
      `${btn.textContent.trim()} 탭에서 죽었습니다: ` + doc.getElementById('fatal-msg').textContent);
  }
  assert.deepEqual(errors, [], '탭을 여는 중 오류가 났습니다');

  // 설정 탭의 테마 단추가 살아 있는지
  const dark = doc.querySelector('[data-theme-choice="dark"]');
  assert.ok(dark, '테마 단추가 없습니다');
  dark.click();
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark', '어둡게가 안 먹습니다');
  assert.equal(win.localStorage.getItem('theme'), 'dark');
});

test('파일 주소에 판 번호가 붙어 있다', { skip }, async () => {
  const ver = read('config.js').match(/APP_VERSION = '([^']+)'/)[1];
  const h = read('index.html');

  // 판 번호가 없으면 폰이 옛 파일을 계속 붙들어서, 고쳐도 안 바뀐 것처럼 보인다
  for (const f of ['styles.css', 'app.js', 'config.js']) {
    assert.ok(h.includes(`${f}?v=${ver}`), `${f} 에 판 번호(${ver})가 없습니다`);
  }
  // 일꾼도 같은 판이라야 옛 것을 비운다
  assert.ok(read('sw.js').includes(`kkineun-${ver}`), '일꾼의 판 번호가 다릅니다');
});

/* ------------------------------------------------------------------ */
/* 다시 열 때 로그인                                                    */
/* ------------------------------------------------------------------ */

test('앱을 껐다 켜도 다시 로그인하지 않는다', { skip }, async () => {
  const { doc, calls } = openApp({ signedIn: true });
  await wait();

  // 저장해 둔 증명서로 바로 열려야 한다
  assert.equal(st(doc, 'signin'), '숨김', '또 로그인하라고 합니다');
  assert.equal(st(doc, 'screens'), '보임');
  assert.ok(calls.includes('getBootstrap'), '자료를 안 불러왔습니다');
});

test('증명서가 만료됐으면 조용히 새로 받아 연다', { skip }, async () => {
  // 저장된 것은 이미 만료, 대신 구글이 조용히 새 것을 내주는 상황
  const { doc } = openApp({ signedIn: true, secondsLeft: -10, silent: true });
  await wait();

  assert.equal(st(doc, 'signin'), '숨김', '만료됐다고 로그인 화면을 띄웠습니다');
  assert.equal(st(doc, 'screens'), '보임', '가계부가 안 열렸습니다');
});

test('구글이 조용히 못 내주면 그때만 로그인 화면', { skip }, async () => {
  const { doc } = openApp({ signedIn: false, silent: false });
  await wait();

  assert.equal(st(doc, 'signin'), '보임', '로그인 화면이 안 나옵니다');
  assert.ok(doc.getElementById('fake-google'), '로그인 단추가 없습니다');
});

test('만료된 증명서는 서버로 보내지 않는다', { skip }, async () => {
  const { calls } = openApp({ signedIn: true, secondsLeft: -10, silent: false });
  await wait();

  // 어차피 거절당할 것을 보내면 왕복만 낭비된다
  assert.deepEqual(calls, [], '만료된 증명서로 서버를 불렀습니다');
});

/* ------------------------------------------------------------------ */
/* 빨리 열기                                                            */
/* ------------------------------------------------------------------ */

test('두 번째부터는 기다리지 않고 바로 보여준다', { skip }, async () => {
  const first = openApp({ signedIn: true });
  first.gas.call('addTransaction', {
    date: '2026-08-11', kind: 'expense', amount: 4500, category: '식비', memo: '김밥', month: '',
  });
  await wait();
  const saved = first.win.localStorage.getItem('ledger');
  assert.ok(saved, '본 내역을 남겨두지 않았습니다');
  assert.ok(JSON.parse(saved).transactions, '남겨둔 내용이 이상합니다');

  // 다음에 열 때: 서버가 아주 느려도 화면은 곧바로 나와야 한다
  const next = openApp({ signedIn: true, slowServer: true, ledger: saved });
  await wait(120);
  assert.equal(st(next.doc, 'screens'), '보임', '서버를 기다리느라 빈 화면입니다');
  assert.equal(st(next.doc, 'loading'), '숨김');
  assert.equal(next.doc.getElementById('month-label').textContent, thisMonthLabel());
});

test('새 자료를 못 받아와도 보던 화면을 뺏지 않는다', { skip }, async () => {
  const first = openApp({ signedIn: true });
  await wait();
  const saved = first.win.localStorage.getItem('ledger');

  // 인터넷이 끊긴 상황 (첫 요청부터 실패해야 하므로 따로 표시)
  const next = openApp({ signedIn: true, deadServer: true, deadFromStart: true, ledger: saved });
  await wait();
  assert.equal(st(next.doc, 'screens'), '보임', '보던 내역이 사라졌습니다');
  assert.equal(st(next.doc, 'fatal'), '숨김', '오류 화면으로 덮었습니다');
});

test('로그아웃하면 남겨둔 내역을 지운다', { skip }, async () => {
  const { win, doc } = openApp({ signedIn: true });
  await wait();
  assert.ok(win.localStorage.getItem('ledger'), '남겨둔 내역이 없습니다');

  win.eval("signOut('테스트')");
  assert.equal(win.localStorage.getItem('ledger'), null, '로그아웃했는데 내역이 남아 있습니다');
  assert.equal(st(doc, 'signin'), '보임');
});

test('시작일·종료일을 따로 정할 수 있고, 겹치면 알려준다', { skip }, async () => {
  const { doc } = openApp();
  await wait();
  [...doc.querySelectorAll('.tabbar button')].forEach((b) => {
    if (b.getAttribute('data-tab') === 'settings') b.click();
  });
  await wait(150);

  const start = doc.getElementById('set-start-day');
  const end = doc.getElementById('set-end-day');
  const note = doc.getElementById('start-day-note');
  const fire = (el) => el.dispatchEvent(new doc.defaultView.Event('change'));

  assert.equal(start.options.length, 31, '시작일이 31일까지 안 나옵니다');
  assert.equal(end.options.length, 31, '종료일이 31일까지 안 나옵니다');

  // 시작일 24 → 종료일은 딱 붙는 23으로
  start.value = '24'; fire(start);
  await wait(200);
  assert.equal(end.value, '23');
  assert.match(note.textContent, /딱 붙어/, '딱 붙는다고 안 알려줍니다');

  // 종료일만 25로 → 시작일은 24 그대로, 겹친다고 알려줘야 한다
  end.value = '25'; fire(end);
  await wait(200);
  assert.equal(start.value, '24', '시작일이 멋대로 바뀌었습니다');
  assert.equal(end.value, '25');
  assert.match(note.textContent, /모두/, '겹친다고 안 알려줍니다');
  assert.match(note.textContent, /\d+\.24 ~ \d+\.25/, '기간이 틀립니다: ' + note.textContent);
});

/* ------------------------------------------------------------------ */
/* 기다리지 않게 하기                                                   */
/* ------------------------------------------------------------------ */

/**
 * jsdom 이 브라우저만큼 갖추지 못한 두 가지를 채운다. 앱 문제가 아니라 시험 환경 문제다.
 *  - form.amount 처럼 칸 이름으로 바로 접근하기
 *  - <dialog> 의 showModal / close
 */
function patchDom(doc) {
  doc.querySelectorAll('form').forEach((form) => {
    form.querySelectorAll('[name]').forEach((el) => {
      if (form[el.name] === undefined) {
        Object.defineProperty(form, el.name, { get: () => el, configurable: true });
      }
    });
  });
  doc.querySelectorAll('dialog').forEach((dlg) => {
    if (typeof dlg.showModal !== 'function') {
      dlg.showModal = function () { this.setAttribute('open', ''); };
      dlg.close = function () { this.removeAttribute('open'); };
    }
  });
}

/** 기록 창을 열어 한 건 적고 저장을 누른다 */
function addOne(doc, { amount = '7000', date = new Date().toISOString().slice(0, 10), memo = '점심' } = {}) {
  patchDom(doc);
  doc.getElementById('btn-add').click();
  const form = doc.getElementById('form-tx');
  const put = (name, v) => { form.querySelector(`[name="${name}"]`).value = v; };
  put('amount', amount);
  put('date', date);
  put('memo', memo);
  form.dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true }));
}

/** 화면에 그려진 기록 수. 같은 건이 날짜 칸과 목록 양쪽에 그려지므로 상태를 본다. */
const kept = (win) => win.state.transactions.length;

test('저장을 누르면 서버를 기다리지 않고 목록에 바로 뜬다', { skip }, async () => {
  const extra = openApp({ slowServer: true });
  const { doc } = extra;
  await wait();

  const win = doc.defaultView;
  const before = kept(win);
  addOne(doc, { memo: '즉시확인' });
  await wait(80);   // 서버는 아직 한참 남았다

  assert.deepEqual(extra.errors, [], '페이지 오류: ' + extra.errors.join(' / '));
  assert.equal(kept(win), before + 1, '적은 내역이 바로 안 올라갔습니다');
  assert.match(doc.body.textContent, /즉시확인/, '적은 내용이 화면에 안 보입니다');
  assert.equal(doc.getElementById('dlg-tx').hasAttribute('open'), false, '기록 창이 안 닫혔습니다');
  assert.equal(doc.getElementById('busy').hidden, false, '저장 중 표시가 없습니다');
});

test('저장이 실패하면 미리 올린 줄을 걷어낸다', { skip }, async () => {
  const { doc } = openApp({ deadServer: true });
  await wait();

  const win = doc.defaultView;
  const before = kept(win);
  addOne(doc, { memo: '실패할것' });
  await wait(300);

  assert.equal(kept(win), before, '실패했는데 줄이 남아 있습니다');
  assert.doesNotMatch(doc.body.textContent, /실패할것/, '실패한 내역이 화면에 남아 있습니다');
});

test('한 번 본 달로 돌아가면 기다리지 않는다', { skip }, async () => {
  const { doc, calls } = openApp();
  await wait();

  doc.getElementById('btn-prev-month').click();   // 7월
  await wait();
  const label = doc.getElementById('month-label').textContent;

  doc.getElementById('btn-next-month').click();   // 8월
  await wait();
  calls.length = 0;

  doc.getElementById('btn-prev-month').click();   // 다시 7월
  await wait(60);   // 서버 답이 오기 전
  assert.equal(doc.getElementById('month-label').textContent, label, '본 적 있는 달인데 안 그려집니다');
});

test('기록 창에서 카테고리가 맨 아래에 온다', { skip }, async () => {
  const { doc } = openApp();
  await wait();
  patchDom(doc);
  doc.getElementById('btn-add').click();

  // 카테고리는 줄이 여러 개로 늘어나 아래로 밀리므로, 날짜·사람·메모가 먼저 보여야 한다
  const order = [...doc.querySelectorAll('#form-tx .field')].map((f) => f.querySelector('span').textContent);
  const 자리 = (name) => order.indexOf(name);

  assert.ok(자리('얼마?') < 자리('언제?'), '금액이 맨 위가 아닙니다');
  assert.ok(자리('언제?') < 자리('어디에?'), '날짜가 카테고리보다 아래입니다');
  assert.ok(자리('누가?') < 자리('어디에?'), '사람이 카테고리보다 아래입니다');
  assert.ok(자리('메모') < 자리('어디에?'), '메모가 카테고리보다 아래입니다');
  assert.equal(자리('어디에?'), order.length - 1, '카테고리가 맨 아래가 아닙니다');
});

/* ------------------------------------------------------------------ */
/* 은행 화면 글자 읽기                                                  */
/* ------------------------------------------------------------------ */

/**
 * 아래 글자는 실제 토스뱅크 화면을 글자 인식에 통과시켜 나온 그대로다.
 * 사람이 다듬지 않았다 — 인식이 틀린 것까지 그대로 두어야 진짜 시험이 된다.
 */
const 토스화면 = `8월 30일

8 ㅎ주자유시장상인회  -200원
16:40            259565월

『개 무지개주유소       -50,000원
15:58             252765원

8월 29일

= 、. 어느 바이크

- 어느페이 、 > 0 820원

302,765원

11:13

8월 27일`;

/**
 * 같은 화면을 1.5배로 키워 한글·영문을 함께 읽힌 결과. 이름은 더 정확해지지만
 * 시각의 콜론이 날아가고(11:13 → 1133) 잔액이 이름 줄에 붙는다. 어느 쪽으로
 * 읽히든 금액과 날짜는 놓치지 않아야 한다.
 */
const 토스화면_확대 = `8월 30일

『기 가나시장상인회 _ -200원
16:40            252 565%

ry 무지개주유소      -50,000원
15:58            252,765원

8월 29일

를 717  바이크

0) PRT 바 19.     -820원
어느페이       302,765원
1133

8월 27일`;

test('확대해서 읽은 글자도 같은 세 건이 나온다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(토스화면_확대, 2026);
  const 뽑은것 = JSON.parse(JSON.stringify(rows.map((r) => [r.date, r.kind, r.amount])));
  assert.deepEqual(뽑은것, [
    ['2026-08-30', 'expense', 200],
    ['2026-08-30', 'expense', 50000],
    ['2026-08-29', 'expense', 820],
  ]);
  // 이쪽에서는 가맹점 이름이 정확히 나온다
  assert.match(rows[0].memo, /가나시장상인회/);
  assert.match(rows[1].memo, /무지개주유소/);
});

test('시각이 깨져도 마지막 한 건을 놓치지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 11:13 이 1133 으로 읽히면 그 줄로 끝맺지 못한다. 다음 날짜에서 마무리해야 한다.
  const rows = win.parseBankText(토스화면_확대, 2026);
  assert.equal(rows.length, 3, '한 건을 놓쳤습니다: ' + JSON.stringify(rows));
  assert.ok(rows.every((r) => !/^\d{3,4}$/.test(r.memo)), '깨진 시각이 이름이 됐습니다');
});

test('토스 화면에서 읽은 글자를 내역으로 바꾼다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(토스화면, 2026);
  assert.equal(rows.length, 3, '세 건이 나와야 합니다: ' + JSON.stringify(rows));

  // 금액과 날짜는 정확해야 한다. 이름은 인식이 틀릴 수 있어 고쳐 쓰게 한다.
  // jsdom 안에서 만든 배열은 바깥 배열과 종류가 달라 그대로는 못 비교한다
  const 뽑은것 = JSON.parse(JSON.stringify(rows.map((r) => [r.date, r.kind, r.amount])));
  assert.deepEqual(뽑은것, [
    ['2026-08-30', 'expense', 200],
    ['2026-08-30', 'expense', 50000],
    ['2026-08-29', 'expense', 820],
  ]);

  assert.match(rows[0].memo, /주자유시장상인회/);
  assert.match(rows[1].memo, /무지개주유소/);
  // 두 줄로 나뉜 이름도 이어 붙여야 한다
  assert.match(rows[2].memo, /바이크/);
  assert.match(rows[2].memo, /페이/);
});

test('잔액을 금액으로 잘못 읽지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(토스화면, 2026);
  // 화면의 잔액은 252,565 / 252,765 / 302,765 원이다. 하나라도 금액에 섞이면 안 된다.
  const 잔액 = [252565, 259565, 252765, 302765];
  rows.forEach((r) => {
    assert.ok(잔액.indexOf(r.amount) === -1, `잔액이 금액으로 들어갔습니다: ${r.amount}`);
  });
});

test('내역 없이 날짜만 있는 줄은 버린다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 화면 맨 아래 '8월 27일'은 내역이 잘려 안 보인다. 빈 건이 생기면 안 된다.
  const rows = win.parseBankText(토스화면, 2026);
  assert.equal(rows.filter((r) => r.date === '2026-08-27').length, 0);
  assert.ok(rows.every((r) => r.amount > 0), '금액이 0인 건이 있습니다');
});

test('연도가 없는 화면에서 앞날로 읽지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 1월에 12월 내역을 보면, 올해 12월이 아니라 작년 12월이라야 한다
  const rows = win.parseBankText('12월 25일\n스타벅스 -5,600원\n09:00 1,000원', new Date().getFullYear());
  assert.equal(rows.length, 1);
  const 일주일뒤 = new Date();
  일주일뒤.setDate(일주일뒤.getDate() + 7);
  assert.ok(rows[0].date <= 일주일뒤.toISOString().slice(0, 10), '앞날로 읽었습니다: ' + rows[0].date);
});

test('사진에서 찾은 내역을 고쳐서 넣는다', { skip }, async () => {
  const { doc, win, gas, calls } = openApp();
  await wait();
  patchDom(doc);

  // 글자 읽기까지 흉내 내긴 어려우니, 읽어낸 결과가 나온 상태부터 확인한다
  win.shot = { rows: win.parseBankText(토스화면, 2026).map((r) => ({ ...r, categoryId: '', use: true })) };
  win.renderShotRows();

  const rows = [...doc.querySelectorAll('.shot-row')];
  assert.equal(rows.length, 3, '찾은 내역이 안 그려집니다');
  assert.equal(doc.getElementById('btn-shot-save').textContent, '3건 넣기');

  // 이름을 고칠 수 있어야 한다 (글자 인식이 자주 틀리는 부분)
  const memo = rows[0].querySelector('.shot-memo');
  memo.value = '가나시장상인회';
  memo.dispatchEvent(new win.Event('input'));
  assert.equal(win.shot.rows[0].memo, '가나시장상인회');

  // 빼고 싶은 줄은 뺄 수 있어야 한다
  const 체크 = rows[2].querySelector('.shot-use input');
  체크.checked = false;
  체크.dispatchEvent(new win.Event('change'));
  assert.equal(doc.getElementById('btn-shot-save').textContent, '2건 넣기');

  // 지출↔수입을 뒤집을 수 있어야 한다 (부호를 잘못 읽었을 때)
  rows[1].querySelector('.shot-kind').click();
  assert.equal(win.shot.rows[1].kind, 'income');

  calls.length = 0;
  doc.getElementById('btn-shot-save').click();
  await wait();

  assert.ok(calls.includes('importTransactions'), '넣기를 안 불렀습니다');
  const 넣은것 = gas.dump('내역').slice(1);
  assert.equal(넣은것.length, 2, '뺀 줄까지 들어갔습니다');
  assert.ok(넣은것.some((r) => String(r[5]).indexOf('가나시장상인회') >= 0), '고친 이름이 안 들어갔습니다');
});

test('글자를 붙여넣어도 같은 확인 화면으로 간다', { skip }, async () => {
  const { doc, win, gas } = openApp();
  await wait();
  patchDom(doc);

  doc.querySelector('[data-import="paste"]').click();
  doc.getElementById('paste-text').value = 토스화면;
  doc.getElementById('form-paste').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await wait(150);

  assert.equal(doc.getElementById('dlg-paste').hasAttribute('open'), false, '붙여넣기 창이 안 닫혔습니다');
  assert.equal(doc.querySelectorAll('.shot-row').length, 3, '확인 화면에 3건이 안 나옵니다');
  assert.equal(doc.getElementById('btn-shot-save').textContent, '3건 넣기');

  doc.getElementById('btn-shot-save').click();
  await wait();
  assert.equal(gas.dump('내역').slice(1).length, 3, '넣기가 안 됐습니다');
});

test('시각이 금액보다 먼저 와도 놓치지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 앱에서 복사하면 줄 순서가 화면과 다를 수 있다
  const 붙여넣은글 = `9월 1일
스타벅스
09:12
-5,600원
300,000원
편의점
10:30
-3,200원
296,800원`;

  const rows = win.parseBankText(붙여넣은글, 2026);
  const 금액 = JSON.parse(JSON.stringify(rows.map((r) => r.amount)));
  assert.deepEqual(금액, [5600, 3200], '금액을 놓쳤습니다: ' + JSON.stringify(rows));
});

test('붙여넣은 글자가 비었거나 내역이 없으면 알려준다', { skip }, async () => {
  const { doc, win } = openApp();
  await wait();
  patchDom(doc);

  doc.querySelector('[data-import="paste"]').click();
  const 보내기 = () => doc.getElementById('form-paste')
    .dispatchEvent(new win.Event('submit', { cancelable: true }));

  doc.getElementById('paste-text').value = '';
  보내기();
  assert.equal(doc.getElementById('paste-error').hidden, false, '빈 것을 안 막았습니다');

  doc.getElementById('paste-text').value = '안녕하세요 오늘 날씨가 좋네요';
  보내기();
  assert.match(doc.getElementById('paste-error').textContent, /찾지 못했어요/);
  assert.equal(doc.getElementById('dlg-shot').hasAttribute('open'), false, '빈 확인 화면이 떴습니다');
});

test('창을 스크롤해도 저장·취소가 위에 남아 있다', { skip }, async () => {
  const { doc } = openApp();
  await wait();
  patchDom(doc);
  doc.getElementById('btn-add').click();

  const form = doc.getElementById('form-tx');
  const head = form.querySelector('.modal-head');
  const body = form.querySelector('.modal-body');

  assert.ok(head, '위쪽 고정 줄이 없습니다');
  assert.ok(body, '스크롤 되는 부분이 없습니다');

  // 저장·취소는 스크롤되는 부분이 아니라 고정된 줄에 있어야 한다
  assert.ok(head.contains(doc.getElementById('btn-tx-save')), '저장이 위에 없습니다');
  assert.ok(head.querySelector('[data-close]'), '취소가 위에 없습니다');
  assert.ok(!body.contains(doc.getElementById('btn-tx-save')), '저장이 아직 아래에 있습니다');

  // 삭제도 위에 둔다. 다만 저장에서 가장 먼 왼쪽 끝이고, 누르면 한 번 더 묻는다.
  const acts = [...head.querySelectorAll('.modal-acts .btn')];
  assert.ok(head.contains(doc.getElementById('btn-tx-delete')), '삭제가 위에 없습니다');
  assert.equal(acts[0].id, 'btn-tx-delete', '삭제가 맨 왼쪽이 아닙니다');
  assert.equal(acts[acts.length - 1].id, 'btn-tx-save', '저장이 맨 오른쪽이 아닙니다');

  // 길어지는 카테고리 목록은 스크롤 쪽에 있어야 한다
  assert.ok(body.contains(doc.getElementById('tx-categories')), '카테고리가 스크롤 밖에 있습니다');
});

test('가져오기 창도 넣기가 위에 있다', { skip }, async () => {
  const { doc, win } = openApp();
  await wait();
  patchDom(doc);

  doc.querySelector('[data-import="paste"]').click();
  doc.getElementById('paste-text').value = 토스화면;
  doc.getElementById('form-paste').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await wait(150);

  const head = doc.getElementById('dlg-shot').querySelector('.modal-head');
  assert.ok(head.contains(doc.getElementById('btn-shot-save')), '넣기가 위에 없습니다');
  assert.equal(doc.getElementById('btn-shot-save').textContent, '3건 넣기');
});

/**
 * 두 번째 화면(카드 내역)을 글자 인식에 통과시켜 나온 그대로.
 * 여기서는 '원'이 4 · & · ! 로 깨지고, '9월 1일'이 '9월 12'로 읽혔다.
 */
const 카드화면 = `&              | 카드 후 관리
9월 2일
~ AB12%w CDE    -2,3504
18:29            2021258!
Ky 카드 캐시백         +100원
18:09            204,475원
~ AB12&t CDE    -6,200&
18:09            204,375
9월 12
o “Piero       16,500!
19:28            2105758
~ AB12ttuCDE    -2,0004
15:33            227075원
il  회비      -1,000,000&
® 13:20            229,075
0  홍길동      +1,000,000&
13:19           1,229,075
oO  한전(홍길동)      -6,450원
11:23            229,075원
  홍길동상회       -450원
11:06            235,525원
8월 31일
Ky 카드 캐시백         +100원
17:25            235,975원
2, MRXXEMOEY -4,190원
17:25            235,875원
공과금
(>  공과금2     -12,500원
(어느페이)       fideo,`;

test('원이 깨져도 열두 건을 모두 찾는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(카드화면, 2026);
  const 금액 = JSON.parse(JSON.stringify(rows.map((r) => r.amount)));

  // -2,3504 / -6,200& / 16,500! 처럼 원이 깨진 것까지 다 잡아야 한다
  assert.deepEqual(금액, [
    2350, 100, 6200,
    16500, 2000, 1000000, 1000000, 6450, 450,
    100, 4190, 12500,
  ]);
});

test('더하기 부호가 붙은 것은 수입으로 넣는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(카드화면, 2026);
  const 수입 = JSON.parse(JSON.stringify(
    rows.filter((r) => r.kind === 'income').map((r) => r.amount)));

  // 카드 캐시백 두 번(+100), 홍길동(+1,000,000)
  assert.deepEqual(수입, [100, 1000000, 100]);
});

test("'일'이 깨져도 날짜가 앞으로 튀지 않는다", { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(카드화면, 2026);
  const 날짜 = JSON.parse(JSON.stringify(rows.map((r) => r.date)));

  // '9월 12'로 읽힌 줄은 9월 1일이라야 한다. 12일이면 여섯 건이 엉뚱한 날로 간다.
  assert.deepEqual(날짜, [
    '2026-09-02', '2026-09-02', '2026-09-02',
    '2026-09-01', '2026-09-01', '2026-09-01', '2026-09-01', '2026-09-01', '2026-09-01',
    '2026-08-31', '2026-08-31', '2026-08-31',
  ]);
});

test('잔액과 화면 버튼은 내역으로 들어오지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(카드화면, 2026);
  const 잔액 = [202125, 204475, 204375, 210575, 227075, 229075, 235525, 235975, 235875, 1229075];
  rows.forEach((r) => {
    assert.ok(잔액.indexOf(r.amount) === -1, `잔액이 들어왔습니다: ${r.amount}`);
  });
  assert.ok(!rows.some((r) => /관리|채우기|보내기/.test(r.memo)), '화면 버튼이 내역이 됐습니다');
});

/* ------------------------------------------------------------------ */
/* 가게 이름                                                            */
/* ------------------------------------------------------------------ */

test('이름 앞에 붙은 아이콘 찌꺼기를 걷어낸다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const 이름 = JSON.parse(JSON.stringify(
    win.parseBankText(카드화면, 2026).map((r) => r.memo)));

  // Ky 카드 캐시백 / il 회비 / oO 한전(홍길동) 처럼 앞에 붙던 것이 없어져야 한다
  assert.ok(이름.includes('카드 캐시백'), '카드 캐시백이 깨끗하지 않습니다: ' + 이름.join(' | '));
  assert.ok(이름.includes('회비'), '회비가 깨끗하지 않습니다: ' + 이름.join(' | '));
  assert.ok(이름.includes('한전(홍길동)'), '한전(홍길동)이 깨끗하지 않습니다: ' + 이름.join(' | '));
  assert.ok(이름.includes('홍길동'), '홍길동이 깨끗하지 않습니다: ' + 이름.join(' | '));
  assert.ok(이름.includes('홍길동상회'), '홍길동상회가 깨끗하지 않습니다: ' + 이름.join(' | '));
});

test('SK·GS 처럼 진짜 상호는 남긴다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  assert.equal(win.tidyName('~ AB12 어느점'), 'AB12 어느점');
  assert.equal(win.tidyName('Ky 카드 캐시백'), '카드 캐시백');
  assert.equal(win.tidyName('SK 주유소'), 'SK 주유소', '진짜 상호를 지웠습니다');
  assert.equal(win.tidyName('CU 어느점'), 'CU 어느점', '진짜 상호를 지웠습니다');
});

test('한 번 고쳐준 이름은 다음부터 알아서 바뀐다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 같은 가게도 찍을 때마다 다르게 틀린다: AB12%w CDE / AB12&t CDE / AB12ttuCDE
  win.rememberName('AB12%w CDE', 'AB12 어느점');

  const 이름 = JSON.parse(JSON.stringify(
    win.parseBankText(카드화면, 2026).map((r) => r.memo)));
  const 고쳐진것 = 이름.filter((n) => n === 'AB12 어느점');
  assert.equal(고쳐진것.length, 3, '세 건 모두 안 바뀌었습니다: ' + 이름.join(' | '));
});

test('고쳐서 넣으면 그 이름을 기억해 둔다', { skip }, async () => {
  const { doc, win } = openApp();
  await wait();
  patchDom(doc);

  doc.querySelector('[data-import="paste"]').click();
  doc.getElementById('paste-text').value = 카드화면;
  doc.getElementById('form-paste').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await wait(150);

  const 첫줄 = doc.querySelector('.shot-row .shot-memo');
  첫줄.value = 'AB12 어느점';
  첫줄.dispatchEvent(new win.Event('input'));

  doc.getElementById('btn-shot-save').click();
  await wait();

  const 기억 = JSON.parse(win.localStorage.getItem('names') || '{}');
  assert.ok(Object.values(기억).includes('AB12 어느점'), '고친 이름을 기억하지 않았습니다');
});

test('가져오기 버튼이 캘린더 탭에도 있다', { skip }, async () => {
  const { doc } = openApp();
  await wait();

  for (const tab of ['calendar', 'list']) {
    const screen = doc.getElementById('screen-' + tab);
    assert.ok(screen.querySelector('[data-import="shot"]'), `${tab} 탭에 사진 버튼이 없습니다`);
    assert.ok(screen.querySelector('[data-import="paste"]'), `${tab} 탭에 붙여넣기 버튼이 없습니다`);
  }

  // 어느 탭에서 눌러도 같은 창이 떠야 한다
  patchDom(doc);
  doc.querySelector('#screen-calendar [data-import="paste"]').click();
  assert.equal(doc.getElementById('dlg-paste').hasAttribute('open'), true, '캘린더에서 안 열립니다');
});

/**
 * 세 번째 화면(카드 명세서)을 글자 인식에 통과시켜 나온 그대로.
 * 앞의 둘과 형식이 아주 다르다 — 날짜가 '26. 8. 30 (일)', 금액에 부호가 없고,
 * 한 건마다 결제 방식·적립 안내가 딸려 있다. 위아래로 화면 안내도 섞여 있다.
 */
const 명세서화면 = `10월 5일 명세서
o
471,150H
결제 = tol - 594 0008 (©)
간편결제 내역 자세히 보려면?            상세 정보 보기 >
26. 8. 30 (일)
가게하나                                  20,000원
일시불 ㆍ어느카드 300
적립 예정 20(0.1%)
가게둘                                               20,000원
일시불 ㆍ어느카드 300
적립 예정 20(0.1%)
26. 8. 29 (토)
가게셋                                  53,450원
일시불 ㆍ어느카드 300
적립 예정 53(0.19%)
분할결제 신청하기 >
26. 8. 28 (금)
가게넷                                        297,000원
무이자 할부(1/3) ㆍ어느카드 300
이용 금액 891,000원
분할결제 신청하기 >
가게다섯                               38,000원
일시불 ㆍ어느카드 300
적립 예정 114(0.396)
최근순 고액순                                 = Q
가게다섯                               15,000원
일시불ㆍ어느카드 300
적립 예정 45(0.39%)
26. 8. 25 (화)
가게여섯                              14,700
LAE ㆍ어느카드 300
적립 예정 15(0.19%)
가게일곱                                       13,000원
일시불ㆍ어느카드 300
적립 예정 13(0.19%)
이용 내역                         이용 내역
이미지로 저장             인쇄하기
가장 쉬운 소비 관리의 시작
명세서 이용 안내 >
oi 위로 1`;

test('카드 명세서 형식도 여덟 건을 모두 찾는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(명세서화면, 2026);
  const 뽑은것 = JSON.parse(JSON.stringify(rows.map((r) => [r.date, r.amount])));

  assert.deepEqual(뽑은것, [
    ['2026-08-30', 20000],
    ['2026-08-30', 20000],
    ['2026-08-29', 53450],
    ['2026-08-28', 297000],
    ['2026-08-28', 38000],
    ['2026-08-28', 15000],
    ['2026-08-25', 14700],
    ['2026-08-25', 13000],
  ]);
});

test("'26. 8. 30' 같은 날짜도 읽는다", { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  // 맨 위 '10월 5일 명세서'는 결제일 안내지 거래 날짜가 아니다. 이걸 날짜로 쓰면
  // 여덟 건이 전부 10월 5일이 된다.
  const rows = win.parseBankText(명세서화면, 2026);
  assert.ok(!rows.some((r) => r.date === '2026-10-05'), '맨 위 결제일을 날짜로 썼습니다');
  assert.equal(rows[0].date, '2026-08-30');
});

test('결제 방식·적립·총액 줄은 내역으로 세지 않는다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const rows = win.parseBankText(명세서화면, 2026);
  // 891,000원(할부 총액), 471,150원(청구액), 594,000원(잔액)이 섞이면 안 된다
  [891000, 471150, 594000].forEach((n) => {
    assert.ok(!rows.some((r) => r.amount === n), `내역이 아닌 금액이 들어왔습니다: ${n}`);
  });
  // 이름에도 붙으면 안 된다
  assert.ok(!rows.some((r) => /일시불|적립|할부|이용 금액|최근순/.test(r.memo)),
    '이름에 안내 문구가 붙었습니다: ' + rows.map((r) => r.memo).join(' | '));
});

test('가게 이름이 그대로 나온다', { skip }, async () => {
  const { win } = openApp();
  await wait(200);

  const 이름 = JSON.parse(JSON.stringify(
    win.parseBankText(명세서화면, 2026).map((r) => r.memo)));
  assert.deepEqual(이름, [
    '가게하나', '가게둘', '가게셋', '가게넷', '가게다섯', '가게다섯', '가게여섯', '가게일곱',
  ]);
});
