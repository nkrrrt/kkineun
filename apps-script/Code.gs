/**
 * 함께 쓰는 가계부 — 구글 시트 백엔드
 *
 * 이 스크립트는 스프레드시트에 붙어서 동작합니다(컨테이너 바인딩).
 * 데이터는 같은 스프레드시트의 '내역' · '카테고리' · '멤버' 시트에 쌓입니다.
 * 시트를 상대와 공유하면 그대로 함께 쓰는 가계부가 됩니다.
 */

var SHEET_TX = '내역';
var SHEET_GROUP = '대분류';
var SHEET_CAT = '카테고리';
var SHEET_MEMBER = '멤버';
var SHEET_SETTINGS = '설정';

var TX_HEADERS = ['ID', '날짜', '구분', '금액', '카테고리', '메모', '작성자', '기록시각'];
var GROUP_HEADERS = ['ID', '구분', '이름', '색상', '사용'];
var CAT_HEADERS = ['ID', '구분', '대분류', '이름', '아이콘', '사용'];
var MEMBER_HEADERS = ['이메일', '표시이름', '첫접속'];
var SETTINGS_HEADERS = ['항목', '값', '설명'];

var KEY_START_DAY = '월 시작일';

var DEFAULT_START_DAY = 1;

/**
 * 실행이 끝나도 잠깐 남는 기억의 이름표와 유지 시간(초).
 *
 * 시트 구조 점검과 '이 시트를 공유받은 사람 목록' 조회는 매번 하면 느린데
 * 좀처럼 바뀌지도 않는다. 한 번 확인하면 여섯 시간 동안 그대로 믿는다.
 */
var CACHE_SETUP = 'setup-ok';
var CACHE_EDITORS = 'editors';

/**
 * 구글 클라우드 콘솔에서 만든 웹 클라이언트 ID.
 *
 * 화면(config.js)에 적은 것과 똑같아야 한다. 이걸 확인해야, 남이 우리 화면을
 * 통째로 베껴 다른 주소에 올려도 그 증명서로는 우리 시트를 못 건드린다.
 */
var CLIENT_ID = '1068313664202-3dhaov21ksrq2vaalvi32itidpkks58f.apps.googleusercontent.com';

/** 화면이 올라가 있는 주소. 옛 주소로 들어온 사람을 여기로 안내한다. */
var APP_URL = 'https://nkrrrt.github.io/kkineun/';
var CACHE_SECONDS = 21600;

/** 증명서 확인 결과를 기억하는 시간. 증명서 자체가 한 시간짜리다. */
var CACHE_TOKEN_SECONDS = 1800;

/** 공유 목록을 기억하는 시간. 짧을수록 공유를 끊었을 때 빨리 막힌다. */
var CACHE_EDITORS_SECONDS = 600;

// 내역 시트 열 번호 (1부터)
var TX_ID = 1, TX_DATE = 2, TX_KIND = 3, TX_AMOUNT = 4, TX_CAT = 5, TX_MEMO = 6, TX_USER = 7, TX_AT = 8;
var GRP_ID = 1, GRP_KIND = 2, GRP_NAME = 3, GRP_COLOR = 4, GRP_ACTIVE = 5;
var CAT_ID = 1, CAT_KIND = 2, CAT_GROUP = 3, CAT_NAME = 4, CAT_ICON = 5, CAT_ACTIVE = 6;

/** 분석은 대분류로 묶어 보고, 색도 대분류가 갖는다. [구분, 이름, 색상] */
var DEFAULT_GROUPS = [
  ['expense', '먹고 마시기', '#ff9f68'],
  ['expense', '생활', '#d9a441'],
  ['expense', '이동', '#5fa8e0'],
  ['expense', '건강', '#4fc0a0'],
  ['expense', '꾸미기', '#f07ab0'],
  ['expense', '즐기기', '#b18cf0'],
  ['expense', '그 밖에', '#9aa0b0'],
  ['income', '버는 돈', '#3fa9f5'],
  ['income', '그 밖에', '#7ec98a']
];

/** 기록은 소분류로 남기고, 그림도 소분류가 갖는다. [구분, 대분류, 이름, 아이콘] */
var DEFAULT_CATEGORIES = [
  ['expense', '먹고 마시기', '식비', 'food'],
  ['expense', '먹고 마시기', '카페·간식', 'cafe'],
  ['expense', '먹고 마시기', '장보기', 'market'],
  ['expense', '먹고 마시기', '배달', 'cart'],
  ['expense', '생활', '주거·월세', 'home'],
  ['expense', '생활', '공과금', 'bolt'],
  ['expense', '생활', '통신', 'phone'],
  ['expense', '생활', '생활용품', 'box'],
  ['expense', '생활', '반려동물', 'paw'],
  ['expense', '생활', '세금·수수료', 'doc'],
  ['expense', '이동', '교통', 'bus'],
  ['expense', '이동', '주유·차량', 'car'],
  ['expense', '건강', '병원', 'health'],
  ['expense', '건강', '치과', 'tooth'],
  ['expense', '건강', '약국', 'pill'],
  ['expense', '건강', '운동', 'gym'],
  ['expense', '꾸미기', '의류', 'shirt'],
  ['expense', '꾸미기', '미용', 'beauty'],
  ['expense', '즐기기', '여가생활', 'ticket'],
  ['expense', '즐기기', '취미', 'art'],
  ['expense', '즐기기', '게임', 'game'],
  ['expense', '즐기기', '음악·공연', 'music'],
  ['expense', '즐기기', '사진·장비', 'camera'],
  ['expense', '즐기기', '구독', 'play'],
  ['expense', '즐기기', '여행', 'plane'],
  ['expense', '그 밖에', '교육', 'book'],
  ['expense', '그 밖에', '경조사', 'gift'],
  ['expense', '그 밖에', '기부·후원', 'heart'],
  ['expense', '그 밖에', '기타', 'dots'],
  ['income', '버는 돈', '급여', 'money'],
  ['income', '버는 돈', '보너스', 'star'],
  ['income', '버는 돈', '부수입', 'coins'],
  ['income', '그 밖에', '용돈', 'wallet'],
  ['income', '그 밖에', '금융소득', 'piggy'],
  ['income', '그 밖에', '환급', 'refund'],
  ['income', '그 밖에', '중고판매', 'tag'],
  ['income', '그 밖에', '기타수입', 'dots']
];

/* ------------------------------------------------------------------ */
/* 웹앱 진입점                                                          */
/* ------------------------------------------------------------------ */

/**
 * 옛 주소로 들어온 사람에게 새 주소를 알려준다.
 *
 * 이 스크립트는 이제 '나(주인)'로 실행된다. 여기서 예전처럼 앱을 그려주면
 * 구글 계정만 있으면 누구나 내 시트를 들여다보게 되므로, 앱은 내주지 않는다.
 */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:28px;line-height:1.7;text-align:center">' +
    '<h2 style="margin:0 0 10px">가계부가 이사했어요</h2>' +
    '<p style="color:#666;margin:0 0 18px">아래 주소로 열어 주세요.</p>' +
    '<p><a href="' + APP_URL + '" style="font-size:17px">' + APP_URL + '</a></p>' +
    '</div>'
  ).setTitle('함께 쓰는 가계부');
}

/* ------------------------------------------------------------------ */
/* 화면에서 오는 요청 받기                                              */
/* ------------------------------------------------------------------ */

/**
 * 깃허브에 올린 화면이 부르는 창구.
 *
 * 이 스크립트는 '나(시트 주인)'로 실행되므로, 요청한 사람이 누구인지 구글이
 * 알려주지 않는다. 그래서 화면이 보내온 증명서를 구글에 직접 물어 확인하고,
 * 가계부를 공유받은 사람인지 본 다음에만 일을 해준다.
 */
function doPost(e) {
  var out = {};
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var email = verifyToken_(body.token);

    ensureSheets_();
    if (!isMember_(email)) {
      fail_('이 가계부에 초대되지 않은 계정입니다: ' + email);
    }
    MEMO_.actor = email;

    out.result = dispatch_(body.fn, body.args || []);
  } catch (err) {
    out.error = String((err && err.message) || err) || '알 수 없는 오류';
    // 증명서 문제면 화면이 다시 로그인시키도록 알려준다
    if (/증명서|로그인|초대되지/.test(out.error)) out.needSignIn = true;
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 화면이 부를 수 있는 일의 목록.
 *
 * 여기 적힌 것만 부를 수 있다. 이름을 문자열로 받아 아무 함수나 부르게 두면,
 * 화면을 조작해서 시트를 지우는 함수까지 부를 수 있게 된다.
 */
function allowed_() {
  return {
    getBootstrap: getBootstrap,
    getMonthData: getMonthData,
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    updateSettings: updateSettings,
    renameMe: renameMe,
    addGroup: addGroup,
    updateGroup: updateGroup,
    deleteGroup: deleteGroup,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory
  };
}

function dispatch_(fn, args) {
  var target = allowed_()[String(fn || '')];
  if (typeof target !== 'function') fail_('알 수 없는 요청입니다: ' + fn);
  return target.apply(null, args || []);
}

/**
 * 화면이 보내온 증명서가 진짜인지 구글에 물어보고, 누구인지 돌려준다.
 *
 * 증명서(ID 토큰)는 구글이 서명해서 발급한 것이라 위조할 수 없다. 다만 남이
 * 자기 사이트에서 받은 증명서를 우리 창구에 들이밀 수도 있으니, 우리 클라이언트
 * ID 로 발급된 것인지까지 확인한다.
 */
function verifyToken_(token) {
  var t = String(token || '').trim();
  if (!t) fail_('로그인이 필요합니다.');
  if (!CLIENT_ID) fail_('Code.gs 의 CLIENT_ID 가 비어 있습니다.');

  var cache = docCache_();
  var key = 'tok-' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t));

  // 같은 증명서를 몇 분 안에 다시 물어보지 않는다. 매번 물으면 그만큼 느려진다.
  if (cache) {
    var hit = cache.get(key);
    if (hit) return hit;
  }

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) fail_('증명서가 만료되었습니다. 다시 로그인해 주세요.');

  var info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) fail_('다른 곳에서 발급된 증명서입니다.');
  if (String(info.email_verified) !== 'true') fail_('구글에서 확인되지 않은 계정입니다.');
  if (Number(info.exp) * 1000 < Date.now()) fail_('증명서가 만료되었습니다. 다시 로그인해 주세요.');

  var email = String(info.email || '').trim().toLowerCase();
  if (!email) fail_('증명서에 이메일이 없습니다.');

  // 이 확인 한 번마다 바깥 왕복이 한 번 붙는다. 증명서는 한 시간짜리이므로
  // 남은 시간 안에서 넉넉히 기억해 두고, 그동안은 다시 묻지 않는다.
  if (cache) {
    var left = Math.floor(Number(info.exp) - Date.now() / 1000);
    if (left > 60) cache.put(key, email, Math.min(left - 60, CACHE_TOKEN_SECONDS));
  }
  return email;
}

/** 시트 주소. 바뀌지 않으니 한 번만 물어본다. */
function sheetUrl_() {
  var cache = docCache_();
  if (cache) {
    var hit = cache.get('sheet-url');
    if (hit !== null && hit !== undefined) return hit;
  }
  var url = '';
  try {
    url = ss_().getUrl() || '';
  } catch (e) {
    url = '';
  }
  if (cache) cache.put('sheet-url', url, CACHE_SECONDS);
  return url;
}

/**
 * 이 가계부를 공유받은 사람인가. 시트 공유 목록이 곧 초대 명단이다.
 *
 * 멤버 시트는 보지 않는다. 거기에는 '한 번이라도 열어본 사람'이 남아 있어서,
 * 공유를 끊어도 이름이 그대로 남는다. 그걸 명단으로 쓰면 내보낼 방법이 없다.
 */
function isMember_(email) {
  return !!email && editorEmails_().indexOf(email) >= 0;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('가계부')
    .addItem('가계부 앱 열기 (주소 확인)', 'showAppUrl')
    .addItem('시트 초기 설정하기', 'ensureSheets_')
    .addToUi();
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p style="font-family:sans-serif">아래 주소를 폰에서 열고 홈 화면에 추가하세요.</p>' +
      '<p style="font-family:monospace;word-break:break-all">' + url + '</p>'
    : '<p style="font-family:sans-serif">아직 웹 앱으로 배포하지 않았습니다.<br>' +
      '상단 <b>배포 → 새 배포 → 웹 앱</b> 으로 먼저 배포해 주세요.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setHeight(160), '가계부 앱 주소');
}

/* ------------------------------------------------------------------ */
/* 시트 준비                                                            */
/* ------------------------------------------------------------------ */

function ensureSheets_() {
  if (MEMO_.ready) return MEMO_.ready;

  // 시트 구조는 좀처럼 바뀌지 않는다. 최근에 확인했으면 그대로 믿고 넘어간다.
  var cache = docCache_();
  if (cache && cache.get(CACHE_SETUP)) {
    MEMO_.ready = ss_();
    return MEMO_.ready;
  }

  var ss = ss_();
  sheetWithHeaders_(ss, SHEET_TX, TX_HEADERS, [90, 100, 70, 110, 110, 220, 130, 150]);
  var grp = sheetWithHeaders_(ss, SHEET_GROUP, GROUP_HEADERS, [90, 70, 130, 80, 55]);
  var cat = sheetWithHeaders_(ss, SHEET_CAT, CAT_HEADERS, [90, 70, 120, 130, 90, 55]);
  migrateCategories_(grp, cat);

  if (grp.getLastRow() < 2) {
    grp.getRange(2, 1, DEFAULT_GROUPS.length, GROUP_HEADERS.length).setValues(
      DEFAULT_GROUPS.map(function (g) { return [newId_(), g[0], g[1], g[2], true]; })
    );
  }
  if (cat.getLastRow() < 2) {
    cat.getRange(2, 1, DEFAULT_CATEGORIES.length, CAT_HEADERS.length).setValues(
      DEFAULT_CATEGORIES.map(function (c) { return [newId_(), c[0], c[1], c[2], c[3], true]; })
    );
  }

  sheetWithHeaders_(ss, SHEET_MEMBER, MEMBER_HEADERS, [220, 130, 150]);


  var settings = sheetWithHeaders_(ss, SHEET_SETTINGS, SETTINGS_HEADERS, [110, 70, 420]);
  if (settings.getLastRow() < 2) {
    settings.appendRow([
      KEY_START_DAY,
      DEFAULT_START_DAY,
      '한 달을 며칠부터 셀지 정합니다. 예를 들어 24로 두면 8월은 7월 24일 ~ 8월 23일이 됩니다. (1이면 달력과 같음)'
    ]);
  }

  if (cache) cache.put(CACHE_SETUP, '1', CACHE_SECONDS);
  MEMO_.ready = ss;
  return ss;
}

/**
 * 예전 카테고리 시트를 대분류/소분류 두 단계로 옮긴다.
 * 예전: ID | 구분 | 이름 | 색상 | (아이콘) | 사용
 * 지금: 대분류 시트가 색을 갖고, 카테고리 시트는 대분류 이름을 가리킨다.
 */
function migrateCategories_(grp, cat) {
  var lastCol = cat.getLastColumn();
  if (lastCol < 1) return;
  var header = cat.getRange(1, 1, 1, lastCol).getValues()[0].join('|');
  if (header.indexOf('대분류') >= 0) return;

  var last = cat.getLastRow();
  var old = last < 2 ? [] : cat.getRange(2, 1, last - 1, lastCol).getValues();
  var hadIcon = header.indexOf('아이콘') >= 0;

  // 이름 → [대분류, 아이콘] 짝을 기본값에서 만든다
  var known = {};
  DEFAULT_CATEGORIES.forEach(function (c) { known[c[0] + ':' + c[2]] = [c[1], c[3]]; });

  var rows = old.map(function (r) {
    var kind = String(r[1] || '').trim() === 'income' ? 'income' : 'expense';
    var name = String(r[2] || '').trim();
    var icon = hadIcon ? String(r[4] || '').trim() : '';
    var hit = known[kind + ':' + name];
    return [
      String(r[0] || '').trim() || newId_(),
      kind,
      hit ? hit[0] : '그 밖에',
      name,
      icon || (hit ? hit[1] : 'dots'),
      r[hadIcon ? 5 : 4] !== false
    ];
  }).filter(function (r) { return r[3]; });

  cat.clear();
  cat.getRange(1, 1, 1, CAT_HEADERS.length).setValues([CAT_HEADERS]).setFontWeight('bold');
  if (rows.length) cat.getRange(2, 1, rows.length, CAT_HEADERS.length).setValues(rows);

  // 대분류 시트가 비어 있으면 기본값을 넣어 색을 살린다
  if (grp.getLastRow() < 2) {
    grp.getRange(2, 1, DEFAULT_GROUPS.length, GROUP_HEADERS.length).setValues(
      DEFAULT_GROUPS.map(function (g) { return [newId_(), g[0], g[1], g[2], true]; })
    );
  }
}

function sheetWithHeaders_(ss, name, headers, widths) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    if (widths) {
      for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);
    }
  }
  return sheet;
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* 값 읽기 도우미                                                       */
/* ------------------------------------------------------------------ */

/**
 * 한 번 실행되는 동안만 살아 있는 기억장소.
 *
 * 구글 시트에 뭘 물어볼 때마다 서버 왕복이 한 번씩 생긴다. 그게 수십 번 쌓이면
 * 앱이 눈에 띄게 느려진다. 실행 도중에는 절대 바뀌지 않는 것(스프레드시트 자체,
 * 시간대, 시트 손잡이)은 한 번만 물어보고 계속 재사용한다.
 */
var MEMO_ = {};

function ss_() {
  if (!MEMO_.ss) MEMO_.ss = SpreadsheetApp.getActive();
  return MEMO_.ss;
}

/** 실행이 끝나도 남는 짧은 기억. 없으면 없는 대로 동작한다. */
function docCache_() {
  if (MEMO_.cacheDone) return MEMO_.cache;
  MEMO_.cacheDone = true;
  try {
    // 웹 앱으로 열릴 때는 '문서 캐시'가 없다(null 이 온다). 스크립트 캐시는 어디서든 있다.
    MEMO_.cache = CacheService.getScriptCache() || null;
  } catch (e) {
    MEMO_.cache = null;
  }
  return MEMO_.cache;
}

function sheet_(name) {
  if (!MEMO_.sheets) MEMO_.sheets = {};
  if (MEMO_.sheets[name]) return MEMO_.sheets[name];

  var s = ss_().getSheetByName(name);
  if (!s) {
    // 시트가 없으면 '준비 끝났다'는 기억이 틀린 것이니 지우고 다시 만든다.
    MEMO_.ready = null;
    var cache = docCache_();
    if (cache) cache.remove(CACHE_SETUP);
    ensureSheets_();
    s = ss_().getSheetByName(name);
  }
  MEMO_.sheets[name] = s;
  return s;
}

/** 헤더를 뺀 데이터 행 전체 */
function rows_(name, width) {
  var sheet = sheet_(name);
  // '마지막 줄이 몇 번째냐'와 '그 값을 달라'를 따로 묻던 것을 한 번으로 합친다.
  var all = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < all.length; i++) {
    var r = all[i];
    // 뒤쪽 칸이 비어 있으면 구글이 짧은 줄을 주기도 한다. 길이를 맞춰둔다.
    while (r.length < width) r.push('');
    out.push(r);
  }
  return out;
}

function tzone_() {
  // 내역 한 줄마다 불리는 자리라, 여기서 왕복이 생기면 그대로 줄 수만큼 느려진다.
  if (!MEMO_.tz) {
    var ss = ss_();
    MEMO_.tz = (ss.getSpreadsheetTimeZone && ss.getSpreadsheetTimeZone()) ||
      Session.getScriptTimeZone() || 'Asia/Seoul';
  }
  return MEMO_.tz;
}

/** 날짜 칸이 Date든 문자열이든 'YYYY-MM-DD' 로 통일해서 돌려준다. */
function toIsoDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, tzone_(), 'yyyy-MM-dd');
  }
  var text = String(value || '').trim();
  var m = text.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (!m) return '';
  return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
}

function pad2_(n) {
  return ('0' + Number(n)).slice(-2);
}

/** 'YYYY-MM-DD' 를 시트에 넣을 Date 로. 시간대 밀림을 피하려고 정오로 만든다. */
function toSheetDate_(iso) {
  var p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
}

/* ------------------------------------------------------------------ */
/* 설정 · 월 주기                                                       */
/* ------------------------------------------------------------------ */

function readSettings_() {
  var startDay = DEFAULT_START_DAY;
  rows_(SHEET_SETTINGS, SETTINGS_HEADERS.length).forEach(function (r) {
    if (String(r[0] || '').trim() !== KEY_START_DAY) return;
    var n = Number(r[1]);
    if (isFinite(n) && Math.floor(n) === n && n >= 1 && n <= 31) startDay = n;
  });
  return { startDay: startDay, endDay: endDayOf_(startDay) };
}

/**
 * 시작일에서 종료일을 구한다. 0 은 '말일'이라는 뜻이다.
 *
 * 한 달은 시작일 바로 앞날에 끝난다. 24일에 시작하면 23일에 끝나는 식이다.
 * 둘을 따로 정하게 두면 사이에 빈 날이 생기고, 그 날 쓴 돈은 어느 달에도
 * 안 잡혀 사라진 것처럼 보인다. 그래서 하나를 정하면 나머지가 따라온다.
 */
function endDayOf_(startDay) {
  return startDay <= 1 ? 0 : startDay - 1;
}

/** 종료일에서 시작일을 구한다. endDayOf_ 의 반대. */
function startDayOf_(endDay) {
  var n = Number(endDay);
  if (!isFinite(n) || Math.floor(n) !== n || n < 0 || n > 31) {
    fail_('종료일은 말일이거나 1에서 30 사이의 날짜여야 합니다.');
  }
  return (n === 0 || n >= 31) ? 1 : n + 1;
}

/** 설정 시트에서 한 항목을 고치거나, 없으면 새로 만든다. */
function putSetting_(key, value, note) {
  var sheet = sheet_(SHEET_SETTINGS);
  var data = rows_(SHEET_SETTINGS, SETTINGS_HEADERS.length);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === key) {
      sheet.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, note || '']);
}

/** 월 시작일 바꾸기. 급여일이 바뀌면 여기만 고치면 된다. */
function updateSettings(payload) {
  payload = payload || {};

  // 시작일과 종료일 중 무엇을 보내든 받는다. 둘은 붙어 있는 값이다.
  var startDay;
  if (payload.endDay !== undefined && payload.startDay === undefined) {
    startDay = startDayOf_(payload.endDay);
  } else {
    startDay = Number(payload.startDay);
    if (!isFinite(startDay) || Math.floor(startDay) !== startDay || startDay < 1 || startDay > 31) {
      fail_('월 시작일은 1에서 31 사이의 숫자여야 합니다.');
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    putSetting_(KEY_START_DAY, startDay, '한 달을 며칠부터 셀지 정합니다.');
    return getMonthData(payload.month || defaultMonth_());
  } finally {
    lock.releaseLock();
  }
}

function daysInMonth_(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 31일 시작인데 2월이면 28(29)일로 당긴다. 이렇게 해야 기간이 끊기거나 겹치지 않는다. */
function clampDay_(year, month, day) {
  return Math.min(day, daysInMonth_(year, month));
}

function isoOf_(year, month, day) {
  return year + '-' + pad2_(month) + '-' + pad2_(day);
}

function addDays_(iso, delta) {
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2] + delta);
  return isoOf_(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * 'YYYY-MM' 라벨이 실제로 며칠부터 며칠까지인지.
 * 시작일이 24면 2026-08 은 2026-07-24 ~ 2026-08-23 이다.
 */
function periodRange_(month, startDay) {
  var p = month.split('-').map(Number);
  var year = p[0], m = p[1];
  if (startDay <= 1) {
    return { from: isoOf_(year, m, 1), to: isoOf_(year, m, daysInMonth_(year, m)) };
  }
  var prevYear = m === 1 ? year - 1 : year;
  var prevMonth = m === 1 ? 12 : m - 1;
  return {
    from: isoOf_(prevYear, prevMonth, clampDay_(prevYear, prevMonth, startDay)),
    to: addDays_(isoOf_(year, m, clampDay_(year, m, startDay)), -1)
  };
}

/** 어떤 날짜가 어느 달 라벨에 속하는지 (periodRange_ 의 반대) */
function periodOf_(iso, startDay) {
  if (startDay <= 1) return iso.slice(0, 7);
  var p = iso.split('-').map(Number);
  var year = p[0], m = p[1], day = p[2];
  if (day < clampDay_(year, m, startDay)) return year + '-' + pad2_(m);
  return m === 12 ? (year + 1) + '-01' : year + '-' + pad2_(m + 1);
}

/* ------------------------------------------------------------------ */
/* 검증                                                                */
/* ------------------------------------------------------------------ */

function fail_(message) {
  throw new Error(message);
}

function checkKind_(kind) {
  if (kind !== 'income' && kind !== 'expense') fail_('구분은 수입 또는 지출이어야 합니다.');
  return kind;
}

function checkAmount_(value) {
  var n = Number(String(value == null ? '' : value).replace(/[,\s원]/g, ''));
  if (!isFinite(n) || Math.floor(n) !== n || n <= 0) fail_('금액은 0보다 큰 정수여야 합니다.');
  if (n > 1e15) fail_('금액이 너무 큽니다.');
  return n;
}

function checkDate_(value) {
  var iso = toIsoDate_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) fail_('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) {
    fail_('존재하지 않는 날짜입니다.');
  }
  return iso;
}

function checkMonth_(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) fail_('월은 YYYY-MM 형식이어야 합니다.');
  return month;
}

/** 아이콘은 화면에서 그림을 고르는 열쇠말이라 영문 소문자만 허용한다. */
function checkIcon_(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  if (!v) return 'dots';
  if (!/^[a-z][a-z0-9-]{0,23}$/.test(v)) fail_('아이콘 값이 올바르지 않습니다.');
  return v;
}

function checkText_(value, label, max) {
  var v = String(value == null ? '' : value).trim();
  if (!v) fail_(label + '을(를) 입력해 주세요.');
  if (v.length > max) fail_(label + '이(가) 너무 깁니다. (최대 ' + max + '자)');
  return v;
}

/* ------------------------------------------------------------------ */
/* 사용자 · 멤버                                                        */
/* ------------------------------------------------------------------ */

function currentEmail_() {
  // 화면에서 들어온 요청은 증명서로 확인된 사람이 있다. 그 사람이 우선이다.
  if (MEMO_.actor) return MEMO_.actor;

  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }
  if (!email) fail_('구글 로그인 정보를 읽지 못했습니다.');
  return email.toLowerCase();
}

function nameFromEmail_(email) {
  return String(email).split('@')[0];
}

/** 처음 들어온 사람을 멤버 시트에 등록하고, 전체 멤버 목록을 돌려준다. */
function syncMembers_(email) {
  var sheet = sheet_(SHEET_MEMBER);
  var data = rows_(SHEET_MEMBER, MEMBER_HEADERS.length);
  var seen = {};
  var members = [];

  data.forEach(function (r) {
    var mail = String(r[0] || '').trim().toLowerCase();
    if (!mail || seen[mail]) return;
    seen[mail] = true;
    members.push({ email: mail, name: String(r[1] || '').trim() || nameFromEmail_(mail) });
  });

  if (email && !seen[email]) {
    sheet.appendRow([email, nameFromEmail_(email), new Date()]);
    seen[email] = true;
    members.push({ email: email, name: nameFromEmail_(email) });
  }

  // 시트를 공유받았지만 아직 앱을 열어본 적 없는 사람도 목록에 보이게 한다.
  editorEmails_().forEach(function (mail) {
    if (!mail || seen[mail]) return;
    seen[mail] = true;
    members.push({ email: mail, name: nameFromEmail_(mail), pending: true });
  });

  return members;
}

/**
 * 이 시트를 공유받은 사람들의 메일 주소.
 *
 * 공유 목록을 묻는 일은 시트를 읽는 것보다 한참 느리다(구글 드라이브 쪽에
 * 따로 물어봐야 한다). 그래서 답을 잠시 기억해 둔다. 다만 이 목록이 곧 초대
 * 명단이므로, 공유를 끊었는데 한참 열려 있으면 곤란하다. 십 분만 기억한다.
 */
function editorEmails_() {
  if (MEMO_.editors) return MEMO_.editors;

  var cache = docCache_();
  if (cache) {
    var hit = cache.get(CACHE_EDITORS);
    if (hit) {
      MEMO_.editors = hit ? hit.split(',').filter(function (x) { return x; }) : [];
      return MEMO_.editors;
    }
  }

  var list = [];
  try {
    var ss = ss_();
    ss.getEditors().concat([ss.getOwner()]).forEach(function (u) {
      if (!u) return;
      var mail = String(u.getEmail() || '').trim().toLowerCase();
      if (mail && list.indexOf(mail) === -1) list.push(mail);
    });
  } catch (e) {
    // 권한이 없으면 멤버 시트 기준으로만 보여준다.
  }

  if (cache) cache.put(CACHE_EDITORS, list.join(','), CACHE_EDITORS_SECONDS);
  MEMO_.editors = list;
  return list;
}

/** 내 표시 이름 바꾸기 */
function renameMe(newName) {
  var email = currentEmail_();
  var name = checkText_(newName, '이름', 20);
  var sheet = sheet_(SHEET_MEMBER);
  var data = rows_(SHEET_MEMBER, MEMBER_HEADERS.length);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      sheet.getRange(i + 2, 2).setValue(name);
      return { ok: true, name: name };
    }
  }
  sheet.appendRow([email, name, new Date()]);
  return { ok: true, name: name };
}

/* ------------------------------------------------------------------ */
/* 대분류 (색과 분석 단위)                                               */
/* ------------------------------------------------------------------ */

function readGroups_() {
  return rows_(SHEET_GROUP, GROUP_HEADERS.length)
    .filter(function (r) { return String(r[GRP_NAME - 1] || '').trim(); })
    .map(function (r) {
      var color = String(r[GRP_COLOR - 1] || '').trim();
      return {
        id: String(r[GRP_ID - 1] || '').trim(),
        kind: String(r[GRP_KIND - 1]).trim() === 'income' ? 'income' : 'expense',
        name: String(r[GRP_NAME - 1]).trim(),
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#94a3b8',
        isActive: r[GRP_ACTIVE - 1] !== false && String(r[GRP_ACTIVE - 1]).toUpperCase() !== 'FALSE'
      };
    });
}

function findGroupRow_(id) {
  var data = rows_(SHEET_GROUP, GROUP_HEADERS.length);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][GRP_ID - 1]).trim() === id) return { index: i, row: i + 2, data: data[i], all: data };
  }
  return null;
}

function addGroup(payload) {
  payload = payload || {};
  var kind = checkKind_(payload.kind);
  var name = checkText_(payload.name, '대분류 이름', 20);
  var color = /^#[0-9a-fA-F]{6}$/.test(payload.color || '') ? payload.color : '#94a3b8';

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var groups = readGroups_();
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].kind === kind && groups[i].name === name) {
        if (groups[i].isActive) fail_('같은 이름의 대분류가 이미 있습니다.');
        return updateGroup({ id: groups[i].id, isActive: true, color: color });
      }
    }
    sheet_(SHEET_GROUP).appendRow([newId_(), kind, name, color, true]);
    return catalog_();
  } finally {
    lock.releaseLock();
  }
}

function updateGroup(payload) {
  payload = payload || {};
  var id = checkText_(payload.id, '대분류', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findGroupRow_(id);
    if (!found) fail_('대분류를 찾을 수 없습니다.');
    var sheet = sheet_(SHEET_GROUP);
    var kind = String(found.data[GRP_KIND - 1]).trim();
    var oldName = String(found.data[GRP_NAME - 1]).trim();

    if (payload.name !== undefined) {
      var name = checkText_(payload.name, '대분류 이름', 20);
      if (name !== oldName) {
        for (var j = 0; j < found.all.length; j++) {
          if (j !== found.index &&
              String(found.all[j][GRP_KIND - 1]).trim() === kind &&
              String(found.all[j][GRP_NAME - 1]).trim() === name) {
            fail_('같은 이름의 대분류가 이미 있습니다.');
          }
        }
        sheet.getRange(found.row, GRP_NAME).setValue(name);
        renameGroupInCategories_(kind, oldName, name);
      }
    }
    if (payload.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(payload.color)) {
      sheet.getRange(found.row, GRP_COLOR).setValue(payload.color);
    }
    if (payload.isActive !== undefined) {
      sheet.getRange(found.row, GRP_ACTIVE).setValue(!!payload.isActive);
    }
    return catalog_();
  } finally {
    lock.releaseLock();
  }
}

/** 소분류가 대분류를 이름으로 가리키므로, 이름을 바꾸면 같이 고친다. */
function renameGroupInCategories_(kind, oldName, newName) {
  var sheet = sheet_(SHEET_CAT);
  var last = sheet.getLastRow();
  if (last < 2) return;
  var range = sheet.getRange(2, 1, last - 1, CAT_HEADERS.length);
  var data = range.getValues();
  var changed = false;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][CAT_KIND - 1]).trim() === kind && String(data[i][CAT_GROUP - 1]).trim() === oldName) {
      data[i][CAT_GROUP - 1] = newName;
      changed = true;
    }
  }
  if (changed) range.setValues(data);
}

function deleteGroup(id) {
  id = checkText_(id, '대분류', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findGroupRow_(id);
    if (!found) fail_('대분류를 찾을 수 없습니다.');
    var kind = String(found.data[GRP_KIND - 1]).trim();
    var name = String(found.data[GRP_NAME - 1]).trim();

    var used = readCategories_().filter(function (c) {
      return c.kind === kind && c.group === name;
    }).length;

    if (used > 0) {
      // 소분류가 딸려 있으면 지우지 않고 숨긴다.
      sheet_(SHEET_GROUP).getRange(found.row, GRP_ACTIVE).setValue(false);
      var res = catalog_();
      res.archived = true;
      res.usedCount = used;
      return res;
    }
    sheet_(SHEET_GROUP).deleteRow(found.row);
    var out = catalog_();
    out.archived = false;
    out.usedCount = 0;
    return out;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* 소분류 (그림과 기록 단위)                                             */
/* ------------------------------------------------------------------ */

/** 대분류와 소분류를 함께 돌려준다. 소분류의 색은 대분류에서 물려받는다. */
function catalog_() {
  // 대분류를 한 번만 읽어 소분류 쪽에 넘겨준다. 예전엔 같은 시트를 세 번 읽었다.
  var groups = readGroups_();
  return { groups: groups, categories: readCategories_(groups) };
}

function readCategories_(groups) {
  var colorOf = {};
  (groups || readGroups_()).forEach(function (g) { colorOf[g.kind + ':' + g.name] = g.color; });

  return rows_(SHEET_CAT, CAT_HEADERS.length)
    .filter(function (r) { return String(r[CAT_NAME - 1] || '').trim(); })
    .map(function (r) {
      var kind = String(r[CAT_KIND - 1]).trim() === 'income' ? 'income' : 'expense';
      var group = String(r[CAT_GROUP - 1] || '').trim() || '그 밖에';
      return {
        id: String(r[CAT_ID - 1] || '').trim(),
        kind: kind,
        group: group,
        name: String(r[CAT_NAME - 1]).trim(),
        icon: String(r[CAT_ICON - 1] || '').trim() || 'dots',
        color: colorOf[kind + ':' + group] || '#94a3b8',
        isActive: r[CAT_ACTIVE - 1] !== false && String(r[CAT_ACTIVE - 1]).toUpperCase() !== 'FALSE'
      };
    });
}

/** 소분류가 가리키는 대분류가 실제로 있는지 확인한다. */
function checkGroupName_(kind, value) {
  var name = checkText_(value, '대분류', 20);
  var groups = readGroups_();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].kind === kind && groups[i].name === name) return name;
  }
  fail_('그런 대분류가 없습니다: ' + name);
}

function addCategory(payload) {
  payload = payload || {};
  var kind = checkKind_(payload.kind);
  var name = checkText_(payload.name, '카테고리 이름', 30);
  var group = checkGroupName_(kind, payload.group);
  var icon = checkIcon_(payload.icon);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cats = readCategories_();
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].kind === kind && cats[i].name === name) {
        if (cats[i].isActive) fail_('같은 이름의 카테고리가 이미 있습니다.');
        return updateCategory({ id: cats[i].id, isActive: true, group: group, icon: icon });
      }
    }
    sheet_(SHEET_CAT).appendRow([newId_(), kind, group, name, icon, true]);
    return catalog_();
  } finally {
    lock.releaseLock();
  }
}

function updateCategory(payload) {
  payload = payload || {};
  var id = checkText_(payload.id, '카테고리', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_(SHEET_CAT);
    var data = rows_(SHEET_CAT, CAT_HEADERS.length);
    var index = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][CAT_ID - 1]).trim() === id) { index = i; break; }
    }
    if (index < 0) fail_('카테고리를 찾을 수 없습니다.');

    var row = index + 2;
    var kind = String(data[index][CAT_KIND - 1]).trim();
    var oldName = String(data[index][CAT_NAME - 1]).trim();

    if (payload.name !== undefined) {
      var name = checkText_(payload.name, '카테고리 이름', 30);
      if (name !== oldName) {
        for (var j = 0; j < data.length; j++) {
          if (j !== index &&
              String(data[j][CAT_KIND - 1]).trim() === kind &&
              String(data[j][CAT_NAME - 1]).trim() === name) {
            fail_('같은 이름의 카테고리가 이미 있습니다.');
          }
        }
        sheet.getRange(row, CAT_NAME).setValue(name);
        renameInTransactions_(kind, oldName, name);
      }
    }
    if (payload.group !== undefined) {
      sheet.getRange(row, CAT_GROUP).setValue(checkGroupName_(kind, payload.group));
    }
    if (payload.icon !== undefined) {
      sheet.getRange(row, CAT_ICON).setValue(checkIcon_(payload.icon));
    }
    if (payload.isActive !== undefined) {
      sheet.getRange(row, CAT_ACTIVE).setValue(!!payload.isActive);
    }
    return catalog_();
  } finally {
    lock.releaseLock();
  }
}

/** 시트를 사람이 읽을 수 있게 카테고리를 이름으로 저장하므로, 이름을 바꾸면 지난 내역도 같이 고친다. */
function renameInTransactions_(kind, oldName, newName) {
  var sheet = sheet_(SHEET_TX);
  var last = sheet.getLastRow();
  if (last < 2) return;
  var range = sheet.getRange(2, 1, last - 1, TX_HEADERS.length);
  var data = range.getValues();
  var changed = false;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][TX_KIND - 1]).trim() === kind && String(data[i][TX_CAT - 1]).trim() === oldName) {
      data[i][TX_CAT - 1] = newName;
      changed = true;
    }
  }
  if (changed) range.setValues(data);
}

function deleteCategory(id) {
  id = checkText_(id, '카테고리', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_(SHEET_CAT);
    var data = rows_(SHEET_CAT, CAT_HEADERS.length);
    var index = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][CAT_ID - 1]).trim() === id) { index = i; break; }
    }
    if (index < 0) fail_('카테고리를 찾을 수 없습니다.');

    var kind = String(data[index][CAT_KIND - 1]).trim();
    var name = String(data[index][CAT_NAME - 1]).trim();
    var used = countUsage_(kind, name);

    if (used > 0) {
      // 이미 쓴 내역이 있으면 지우지 않고 숨긴다. 지난 기록이 '미분류'가 되지 않도록.
      sheet.getRange(index + 2, CAT_ACTIVE).setValue(false);
      var res = catalog_();
      res.archived = true;
      res.usedCount = used;
      return res;
    }
    sheet.deleteRow(index + 2);
    var out = catalog_();
    out.archived = false;
    out.usedCount = 0;
    return out;
  } finally {
    lock.releaseLock();
  }
}

function countUsage_(kind, name) {
  return rows_(SHEET_TX, TX_HEADERS.length).filter(function (r) {
    return String(r[TX_KIND - 1]).trim() === kind && String(r[TX_CAT - 1]).trim() === name;
  }).length;
}

/* ------------------------------------------------------------------ */
/* 내역                                                                */
/* ------------------------------------------------------------------ */

function resolveCategoryName_(kind, categoryId) {
  if (!categoryId) return '';
  var cats = readCategories_();
  for (var i = 0; i < cats.length; i++) {
    if (cats[i].id === categoryId) {
      if (cats[i].kind !== kind) fail_('수입/지출 구분과 카테고리가 맞지 않습니다.');
      return cats[i].name;
    }
  }
  fail_('카테고리를 찾을 수 없습니다.');
}

function addTransaction(payload) {
  payload = payload || {};
  var email = currentEmail_();
  var kind = checkKind_(payload.kind);
  var amount = checkAmount_(payload.amount);
  var date = checkDate_(payload.date);
  var memo = String(payload.memo == null ? '' : payload.memo).trim().slice(0, 200);
  var category = resolveCategoryName_(kind, payload.categoryId);
  var owner = payload.userEmail ? String(payload.userEmail).trim().toLowerCase() : email;

  // 한 줄 덧붙이기라 두 사람이 동시에 넣어도 서로 덮어쓰지 않는다.
  sheet_(SHEET_TX).appendRow([
    newId_(), toSheetDate_(date), kind, amount, category, memo, owner, new Date()
  ]);
  return getMonthData(periodOf_(date, readSettings_().startDay));
}

function updateTransaction(payload) {
  payload = payload || {};
  var id = checkText_(payload.id, '내역', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_(SHEET_TX);
    var data = rows_(SHEET_TX, TX_HEADERS.length);
    var index = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][TX_ID - 1]).trim() === id) { index = i; break; }
    }
    if (index < 0) fail_('내역을 찾을 수 없습니다. 상대가 방금 지웠을 수 있어요.');

    var current = data[index];
    var kind = payload.kind === undefined ? String(current[TX_KIND - 1]).trim() : checkKind_(payload.kind);
    var amount = payload.amount === undefined ? Number(current[TX_AMOUNT - 1]) : checkAmount_(payload.amount);
    var date = payload.date === undefined ? toIsoDate_(current[TX_DATE - 1]) : checkDate_(payload.date);
    var memo = payload.memo === undefined
      ? String(current[TX_MEMO - 1] || '')
      : String(payload.memo == null ? '' : payload.memo).trim().slice(0, 200);
    var category = payload.categoryId === undefined && kind === String(current[TX_KIND - 1]).trim()
      ? String(current[TX_CAT - 1] || '')
      : resolveCategoryName_(kind, payload.categoryId);
    var owner = payload.userEmail === undefined
      ? String(current[TX_USER - 1] || '')
      : String(payload.userEmail).trim().toLowerCase();

    sheet.getRange(index + 2, 1, 1, TX_HEADERS.length).setValues([[
      id, toSheetDate_(date), kind, amount, category, memo, owner, current[TX_AT - 1] || new Date()
    ]]);
    return getMonthData(periodOf_(date, readSettings_().startDay));
  } finally {
    lock.releaseLock();
  }
}

function deleteTransaction(id, month) {
  id = checkText_(id, '내역', 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_(SHEET_TX);
    var data = rows_(SHEET_TX, TX_HEADERS.length);
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][TX_ID - 1]).trim() === id) {
        sheet.deleteRow(i + 2);
        return getMonthData(month || periodOf_(toIsoDate_(data[i][TX_DATE - 1]), readSettings_().startDay));
      }
    }
    fail_('내역을 찾을 수 없습니다. 상대가 이미 지웠을 수 있어요.');
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* 조회 · 집계                                                          */
/* ------------------------------------------------------------------ */

/** 앱을 처음 열 때 필요한 것을 한 번에 준다 (호출 왕복을 줄이려고). */
function getBootstrap(month) {
  ensureSheets_();
  var email = currentEmail_();
  var settings = readSettings_();
  var members = syncMembers_(email);
  var cat = catalog_();

  // 방금 읽은 것을 그대로 넘긴다. 안 넘기면 getMonthData 가 설정·멤버·카테고리를
  // 처음부터 다시 읽어서, 앱을 열 때마다 같은 시트를 두 번씩 읽게 된다.
  var data = getMonthData(month || defaultMonth_(settings), {
    settings: settings,
    members: members,
    categories: cat.categories
  });

  data.me = { email: email, name: memberName_(members, email) };
  data.members = members;
  data.groups = cat.groups;
  data.categories = cat.categories;
  data.sheetUrl = sheetUrl_();
  return data;
}

function defaultMonth_(settings) {
  var today = Utilities.formatDate(new Date(), tzone_(), 'yyyy-MM-dd');
  return periodOf_(today, (settings || readSettings_()).startDay);
}

function memberName_(members, email) {
  for (var i = 0; i < members.length; i++) {
    if (members[i].email === email) return members[i].name;
  }
  return nameFromEmail_(email);
}

/** 한 달치 내역과 요약. 화면에 필요한 계산은 전부 여기서 끝낸다. */
function getMonthData(month, ctx) {
  // ctx 는 앱이 열릴 때 이미 읽어둔 값을 넘겨받는 자리다. 화면에서 부를 때는 비어 있다.
  ctx = ctx || {};
  month = checkMonth_(month);
  var settings = ctx.settings || readSettings_();
  var range = periodRange_(month, settings.startDay);
  var members = ctx.members || syncMembers_('');
  var cats = ctx.categories || readCategories_();

  var colorOf = {}, iconOf = {}, groupOf = {};
  cats.forEach(function (c) {
    colorOf[c.kind + ':' + c.name] = c.color;
    iconOf[c.kind + ':' + c.name] = c.icon;
    groupOf[c.kind + ':' + c.name] = c.group;
  });

  var transactions = [];
  rows_(SHEET_TX, TX_HEADERS.length).forEach(function (r) {
    var id = String(r[TX_ID - 1] || '').trim();
    var date = toIsoDate_(r[TX_DATE - 1]);
    if (!id || date < range.from || date > range.to) return;
    var kind = String(r[TX_KIND - 1]).trim() === 'income' ? 'income' : 'expense';
    var amount = Number(r[TX_AMOUNT - 1]) || 0;
    if (amount <= 0) return;
    var name = String(r[TX_CAT - 1] || '').trim();
    var email = String(r[TX_USER - 1] || '').trim().toLowerCase();
    transactions.push({
      id: id,
      date: date,
      kind: kind,
      amount: amount,
      categoryName: name || '미분류',
      categoryColor: colorOf[kind + ':' + name] || '#94a3b8',
      categoryIcon: iconOf[kind + ':' + name] || 'dots',
      categoryGroup: groupOf[kind + ':' + name] || '그 밖에',
      memo: String(r[TX_MEMO - 1] || ''),
      userEmail: email,
      userName: memberName_(members, email)
    });
  });

  transactions.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return 0;
  });

  return {
    month: month,
    range: range,
    settings: settings,
    transactions: transactions,
    summary: summarize_(transactions, members)
  };
}

function summarize_(transactions, members) {
  var total = { income: 0, expense: 0, balance: 0 };
  var byMember = {};
  var order = [];

  members.forEach(function (m) {
    byMember[m.email] = { email: m.email, name: m.name, income: 0, expense: 0, balance: 0 };
    order.push(m.email);
  });

  var byCategory = {};
  var catOrder = [];
  var byGroup = {};
  var groupOrder = [];

  transactions.forEach(function (t) {
    total[t.kind] += t.amount;

    if (!byMember[t.userEmail]) {
      byMember[t.userEmail] = {
        email: t.userEmail,
        name: t.userEmail ? nameFromEmail_(t.userEmail) : '(알 수 없음)',
        income: 0, expense: 0, balance: 0
      };
      order.push(t.userEmail);
    }
    byMember[t.userEmail][t.kind] += t.amount;

    var key = t.kind + ':' + t.categoryName;
    if (!byCategory[key]) {
      byCategory[key] = {
        name: t.categoryName, kind: t.kind, group: t.categoryGroup, color: t.categoryColor,
        icon: t.categoryIcon, total: 0, perUser: {}
      };
      catOrder.push(key);
    }
    byCategory[key].total += t.amount;
    byCategory[key].perUser[t.userEmail] = (byCategory[key].perUser[t.userEmail] || 0) + t.amount;

    // 분석 화면은 대분류로 묶어 본다. 소분류가 많아도 그래프가 읽힌다.
    var gkey = t.kind + ':' + t.categoryGroup;
    if (!byGroup[gkey]) {
      byGroup[gkey] = {
        name: t.categoryGroup, kind: t.kind, color: t.categoryColor, total: 0, perUser: {}
      };
      groupOrder.push(gkey);
    }
    byGroup[gkey].total += t.amount;
    byGroup[gkey].perUser[t.userEmail] = (byGroup[gkey].perUser[t.userEmail] || 0) + t.amount;
  });

  total.balance = total.income - total.expense;

  var memberList = order.map(function (email) {
    var m = byMember[email];
    m.balance = m.income - m.expense;
    return m;
  });

  var categoryList = catOrder.map(function (k) { return byCategory[k]; })
    .sort(function (a, b) { return b.total - a.total; });

  var groupList = groupOrder.map(function (k) { return byGroup[k]; })
    .sort(function (a, b) { return b.total - a.total; });

  return {
    total: total, byMember: memberList,
    byGroup: groupList, byCategory: categoryList,
    transactionCount: transactions.length
  };
}
