/* 함께 쓰는 가계부 — 화면 담당 (구글 시트 버전) */

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

/* ------------------------------------------------------------------ */
/* 픽토그램                                                             */
/* viewBox 24×24, 선으로만 그린다. 카테고리는 이 열쇠말만 저장한다.        */
/* ------------------------------------------------------------------ */

var ICONS = {
  food:   '<path d="M3.5 11h17c0 4.7-3.8 8.5-8.5 8.5S3.5 15.7 3.5 11z"/><path d="M9 4.2c0 1.5-1.1 1.5-1.1 3M13 3.4c0 1.7-1.1 1.7-1.1 3.4"/>',
  cafe:   '<path d="M5 8h11v5.5A5.5 5.5 0 0 1 10.5 19h0A5.5 5.5 0 0 1 5 13.5V8z"/><path d="M16 9.5h1.8a2.4 2.4 0 0 1 0 4.8H16"/><path d="M4 21.5h13"/>',
  market: '<path d="M4 8h16l-1.3 10.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8L4 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cart:   '<path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 7H6"/><circle cx="9.5" cy="19.5" r="1.6"/><circle cx="17" cy="19.5" r="1.6"/>',
  bus:    '<rect x="4" y="4.5" width="16" height="12" rx="3"/><path d="M4 10.5h16"/><path d="M7 20v-3.5M17 20v-3.5"/><path d="M7.6 13.6h.01M16.4 13.6h.01"/>',
  car:    '<path d="M4.5 14.5h15V12l-1.8-4a2 2 0 0 0-1.8-1.2H8.1a2 2 0 0 0-1.8 1.2L4.5 12v2.5z"/><path d="M4.5 11.5h15"/><circle cx="8" cy="17" r="1.9"/><circle cx="16" cy="17" r="1.9"/>',
  ticket: '<path d="M4 9V7.5h16V9a3 3 0 0 0 0 6v1.5H4V15a3 3 0 0 0 0-6z"/>',
  art:    '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.7-.7 1.7-1.6 0-.9-.8-1.5-.8-2.4 0-.8.7-1.5 1.5-1.5h1.4A5.2 5.2 0 0 0 21 9.8c0-3.6-4-6.3-9-6.3z"/><path d="M8 11h.01M12 8.2h.01M16 11h.01"/>',
  gym:    '<path d="M6.5 8.5v7M4 10.5v3M17.5 8.5v7M20 10.5v3M6.5 12h11"/>',
  health: '<rect x="3.5" y="9.5" width="17" height="5" rx="2.5"/><path d="M9.5 12h.01M12 12h.01M14.5 12h.01"/>',
  pill:   '<rect x="3.5" y="7" width="17" height="10" rx="5"/><path d="M12 7v10"/>',
  tooth:  '<path d="M7.5 3.6c-2 0-3.5 1.6-3.5 4 0 3.4 1.4 4.4 1.9 8.2.3 2.4.7 4.2 1.9 4.2 1.4 0 1.4-2.2 2.3-4.6.4-1 .9-1.4 1.9-1.4s1.5.4 1.9 1.4c.9 2.4.9 4.6 2.3 4.6 1.2 0 1.6-1.8 1.9-4.2.5-3.8 1.9-4.8 1.9-8.2 0-2.4-1.5-4-3.5-4-1.6 0-2.3.8-4.5.8s-2.9-.8-4.5-.8z"/>',
  box:    '<path d="M4 8.3l8-3.8 8 3.8v7.4l-8 3.8-8-3.8V8.3z"/><path d="M4 8.3l8 3.8 8-3.8M12 12.1v7.4"/>',
  shirt:  '<path d="M9 4L4.5 6l1.6 4L8.5 9v10.5h7V9l2.4 1L19.5 6 15 4a3 3 0 0 1-6 0z"/>',
  beauty: '<circle cx="6.5" cy="18" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="M8.2 16.3L18.5 4.5M15.8 16.3L5.5 4.5"/>',
  phone:  '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>',
  home:   '<path d="M4 10.3L12 4l8 6.3v8.2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-8.2z"/><path d="M9.8 20v-5.8h4.4V20"/>',
  bolt:   '<path d="M13.5 2.5L5 13.5h6l-.5 8L19 10.5h-6l.5-8z"/>',
  paw:    '<circle cx="7.4" cy="8.4" r="1.9"/><circle cx="12" cy="6.7" r="1.9"/><circle cx="16.6" cy="8.4" r="1.9"/><path d="M12 12.4c-3.1 0-5 2.1-5 4.3 0 1.7 1.3 2.4 2.7 2.4 1 0 1.5-.4 2.3-.4s1.3.4 2.3.4c1.4 0 2.7-.7 2.7-2.4 0-2.2-1.9-4.3-5-4.3z"/>',
  book:   '<path d="M5 4.5h9.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12z"/><path d="M5 16.5a3 3 0 0 1 3-3h9.5"/>',
  play:   '<circle cx="12" cy="12" r="8.5"/><path d="M10.3 8.8l5 3.2-5 3.2V8.8z"/>',
  music:  '<path d="M9 17.5V6.2l9-1.7v11"/><circle cx="6.5" cy="17.8" r="2.5"/><circle cx="15.5" cy="15.5" r="2.5"/>',
  game:   '<rect x="2.5" y="7.5" width="19" height="9" rx="4.5"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="16" cy="11" r="1"/><circle cx="18.5" cy="13.5" r="1"/>',
  camera: '<rect x="3" y="7" width="18" height="12.5" rx="3"/><circle cx="12" cy="13.2" r="3.4"/><path d="M8.5 7l1.3-2.5h4.4L15.5 7"/>',
  plane:  '<path d="M10.5 21l1.5-6 8.5-2.5c1-.3 1-1.7 0-2L4.5 5.5c-1-.3-1.7.9-1 1.6L8 11.5"/><path d="M8 11.5l-3.5 1.7c-.9.4-.8 1.7.2 2l3.8.8"/>',
  gift:   '<rect x="3.5" y="9" width="17" height="11.5" rx="2.5"/><path d="M2.5 9h19M12 9v11.5"/><path d="M12 9c-1.5-3.5-2.8-5-4.2-5a2.2 2.2 0 0 0 0 4.4M12 9c1.5-3.5 2.8-5 4.2-5a2.2 2.2 0 0 1 0 4.4"/>',
  heart:  '<path d="M12 20s-7.5-4.6-7.5-9.5A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  doc:    '<path d="M6 3.5h7.5L18 8v12.5H6z"/><path d="M13.5 3.5V8H18"/><path d="M9 12.5h6M9 16h4"/>',
  money:  '<rect x="3" y="6" width="18" height="12" rx="4"/><circle cx="12" cy="12" r="2.7"/><path d="M6.5 12h.01M17.5 12h.01"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11.8a1.7 1.7 0 0 1 1.7 1.7V8"/><rect x="4" y="7.5" width="16" height="11.5" rx="2.5"/><circle cx="16.2" cy="13.2" r="1.3"/>',
  star:   '<path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9L12 3.5z"/>',
  coins:  '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  piggy:  '<path d="M4 12.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6c0 1.6-.7 3-1.8 4.1V19h-2.4l-.6-1.3c-.9.2-1.8.3-2.7.3s-1.8-.1-2.7-.3L8.2 19H5.8v-2.4C4.7 15.5 4 14.1 4 12.5z"/><path d="M4 11.5H2.8M15 10.5h.01"/>',
  refund: '<path d="M4 12a8 8 0 1 1 2.4 5.7"/><path d="M4 6.5V12h5.5"/>',
  tag:    '<path d="M11 3.5H20v9l-8.7 8.7a1.6 1.6 0 0 1-2.3 0L3.5 15.7a1.6 1.6 0 0 1 0-2.3L11 3.5z"/><circle cx="16.3" cy="7.7" r="1.4"/>',
  dots:   '<circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/>'
};

var ICON_KEYS = Object.keys(ICONS);

function iconSvg(key, size, stroke, weight) {
  var body = ICONS[key] || ICONS.dots;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' +
    escapeAttr(stroke) + '" stroke-width="' + (weight || 2) +
    '" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}

/* 카테고리 색 하나로 배경(연하게)과 선(진하게)을 만든다. */
function mixHex(hex, target, amount) {
  var h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var c = parseInt(h.substr(i * 2, 2), 16);
    var v = Math.round(c + (target - c) * amount);
    out += ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
  }
  return out;
}
var tintOf = function (hex) { return mixHex(hex, 255, 0.74); };
var inkOf = function (hex) { return mixHex(hex, 0, 0.3); };

/** 픽토그램 한 칸 */
function picHtml(icon, color, cls, size) {
  return '<span class="pic ' + (cls || '') + '" style="background: ' + escapeAttr(tintOf(color)) + '">' +
    iconSvg(icon, size || 21, inkOf(color), 2.1) + '</span>';
}

/* ------------------------------------------------------------------ */
/* 상태                                                                */
/* ------------------------------------------------------------------ */

var state = {
  me: null, members: [], groups: [], categories: [],
  month: '', range: null, settings: { startDay: 1 },
  scope: 'all', tab: 'calendar', selectedDate: null,
  summary: null, transactions: [],
  editingTx: null, txKind: 'expense', txCategoryId: null,
  catKind: 'expense', newCatIcon: 'dots', newCatGroup: null,
  iconTarget: null, groupTarget: null, openGroups: {},
  busy: 0
};

/* ------------------------------------------------------------------ */
/* 서버 호출                                                            */
/* ------------------------------------------------------------------ */

/**
 * 구글 시트 쪽에 일을 시킨다.
 *
 * 로그인할 때 구글이 준 증명서를 늘 같이 보낸다. 서버는 그걸 구글에 확인해서
 * 누구인지 알아내고, 가계부를 공유받은 사람인지 본 다음에야 일을 해준다.
 */
function call(fn) {
  var args = Array.prototype.slice.call(arguments, 1);

  if (!CONFIG.apiUrl) {
    return Promise.reject(new Error('config.js 의 apiUrl 이 비어 있습니다.'));
  }

  return fetch(CONFIG.apiUrl, {
    method: 'POST',
    // text/plain 이라야 브라우저가 서버에 미리 묻지 않는다.
    // 앱스 스크립트는 그 물음(preflight)에 답할 줄 몰라서, 다른 형식이면 막힌다.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args, token: auth.token })
  })
    .then(function (res) {
      if (!res.ok) throw new Error('서버가 응답하지 않습니다. (' + res.status + ')');
      return res.json();
    })
    .then(function (out) {
      if (out && out.error) {
        if (out.needSignIn) {
          keepToken('');
          // 초대 명단 문제면 다시 받아봐야 소용없다
          if (!/초대되지/.test(out.error)) {
            silentSignIn(function () { signOut(out.error); });
          } else {
            signOut(out.error);
          }
        }
        throw new Error(out.error);
      }
      return out ? out.result : null;
    })
    .catch(function (err) {
      if (err instanceof TypeError) throw new Error('인터넷 연결을 확인해 주세요.');
      throw err;
    });
}

/* ------------------------------------------------------------------ */
/* 로그인                                                              */
/* ------------------------------------------------------------------ */

var auth = { token: '', ready: false };

/**
 * 구글이 준 증명서를 이 기기에 보관한다.
 *
 * 앱을 껐다 켜도 남아 있어야 매번 로그인하지 않는다. 증명서는 한 시간쯤 지나면
 * 만료되는데, 그때는 구글에게 조용히 새로 받아온다(아래 silentSignIn).
 */
function keepToken(token) {
  auth.token = token || '';
  try {
    if (token) localStorage.setItem('idt', token);
    else localStorage.removeItem('idt');
  } catch (e) {
    // 저장을 못 해도 이번 방문에는 쓸 수 있다
  }
}

function loadToken() {
  try {
    auth.token = localStorage.getItem('idt') || '';
  } catch (e) {
    auth.token = '';
  }
  if (auth.token && expired(auth.token)) keepToken('');
  return auth.token;
}

/**
 * 증명서에 적힌 만료 시각이 지났는지 본다.
 *
 * 서명을 확인하는 게 아니라 언제까지 쓸 수 있는지만 읽는 것이다. 진짜 검사는
 * 서버가 구글에 물어서 한다. 여기서는 '이미 지난 걸 굳이 보내지 말자'는 정도다.
 */
function expired(token) {
  try {
    var body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var exp = Number(JSON.parse(atob(body)).exp) || 0;
    return exp * 1000 < Date.now() + 60000;   // 1분 남았으면 만료로 친다
  } catch (e) {
    return true;
  }
}

/** 로그인 화면으로 돌아간다. */
function signOut(why) {
  keepToken('');
  $('#loading').hidden = true;
  $('#screens').hidden = true;
  $('#header').hidden = true;
  $('#tabbar').hidden = true;
  $('#btn-add').hidden = true;
  $('#signin-note').textContent = why || '';
  $('#signin').hidden = false;
  showGoogleButton();
}

/**
 * 구글에게 조용히 증명서를 다시 받아본다.
 *
 * 이미 이 기기에서 로그인한 적이 있으면 구글이 묻지 않고 바로 내준다. 그래서
 * 대개는 로그인 화면을 볼 일이 없다. 안 되면 시간 안에 답이 없으니, 그때만
 * 로그인 화면을 보여준다.
 */
function silentSignIn(onFail) {
  if (!CONFIG.clientId || !window.google || !google.accounts || !google.accounts.id) {
    onFail();
    return;
  }
  initGoogle();

  var settled = false;
  auth.silent = function (token) {
    if (settled) return;
    settled = true;
    auth.silent = null;
    onSignedIn(token);
  };
  setTimeout(function () {
    if (settled) return;
    settled = true;
    auth.silent = null;
    onFail();
  }, 3000);

  function giveUp() {
    if (settled) return;
    settled = true;
    auth.silent = null;
    onFail();
  }

  try {
    // 구글이 '못 내주겠다'고 알려주면 3초를 기다리지 않고 바로 로그인 화면으로
    google.accounts.id.prompt(function (n) {
      if (!n) return;
      var no = (n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment());
      if (no) giveUp();
    });
  } catch (e) {
    giveUp();
  }
}

function busy(on) {
  state.busy += on ? 1 : -1;
  if (state.busy < 0) state.busy = 0;
  $('#busy').hidden = state.busy === 0;
  $('#screens').classList.toggle('is-busy', state.busy > 0);
}

function withBusy(p) {
  busy(true);
  return p.then(function (v) { busy(false); return v; }, function (e) { busy(false); throw e; });
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */

function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }

function signed(n) {
  n = Number(n || 0);
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ko-KR');
}

function shortNum(n) {
  n = Math.abs(Number(n || 0));
  if (n >= 10000000) return Math.round(n / 1000000) / 10 + '천만';
  if (n >= 10000) return Math.round(n / 1000) / 10 + '만';
  if (n >= 1000) return Math.round(n / 100) / 10 + '천';
  return String(n);
}

function monthLabel(m) { var p = m.split('-'); return p[0] + '년 ' + Number(p[1]) + '월'; }

function shiftMonth(m, d) {
  var p = m.split('-').map(Number);
  var x = new Date(p[0], p[1] - 1 + d, 1);
  return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2);
}

var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function dowOf(iso) { var p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).getDay(); }
function dayLabel(iso) { var p = iso.split('-').map(Number); return p[1] + '월 ' + p[2] + '일 ' + WEEK[dowOf(iso)] + '요일'; }

function addDaysIso(iso, delta) {
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2] + delta);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function todayIso() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function inRange(iso) { return !!state.range && iso >= state.range.from && iso <= state.range.to; }

function rangeLabel() {
  if (!state.range) return '';
  var f = state.range.from.split('-'), t = state.range.to.split('-');
  return Number(f[1]) + '.' + Number(f[2]) + ' ~ ' + Number(t[1]) + '.' + Number(t[2]);
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
var escapeAttr = escapeHtml;

function showError(el, msg) {
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.textContent = msg;
  el.hidden = false;
}

var toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  var old = $('.toast');
  if (old) old.parentNode.removeChild(old);
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
}

function memberName(email) {
  for (var i = 0; i < state.members.length; i++) {
    if (state.members[i].email === email) return state.members[i].name;
  }
  return String(email || '').split('@')[0];
}

function visibleTx() {
  return state.transactions.filter(function (t) {
    return state.scope === 'all' || t.userEmail === state.scope;
  });
}

function categoryById(id) {
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].id === id) return state.categories[i];
  }
  return null;
}

function categoryIdOf(kind, name) {
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].kind === kind && state.categories[i].name === name) return state.categories[i].id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 탭                                                                  */
/* ------------------------------------------------------------------ */

var TABS = ['calendar', 'list', 'stats', 'settings'];

function showTab(tab) {
  state.tab = tab;
  TABS.forEach(function (t) { $('#screen-' + t).hidden = t !== tab; });
  $$('#tabbar button').forEach(function (b) {
    b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
  });
  var isSettings = tab === 'settings';
  $('#header').hidden = isSettings;
  $('#btn-add').hidden = isSettings;
  if (isSettings) renderSettings();
  $('#screens').scrollTop = 0;
}

$$('#tabbar button').forEach(function (btn) {
  btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
});

/* ------------------------------------------------------------------ */
/* 데이터 반영                                                          */
/* ------------------------------------------------------------------ */

function apply(data) {
  var monthChanged = state.month !== data.month;

  state.month = data.month;
  if (data.range) state.range = data.range;
  if (data.settings) state.settings = data.settings;
  state.transactions = data.transactions;
  state.summary = data.summary;
  if (data.groups) state.groups = data.groups;
  if (data.categories) state.categories = data.categories;
  if (data.members) state.members = data.members;
  if (data.me) state.me = data.me;

  var known = state.members.some(function (m) { return m.email === state.scope; });
  if (state.scope !== 'all' && !known) state.scope = 'all';

  if (monthChanged || !state.selectedDate || !inRange(state.selectedDate)) {
    var today = todayIso();
    state.selectedDate = inRange(today) ? today : null;
  }

  $('#month-label').textContent = monthLabel(state.month);
  $('#range-label').textContent = state.settings.startDay > 1 ? rangeLabel() : '';
  renderScopeTabs();
  renderHero();
  renderCalendar();
  renderDayPanel();
  renderTransactions();
  renderStats();
  if (state.tab === 'settings') renderSettings();
}

function loadMonth(month) { return withBusy(call('getMonthData', month)).then(apply); }

/* ------------------------------------------------------------------ */
/* 상단                                                                */
/* ------------------------------------------------------------------ */

function renderScopeTabs() {
  var box = $('#scope-tabs');
  box.innerHTML = '';
  var opts = [{ id: 'all', label: '둘이 합쳐' }];
  state.members.forEach(function (m) { opts.push({ id: m.email, label: m.name }); });

  opts.forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jua';
    b.textContent = o.label;
    b.setAttribute('aria-selected', String(state.scope === o.id));
    b.addEventListener('click', function () {
      state.scope = o.id;
      renderScopeTabs(); renderHero(); renderCalendar(); renderDayPanel();
      renderTransactions(); renderStats();
    });
    box.appendChild(b);
  });
}

function scopedTotals() {
  if (state.scope === 'all') return state.summary.total;
  for (var i = 0; i < state.summary.byMember.length; i++) {
    if (state.summary.byMember[i].email === state.scope) return state.summary.byMember[i];
  }
  return { income: 0, expense: 0, balance: 0 };
}

function renderHero() {
  var t = scopedTotals();
  var balance = t.income - t.expense;
  $('#stat-balance').textContent = signed(balance);
  $('#stat-income').textContent = '＋' + num(t.income);
  $('#stat-expense').textContent = '－' + num(t.expense);
  $('#stat-balance-label').textContent =
    state.scope === 'all' ? '둘이 합쳐 남은 돈' : memberName(state.scope) + ' 님 남은 돈';
}

$('#btn-prev-month').addEventListener('click', function () {
  loadMonth(shiftMonth(state.month, -1))['catch'](function (e) { toast(e.message); });
});
$('#btn-next-month').addEventListener('click', function () {
  loadMonth(shiftMonth(state.month, 1))['catch'](function (e) { toast(e.message); });
});
$('#btn-reload').addEventListener('click', function () {
  withBusy(call('getBootstrap', state.month)).then(function (d) {
    apply(d); toast('최신 내역을 가져왔어요');
  })['catch'](function (e) { toast(e.message); });
});

/* ------------------------------------------------------------------ */
/* 캘린더                                                              */
/* ------------------------------------------------------------------ */

/** 날짜별 합계와 그날 가장 큰 내역의 카테고리 */
function dailyInfo() {
  var map = {};
  visibleTx().forEach(function (t) {
    var d = map[t.date];
    if (!d) { d = map[t.date] = { income: 0, expense: 0, top: null, topAmount: 0 }; }
    d[t.kind] += t.amount;
    if (t.amount > d.topAmount) {
      d.topAmount = t.amount;
      d.top = { icon: t.categoryIcon, color: t.categoryColor };
    }
  });
  return map;
}

function renderCalendar() {
  var grid = $('#cal-grid');
  grid.innerHTML = '';
  if (!state.range) return;

  var info = dailyInfo();
  var today = todayIso();
  var first = state.range.from.split('-').map(Number);
  var firstDow = new Date(first[0], first[1] - 1, first[2]).getDay();

  for (var b = 0; b < firstDow; b++) {
    var blank = document.createElement('div');
    blank.className = 'cal-cell blank';
    grid.appendChild(blank);
  }

  var iso = state.range.from;
  var dow = firstDow;
  var guard = 0;
  while (iso <= state.range.to && guard++ < 40) {
    (function (dateIso, weekday) {
      var parts = dateIso.split('-').map(Number);
      var day = parts[2];
      var isMonthStart = day === 1;
      var sum = info[dateIso];

      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell' +
        (weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : '') +
        (dateIso === today ? ' today' : '') +
        (isMonthStart ? ' month-start' : '') +
        (sum ? ' has' : '');
      cell.setAttribute('aria-selected', String(state.selectedDate === dateIso));

      var html = '<span class="dnum jua">' + (isMonthStart ? parts[1] + '/1' : day) + '</span>';
      if (sum && sum.top) {
        html += '<span style="line-height:0">' + iconSvg(sum.top.icon, 15, inkOf(sum.top.color), 2.3) + '</span>';
      }
      if (sum && sum.income) html += '<span class="cash income-text">+' + shortNum(sum.income) + '</span>';
      if (sum && sum.expense) html += '<span class="cash expense-text">−' + shortNum(sum.expense) + '</span>';
      cell.innerHTML = html;

      cell.addEventListener('click', function () {
        state.selectedDate = state.selectedDate === dateIso ? null : dateIso;
        renderCalendar(); renderDayPanel();
      });
      grid.appendChild(cell);
    })(iso, dow);

    iso = addDaysIso(iso, 1);
    dow = (dow + 1) % 7;
  }
}

function renderDayPanel() {
  var title = $('#day-panel-title'), sumEl = $('#day-panel-sum'), body = $('#day-panel-body');
  body.innerHTML = '';

  if (!state.selectedDate) {
    title.textContent = '날짜를 눌러보세요';
    sumEl.textContent = '';
    body.innerHTML = '<div class="card empty">날짜를 고르면 그날 쓴 게 여기 나와요</div>';
    return;
  }

  var items = visibleTx().filter(function (t) { return t.date === state.selectedDate; });
  title.textContent = dayLabel(state.selectedDate);

  var income = 0, expense = 0;
  items.forEach(function (t) { if (t.kind === 'income') income += t.amount; else expense += t.amount; });
  sumEl.innerHTML =
    (income ? '<span class="income-text">+' + num(income) + '</span> ' : '') +
    (expense ? '<span class="expense-text">−' + num(expense) + '</span>' : '') ||
    '<span class="muted">기록 없음</span>';

  if (!items.length) {
    body.innerHTML = '<div class="card empty">이날은 기록이 없어요<br />아래 버튼으로 남겨보세요</div>';
    return;
  }
  body.appendChild(txListCard(items));
}

/* ------------------------------------------------------------------ */
/* 내역                                                                */
/* ------------------------------------------------------------------ */

function txListCard(items) {
  var box = document.createElement('div');
  box.className = 'tx-list';
  items.forEach(function (t) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tx';
    btn.innerHTML =
      picHtml(t.categoryIcon, t.categoryColor) +
      '<span style="min-width:0">' +
        '<div class="title">' + escapeHtml(t.memo || t.categoryName) + '</div>' +
        '<div class="sub">' + escapeHtml(t.categoryName) + ' · ' + escapeHtml(t.userName) + '</div>' +
      '</span>' +
      '<span class="val amt ' + (t.kind === 'income' ? 'income-text' : 'expense-text') + '">' +
        (t.kind === 'income' ? '+' : '−') + num(t.amount) + '</span>';
    btn.addEventListener('click', function () { openTxModal(t); });
    box.appendChild(btn);
  });
  return box;
}

function renderTransactions() {
  var box = $('#tx-groups');
  box.innerHTML = '';

  var list = visibleTx();
  if (!list.length) {
    box.innerHTML = '<div class="card empty">이번 달 기록이 아직 없어요<br />아래 버튼으로 첫 기록을 남겨보세요</div>';
    return;
  }

  var days = [], byDay = {};
  list.forEach(function (t) {
    if (!byDay[t.date]) { byDay[t.date] = []; days.push(t.date); }
    byDay[t.date].push(t);
  });

  days.forEach(function (date) {
    var items = byDay[date];
    var income = 0, expense = 0;
    items.forEach(function (t) { if (t.kind === 'income') income += t.amount; else expense += t.amount; });

    var group = document.createElement('div');
    group.className = 'tx-day';

    var head = document.createElement('div');
    head.className = 'tx-day-head';
    head.innerHTML = '<span class="jua" style="font-size:13.5px">' + dayLabel(date) + '</span>' +
      '<span class="amt small" style="font-weight:700">' +
      (income ? '<span class="income-text">+' + num(income) + '</span> ' : '') +
      (expense ? '<span class="expense-text">−' + num(expense) + '</span>' : '') + '</span>';

    group.appendChild(head);
    group.appendChild(txListCard(items));
    box.appendChild(group);
  });
}

/* ------------------------------------------------------------------ */
/* 분석                                                                */
/* ------------------------------------------------------------------ */

function renderStats() {
  var splits = $('#member-splits');
  splits.innerHTML = '';
  state.summary.byMember.forEach(function (m) {
    var row = document.createElement('div');
    row.className = 'member-split';
    row.innerHTML =
      '<div class="name jua">' + escapeHtml(m.name) + '</div>' +
      '<div class="amt" style="font-weight:700; color: ' + (m.balance < 0 ? 'var(--expense)' : 'var(--income)') + '">' +
        signed(m.balance) + '원</div>' +
      '<div class="nums muted amt"><span>수입 ' + won(m.income) + '</span><span>지출 ' + won(m.expense) + '</span></div>';
    splits.appendChild(row);
  });

  ['expense', 'income'].forEach(function (kind) {
    var box = $('#bars-' + kind);
    box.innerHTML = '';

    var groups = pickForScope(state.summary.byGroup.filter(function (g) { return g.kind === kind; }));
    var sum = groups.reduce(function (a, g) { return a + g.total; }, 0);
    if (!sum) {
      box.innerHTML = '<div class="empty">이번 달 ' + (kind === 'expense' ? '지출' : '수입') + ' 기록이 없어요</div>';
      return;
    }

    groups.forEach(function (g) {
      var pct = Math.round((g.total / sum) * 100);
      var key = kind + ':' + g.name;
      var open = !!state.openGroups[key];

      var subs = pickForScope(state.summary.byCategory.filter(function (c) {
        return c.kind === kind && c.group === g.name;
      }));

      var row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML =
        '<div class="bar-head">' +
          '<span class="bar-name">' +
            '<span class="grp-dot" style="background:' + escapeAttr(g.color) + '"></span>' +
            '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">' + escapeHtml(g.name) + '</span>' +
            '<span class="small muted" style="font-weight:700">' + subs.length + '</span>' +
            '<span class="caret' + (open ? ' open' : '') + '">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
            '</span>' +
          '</span>' +
          '<span class="amt" style="white-space:nowrap"><strong>' + won(g.total) + '</strong> ' +
            '<span class="muted small">' + pct + '%</span></span>' +
        '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%; background:' + escapeAttr(g.color) + '"></div></div>';

      row.querySelector('.bar-head').style.cursor = 'pointer';
      row.querySelector('.bar-head').addEventListener('click', function () {
        state.openGroups[key] = !open;
        renderStats();
      });

      if (open) {
        var subBox = document.createElement('div');
        subBox.className = 'sub-list';
        subs.forEach(function (c) {
          var spct = Math.round((c.total / g.total) * 100);
          var line = document.createElement('div');
          line.className = 'sub-row';
          line.innerHTML =
            picHtml(c.icon, c.color, 'pic-sm', 13) +
            '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">' + escapeHtml(c.name) + '</span>' +
            '<span class="amt" style="white-space:nowrap">' + won(c.total) +
              ' <span class="muted">' + spct + '%</span></span>';
          subBox.appendChild(line);
        });
        if (state.scope === 'all' && state.members.length > 1) {
          var per = document.createElement('div');
          per.className = 'per-user amt';
          per.textContent = state.members.map(function (m) {
            return m.name + ' ' + won(g.perUser[m.email] || 0);
          }).join(' · ');
          subBox.appendChild(per);
        }
        row.appendChild(subBox);
      }
      box.appendChild(row);
    });
  });
}

/** 합산이면 그대로, 한 사람만 보면 그 사람 몫으로 다시 계산한다. */
function pickForScope(rows) {
  if (state.scope === 'all') return rows.slice().sort(function (a, b) { return b.total - a.total; });
  return rows.map(function (r) {
    var copy = {};
    for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) copy[k] = r[k];
    copy.total = r.perUser[state.scope] || 0;
    return copy;
  }).filter(function (r) { return r.total > 0; })
    .sort(function (a, b) { return b.total - a.total; });
}

/* ------------------------------------------------------------------ */
/* 화면 테마                                                            */
/* ------------------------------------------------------------------ */

/**
 * 밝게 / 어둡게.
 *
 * 시트가 아니라 이 기기에만 기억한다. 둘이 한 가계부를 쓰지만 화면 취향까지
 * 같을 이유는 없고, 한쪽이 바꿨다고 상대 화면이 따라 바뀌면 곤란하다.
 */
var THEME_KEY = 'theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setTheme(name) {
  if (name === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.setItem(THEME_KEY, name === 'dark' ? 'dark' : 'light');
  } catch (e) {
    // 저장을 못 해도 이번 화면에는 적용된다
  }
  renderTheme();
}

function renderTheme() {
  var now = currentTheme();
  $$('[data-theme-choice]').forEach(function (b) {
    b.setAttribute('aria-selected', b.getAttribute('data-theme-choice') === now ? 'true' : 'false');
  });
}

$$('[data-theme-choice]').forEach(function (b) {
  b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-choice')); });
});

/* ------------------------------------------------------------------ */
/* 설정                                                                */
/* ------------------------------------------------------------------ */

function renderSettings() {
  renderTheme();
  // 지금 무슨 판이 돌고 있는지 눈으로 확인할 수 있게. 고쳤는데 그대로면 옛 파일이다.
  $('#app-version').textContent = '판 ' + (typeof APP_VERSION === 'undefined' ? '?' : APP_VERSION);
  renderStartDay();
  if (state.me) {
    $('#set-my-name').textContent = state.me.name;
    $('#set-my-email').textContent = state.me.email;
  }
  renderMembers();
  renderCatSeg();
  renderGroupList();
  renderCatList();
  renderAddForm();
}

function renderStartDay() {
  var sel = $('#set-start-day');
  if (!sel.options.length) {
    var html = '';
    for (var d = 1; d <= 31; d++) {
      html += '<option value="' + d + '">' + d + '일' + (d === 1 ? ' (달력과 같음)' : '') + '</option>';
    }
    sel.innerHTML = html;
    sel.addEventListener('change', saveStartDay);
  }
  sel.value = String(state.settings.startDay);

  var note = $('#start-day-note');
  if (state.settings.startDay <= 1) {
    note.innerHTML = '지금은 <b>달력 그대로</b>예요. 8월은 8월 1일 ~ 8월 31일.<br />' +
      '월급날이 24일이면 <b>24일</b>로 바꿔보세요.';
  } else {
    note.innerHTML = '<b>' + state.settings.startDay + '일</b>부터 한 달로 세요.<br />' +
      '지금 보는 <b>' + monthLabel(state.month) + '</b>은 <b>' + rangeLabel() + '</b>.<br />' +
      '<span class="muted">지난 기록은 그대로 있고 묶는 기준만 바뀌어요.</span>';
  }
}

function saveStartDay() {
  var value = Number($('#set-start-day').value);
  withBusy(call('updateSettings', { startDay: value, month: state.month }))
    .then(function (d) { apply(d); toast(value <= 1 ? '달력 기준으로 바꿨어요' : value + '일 시작으로 바꿨어요'); })
    ['catch'](function (e) { toast(e.message); $('#set-start-day').value = String(state.settings.startDay); });
}

function renderMembers() {
  var box = $('#member-list');
  box.innerHTML = '';
  state.members.forEach(function (m) {
    var isMe = state.me && m.email === state.me.email;
    var row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML =
      '<div style="min-width:0"><div style="font-weight:700">' + escapeHtml(m.name) +
        (isMe ? ' <span class="small muted">나</span>' : '') +
        (m.pending ? ' <span class="small muted">(앱 접속 전)</span>' : '') + '</div>' +
      '<div class="small muted" style="font-weight:600">' + escapeHtml(m.email) + '</div></div>';
    box.appendChild(row);
  });
}

$('#btn-rename-me').addEventListener('click', function () {
  var name = prompt('가계부에 보여줄 이름', state.me ? state.me.name : '');
  if (!name || !name.trim()) return;
  withBusy(call('renameMe', name.trim()))
    .then(function () { return withBusy(call('getBootstrap', state.month)); })
    .then(function (d) { apply(d); toast('이름을 바꿨어요'); })
    ['catch'](function (e) { toast(e.message); });
});

function renderCatSeg() {
  $$('#cat-kind-seg button').forEach(function (b) {
    b.setAttribute('aria-selected', String(b.getAttribute('data-kind') === state.catKind));
  });
}

$$('#cat-kind-seg button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.catKind = btn.getAttribute('data-kind');
    state.newCatGroup = null;
    renderCatSeg(); renderGroupList(); renderCatList(); renderAddForm();
  });
});

/** 대분류와 소분류는 한 번에 돌아오므로 함께 갈아끼운다. */
function catAction(promise) {
  showError($('#cat-error'), '');
  return withBusy(promise)
    .then(function (res) {
      if (res.groups) state.groups = res.groups;
      state.categories = res.categories;
      renderGroupList(); renderCatList(); renderAddForm();
      return withBusy(call('getMonthData', state.month)).then(apply);
    })
    ['catch'](function (err) { showError($('#cat-error'), err.message); });
}

function groupsOfKind() {
  return state.groups.filter(function (g) { return g.kind === state.catKind; });
}

function subsOfGroup(groupName) {
  return state.categories.filter(function (c) {
    return c.kind === state.catKind && c.group === groupName;
  });
}

/* ---------- 대분류 ---------- */

function renderGroupList() {
  var box = $('#group-list');
  box.innerHTML = '';
  var groups = groupsOfKind();
  if (!groups.length) { box.innerHTML = '<div class="empty">대분류가 없어요</div>'; return; }

  groups.forEach(function (g) {
    var row = document.createElement('div');
    row.className = 'list-item';
    row.style.opacity = g.isActive ? '1' : '0.45';

    var left = document.createElement('div');
    left.className = 'row';
    left.style.minWidth = '0';
    left.innerHTML = '<span class="grp-dot" style="background:' + escapeAttr(g.color) + '"></span>' +
      '<span style="font-weight:700">' + escapeHtml(g.name) +
      (g.isActive ? '' : ' <span class="small muted">(숨김)</span>') + '</span>' +
      '<span class="small muted" style="font-weight:700">소분류 ' + subsOfGroup(g.name).length + '</span>';

    var right = document.createElement('div');
    right.className = 'row';
    right.style.gap = '2px';

    var color = document.createElement('input');
    color.type = 'color';
    color.value = g.color;
    color.title = '색 바꾸기';
    color.style.cssText = 'width:28px;height:26px;padding:1px;border:2px solid var(--edge);border-radius:9px;background:var(--surface)';
    color.addEventListener('change', function () {
      catAction(call('updateGroup', { id: g.id, color: color.value }));
    });

    var rename = document.createElement('button');
    rename.className = 'btn btn-ghost small';
    rename.textContent = '이름';
    rename.addEventListener('click', function () {
      var name = prompt('새 대분류 이름', g.name);
      if (!name || name.trim() === g.name) return;
      catAction(call('updateGroup', { id: g.id, name: name.trim() }));
    });

    var toggle = document.createElement('button');
    toggle.className = 'btn btn-ghost small';
    toggle.textContent = g.isActive ? '삭제' : '되살리기';
    toggle.addEventListener('click', function () {
      if (!g.isActive) { catAction(call('updateGroup', { id: g.id, isActive: true })); return; }
      if (!confirm("'" + g.name + "' 대분류를 지울까요?\n소분류가 딸려 있으면 목록에서만 숨겨요.")) return;
      catAction(call('deleteGroup', g.id).then(function (r) {
        toast(r.archived ? '소분류 ' + r.usedCount + '개가 있어 숨겼어요' : '지웠어요');
        return r;
      }));
    });

    right.appendChild(color); right.appendChild(rename); right.appendChild(toggle);
    row.appendChild(left); row.appendChild(right);
    box.appendChild(row);
  });
}

$('#form-group-add').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = e.target;
  catAction(call('addGroup', { kind: state.catKind, name: form.name.value, color: form.color.value })
    .then(function (r) { form.reset(); form.color.value = '#c9b6ff'; return r; }));
});

/* ---------- 소분류 ---------- */

function renderCatList() {
  var box = $('#cat-list');
  box.innerHTML = '';

  var groups = groupsOfKind();
  var shown = 0;

  groups.forEach(function (g) {
    var subs = subsOfGroup(g.name);
    if (!subs.length) return;
    shown += subs.length;

    var head = document.createElement('div');
    head.className = 'cat-group-head';
    head.innerHTML = '<span class="grp-dot" style="background:' + escapeAttr(g.color) + '"></span>' + escapeHtml(g.name);
    box.appendChild(head);

    subs.forEach(function (c) { box.appendChild(catRow(c)); });
  });

  // 없는 대분류를 가리키는 소분류가 있으면 따로 보여준다
  var orphans = state.categories.filter(function (c) {
    return c.kind === state.catKind && !groups.some(function (g) { return g.name === c.group; });
  });
  if (orphans.length) {
    var h = document.createElement('div');
    h.className = 'cat-group-head';
    h.textContent = '대분류 없음';
    box.appendChild(h);
    orphans.forEach(function (c) { box.appendChild(catRow(c)); });
    shown += orphans.length;
  }

  if (!shown) box.innerHTML = '<div class="empty">소분류가 없어요</div>';
}

function catRow(c) {
  var row = document.createElement('div');
  row.className = 'list-item';
  row.style.opacity = c.isActive ? '1' : '0.45';

  var left = document.createElement('div');
  left.className = 'row';
  left.style.minWidth = '0';
  left.innerHTML = picHtml(c.icon, c.color, 'pic-sm', 15) +
    '<span style="font-weight:700">' + escapeHtml(c.name) +
    (c.isActive ? '' : ' <span class="small muted">(숨김)</span>') + '</span>';
  left.firstChild.style.cursor = 'pointer';
  left.firstChild.title = '그림 바꾸기';
  left.firstChild.addEventListener('click', function () { openIconPicker({ mode: 'edit', id: c.id }); });

  var right = document.createElement('div');
  right.className = 'row';
  right.style.gap = '2px';

  var move = document.createElement('button');
  move.className = 'btn btn-ghost small';
  move.textContent = '옮기기';
  move.addEventListener('click', function () { openGroupPicker({ mode: 'move', id: c.id }); });

  var rename = document.createElement('button');
  rename.className = 'btn btn-ghost small';
  rename.textContent = '이름';
  rename.addEventListener('click', function () {
    var name = prompt('새 이름', c.name);
    if (!name || name.trim() === c.name) return;
    catAction(call('updateCategory', { id: c.id, name: name.trim() }));
  });

  var toggle = document.createElement('button');
  toggle.className = 'btn btn-ghost small';
  toggle.textContent = c.isActive ? '삭제' : '되살리기';
  toggle.addEventListener('click', function () {
    if (!c.isActive) { catAction(call('updateCategory', { id: c.id, isActive: true })); return; }
    if (!confirm("'" + c.name + "'을(를) 지울까요?\n이미 쓴 기록이 있으면 목록에서만 숨겨요.")) return;
    catAction(call('deleteCategory', c.id).then(function (r) {
      toast(r.archived ? '기록 ' + r.usedCount + '건이 있어 숨겼어요' : '지웠어요');
      return r;
    }));
  });

  right.appendChild(move); right.appendChild(rename); right.appendChild(toggle);
  row.appendChild(left); row.appendChild(right);
  return row;
}

function renderAddForm() {
  var groups = groupsOfKind().filter(function (g) { return g.isActive; });
  if (!state.newCatGroup || !groups.some(function (g) { return g.name === state.newCatGroup; })) {
    state.newCatGroup = groups.length ? groups[0].name : null;
  }
  $('#cat-add-group').textContent = state.newCatGroup || '먼저 대분류를 만드세요';
  $('#cat-add-icon').innerHTML = iconSvg(state.newCatIcon, 19, 'currentColor', 2.1);
}

$('#cat-add-group').addEventListener('click', function () { openGroupPicker({ mode: 'add' }); });

$('#form-cat-add').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = e.target;
  if (!state.newCatGroup) { showError($('#cat-error'), '먼저 대분류를 만들어 주세요.'); return; }
  catAction(call('addCategory', {
    kind: state.catKind, group: state.newCatGroup, name: form.name.value, icon: state.newCatIcon
  }).then(function (r) {
    form.reset();
    state.newCatIcon = 'dots';
    renderAddForm();
    return r;
  }));
});

/* ---------- 대분류 고르기 ---------- */

var dlgGroup = $('#dlg-group');

function openGroupPicker(target) {
  state.groupTarget = target;
  var current = target.mode === 'add'
    ? state.newCatGroup
    : (categoryById(target.id) || {}).group;

  var box = $('#group-pick-list');
  box.innerHTML = '';
  groupsOfKind().forEach(function (g) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(g.name === current));
    b.innerHTML = '<span class="grp-dot" style="background:' + escapeAttr(g.color) + '"></span>' +
      '<span>' + escapeHtml(g.name) + '</span>';
    b.addEventListener('click', function () { pickGroup(g.name); });
    box.appendChild(b);
  });
  $('#group-pick-title').textContent = target.mode === 'add' ? '어느 대분류에 넣을까요?' : '어디로 옮길까요?';
  dlgGroup.showModal();
}

function pickGroup(name) {
  var target = state.groupTarget;
  dlgGroup.close();
  if (!target) return;
  if (target.mode === 'add') { state.newCatGroup = name; renderAddForm(); return; }
  catAction(call('updateCategory', { id: target.id, group: name }));
}

/* ------------------------------------------------------------------ */
/* 그림 고르기                                                          */
/* ------------------------------------------------------------------ */

var dlgIcon = $('#dlg-icon');

$('#cat-add-icon').addEventListener('click', function () { openIconPicker({ mode: 'add' }); });

function openIconPicker(target) {
  state.iconTarget = target;
  var current = target.mode === 'add'
    ? state.newCatIcon
    : (categoryById(target.id) || {}).icon;

  var grid = $('#icon-grid');
  grid.innerHTML = '';
  ICON_KEYS.forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(key === current));
    b.innerHTML = iconSvg(key, 21, 'currentColor', 2.1);
    b.addEventListener('click', function () { pickIcon(key); });
    grid.appendChild(b);
  });
  $('#icon-title').textContent = target.mode === 'add' ? '새 카테고리 그림' : '그림 바꾸기';
  dlgIcon.showModal();
}

function pickIcon(key) {
  var target = state.iconTarget;
  dlgIcon.close();
  if (!target) return;
  if (target.mode === 'add') { state.newCatIcon = key; renderAddForm(); return; }
  catAction(call('updateCategory', { id: target.id, icon: key }));
}

/* ------------------------------------------------------------------ */
/* 내역 추가 · 수정                                                     */
/* ------------------------------------------------------------------ */

var dlgTx = $('#dlg-tx');

$('#btn-add').addEventListener('click', function () { openTxModal(null); });

function defaultDate() {
  if (state.tab === 'calendar' && state.selectedDate) return state.selectedDate;
  var today = todayIso();
  return inRange(today) ? today : (state.range ? state.range.from : today);
}

function openTxModal(tx) {
  state.editingTx = tx;
  state.txKind = tx ? tx.kind : 'expense';
  state.txCategoryId = tx ? categoryIdOf(tx.kind, tx.categoryName) : null;

  $('#tx-modal-title').textContent = tx ? '내역 고치기' : '뭐 썼지?';
  $('#btn-tx-delete').hidden = !tx;
  showError($('#tx-error'), '');

  var form = $('#form-tx');
  form.amount.value = tx ? tx.amount : '';
  form.date.value = tx ? tx.date : defaultDate();
  form.memo.value = tx ? tx.memo : '';

  form.userEmail.innerHTML = state.members.map(function (m) {
    return '<option value="' + escapeAttr(m.email) + '">' + escapeHtml(m.name) + '</option>';
  }).join('');
  form.userEmail.value = tx ? tx.userEmail : (state.me ? state.me.email : '');

  renderKindSeg();
  renderTxCategories();
  dlgTx.showModal();
}

function renderKindSeg() {
  $$('#tx-kind-seg button').forEach(function (b) {
    b.setAttribute('aria-selected', String(b.getAttribute('data-kind') === state.txKind));
  });
}

$$('#tx-kind-seg button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var kind = btn.getAttribute('data-kind');
    if (state.txKind === kind) return;
    state.txKind = kind;
    state.txCategoryId = null;
    renderKindSeg(); renderTxCategories();
  });
});

function renderTxCategories() {
  var box = $('#tx-categories');
  box.innerHTML = '';

  var chip = function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.txCategoryId === c.id));
    b.innerHTML = picHtml(c.icon, c.color, 'pic-sm', 14) + '<span>' + escapeHtml(c.name) + '</span>';
    b.addEventListener('click', function () { state.txCategoryId = c.id; renderTxCategories(); });
    return b;
  };

  // 소분류가 많아지므로 대분류 이름을 얹어 묶어 보여준다
  state.groups.filter(function (g) { return g.kind === state.txKind; }).forEach(function (g) {
    var cats = state.categories.filter(function (c) {
      return c.kind === state.txKind && c.group === g.name && (c.isActive || c.id === state.txCategoryId);
    });
    if (!cats.length) return;

    var head = document.createElement('div');
    head.className = 'cat-group-head';
    head.style.width = '100%';
    head.innerHTML = '<span class="grp-dot" style="background:' + escapeAttr(g.color) + '"></span>' + escapeHtml(g.name);
    box.appendChild(head);

    var wrap = document.createElement('div');
    wrap.className = 'chip-picker';
    wrap.style.width = '100%';
    cats.forEach(function (c) { wrap.appendChild(chip(c)); });
    box.appendChild(wrap);
  });

  var tail = document.createElement('div');
  tail.className = 'chip-picker';
  tail.style.width = '100%';
  tail.style.marginTop = '8px';
  tail.appendChild(chip({ id: null, name: '미분류', color: '#9aa0b0', icon: 'dots' }));
  box.appendChild(tail);
}

$('#form-tx').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = e.target;
  var payload = {
    kind: state.txKind,
    amount: String(form.amount.value).replace(/[,\s]/g, ''),
    date: form.date.value,
    memo: form.memo.value,
    categoryId: state.txCategoryId,
    userEmail: form.userEmail.value
  };

  var saveBtn = $('#btn-tx-save');
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';
  showError($('#tx-error'), '');

  var editing = state.editingTx;
  if (editing) payload.id = editing.id;

  withBusy(call(editing ? 'updateTransaction' : 'addTransaction', payload))
    .then(function (data) {
      state.selectedDate = payload.date;
      apply(data);
      dlgTx.close();
      toast(editing ? '고쳤어요' : '기록했어요');
    })
    ['catch'](function (err) { showError($('#tx-error'), err.message); })
    .then(function () { saveBtn.disabled = false; saveBtn.textContent = '저장'; });
});

$('#btn-tx-delete').addEventListener('click', function () {
  if (!state.editingTx || !confirm('이 기록을 지울까요?')) return;
  showError($('#tx-error'), '');
  withBusy(call('deleteTransaction', state.editingTx.id, state.month))
    .then(function (d) { apply(d); dlgTx.close(); toast('지웠어요'); })
    ['catch'](function (err) { showError($('#tx-error'), err.message); });
});

$$('[data-close]').forEach(function (btn) {
  btn.addEventListener('click', function () { btn.closest('dialog').close(); });
});

/* ------------------------------------------------------------------ */
/* 시작                                                                */
/* ------------------------------------------------------------------ */

/**
 * 앱을 켠다.
 *
 * 여는 데 실패하면 반드시 화면에 이유를 띄운다. 조용히 죽어서 '여는 중…' 화면에
 * 멈춰 있으면 왜 그런지 알 길이 없다.
 */
function fatal(message) {
  var box = document.getElementById('fatal');
  var msg = document.getElementById('fatal-msg');
  var load = document.getElementById('loading');
  if (msg) msg.textContent = message || '알 수 없는 오류';
  if (load) load.hidden = true;
  if (box) box.hidden = false;
}

window.addEventListener('error', function (e) {
  fatal((e && e.message ? e.message : '스크립트 오류') + (e && e.lineno ? ' (' + e.lineno + '번째 줄)' : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  var r = e && e.reason;
  fatal('처리 못 한 오류: ' + ((r && r.message) || r || ''));
});

/** 구글 로그인 단추를 그린다. 구글 쪽 코드가 늦게 오면 기다렸다 다시 시도한다. */
function showGoogleButton() {
  var box = $('#gbtn');
  if (!box) return;

  if (!CONFIG.clientId) {
    box.innerHTML = '';
    $('#signin-note').textContent = 'config.js 의 clientId 가 비어 있습니다.';
    return;
  }
  if (!window.google || !google.accounts || !google.accounts.id) {
    setTimeout(showGoogleButton, 200);
    return;
  }

  initGoogle();
  box.innerHTML = '';
  google.accounts.id.renderButton(box, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko'
  });
  google.accounts.id.prompt();
}

/** 구글 로그인 코드를 한 번만 준비시킨다. */
function initGoogle() {
  if (auth.ready) return;
  google.accounts.id.initialize({
    client_id: CONFIG.clientId,
    callback: function (res) {
      var token = res && res.credential;
      // 조용히 받아오는 중이었으면 그쪽이 받는다
      if (auth.silent) auth.silent(token);
      else onSignedIn(token);
    },
    auto_select: true,
    cancel_on_tap_outside: false
  });
  auth.ready = true;
}

function onSignedIn(token) {
  if (!token) { $('#signin-note').textContent = '로그인 정보를 받지 못했습니다.'; return; }
  keepToken(token);
  $('#signin').hidden = true;
  $('#loading').hidden = false;
  openLedger();
}

/** 자료를 받아 화면을 채운다. */
function openLedger() {
  var stuck = setTimeout(function () {
    fatal('20초 동안 응답이 없습니다. config.js 의 apiUrl 과 배포 상태를 확인해 주세요.');
  }, 20000);

  call('getBootstrap', '')
    .then(function (data) {
      clearTimeout(stuck);
      if (data.sheetUrl) $('#sheet-link').href = data.sheetUrl;
      apply(data);
      showTab('calendar');
      $('#loading').hidden = true;
      $('#header').hidden = false;
      $('#screens').hidden = false;
      $('#tabbar').hidden = false;
      $('#btn-add').hidden = false;
    })
    ['catch'](function (err) {
      clearTimeout(stuck);
      var msg = (err && err.message) || '서버와 연결하지 못했습니다.';
      // 명단에 없는 사람이면 오류가 아니라 로그인 화면으로 돌려보낸다
      if (/로그인|명단|권한/.test(msg)) signOut(msg);
      else fatal(msg);
    });
}

(function boot() {
  // 화면 파일을 폰에 담아두는 일꾼을 깨운다. 이게 있어야 '앱으로 설치'가 된다.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')['catch'](function () {
        // 안 돼도 앱은 그대로 쓸 수 있다
      });
    });
  }

  if (loadToken()) {
    openLedger();
    return;
  }
  // 저장된 증명서가 없거나 만료됐으면, 먼저 조용히 받아본다
  $('#loading').hidden = false;
  silentSignIn(function () { signOut(''); });
})();
