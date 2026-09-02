/*
 * 화면 파일을 폰에 담아두는 일꾼.
 *
 * 브라우저가 '이건 앱이다'라고 인정하려면 이 파일이 있어야 한다. 그래야 아이콘이
 * 붙고 주소창이 사라진다.
 *
 * 담아두기는 조심해서 한다. 잘못 담아두면 고친 화면이 폰에 영영 안 보인다.
 * 규칙은 둘이다.
 *
 *  - 판 번호가 붙은 파일(app.js?v=…)은 담아둬도 안전하다. 고치면 번호가 바뀌고,
 *    번호가 바뀌면 다른 파일이 되어 새로 받는다.
 *  - index.html 은 그 번호들을 담고 있는 문서다. 이게 낡으면 낡은 번호를 가리켜
 *    모든 게 낡는다. 그래서 이것만은 늘 새로 받아온다.
 */
var CACHE = 'kkineun-20260902c';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // 우리 화면 파일만 다룬다. 시트로 가는 요청과 구글 로그인은 손대지 않는다.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 문서와 판 번호 없는 파일은 브라우저가 몰래 쥐고 있던 것도 무시하고 새로 받는다
  var mustBeFresh = e.request.mode === 'navigate' || !url.search;

  e.respondWith(
    fetch(mustBeFresh ? new Request(url.href, { cache: 'reload' }) : e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('./index.html') || caches.match('./');
        });
      })
  );
});
