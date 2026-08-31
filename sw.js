/*
 * 화면 파일을 폰에 담아두는 일꾼.
 *
 * 브라우저가 '이건 앱이다'라고 인정하려면 이 파일이 있어야 한다(그래야 주소창이
 * 사라진다). 겸사겸사 화면 파일을 담아둬서 두 번째부터는 훨씬 빨리 열린다.
 *
 * 내역 자료는 절대 담아두지 않는다. 그건 늘 새로 받아와야 맞다.
 */
var CACHE = 'kkineun-v1';
var SHELL = ['./', './index.html', './styles.css', './app.js', './config.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // 우리 화면 파일만 다룬다. 시트로 가는 요청과 구글 로그인은 손대지 않는다.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 새 것을 먼저 받아보고, 안 되면 담아둔 것을 쓴다. 그래야 고친 화면이 바로 반영된다.
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
