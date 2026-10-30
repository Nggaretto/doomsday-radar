// Service Worker: بيستقبل الإشعارات والتطبيق مقفول ويعرضها بإلحاح (اهتزاز + مفيش اختفاء تلقائي)
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
  '/firebase-config.js'
);

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || '🚨 الحجز فتح!', {
    body: d.body || 'افتح التطبيق دلوقتي',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    tag: 'doomsday-alert',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [600, 200, 600, 200, 900, 200, 900, 200, 1200],
    data: { url: d.url || '/' },
    actions: [{ action: 'open', title: 'افتح واحجز' }],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate && c.navigate(target);
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', () => {}); // مطلوب عشان المتصفح يعتبره تطبيق قابل للتثبيت
