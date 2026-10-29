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
const { umbralesDe, avisoDe } = self.CC_COMUN;

// La versión la escribe scripts/paginas/emitir.js: es un resumen del
// contenido de todo lo que se precachea y de este archivo. Cambia sola cuando
// cambia cualquiera de ellos —antes había que acordarse de subirla en cada
// deploy, y si no, íconos y tipografías quedaban congelados—.
// scripts/comprobar.js avisa si quedó vieja.
const VERSION = "cota-cero-a585fff7d2";
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
  "/hidrometro",
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
  /* El original de lib/comun-clasico.js, que importan los módulos de la app:
     sin esto /app no abre sin conexión. Ninguna página del sitio lo pide —ésas
     cargan el gemelo clásico, arriba—, así que va en la tanda de /app y no en
     la que paga todo el que entra a leer /legal. */
  "/lib/comun.js",
  "/lib/fuentes.js",
  /* El respaldo para teléfonos que no corren módulos. Va con `defer` en
     app/index.html, así que la app no arranca hasta que llega: sin copia,
     con la señal colgada, frenaba todo el arranque los 4 s de ESPERA_RED_MS. */
  "/js/sin-modulos.js",
  // MODULOS:inicio — uno por archivo de js/app/; los escribe scripts/paginas/emitir.js
  "/js/app/principal.js",
  "/js/app/ahora.js",
  "/js/app/alias.js",
  "/js/app/avisos.js",
  "/js/app/bienvenida.js",
  "/js/app/calles.js",
  "/js/app/compartir.js",
  "/js/app/config.js",
  "/js/app/cota.js",
  "/js/app/destacar.js",
  "/js/app/elevacion.js",
  "/js/app/estado.js",
  "/js/app/formato.js",
  "/js/app/fuentes.js",
  "/js/app/instalar.js",
  "/js/app/lluvia.js",
  "/js/app/mapa.js",
  "/js/app/metricas.js",
  "/js/app/modelo.js",
  "/js/app/oficiales.js",
  "/js/app/plan.js",
  "/js/app/puntos.js",
  "/js/app/rio.js",
  "/js/app/tema.js",
  "/js/app/vista.js",
  "/js/app/zonas.js",
  // MODULOS:fin
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
  // verdad, no con los fallbacks del sistema. Son variables, un archivo por
  // familia con todos los pesos (ver el @font-face de estilos/app.css).
  "/vendor/fonts/jakarta.woff2",
  "/vendor/fonts/jetbrains.woff2",
  // Las curvas de nivel son el cálculo central de la app: sin esto no hay
  // cota, y justo el día que importa puede no haber señal.
  "/datos-abiertos/curvas.json",
  // Lo mismo para Rincón y Arroyo Leyes, donde las curvas no llegan: los
  // puntos con cota de la costa (elevacion.js). 24 KB comprimidos.
  "/datos-abiertos/cotas-costa.json",
  /* El estilo del mapa, en sus dos temas (lib/estilo-mapa.js). Sin él,
     MapLibre no dibuja nada sin señal, ni el fondo liso: con él quedan el
     fondo y los 30 puntos. Precacheado entra en VERSION, y un cambio de
     colores llega a los teléfonos. */
  "/mapa/claro.json",
  "/mapa/oscuro.json",
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/apple-touch-icon.png",
];

/* La unión. `scripts/paginas.js` verifica contra esto que estén todos los
   módulos de js/app/ y las páginas generadas, y que no sobre ninguna ruta
   muerta. */
const ESENCIALES = CRITICOS.concat(DEL_APP);

/* `cache: "no-cache"`: el pedido va siempre al servidor, pero condicional.
   Si el archivo no cambió vuelve un 304 y se usa la copia de la caché HTTP;
   si cambió, viene el nuevo. Sin esto, subir VERSION podía volver a guardar
   los mismos archivos viejos y el bump no servía de nada — pasó con el
   manifest. Antes era `cache: "reload"`, que también lo evitaba pero salteaba
   la caché HTTP sin preguntar: el precache volvía a bajar entero lo que la
   página acababa de bajar para pintarse. `no-cache` revalida siempre, así que
   lo viejo no entra, y lo que no cambió no se baja dos veces. */
const frescas = (rutas) =>
  rutas.map((u) => new Request(u, { cache: "no-cache" }));

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
           curvas y las tipografías —200 KB comprimidos— en segundo plano,
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
    // Ya está la app entera en esta versión: la copia vieja sobra.
    .then(podarViejas)
    .catch((err) => {
      calentando = null;
      console.warn(
        "precache de /app incompleto, se cachea al usarla:",
        err.message,
      );
    });
  e.waitUntil(calentando);
});

/* Cada deploy cambia VERSION, y la portada se publica dos veces por día.
   Antes, al activarse, el worker nuevo borraba toda caché que no fuera la
   suya, y la suya sólo tenía CRITICOS: la tanda de /app la pide la página, y
   el mensaje le llegaba al worker VIEJO. Quien había abierto la app una vez
   se quedaba sin modo sin conexión después de cada deploy, sin enterarse.

   Ahora la última caché vieja que tenga la app se conserva hasta que la
   nueva tenga la app entera (la poda vuelve a correr al terminar de
   calentar, arriba). Mientras tanto, /app abre sin señal con la copia
   anterior, completa y coherente consigo misma; `buscar()` se encarga de que
   esa copia no le gane a la nueva en lo que ésta ya tiene. Si la persona no
   vuelve a abrir la app con señal, la copia vieja se queda: es una, ~600 KB,
   y es la que la deja abrirla el día que no haya señal. */
async function podarViejas() {
  const nuestra = await caches.open(VERSION);
  const hits = await Promise.all(DEL_APP.map((u) => nuestra.match(u)));
  const appEntera = hits.every(Boolean);
  const viejas = (await caches.keys()).filter((k) => k !== VERSION);
  let conservar = null;
  if (!appEntera) {
    // caches.keys() viene en orden de creación: la última con /app es la más
    // nueva de las viejas.
    for (const k of viejas)
      if (await (await caches.open(k)).match("/app")) conservar = k;
  }
  await Promise.all(
    viejas.filter((k) => k !== conservar).map((k) => caches.delete(k)),
  );
}

self.addEventListener("activate", (e) => {
  e.waitUntil(podarViejas().then(() => self.clients.claim()));
});

/* Busca primero en la caché de esta versión y recién después en las demás.
   caches.match() las recorre en orden de creación, así que con la copia
   vieja de la app conservada (ver podarViejas) sin señal ganaría la /legal
   de ayer aunque la de hoy estuviera guardada. */
async function buscar(req, opciones) {
  const hit = await (await caches.open(VERSION)).match(req, opciones);
  return hit || caches.match(req, opciones);
}

/* Red primero, pero no a cualquier precio. Con señal que va y viene —el
   «lie-fi»: el teléfono dice que hay red y los paquetes no llegan— un fetch
   puede tardar medio minuto en fallar, y mientras tanto la pantalla queda en
   blanco aunque la copia esté acá. Así que la red corre contra un reloj:

   · si contesta antes de ESPERA_RED_MS, gana ella, como siempre, y su
     respuesta actualiza la caché;
   · si no, y hay copia, se sirve la copia. La red sigue en curso y, cuando
     llega, igual actualiza la caché para la próxima vez (waitUntil, para
     que el navegador no mate al worker antes de guardarla);
   · si no hay copia, se sigue esperando a la red: cortar ahí no deja nada
     mejor para mostrar.

   Devuelve la respuesta, o undefined si no hubo red ni copia: qué se hace
   entonces depende de la rama. `deCache` es una función porque cada rama
   busca distinto (la navegación ignora el ?ir=).

   El precio es el mismo de estar sin señal: con la copia de la caché puede
   salir un HTML nuevo con un módulo viejo de la misma versión, o al revés.
   4 s es bastante más de lo que tarda un 304 con 3G floja y bastante menos
   de lo que alguien mira una pantalla en blanco antes de cerrarla. */
const ESPERA_RED_MS = 4000;

function redPrimero(e, req, deCache) {
  const red = fetch(req).then((r) => {
    if (r.ok) {
      const copia = r.clone();
      e.waitUntil(caches.open(VERSION).then((c) => c.put(req, copia)));
    }
    return r;
  });
  // Que la red siga viva aunque ya hayamos contestado con la copia.
  e.waitUntil(red.catch(() => {}));
  return new Promise((ok) => {
    let listo = false;
    const dar = (r) => {
      if (listo) return;
      listo = true;
      ok(r);
    };
    const reloj = setTimeout(() => {
      deCache().then((hit) => {
        if (hit) dar(hit);
      }, () => {});
    }, ESPERA_RED_MS);
    red.then(
      (r) => {
        clearTimeout(reloj);
        /* Un 5xx no es una respuesta mejor que la copia: con Vercel caído o
           la red del barrio devolviendo su propio error, la página se cambiaba
           por un error aunque estuviera guardada. Si no hay copia, va el 5xx. */
        if (r.status >= 500)
          deCache().then((hit) => dar(hit || r), () => dar(r));
        else dar(r);
      },
      () => {
        clearTimeout(reloj);
        deCache().then(dar, () => dar(undefined));
      },
    );
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Datos en vivo: siempre a la red, sin respaldo en caché.
  if (url.pathname.startsWith("/api/")) return;

  // Analytics: ni cachear el script ni interceptar los envíos. Si lo
  // cacheáramos serviríamos una versión vieja para siempre.
  if (url.pathname.startsWith("/_vercel/")) return;

  // robots.txt, sitemap.xml, llms.txt, el catálogo de API y las versiones en
  // Markdown de cada página: siempre a la red, nunca al caché. Ni un buscador
  // ni un agente corren service workers, así que esto no cambia nada para
  // ellos, pero una copia guardada de estos archivos no caduca nunca: a un
  // navegador que ya los pidió le quedaría una versión vieja para siempre. Y
  // un .md abierto desde el pie es una navegación: sin esto, sin señal caía
  // en la portada. Son archivos chicos, no hay nada que ahorrar.
  if (
    url.pathname === "/robots.txt" ||
    url.pathname === "/sitemap.xml" ||
    url.pathname === "/llms.txt" ||
    url.pathname === "/.well-known/api-catalog" ||
    url.pathname.endsWith(".md")
  )
    return;

  /* NADA de otro origen pasa por acá. Antes era una lista de hosts —IGN,
     OpenStreetMap, Open-Meteo— y la lista se quedó corta el día que el
     service worker empezó a correr también en las páginas del sitio, que
     son las que llevan analytics: el tag de Google entraba por la rama de
     caché primero, el worker lo volvía a pedir con `fetch()` y ahí dejaba de
     ser un <script> para pasar a chequearse contra `connect-src`, que no lo
     lista. Resultado: el tag bloqueado por CSP y un 504 nuestro en su lugar.

     Una regla en vez de una lista, porque interceptar otro origen no aporta
     NADA: la rama de caché primero de más abajo sólo guarda lo del propio
     origen, así que lo único que hacíamos era volver a emitir el pedido con
     otro contexto de seguridad. Y de paso, ninguna lista se queda corta la
     próxima vez. */
  if (url.origin !== location.origin) return;

  // app.js y app.css: red primero, igual que el HTML, y por el mismo motivo.
  // Si fueran caché primero, alguien podría quedar con el HTML nuevo y el JS
  // viejo — y en esta app eso significa cálculos mal apareados con la
  // interfaz que los muestra. Revalidar cuesta un 304; el desfasaje no se
  // paga con nada.
  // (ya sabemos que es del propio origen: lo de afuera salió arriba)
  if (/\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      redPrimero(e, req, () => buscar(req)).then(
        (r) =>
          r ||
          new Response("Sin conexión y sin copia guardada.", {
            status: 504,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  // Navegación (el HTML): red primero.
  if (req.mode === "navigate") {
    /* Se guarda bajo SU propia URL (lo hace redPrimero). Antes TODA navegación
       se guardaba como "/index.html": con la landing y la app en documentos
       distintos, visitar una dejaba su HTML como copia offline de la otra.
       ignoreSearch porque la app navega a /app?ir=cota, ?ir=plan y ?ir=donde:
       sin esto cada deep link sería un fallo de caché. A la espera sólo
       contesta la copia propia: servir la portada en lugar de /legal porque la
       red tarda sería el error de siempre, el que parece que anduvo. */
    e.respondWith(
      redPrimero(e, req, () => buscar(req, { ignoreSearch: true })).then(
        async (r) => {
          if (r) return r;
          // Último recurso, ya sin red: la app para sus rutas, la landing
          // para el resto.
          const alApp =
            url.pathname === "/app" || url.pathname.startsWith("/app/");
          return (
            (await buscar(alApp ? "/app" : "/")) ||
            new Response("Sin conexión y sin copia guardada.", {
              status: 504,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        },
      ),
    );
    return;
  }

  // Todo lo demás: caché primero.
  e.respondWith(
    buscar(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((r) => {
          if (r.ok) {
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
/* La notificación la arma avisoDe(), de lib/comun.js: los textos de los
   ocho estados viven ahí, una sola vez para el aviso y para la pantalla. */

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
      const a = avisoDe(
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
