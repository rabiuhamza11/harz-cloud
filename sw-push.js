/**
 * HARZ Push Service Worker
 * Handles push notifications in the background
 * Place in the root of each HARZ platform
 */

const API_BASE = 'https://harz-cloud.onrender.com';

// Push event — notification received
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'HARZ Notification', body: event.data.text() };
  }
  
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/harz-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'harz-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'HARZ', options)
  );
});

// Notification click — open app or specific page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = data.url || '/';
  
  // Handle action clicks
  if (event.action) {
    data.action = event.action;
  }
  
  // Open the app
  event.waitUntil(
    clients.openWindow(url)
  );
});

// Subscribe to push on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Message from page — subscribe
self.addEventListener('message', (event) => {
  if (event.data.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.data.vapidKey
      }).then(sub => {
        // Send subscription to server
        fetch(API_BASE + '/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': event.data.token
          },
          body: JSON.stringify({
            subscription: sub,
            platform: event.data.platform || 'web'
          })
        });
      })
    );
  }
});
