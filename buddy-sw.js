/* Buddy 自管 Service Worker —— 用法：navigator.serviceWorker.register('/buddy-pet-web/buddy-sw.js?v=...')
 *
 * 策略：
 *   - 代码/HTML/JS（network-first，保新鲜不缓存旧版本）：
 *       /, /index.html, /main.dart.js, /flutter.js, /flutter_bootstrap.js,
 *       /manifest.json, /version.json, /favicon.png, /sqlite3.wasm
 *   - 大型资源（cache-first，二次秒开）：
 *       /canvaskit/, /assets/, /icons/
 *
 * 缓存版本化：版本号由构建脚本注入。版本变更时旧缓存自动清理，避免旧资源滞留。
 */
(function(){
  'use strict';
  // === 构建期常量（build_web.sh 会替换 '20260904-063014'）===
  var SW_VERSION = '20260904-063014';
  var ASSET_CACHE = 'buddy-assets-' + SW_VERSION;
  var PAGE_CACHE  = 'buddy-page-'  + SW_VERSION;

  self.addEventListener('install', function(event){
    event.waitUntil((async function(){
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){
        if (k.indexOf('buddy-') === 0 && k !== ASSET_CACHE && k !== PAGE_CACHE) {
          return caches.delete(k);
        }
      }));
      self.skipWaiting();
    })());
  });

  self.addEventListener('activate', function(event){
    event.waitUntil((async function(){
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){
        if (k.indexOf('buddy-') === 0 && k !== ASSET_CACHE && k !== PAGE_CACHE) {
          return caches.delete(k);
        }
      }));
      await self.clients.claim();
    })());
  });

  function isAsset(url){
    return url.indexOf('/canvaskit/') !== -1
        || url.indexOf('/assets/') !== -1
        || url.indexOf('/icons/') !== -1
        || /\.wasm$/.test(url);
  }
  function isPage(url){
    // 任何根路径下的非资源请求都按代码处理
    return !isAsset(url);
  }

  // 网络优先（代码/HTML）—— 永远拿最新，拿不到再回退到缓存
  async function networkFirst(req){
    try {
      var fresh = await fetch(req);
      if (fresh && fresh.ok) {
        var cache = await caches.open(PAGE_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      var cached = await caches.match(req);
      if (cached) return cached;
      throw e;
    }
  }

  // 缓存优先（资源）—— 优先用缓存，没有就下，下完缓存
  async function cacheFirst(req){
    var cached = await caches.match(req);
    if (cached) return cached;
    var fresh = await fetch(req);
    if (fresh && fresh.ok) {
      var cache = await caches.open(ASSET_CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  }

  self.addEventListener('fetch', function(event){
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
      isAsset(url.pathname) ? cacheFirst(req) : networkFirst(req)
    );
  });
})();