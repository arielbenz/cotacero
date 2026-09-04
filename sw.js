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
const VERSION = "cota-cero-v64";
const ESENCIALES = [
  // La landing y la app son dos documentos distintos: la primera es la puerta
  // de entrada desde un buscador, la segunda es la herramienta.
  "/",
  "/index.html",
  "/app",
  "/app/index.html",
  "/css/app.css",
  // La app son módulos ES: hay que precachearlos TODOS o /app no abre sin
  // conexión. scripts/paginas.js verifica que esta lista y js/app/ digan lo
  // mismo, y revienta si alguien agrega un módulo y se olvida de acá.
  // El registro de fuentes: la app lo importa de verdad desde que son
  // módulos, así que sin esto /app no abre sin conexión.
  // La barra del río va en todas las páginas del sitio: sin esto, sin conexión
  // la píldora se queda en su estado inicial en vez de decir "sin dato".
  "/js/rio-barra.js",
  "/lib/fuentes.js",
  "/js/app/principal.js",
  "/js/app/avisos.js",
  "/js/app/bienvenida.js",
  "/js/app/compartir.js",
  "/js/app/config.js",
  "/js/app/cota.js",
  "/js/app/elevacion.js",
  "/js/app/estado.js",
  "/js/app/formato.js",
  "/js/app/fuentes.js",
  "/js/app/instalar.js",
  "/js/app/lluvia.js",
  "/js/app/mapa.js",
  "/js/app/metricas.js",
  "/js/app/oficiales.js",
  "/js/app/plan.js",
  "/js/app/puntos.js",
  "/js/app/rio.js",
  "/js/app/tema.js",
  "/js/app/vista.js",
  // Con esto el mapa abre sin conexión. Los tiles no se cachean (son muchos
  // y pesados), así que sale el fondo liso, pero los 30 puntos se ven igual.
  "/vendor/maplibre-gl.js",
  "/vendor/maplibre-gl.css",
  // Las tipografías ahora son nuestras: precacheadas andan sin conexión de
  // verdad, no con los fallbacks del sistema.
  "/vendor/fonts/jakarta-500.woff2",
  "/vendor/fonts/jakarta-600.woff2",
  "/vendor/fonts/jakarta-700.woff2",
  "/vendor/fonts/jakarta-800.woff2",
  "/vendor/fonts/jetbrains-500.woff2",
  "/vendor/fonts/jetbrains-700.woff2",
  // Las curvas de nivel son el cálculo central de la app: sin esto no hay
  // cota, y justo el día que importa puede no haber señal.
  "/datos-abiertos/curvas.json",
  /* Las páginas de contenido. Antes no se precacheaba ninguna: la app
     explicaba todo adentro justamente porque sin señal no había adónde ir.
     Ahora la explicación vive en el sitio, así que el sitio tiene que abrir
     sin señal. Son ~90 KB crudos, ~25 KB comprimidos. */
  "/datos",
  "/historia",
  "/contacto",
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/apple-touch-icon.png",
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

  // Analytics: ni cachear el script ni interceptar los envíos. Si lo
  // cacheáramos serviríamos una versión vieja para siempre.
  if (url.pathname.startsWith("/_vercel/")) return;

  // robots.txt y sitemap.xml: siempre a la red, nunca al caché. Googlebot no
  // corre service workers, así que esto no cambia nada para el buscador —
  // pero una copia guardada de estos dos archivos no caduca nunca, y a un
  // navegador que ya los pidió le quedaría una versión vieja del mapa del
  // sitio para siempre. Son dos archivos de 1 KB: no hay nada que ahorrar.
  if (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml") return;

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
          caches.match(req).then(
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
          // Se guarda bajo SU propia URL. Antes TODA navegación se guardaba
          // como "/index.html": con la landing y la app en documentos
          // distintos, visitar una dejaba su HTML como copia offline de la
          // otra.
          if (r.ok) {
            const copia = r.clone();
            caches.open(VERSION).then((c) => c.put(req, copia));
          }
          return r;
        })
        .catch(async () => {
          // ignoreSearch porque la app navega a /app?ir=cota, ?ir=plan y
          // ?ir=donde: sin esto cada deep link sería un fallo de caché.
          const propia = await caches.match(req, { ignoreSearch: true });
          if (propia) return propia;
          // Último recurso: la app para sus rutas, la landing para el resto.
          const alApp =
            url.pathname === "/app" || url.pathname.startsWith("/app/");
          return (
            (await caches.match(alApp ? "/app" : "/")) ||
            new Response("Sin conexión y sin copia guardada.", {
              status: 504,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  // Todo lo demás: caché primero.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((r) => {
          if (r.ok && url.origin === location.origin) {
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

/* Los umbrales oficiales del Puerto. Son el arranque y el respaldo: desde
   que /api/nivel lee la API del INA, la respuesta trae los que publica la
   propia estación, y `armarAviso` usa ésos. Que acá sigan escritos importa
   para el caso en que el aviso se arma sin haber podido leer el nivel. */
const ALERTA_OFICIAL = 5.3;
const EVACUACION_OFICIAL = 5.7;

/* Los umbrales oficiales se escriben igual que en la app —"5,30 m", dos
   decimales— para que nadie compare el aviso con la pantalla y crea que son
   dos números distintos. */
const umbralTxt = (v) => v.toFixed(2).replace(".", ",");

/* Distancias como las dice la app: en centímetros cuando falta menos de un
   metro, en metros con un decimal cuando falta más. El aviso decía "Faltan
   unos 360 cm", que es exactamente lo que `mCm()` en app.js existe para
   evitar — nadie lee 360 cm. */
const distancia = (v) => {
  const a = Math.abs(v);
  return a < 1
    ? Math.round(a * 100) + " cm"
    : (Math.round(a * 10) / 10).toFixed(1).replace(".", ",") + " m";
};

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

/* La app espeja acá si la persona quiere aviso anticipado. Con IndexedDB
   caída se asume que no: mejor avisar de menos que de más. */
async function leerAvisarCerca() {
  try {
    const db = await abrirBase();
    const v = await new Promise((ok, mal) => {
      const t = db
        .transaction("kv", "readonly")
        .objectStore("kv")
        .get("avisarCerca");
      t.onsuccess = () => ok(t.result);
      t.onerror = () => mal(t.error);
    });
    db.close();
    return v === true;
  } catch (e) {
    return false;
  }
}

async function leerUmbral() {
  try {
    const db = await abrirBase();
    const v = await new Promise((ok, mal) => {
      const t = db
        .transaction("kv", "readonly")
        .objectStore("kv")
        .get("umbral");
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
/* El umbral se redondea a un decimal en todos lados, avisos incluidos: sale de
   curvas cada 50 cm y el segundo decimal sería precisión inventada. */
const unDec = (v) =>
  "≈ " + (Math.round(v * 10) / 10).toFixed(1).replace(".", ",") + " m";

function armarAviso(nivel, umbral, cerca, oficiales) {
  const ALERTA = (oficiales && oficiales.alerta) || ALERTA_OFICIAL;
  const EVACUACION = (oficiales && oficiales.evacuacion) || EVACUACION_OFICIAL;
  if (nivel == null)
    return {
      titulo: "El río se movió",
      cuerpo: "Abrí Cota Cero para ver el nivel de hoy.",
      urgente: false,
      ir: "/app",
    };
  if (umbral != null && nivel >= umbral)
    return {
      titulo: "El río superó tu umbral",
      cuerpo:
        `El río está en ${dosDec(nivel)} m y tu umbral estimado es ${unDec(umbral)}. ` +
        "Aunque no veas agua, prepará el plan. Si Defensa Civil indica evacuar, evacuá.",
      urgente: true,
      ir: "/app?ir=plan",
    };
  if (nivel >= EVACUACION)
    return {
      titulo: "Nivel de evacuación",
      cuerpo: `El río superó los ${umbralTxt(EVACUACION)} m (${dosDec(nivel)} m). Seguí las indicaciones del municipio.`,
      urgente: true,
      ir: "/app?ir=donde",
    };
  if (nivel >= ALERTA)
    return {
      titulo: "Nivel de alerta",
      cuerpo: `El río superó los ${umbralTxt(ALERTA)} m (${dosDec(nivel)} m). Arrancan las evacuaciones fuera del anillo.`,
      urgente: true,
      ir: "/app?ir=donde",
    };
  if (umbral != null) {
    const falta = umbral - nivel;
    // Aviso anticipado, sólo si lo pidió: a 20 cm es urgente, a 50 no.
    if (cerca && falta <= 0.2)
      return {
        titulo: "Falta muy poco para tu umbral",
        cuerpo: `El río está en ${dosDec(nivel)} m y tu umbral estimado es ${unDec(umbral)}: unos ${distancia(falta)}. Andá preparando el plan.`,
        urgente: true,
        ir: "/app?ir=plan",
      };
    if (cerca && falta <= 0.5)
      return {
        titulo: `Unos ${distancia(falta)} hasta tu umbral`,
        cuerpo: `El río está en ${dosDec(nivel)} m y tu umbral estimado es ${unDec(umbral)}.`,
        urgente: false,
        ir: "/app?ir=plan",
      };
    return {
      titulo: `El río subió a ${dosDec(nivel)} m`,
      cuerpo: `Faltan unos ${distancia(falta)} hasta tu umbral estimado (${unDec(umbral)}).`,
      urgente: false,
      ir: "/app",
    };
  }
  return {
    titulo: `El río subió a ${dosDec(nivel)} m`,
    cuerpo:
      "Calculá tu umbral en la app para saber qué significa para tu casa.",
    urgente: false,
    ir: "/app?ir=cota",
  };
}

self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      let nivel = null;
      let oficiales = null;
      try {
        const r = await fetch("/api/nivel", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (typeof j.altura === "number") nivel = j.altura;
          // Los umbrales que publica la estación, con el mismo filtro de
          // plausibilidad que aplica la app: un cambio raro de la API no
          // puede hacernos avisar de evacuación por debajo de la alerta.
          if (
            typeof j.alerta === "number" &&
            typeof j.evacuacion === "number" &&
            j.alerta > 0 &&
            j.evacuacion > j.alerta &&
            j.evacuacion < 10
          )
            oficiales = { alerta: j.alerta, evacuacion: j.evacuacion };
        }
      } catch (err) {
        /* sin red: avisamos igual, en genérico */
      }
      const a = armarAviso(
        nivel,
        await leerUmbral(),
        await leerAvisarCerca(),
        oficiales,
      );
      // El navegador exige que todo push muestre algo: si no, muestra un
      // "este sitio se actualizó en segundo plano" y termina revocando el
      // permiso. Por eso siempre notificamos, aunque sea en genérico.
      return self.registration.showNotification(a.titulo, {
        body: a.cuerpo,
        icon: "/img/icon-192.png",
        badge: "/img/favicon-32.png",
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
  const destino = (e.notification.data && e.notification.data.ir) || "/app";
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
          applicationServerKey:
            vieja && vieja.options && vieja.options.applicationServerKey,
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
