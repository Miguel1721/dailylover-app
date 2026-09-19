// Daily Lover Service Worker - PWA & Web Push Handler
const CACHE_NAME = 'dailylover-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener para mensajes directos de la aplicación (Web Push local en primer y segundo plano)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || '💌 Daily Lover', {
        icon: '/admin/icon-192.png',
        badge: '/admin/icon-192.png',
        vibrate: [200, 100, 200],
        ...options
      })
    );
  }
});

// Listener para eventos push del servidor
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notificación', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '💌 Daily Lover';
  const options = {
    body: data.body || data.message || 'Nueva actualización en el sistema',
    icon: '/admin/icon-192.png',
    badge: '/admin/icon-192.png',
    tag: data.tag || `dailylover-${Date.now()}`,
    vibrate: [200, 100, 200],
    renotify: true,
    data: { url: data.url || '/admin/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listener al hacer clic sobre la notificación en el celular
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || '/admin/';
  const fullUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(fullUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
