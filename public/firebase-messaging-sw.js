// Service Worker: instala o app como PWA e recebe notificações push (FCM) mesmo com o app fechado.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBJa2FQ7LGJNTIne8iiyRXCr0Og8V1NtVs",
    authDomain: "finance-pro-v1.firebaseapp.com",
    projectId: "finance-pro-v1",
    storageBucket: "finance-pro-v1.firebasestorage.app",
    messagingSenderId: "866672231232",
    appId: "1:866672231232:web:1b4401c3123bb42c26b0a5"
});

const messaging = firebase.messaging();

// Notificação de vencimento chegando com o app fechado/em segundo plano.
messaging.onBackgroundMessage(payload => {
    const titulo = payload.notification?.title || 'Planner Financeiro';
    self.registration.showNotification(titulo, {
        body: payload.notification?.body || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { url: '/index.html' }
    });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/index.html'));
});

// Passthrough simples — só existe pra satisfazer o critério de instalabilidade do PWA
// (não faz cache agressivo: os dados do app vêm ao vivo do Firestore).
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
