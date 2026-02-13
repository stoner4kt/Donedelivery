// Service Worker for Done Delivery
// Optimized for Spck Editor development and Production reliability

// 1. UPDATE THIS VERSION STRING TO FORCE REFRESHES
const CACHE_NAME = 'done-delivery-v1.0.1'; 

// 2. TOGGLE THIS TO 'false' IF YOU WANT TO DISABLE CACHING ENTIRELY IN SPCK
const IS_DEVELOPMENT = false; 

const urlsToCache = [
    '/',
    '/index.html',
    '/driver.html',
    '/style.css',
    '/script.js',
    '/auth.js',
    '/parcel.js',
    '/tracking.js',
    '/payment.js',
    '/labels.js',
    '/driver.js',
    '/config.js',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - Forces the new service worker to take over immediately
self.addEventListener('install', event => {
    self.skipWaiting(); // Forces activation of the new SW
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache version:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .catch(error => console.error('Cache failed:', error))
    );
});

// Activate event - Deletes old caches immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open tabs
    );
});

// Fetch event - NETWORK-FIRST Strategy
self.addEventListener('fetch', event => {
    // Basic filters
    if (event.request.url.startsWith('chrome-extension://') || !IS_DEVELOPMENT) {
        return;
    }

    // Always fetch dynamic API data from network
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('paystack.co')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If network is available, update the cache and return the fresh file
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network fails (offline), look for it in the cache
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || caches.match('/index.html');
                });
            })
    );
});

// Background sync for offline parcel creation
self.addEventListener('sync', event => {
    if (event.tag === 'sync-parcels') {
        event.waitUntil(syncParcels());
    }
});

async function syncParcels() {
    console.log('Syncing parcels to Firebase...');
}

// Push notifications
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : { title: 'New Update', body: 'Check your delivery status.' };
    const options = {
        body: data.body,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});