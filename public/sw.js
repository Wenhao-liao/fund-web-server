const CACHE_NAME = "fund-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // 👉 API 接口走网络
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 👉 静态资源走缓存
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
