// Service Worker for Done Delivery
// Provides offline capabilities and caching

const CACHE_NAME = 'done-delivery-v1.0.0';
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

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
            })
    );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
    // Skip Chrome extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    // Skip Firebase requests - always fetch from network
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('paystack.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch(error => {
                console.error('Fetch failed:', error);
                
                // Return offline page if available
                return caches.match('/index.html');
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
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
    // Get pending parcels from IndexedDB
    // Send them to Firebase when online
    console.log('Syncing parcels...');
}

// Push notifications
self.addEventListener('push', event => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
