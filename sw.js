/* 走场填表工具 - 离线缓存
   策略：主文件 index.html 走「网络优先」（保证更新能到手，断网回退缓存）；
        图标/manifest 走「缓存优先」（体积小、几乎不变）。 */
var CACHE = 'zcform-v2';
var SHELL = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isDoc(req, url) {
  return req.mode === 'navigate' || /\.html?$/.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isDoc(req, url)) {
    // 网络优先：抢到最新版本；失败则用缓存（离线可用）
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          var key = new URL('./index.html', self.location).href;
          caches.open(CACHE).then(function (c) { c.put(key, copy); }).catch(function () {});
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 其它静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return resp;
      });
    })
  );
});
