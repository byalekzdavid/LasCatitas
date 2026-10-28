// Importar los scripts necesarios de Firebase para la versión modular (compat)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (debe coincidir con la que usas en tu app)
firebase.initializeApp({
  apiKey: "AIzaSyCX3vKQbWOEO4IP0ppPlHsIuiHN4sy0qTc",
  authDomain: "las-catitas.firebaseapp.com",
  projectId: "las-catitas",
  storageBucket: "las-catitas.firebasestorage.app",
  messagingSenderId: "69962715074",
  appId: "1:69962715074:web:b88edad813c0674e29505b"
});

const messaging = firebase.messaging();

// Opcional: Manejar notificaciones en segundo plano si es necesario personalizar el título/icono
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: './icons/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
