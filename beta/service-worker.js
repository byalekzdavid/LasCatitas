const CACHE_NAME = "las-catitas-v3";
const BASE = "/LasCatitas/";

const FILES = [
  BASE,
  BASE + "index.html",
  BASE + "audios.html",
  BASE + "style.css",
  BASE + "manifest.json",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png"
];

// Gestionar el clic solamente en las notificaciones
// que mostramos manualmente cuando la página está abierta.
// Se registra antes de importar Firebase, como recomienda
// la documentación de Firebase Messaging.
self.addEventListener("notificationclick", event => {
  const datos = event.notification.data || {};

  // Las notificaciones de fondo las gestiona Firebase.
  if (!datos.notificacionLasCatitas) return;

  event.notification.close();

  const destino = new URL(
    datos.url || BASE + "index.html",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(async clientes => {
      const cliente = clientes.find(c =>
        c.url.startsWith(self.location.origin + BASE)
      );

      if (cliente) {
        await cliente.navigate(destino);
        return cliente.focus();
      }

      return self.clients.openWindow(destino);
    })
  );
});

// Firebase Messaging: SDK compatible con el código actual.
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyCX3vKQbWOEO4IP0ppPlHsIuiHN4sy0qTc",
  authDomain: "las-catitas.firebaseapp.com",
  projectId: "las-catitas",
  storageBucket: "las-catitas.firebasestorage.app",
  messagingSenderId: "69962715074",
  appId: "1:69962715074:web:b88edad813c0674e29505b"
});

const messaging = firebase.messaging();

// Firebase muestra automáticamente los mensajes que contienen
// una carga notification cuando llegan en segundo plano.
// Solo mostramos manualmente los mensajes que sean de datos.
messaging.onBackgroundMessage(payload => {
  console.log(
    "[Las Catitas] Mensaje recibido en segundo plano."
  );

  if (payload.notification) {
    // Evita duplicar la notificación automática de Firebase.
    return;
  }

  const datos = payload.data || {};
  const titulo = datos.title || "Las Catitas";
  const opciones = {
    body: datos.body || "",
    icon: BASE + "icons/icon-192.png",
    data: {
      notificacionLasCatitas: true,
      url: datos.url || BASE + "index.html"
    }
  };

  return self.registration.showNotification(titulo, opciones);
});

// Instalar el service worker y precargar archivos.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(FILES)
    )
  );

  self.skipWaiting();
});
// Instalar el service worker y precargar archivos.
/*self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(FILES).catch(() => {})
    )
  );

  self.skipWaiting();
});

// Activar la nueva versión y borrar cachés anteriores.
/* self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  
  self.clients.claim();
});
  borrar ->*/ 
// Activar la nueva versión y borrar cachés anteriores de Las Catitas.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("las-catitas-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Mantener el funcionamiento actual de la PWA sin conexión.
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    request.method !== "GET"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copia = response.clone();

          caches.open(CACHE_NAME).then(cache =>
            cache.put(request, copia)
          );

          return response;
        })
        .catch(async () =>
          (await caches.match(request)) ||
          caches.match(BASE + "index.html")
        )
    );
  } else {
    event.respondWith(
      caches.match(request).then(hit =>
        hit ||
        fetch(request).then(response => {
          if (response.ok) {
            const copia = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, copia)
            );
          }

          return response;
        })
      )
    );
  }
});
