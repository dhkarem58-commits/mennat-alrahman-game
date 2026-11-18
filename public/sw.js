const CACHE_NAME = 'minnah-academy-3d-v1';
const FONT_CACHE_NAME = 'minnah-fonts-v1';

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.png',
  '/favicon-32.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'apis.google.com',
  'accounts.google.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== FONT_CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never intercept Firebase Auth, Firestore, or Google OAuth endpoints
  if (BYPASS_HOSTS.some((host) => url.hostname.endsWith(host))) {
    return;
  }

  // Google Fonts: CacheFirst for fast offline Arabic typography (Amiri & Cairo)
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch {
          return cached || new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Only handle same-origin requests beyond Google Fonts
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: Network-first with cached index fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html'));
          return cached || new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // Static JS/CSS/Assets: Stale-while-revalidate for smooth offline + fresh updates
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
