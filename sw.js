// sw.js — Cota Cero
// Estrategia deliberada, distinta según el recurso:
//
//   HTML      -> red primero, caché como respaldo.
//                Si publico una corrección, la gente la recibe. Y si no hay
//                señal, la app abre igual con la última versión guardada.
//
//   estáticos -> caché primero. Íconos y tipografías no cambian.
//
//   /api/     -> NUNCA se cachea acá. Es un dato de seguridad: prefiero que
//                falle y que la app muestre su último valor guardado avisando
//                que puede estar viejo, antes que servir un número de ayer
//                como si fuera de hoy.

const VERSION = "cota-cero-v1";
const ESENCIALES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(ESENCIALES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(
          ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Datos en vivo: siempre a la red, sin respaldo en caché.
  if (url.pathname.startsWith("/api/")) return;

  // Mapbox y Open-Meteo: a la red. Cachear tiles no vale la pena.
  if (
    url.hostname.includes("mapbox.com") ||
    url.hostname.includes("open-meteo.com")
  )
    return;

  // Navegación (el HTML): red primero.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put("/index.html", copia));
          return r;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Todo lo demás: caché primero.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((r) => {
            if (
              r.ok &&
              (url.origin === location.origin ||
                url.hostname.includes("gstatic"))
            ) {
              const copia = r.clone();
              caches.open(VERSION).then((c) => c.put(req, copia));
            }
            return r;
          })
          .catch(() => hit),
    ),
  );
});
