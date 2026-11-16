/*
 * Service worker for the Providence Academy app.
 *
 * Two jobs: show notifications, and open the right screen when one is
 * tapped. Deliberately does not cache pages. An offline cache on a school
 * announcement app mostly serves families stale closing notices, which is
 * worse than a blank screen.
 *
 * iOS requires every push to be user-visible. A push that does not call
 * showNotification causes iOS to revoke the subscription, so the catch-all
 * below always shows something.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Providence Academy';
  const options = {
    body: payload.body || 'There is a new post.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.tag || 'providence-post',
    // An emergency notice should not be silently collapsed into an older one.
    renotify: Boolean(payload.renotify),
    requireInteraction: payload.priority === 'emergency',
    data: { url: payload.url || '/feed' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/feed';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an open copy of the app rather than opening a second one.
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
        return undefined;
      }),
  );
});

/*
 * Browsers expire push subscriptions periodically. When that happens the
 * client re-subscribes on next load; this listener just clears the old one
 * so the server stops sending to a dead endpoint.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push/expired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
      }),
    }).catch(() => {}),
  );
});
