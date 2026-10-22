const CACHE_VERSION = 'v1'; // ⬅️ نسخه را برای آپدیت‌های بعدی تغییر دهید
const CACHE_NAME = 'vibe-cache-' + CACHE_VERSION;
const SHELL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2' // کش کردن SDK
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => { }))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
                });
            })
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // درخواست‌های Supabase و APIها را کش نکن
    if (url.hostname.includes('supabase.co')) return;

    // فایل‌های HTML: Network-First (همیشه جدیدترین نسخه، در صورت آفلاین از کش)
    if (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
        );
        return;
    }

    // فایل‌های JS, CSS, تصاویر: Stale-While-Revalidate (سریع + آپدیت پس‌زمینه)
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req).then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                }
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});