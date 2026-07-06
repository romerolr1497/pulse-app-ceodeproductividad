// Pulse service worker — notificaciones de rutina + soporte offline
const CACHE = "pulse-v5";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpia caches de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Estrategia: navegación -> network-first (fallback a cache);
// assets estáticos (_next/static, imágenes) -> cache-first.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";
  const isStatic = url.pathname.startsWith("/_next/static") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname);

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (_) {
          const cached = await caches.match(req);
          return cached || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (_) {
          return cached || Response.error();
        }
      })()
    );
  }
});

// Recibe horarios desde la app y programa notificaciones locales
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SCHEDULE") {
    scheduleNotifications(data.items || []);
  }
  if (data.type === "TEST") {
    self.registration.showNotification("Pulse", {
      body: "Las notificaciones están activas ✅",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "pulse-test",
    });
  }
});

let timers = [];

function scheduleNotifications(items) {
  // Limpia timers previos
  timers.forEach((t) => clearTimeout(t));
  timers = [];

  const now = Date.now();
  for (const item of items) {
    const delay = item.at - now;
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue; // solo próximas 24h
    const id = setTimeout(() => {
      self.registration.showNotification(item.title || "Pulse", {
        body: item.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: item.tag || `pulse-${item.at}`,
        requireInteraction: false,
        data: { url: "/" },
      });
    }, delay);
    timers.push(id);
  }
}

// Al tocar la notificación, abre/enfoca la app.
// Si tocan "Ya lo hice", marca la rutina como completada sin abrir la app.
self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  event.notification.close();

  if (event.action === "done" && data.token) {
    event.waitUntil(
      fetch("/api/routine/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token }),
        keepalive: true,
      })
        .then(() =>
          self.registration.showNotification("Pulse", {
            body: "✅ Marcado como hecho",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: "pulse-done",
          })
        )
        .catch(() => {})
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const url = data.url || "/";
      for (const client of clientsArr) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Web Push real (backend con VAPID). Muestra la notificación con acción "Ya lo hice".
self.addEventListener("push", (event) => {
  let payload = { title: "Pulse", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch (_) {}
  const actions = payload.token ? [{ action: "done", title: "✅ Ya lo hice" }] : [];
  // Un tag estable evita duplicados: si el push llega dos veces (o coincide con
  // la notificación local), la segunda REEMPLAZA a la primera en vez de sumarse.
  const tag =
    payload.tag ||
    (payload.routineId ? `routine-${payload.routineId}` : "pulse-push");
  event.waitUntil(
    self.registration.showNotification(payload.title || "Pulse", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      renotify: true,
      actions,
      data: { url: payload.url || "/", routineId: payload.routineId, token: payload.token },
    })
  );
});
