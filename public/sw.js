// FinTracker minimal service worker.
// Strategy:
//   - HTML / dashboard / quick → network-first (so updates ship instantly),
//     fall back to the last cached copy when offline.
//   - Same-origin /_next/static, /fonts/, /icon.svg → cache-first (immutable).
//   - /api/* → network only, never cached (data must be fresh).
const VERSION = "v1"
const SHELL = `ft-shell-${VERSION}`
const RUNTIME = `ft-runtime-${VERSION}`

self.addEventListener("install", e => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener("fetch", e => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Never cache the API
  if (url.pathname.startsWith("/api/")) return

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.json"

  if (isStaticAsset) {
    e.respondWith(cacheFirst(req))
  } else if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(networkFirst(req))
  }
})

async function cacheFirst(req) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    const hit = await cache.match(req)
    if (hit) return hit
    return new Response("Offline", { status: 503, statusText: "Offline" })
  }
}
