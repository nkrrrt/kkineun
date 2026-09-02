/**
 * 구글 Apps Script 환경을 흉내 내는 테스트용 가짜 구현.
 *
 * Apps Script 는 구글 서버에서만 돌아가므로, 여기서 SpreadsheetApp · Session ·
 * LockService 등을 메모리 위에 재현해 Code.gs 를 그대로 실행시켜 본다.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const CODE_PATH = fileURLToPath(new URL('../../apps-script/Code.gs', import.meta.url));

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const line = [];
      for (let c = 0; c < this.numCols; c += 1) {
        line.push(this.sheet._cell(this.row + r, this.col + c));
      }
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.numRows || values[0].length !== this.numCols) {
      throw new Error(`setValues 크기 불일치: ${values.length}x${values[0].length} vs ${this.numRows}x${this.numCols}`);
    }
    values.forEach((line, r) =>
      line.forEach((v, c) => this.sheet._setCell(this.row + r, this.col + c, v))
    );
    return this;
  }
  setValue(value) {
    this.sheet._setCell(this.row, this.col, value);
    return this;
  }
  setFontWeight() {
    return this;
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.data = []; // 0-based 행 배열
    this.frozenRows = 0;
    this.widths = {};
  }
  getName() {
    return this.name;
  }
  _cell(row, col) {
    const line = this.data[row - 1];
    const v = line ? line[col - 1] : undefined;
    return v === undefined ? '' : v;
  }
  _setCell(row, col, value) {
    while (this.data.length < row) this.data.push([]);
    const line = this.data[row - 1];
    while (line.length < col) line.push('');
    line[col - 1] = value;
  }
  getLastColumn() {
    let max = 0;
    for (const line of this.data) {
      for (let c = (line ?? []).length - 1; c >= 0; c -= 1) {
        const v = line[c];
        if (v !== '' && v !== undefined && v !== null) { max = Math.max(max, c + 1); break; }
      }
    }
    return max;
  }
  clear() {
    this.data = [];
    return this;
  }
  insertColumnAfter(col) {
    for (const line of this.data) {
      if (line) line.splice(col, 0, '');
    }
    return this;
  }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i -= 1) {
      const line = this.data[i] ?? [];
      if (line.some((v) => v !== '' && v !== undefined && v !== null)) return i + 1;
    }
    return 0;
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    if (numRows < 1 || numCols < 1) throw new Error('getRange: 행/열 개수는 1 이상이어야 합니다.');
    return new FakeRange(this, row, col, numRows, numCols);
  }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    values.forEach((v, i) => this._setCell(row, i + 1, v));
    return this;
  }
  deleteRow(row) {
    this.data.splice(row - 1, 1);
    return this;
  }
  setFrozenRows(n) {
    this.frozenRows = n;
    return this;
  }
  setColumnWidth(col, w) {
    this.widths[col] = w;
    return this;
  }
}

class FakeSpreadsheet {
  constructor({ owner, editors }) {
    this.sheets = [];
    this.owner = owner;
    this.editors = editors;
  }
  getSheetByName(name) {
    return this.sheets.find((s) => s.getName() === name) ?? null;
  }
  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
  getSpreadsheetTimeZone() {
    return 'Asia/Seoul';
  }
  getUrl() {
    return 'https://docs.google.com/spreadsheets/d/FAKE_ID/edit';
  }
  getOwner() {
    return { getEmail: () => this.owner };
  }
  getEditors() {
    return this.editors.map((e) => ({ getEmail: () => e }));
  }
}

/**
 * Code.gs 를 가짜 환경에서 실행하고, 그 안의 함수들을 돌려준다.
 * activeEmail 을 바꾸면 다른 사람이 접속한 상황을 흉내 낼 수 있다.
 */
export function loadGas({ owner = 'jimin@example.com', editors = ['suho@example.com'] } = {}) {
  // 구글에 증명서를 물어보는 흉내. tokens 에 넣어둔 것만 진짜로 친다.
  const tokens = new Map();
  // 구글에 실제로 몇 번 물어봤는지. 쓸데없이 자주 물으면 하루 한도를 다 쓴다.
  let asked = 0;
  const spreadsheet = new FakeSpreadsheet({ owner, editors });
  const session = { email: owner };
  let uuidCounter = 0;
  // 실행이 끝나도 남는 구글 쪽 짧은 기억. 실제 CacheService 처럼 호출 사이에 살아남는다.
  const cacheStore = new Map();

  const sandbox = {
    console,
    // vm 은 자체 Date 를 갖는다. 호스트 것을 주입해야 instanceof Date 가 양쪽에서 통한다.
    Date,
    JSON,
    SpreadsheetApp: {
      getActive: () => spreadsheet,
      getUi: () => {
        throw new Error('테스트 환경에는 UI 가 없습니다.');
      },
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => session.email }),
      getScriptTimeZone: () => 'Asia/Seoul',
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    Utilities: {
      getUuid: () => `uuid-${String(++uuidCounter).padStart(6, '0')}-aaaa-bbbb-cccc`,
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_alg, value) => [...createHash('sha256').update(String(value)).digest()],
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
      formatDate: (date, _tz, format) => {
        const p = (n) => String(n).padStart(2, '0');
        if (format === 'yyyy-MM') return `${date.getFullYear()}-${p(date.getMonth() + 1)}`;
        return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
      },
    },
    HtmlService: {
      createTemplateFromFile: () => {
        // doGet 이 템플릿에 무엇을 실어 보내는지 테스트가 들여다볼 수 있게 남겨둔다
        const tpl = {
          evaluate: () => ({
            setTitle() { return this; },
            addMetaTag() { return this; },
            setFaviconUrl(url) { rejectFaviconIfAsked(url); return this; },
          }),
        };
        sandbox.HtmlService.lastTemplate = tpl;
        return tpl;
      },
      lastTemplate: null,
      createHtmlOutputFromFile: () => ({ getContent: () => '' }),
      createHtmlOutput: (s) => ({
        setHeight: () => s,
        setFaviconUrl(url) { rejectFaviconIfAsked(url); return this; },
      }),
      // 테스트에서 구글이 아이콘 주소를 거절하는 상황을 흉내 낼 때 쓴다.
      // failFaviconWith 는 모두 거절, failFaviconIf 는 맞는 주소만 거절.
      failFaviconWith: '',
      failFaviconIf: null,
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
        put: (k, v) => { cacheStore.set(k, String(v)); },
        remove: (k) => { cacheStore.delete(k); },
      }),
    },
    UrlFetchApp: {
      fetch: (url) => {
        asked += 1;
        const m = String(url).match(/id_token=([^&]+)/);
        const hit = m ? tokens.get(decodeURIComponent(m[1])) : null;
        return {
          getResponseCode: () => (hit ? 200 : 400),
          getContentText: () => JSON.stringify(hit || { error: 'invalid_token' }),
        };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        setMimeType() { return this; },
        getContent: () => text,
      }),
    },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/FAKE/exec' }) },
  };

  function rejectFaviconIfAsked(url) {
    const { failFaviconWith, failFaviconIf } = sandbox.HtmlService;
    if (failFaviconWith) throw new Error(failFaviconWith);
    if (failFaviconIf && failFaviconIf.test(String(url ?? ''))) {
      throw new Error(`이 주소는 아이콘으로 쓸 수 없습니다: ${url}`);
    }
  }

  const context = createContext(sandbox);
  runInContext(readFileSync(CODE_PATH, 'utf8'), context, { filename: 'Code.gs' });

  return {
    /** 접속한 사람 바꾸기 */
    loginAs(email) {
      session.email = email;
    },
    /** 시트 내용을 그대로 들여다보기 (사람이 직접 시트를 볼 때와 같은 값) */
    dump(name) {
      const sheet = spreadsheet.getSheetByName(name);
      return sheet ? sheet.data.map((r) => [...r]) : null;
    },
    sheetNames: () => spreadsheet.sheets.map((s) => s.getName()),
    /**
     * 구글이 발급한 증명서를 하나 만들어 둔다.
     *
     * 실제 증명서와 같은 모양(머리.내용.서명)으로 만든다. 서버가 모양부터 보고
     * 아닌 것은 구글에 묻지도 않으므로, 아무 글자나 쓰면 그 검사에 걸린다.
     */
    issueToken(name, { email, aud, verified = true, expiresInSec = 3600, iss } = {}) {
      const info = {
        nonce: String(name),
        aud: aud ?? context.CLIENT_ID,
        iss: iss ?? 'https://accounts.google.com',
        email,
        email_verified: String(verified),
        exp: String(Math.floor(Date.now() / 1000) + expiresInSec),
      };
      // 내용 칸에 진짜로 그 정보를 담는다. 화면이 만료 시각을 직접 읽어보기 때문이다.
      const token = `head.${Buffer.from(JSON.stringify(info)).toString('base64url')}.sign`;
      tokens.set(token, info);
      return token;
    },
    /** 구글에 물어본 횟수 */
    asked: () => asked,
    /** 화면이 창구를 부르는 것과 같은 모양으로 요청한다. */
    post(body) {
      context.MEMO_ = {};
      const out = context.doPost({ postData: { contents: JSON.stringify(body) } });
      return JSON.parse(out.getContent());
    },
    /** 구글이 캐시를 비운(또는 아직 채우지 않은) 상태를 만든다. */
    forgetCache() {
      cacheStore.clear();
    },
    call(fn, ...args) {
      if (typeof context[fn] !== 'function') throw new Error(`${fn} 함수가 없습니다.`);
      // Apps Script 는 호출마다 스크립트를 처음부터 다시 돌린다. 실행 중에만 쓰는
      // 기억은 그때마다 사라지므로, 여기서도 똑같이 비우고 시작한다.
      context.MEMO_ = {};
      const result = context[fn](...args);
      if (result === undefined) return result;
      // google.script.run 은 결과를 JSON 으로 직렬화해 브라우저로 보낸다.
      // 같은 과정을 거치게 해서 '보낼 수 없는 값'이 섞이면 여기서 드러나게 한다.
      return JSON.parse(JSON.stringify(result));
    },
    context,
  };
}
