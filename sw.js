/*
 * 화면 파일을 폰에 담아두는 일꾼.
 *
 * 브라우저가 '이건 앱이다'라고 인정하려면 이 파일이 있어야 한다. 그래야 아이콘이
 * 붙고 주소창이 사라진다.
 *
 * 담아두기는 최소한으로 한다. 미리 잔뜩 담아두면 고친 화면이 폰에 안 보여서,
 * 왜 안 바뀌냐고 한참 헤매게 된다. 늘 새 것을 먼저 받아보고, 인터넷이 안 될
 * 때만 담아둔 것을 꺼낸다.
 */
var CACHE = 'kkineun-20260831a';

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

  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
