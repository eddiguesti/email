// LB-BOT Service Worker — handles background push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'LB-BOT', body: event.data.text(), url: '/dashboard/review/queue' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'LB-BOT', {
      body: data.body || 'Nouveaux emails à valider',
      icon: '/logo-small.png',
      badge: '/logo-small.png',
      tag: 'lb-bot-review',       // replaces previous notification instead of stacking
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
      // If dashboard is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});
