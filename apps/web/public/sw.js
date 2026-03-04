// Grand Azure Bot Service Worker — handles background push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Grand Azure Bot', body: event.data.text(), url: '/dashboard/review/queue' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Grand Azure Bot', {
      body: data.body || 'New emails awaiting review',
      icon: '/logo-small.png',
      badge: '/logo-small.png',
      tag: 'grand-azure-review',
      renotify: true,
      data: { url: data.url || '/dashboard/review/queue' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard/review/queue';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
