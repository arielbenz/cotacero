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

// OJO: subir la versión en cada deploy. Todo lo que va por caché primero
// (íconos, tipografías) queda congelado hasta que este número cambie.
const VERSION = "cota-cero-v15";
const ESENCIALES = [
  "/",
  "/index.html",
  "/app.css",
  "/app.js",
  // Con esto el mapa abre sin conexión. Los tiles no se cachean (son muchos
  // y pesados), así que sale el fondo liso, pero los 30 puntos se ven igual.
  "/vendor/maplibre-gl.js",
  "/vendor/maplibre-gl.css",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      // `cache: "reload"` salta el caché HTTP del navegador. Sin esto, subir
      // VERSION puede volver a guardar los mismos archivos viejos y el bump
      // no sirve de nada — pasó con el manifest.
      .then((c) =>
        c.addAll(ESENCIALES.map((u) => new Request(u, { cache: "reload" }))),
      )
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

  // Tiles del IGN y Open-Meteo: a la red. Cachear tiles no vale la pena.
  if (
    url.hostname.includes("ign.gob.ar") ||
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("open-meteo.com")
  )
    return;

  // app.js y app.css: red primero, igual que el HTML, y por el mismo motivo.
  // Si fueran caché primero, alguien podría quedar con el HTML nuevo y el JS
  // viejo — y en esta app eso significa cálculos mal apareados con la
  // interfaz que los muestra. Revalidar cuesta un 304; el desfasaje no se
  // paga con nada.
  if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(VERSION).then((c) => c.put(req, copia));
          }
          return r;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (hit) =>
                hit ||
                new Response("Sin conexión y sin copia guardada.", {
                  status: 504,
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                }),
            ),
        ),
    );
    return;
  }

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
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((r) => {
          if (
            r.ok &&
            (url.origin === location.origin ||
              url.hostname.includes("gstatic") ||
              // Faltaba: sin el CSS de googleapis las tipografías no cargan
              // offline aunque los archivos de gstatic sí estén guardados.
              url.hostname.includes("fonts.googleapis.com"))
          ) {
            const copia = r.clone();
            caches.open(VERSION).then((c) => c.put(req, copia));
          }
          return r;
        })
        .catch(
          () =>
            // Antes devolvía `hit`, que en esta rama es undefined: respondWith
            // recibía undefined y el navegador tiraba un error de red pelado.
            new Response("Sin conexión y sin copia guardada de este recurso.", {
              status: 504,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        );
    }),
  );
});

/* ==========================================================================
   AVISOS
   El push llega SIN contenido: el servidor no sabe la cota de nadie ni a qué
   altura avisarle. Sólo despierta al teléfono. La decisión la tomamos acá,
   contra el umbral que la app guardó en este dispositivo.
   ========================================================================== */

const ALERTA_OFICIAL = 5.3;
const EVACUACION_OFICIAL = 5.7;

/* El service worker no puede leer localStorage, así que la app espeja el
   umbral a IndexedDB. */
function abrirBase() {
  return new Promise((ok, mal) => {
    const p = indexedDB.open("cotacero", 1);
    p.onupgradeneeded = () => p.result.createObjectStore("kv");
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
}

async function leerUmbral() {
  try {
    const db = await abrirBase();
    const v = await new Promise((ok, mal) => {
      const t = db.transaction("kv", "readonly").objectStore("kv").get("umbral");
      t.onsuccess = () => ok(t.result);
      t.onerror = () => mal(t.error);
    });
    db.close();
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

const dosDec = (v) => v.toFixed(2).replace(".", ",");

function armarAviso(nivel, umbral) {
  if (nivel == null)
    return {
      titulo: "El río se movió",
      cuerpo: "Abrí Cota Cero para ver el nivel de hoy.",
      urgente: false,
      ir: "/",
    };
  if (umbral != null && nivel >= umbral)
    return {
      titulo: "El agua llegó a tu cota",
      cuerpo:
        `El río está en ${dosDec(nivel)} m y a tu terreno llega en ${dosDec(umbral)} m. ` +
        "Si Defensa Civil indica evacuar, evacuá.",
      urgente: true,
      ir: "/?ir=plan",
    };
  if (nivel >= EVACUACION_OFICIAL)
    return {
      titulo: "Nivel de evacuación",
      cuerpo: `El río superó los 5,70 m (${dosDec(nivel)} m). Seguí las indicaciones del municipio.`,
      urgente: true,
      ir: "/?ir=donde",
    };
  if (nivel >= ALERTA_OFICIAL)
    return {
      titulo: "Nivel de alerta",
      cuerpo: `El río superó los 5,30 m (${dosDec(nivel)} m). Arrancan las evacuaciones fuera del anillo.`,
      urgente: true,
      ir: "/?ir=donde",
    };
  if (umbral != null) {
    const falta = umbral - nivel;
    return {
      titulo: `El río subió a ${dosDec(nivel)} m`,
      cuerpo: `Faltan ${dosDec(falta)} m para llegar a tu cota.`,
      urgente: false,
      ir: "/",
    };
  }
  return {
    titulo: `El río subió a ${dosDec(nivel)} m`,
    cuerpo: "Cargá tu cota en la app para saber qué significa para tu casa.",
    urgente: false,
    ir: "/?ir=cota",
  };
}

self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      let nivel = null;
      try {
        const r = await fetch("/api/nivel", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (typeof j.altura === "number") nivel = j.altura;
        }
      } catch (err) {
        /* sin red: avisamos igual, en genérico */
      }
      const a = armarAviso(nivel, await leerUmbral());
      // El navegador exige que todo push muestre algo: si no, muestra un
      // "este sitio se actualizó en segundo plano" y termina revocando el
      // permiso. Por eso siempre notificamos, aunque sea en genérico.
      return self.registration.showNotification(a.titulo, {
        body: a.cuerpo,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        lang: "es-AR",
        tag: "cota-cero-nivel", // reemplaza el aviso anterior, no los apila
        renotify: a.urgente,
        requireInteraction: a.urgente,
        data: { ir: a.ir },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.ir) || "/";
  e.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of abiertas) {
        if (c.url.includes(self.location.origin)) {
          await c.focus();
          if ("navigate" in c) await c.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});

/* Los navegadores rotan las suscripciones solos. Sin esto, la gente deja de
   recibir avisos y no se entera nunca. */
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      const vieja = e.oldSubscription;
      if (vieja) {
        try {
          await fetch("/api/desuscribir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: vieja.endpoint }),
          });
        } catch (err) {}
      }
      const nueva =
        e.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vieja && vieja.options && vieja.options.applicationServerKey,
        }));
      if (!nueva) return;
      await fetch("/api/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: nueva.endpoint }),
      });
    })(),
  );
});
