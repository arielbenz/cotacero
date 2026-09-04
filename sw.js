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

/* Lo compartido con la app, el sitio y Node. Un service worker clásico no
   puede importar módulos —y registrarlo como módulo dejaría afuera justo a
   los Android viejos que este proyecto sostiene a mano—, pero SÍ puede
   importScripts. Con esto los umbrales oficiales, el filtro de plausibilidad
   y el formato de los números dejan de estar copiados acá adentro.
   lib/comun-clasico.js lo emite scripts/paginas.js desde lib/comun.js. */
importScripts("/lib/comun-clasico.js");
const { UMBRALES_RESPALDO, umbralesDe, nm, mU, mCm } = self.CC_COMUN;

// OJO: subir la versión en cada deploy. Todo lo que va por caché primero
// (íconos, tipografías) queda congelado hasta que este número cambie.
const VERSION = "cota-cero-v84";
/* El precache va en DOS TANDAS, y el motivo es de datos, no de arquitectura.

   Antes era una sola lista de 387 KB comprimidos y el service worker se
   registraba SÓLO desde /app. Eso dejaba una promesa sin cumplir: la bajada de
   /puntos-de-encuentro dice "esta página funciona sin conexión", pero quien
   llega ahí desde un buscador y nunca abre la app no tenía service worker, así
   que no funcionaba. Y era justo la página de evacuación.

   Ahora el sitio también lo registra (ver js/rio-barra.js). Para que eso no le
   cueste 387 KB a quien entró a leer /legal:

   CRITICOS  — lo que el SITIO necesita para abrir sin señal: los HTML, las dos
               hojas de estilo y los dos scripts que van en todas las páginas.
               Van con `cache.addAll`, que es TODO O NADA: si uno falta, la
               instalación entera falla. Eso es a propósito.

   DEL_APP   — lo que sólo hace falta en /app: sus módulos, las curvas, las
               tipografías, los íconos. Se calienta DESPUÉS, sin bloquear la
               instalación y sin voltearla si falla. Si esa tanda no llegara,
               el sitio igual anda sin señal y la app se cachea sola por la
               rama de red-primero de más abajo, que guarda cada módulo que la
               app efectivamente carga. */
const CRITICOS = [
  // La landing y la app son dos documentos distintos: la primera es la puerta
  // de entrada desde un buscador, la segunda es la herramienta.
  /* Sólo las URL limpias. `/index.html` y `/app/index.html` estaban acá y
     salieron: ahora redirigen con 308 a `/` y `/app` (ver `redirects` en
     vercel.json, que las sacó de circulación porque cada página existía en
     dos URLs indexables). Y `cache.addAll()` REVIENTA con una respuesta
     redirigida —es todo o nada—, así que dejarlas habría dejado la app sin
     modo sin conexión, en silencio, que es como falla siempre esto. */
  "/",
  "/css/app.css",
  /* La hoja de estilo de la guía para imprimir. Va acá y no por la rama de
     red-primero porque /guia sin ella no es una hoja: es una lista suelta de
     casillas sin columnas ni recuadros. */
  "/css/guia.css",
  // La app son módulos ES: hay que precachearlos TODOS o /app no abre sin
  // conexión. scripts/paginas.js verifica que esta lista y js/app/ digan lo
  // mismo, y revienta si alguien agrega un módulo y se olvida de acá.
  // El registro de fuentes: la app lo importa de verdad desde que son
  // módulos, así que sin esto /app no abre sin conexión.
  // La barra del río va en todas las páginas del sitio: sin esto, sin conexión
  // la píldora se queda en su estado inicial en vez de decir "sin dato".
  /* El gemelo clásico de lib/comun.js. El service worker lo trae con
     importScripts —eso el navegador lo guarda solo—, pero las páginas del
     sitio lo piden con un <script> común y sin esto no abrirían sin señal. */
  "/lib/comun-clasico.js",
  /* Y el original, que importan los módulos de la app: sin esto /app no abre
     sin conexión. Son el mismo código, uno para cada mundo. */
  "/lib/comun.js",
  "/js/rio-barra.js",
  /* Las páginas de contenido, TODAS. Antes no se precacheaba ninguna —la app
     explicaba todo adentro justamente porque sin señal no había adónde ir— y
     después se precachearon tres. Las otras seis no fallaban sin señal: el
     respaldo de navegación les servía la PORTADA, así que pedías /legal y te
     daba el home sin decir nada. Peor que un error, porque parece que anduvo.

     Y una de esas seis, /puntos-de-encuentro, decía en su propia bajada "esta
     página funciona sin conexión". Era la página de evacuación afirmando algo
     que no cumplía.

     Son ~132 KB crudos, ~35 KB comprimidos. `scripts/paginas.js` verifica que
     esta lista y el registro de páginas digan lo mismo, así que una página
     nueva que se olvide de acá revienta al generar. */
  "/datos",
  "/historia",
  "/contacto",
  "/preguntas",
  "/legal",
  "/sobre",
  "/charlas",
  "/para-medios",
  "/puntos-de-encuentro",
  /* La guía para imprimir. Es la que más razones tiene de estar acá: alguien
     que la busca sin señal la busca justamente para imprimirla y salir.
     El PDF no se precachea —son 72 KB por algo que se baja una vez—, pero la
     rama de caché primero lo guarda en cuanto se descarga una vez. */
  "/guia",
];

const DEL_APP = [
  "/app",
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
  /* Las listas de la mochila y del checklist previo viven en lib/ para que
     también las lea el generador de la guía impresa. La app las importa desde
     config.js, así que sin esto /app no abre sin conexión. */
  "/lib/listas.js",
  /* MapLibre NO se precachea: son 275 KB comprimidos —el 41 % de todo lo que
     bajaba la primera visita— por una pestaña que mucha gente no abre nunca.
     En un teléfono con datos contados eso es plata.
     No se pierde el modo sin conexión: la rama de red-primero de más abajo
     guarda todo `.js|.css` del propio origen, así que la primera vez que
     alguien abre "Dónde ir" queda cacheado y desde entonces el mapa abre sin
     señal. Los tiles no se cachean nunca (son muchos y pesados): sale el fondo
     liso con los 30 puntos, que es lo que importa. */
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
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/apple-touch-icon.png",
];

/* La unión. `scripts/paginas.js` verifica contra esto que estén los 21 módulos
   y las 10 páginas generadas, y que no sobre ninguna ruta muerta. */
const ESENCIALES = CRITICOS.concat(DEL_APP);

// `cache: "reload"` salta el caché HTTP del navegador. Sin esto, subir
// VERSION puede volver a guardar los mismos archivos viejos y el bump no
// sirve de nada — pasó con el manifest.
const frescas = (rutas) => rutas.map((u) => new Request(u, { cache: "reload" }));

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then(async (c) => {
        // Tanda 1: todo o nada. Si esto falla no hay modo sin conexión, y
        // queremos que falle fuerte.
        await c.addAll(frescas(CRITICOS));
        /* La tanda 2 NO se pide acá. Si se pidiera, quien entró a leer dos
           párrafos de /legal se bajaría igual los módulos de la app, las
           curvas y las seis tipografías —275 KB comprimidos— en segundo plano,
           y el partido en dos no habría servido de nada.
           La pide /app, que es quien los necesita: ver el mensaje de abajo. */
      })
      .then(() => self.skipWaiting()),
  );
});

/* La tanda de /app, a pedido. La manda js/app/instalar.js cuando alguien
   abre la app, y no antes.

   Va con addAll para que /app conserve el todo-o-nada dentro de la tanda:
   media app cacheada abre y se rompe callada, que es lo peor de los dos
   mundos. Si falla, no pasa nada grave: la rama de red-primero de más arriba
   guarda cada módulo que la app efectivamente carga, así que después de una
   visita a /app están todos igual. */
let calentando = null;
self.addEventListener("message", (e) => {
  if (!e.data || e.data.tipo !== "calentar-app") return;
  if (calentando) return; // una sola vez por arranque del worker
  calentando = caches
    .open(VERSION)
    .then((c) => c.addAll(frescas(DEL_APP)))
    .catch((err) => {
      calentando = null;
      console.warn(
        "precache de /app incompleto, se cachea al usarla:",
        err.message,
      );
    });
  e.waitUntil(calentando);
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
  if (
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml" ||
    url.pathname === "/llms.txt"
  )
    return;

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

/* Los umbrales oficiales, el formato de los números y la distancia salen de
   lib/comun.js, arriba. Estaban escritos acá y el aviso podía quedar diciendo
   un número con otro redondeo que la pantalla. */

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

/* Los ocho estados. La notificación llega con la app CERRADA, así que cada
   cuerpo tiene que entenderse solo: sin la app abierta no hay contexto que
   valga. Por eso en los graves va primero el verbo de lo que hay que hacer y
   siempre el 103; antes el de alerta decía "Arrancan las evacuaciones fuera
   del anillo" —sin verbo para la persona y con "el anillo" a secas, que en la
   calle no se sabe si te incluye—.

   Las frases son las mismas que las del veredicto de la pantalla, pero
   copiadas a mano. Si tocás una, revisá las tres: acá, en rio.js
   pintarVeredictoRio() y en cota.js calcular(). Ver README §"Los ocho estados
   y cómo se dicen".

   Ya NO es que no se pueda compartirlas: desde que este archivo trae
   lib/comun-clasico.js con importScripts, la puerta está abierta y los textos
   podrían mudarse ahí. No se hizo todavía porque no son constantes sueltas
   —cada uno interpola el nivel, el umbral y los oficiales, y el de la pantalla
   además lleva marcado— y mudarlos mal es peor que tenerlos copiados. Queda
   como el próximo paso obvio. */
function armarAviso(nivel, umbral, cerca, oficiales) {
  const ALERTA = (oficiales && oficiales.alerta) || UMBRALES_RESPALDO.alerta;
  const EVACUACION =
    (oficiales && oficiales.evacuacion) || UMBRALES_RESPALDO.evacuacion;
  if (nivel == null)
    return {
      titulo: "Cambió el nivel del río",
      cuerpo: "Abrí Cota Cero para ver cuánto mide hoy.",
      urgente: false,
      ir: "/app",
    };
  if (umbral != null && nivel >= umbral)
    return {
      titulo: "El río pasó tu nivel de aviso",
      /* El más importante de los ocho, y el que más se pasaba de largo: a 203
         caracteres Android lo cortaba justo antes del 103. Se va la
         explicación —"el agua puede llegar aunque no la veas" ya está en la
         pantalla— y queda la acción, el dato y el teléfono. */
      cuerpo:
        "Mové a las personas, los remedios y los documentos. " +
        `El río está en ${nm(nivel, 2)} m y tu nivel de aviso es ${mU(umbral)}. ` +
        "Si Defensa Civil dice que salgas, salí. 103.",
      urgente: true,
      ir: "/app?ir=plan",
    };
  if (nivel >= EVACUACION)
    return {
      titulo: `Evacuación en la ciudad: ${nm(nivel, 2)} m`,
      cuerpo:
        `Si Defensa Civil dice que salgas, salí. El río pasó los ${nm(EVACUACION, 2)} m. ` +
        "No cruces agua que corre: con 30 cm te arrastra. Ayuda: 103.",
      urgente: true,
      ir: "/app?ir=donde",
    };
  if (nivel >= ALERTA)
    return {
      titulo: `Alerta en la ciudad: ${nm(nivel, 2)} m`,
      cuerpo:
        "Armá la mochila y avisale a tu familia. " +
        `El río pasó los ${nm(ALERTA, 2)} m: afuera del terraplén ya empiezan a sacar gente. ` +
        "Dudas: 103.",
      urgente: true,
      ir: "/app?ir=donde",
    };
  if (umbral != null) {
    const falta = umbral - nivel;
    // Aviso anticipado, sólo si lo pidió: a 20 cm es urgente, a 50 no.
    if (cerca && falta <= 0.2)
      return {
        titulo: `Faltan unos ${mCm(falta)} para tu nivel de aviso`,
        cuerpo: `El río está en ${nm(nivel, 2)} m; tu nivel de aviso es ${mU(umbral)}. Terminá la mochila y avisale a tu familia.`,
        urgente: true,
        ir: "/app?ir=plan",
      };
    if (cerca && falta <= 0.5)
      return {
        titulo: `Faltan unos ${mCm(falta)} para tu nivel de aviso`,
        cuerpo: `El río está en ${nm(nivel, 2)} m. Andá armando la mochila.`,
        urgente: false,
        ir: "/app?ir=plan",
      };
    return {
      titulo: `El río subió a ${nm(nivel, 2)} m`,
      cuerpo: `Faltan unos ${mCm(falta)} para tu nivel de aviso (${mU(umbral)}). Por ahora, seguí mirando.`,
      urgente: false,
      ir: "/app",
    };
  }
  return {
    titulo: `El río subió a ${nm(nivel, 2)} m`,
    cuerpo:
      "Cargá tu casa en la app y te avisamos cuando el río importe para vos.",
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
          // plausibilidad que aplica la app —ahora literalmente el mismo, no
          // una copia: un cambio raro de la API no puede hacernos avisar de
          // evacuación por debajo de la alerta.
          oficiales = umbralesDe(j);
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
