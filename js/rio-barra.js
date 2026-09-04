// js/rio-barra.js — el estado del río y lo que lo muestra en la barra.
//
// Va en TODAS las páginas del sitio: la portada y las nueve generadas. La
// barra tiene que decir lo mismo se venga de donde se venga, y para eso el
// dato tiene que estar en todas, no sólo donde está el mockup.
//
// Se separó de landing.js por peso: ese archivo son 30 KB con el mockup del
// hidrómetro, la regla que se mueve y la carga perezosa de MapLibre. Mandarlo
// entero a /legal para pintar una píldora era pagar 30 KB por 7.
//
// VA ENVUELTO EN UNA IIFE, y esto no es estilo: este archivo se carga en TODAS
// las páginas, y al lado corren contacto.js, historia.js y medios.js. Un
// `const` suelto acá arriba vive en el ámbito global compartido de los scripts
// clásicos, así que un nombre repetido —`$`, por ejemplo— hace que el SEGUNDO
// archivo no se ejecute ENTERO, con un SyntaxError y nada más. Pasó: se
// llevó puesto el formulario de /contacto y la página /historia completa.
//
// Hacia afuera se expone un solo nombre, `CC`, con lo que landing.js necesita.
// ÉSTE VA PRIMERO.

(() => {
/* Los umbrales de respaldo, el filtro de plausibilidad, el vencimiento y el
   formato salen de lib/comun-clasico.js, que va cargado antes que éste.
   Es el mismo código que importan los módulos de la app y el que trae el
   service worker con importScripts: una sola coma decimal y un solo 5,30. */
const { UMBRALES_RESPALDO, umbralesDe, VENCE_HORAS, nm } = self.CC_COMUN;

const $ = (id) => document.getElementById(id);
/* Acá el número va SIN la unidad: la píldora la pone aparte. */
const m = (v) => nm(v, 2);

/* ==========================================================================
   1 bis. EL ESTADO DEL RÍO, EN UN SOLO LUGAR
   --------------------------------------------------------------------------
   Cuatro piezas de la portada dicen algo sobre el mismo dato: el mockup del
   hero, la píldora de la barra, la franja de alerta y el renglón de frescura
   del pie. Antes había una sola —el mockup— y su fetch vivía adentro de la
   función que lo pintaba.

   Con cuatro, cada una con su propio fetch, la portada terminaría pidiendo el
   mismo JSON cuatro veces y —lo que importa de verdad— podría mostrar dos
   números distintos al mismo tiempo si uno de los pedidos fallara. Que la
   barra diga 5,48 m mientras la franja sigue callada es exactamente el tipo
   de contradicción que este proyecto no se puede permitir en una crecida.

   Así que hay un objeto y una lista de oyentes. Un solo fetch, un solo
   estado, y quien quiera mostrarlo se suscribe. Si mañana aparece una quinta
   pieza, se suscribe también y no toca nada de esto.
   ========================================================================== */

const rio = {
  altura: null, // metros, la lectura del hidrómetro
  delta: null, // variación contra la lectura anterior, en metros
  fechaTexto: "", // "DD/MM/AAAA HH:MM", tal como la publica el INA
  fecha: null, // la misma, ya parseada
  // respaldo: los publica la estación y llegan en la respuesta
  alerta: UMBRALES_RESPALDO.alerta,
  evacuacion: UMBRALES_RESPALDO.evacuacion,
  umbral: null, // el umbral personal, si esta persona ya lo calculó en la app
};

const oyentes = [];

/* Se suscribe y se pinta en el acto: quien llega tarde —el umbral sale de
   IndexedDB y puede tardar— no se queda esperando el próximo cambio. */
function suscribir(fn) {
  oyentes.push(fn);
  try {
    fn(rio);
  } catch (e) {
    /* un renderer roto no puede llevarse puestos a los otros tres */
  }
}

function avisar() {
  for (const fn of oyentes) {
    try {
      fn(rio);
    } catch (e) {
      /* idem */
    }
  }
}

/* El INA publica "DD/MM/AAAA HH:MM" y Date no parsea ese formato. Es la misma
   cuenta que hace `fechaINA()` en js/app/formato.js; no se puede importar
   porque este archivo no es un módulo y la app no está cargada acá. Como el
   INA publica en hora argentina y quien lee la portada está en Santa Fe, el
   huso del navegador es el correcto — la app resuelve esto igual. */
function fechaINA(txt) {
  const p = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(txt || "");
  if (!p) return null;
  const d = new Date(+p[3], +p[2] - 1, +p[1], +(p[4] || 0), +(p[5] || 0));
  return isNaN(d.getTime()) ? null : d;
}

/* Minutos desde la lectura, o null si no sabemos de cuándo es. */
const minutosDesde = (d) => (d ? Math.max(0, (Date.now() - d.getTime()) / 6e4) : null);

/* Cuándo un dato deja de poder presentarse como vigente. Son literalmente las
   mismas 48 h que usa la app —VENCE_HORAS de lib/comun.js, ya no una segunda
   constante que había que acordarse de mover— y NO los 90 minutos que
   pedía el diseño: el INA publica UNA lectura por día, sellada a las 00:00,
   así que a las 01:31 de la mañana el dato de hoy ya figuraría vencido todos
   los días del año. Los 90 minutos siguen valiendo para otra cosa —abajo de
   eso la frescura se cuenta en minutos y no en horas—, que es la única parte
   de esa regla que el ritmo de publicación del INA soporta. */
const EN_MINUTOS = 90;
const VENCE_MINUTOS = VENCE_HORAS * 60;

const estaVencido = () => {
  const m = minutosDesde(rio.fecha);
  return m === null || m > VENCE_MINUTOS;
};

/* El umbral personal. NO se recalcula acá: `cotaEnHidrometro()` es la única
   función que traduce cota a umbral y vive en js/app/cota.js, que la portada
   no carga. La app espeja su resultado a IndexedDB para que lo lea el service
   worker —ver js/app/avisos.js— y esa misma copia sirve acá. Duplicar la
   cuenta era la manera segura de que un día la barra y la app mostraran dos
   umbrales distintos para la misma casa. */
async function leerUmbralPropio() {
  try {
    const db = await new Promise((ok, mal) => {
      const p = indexedDB.open("cotacero", 1);
      /* Si la base todavía no existe, esto la crearía vacía. No pasa nada:
         es la misma que usa la app, con el mismo almacén y la misma versión. */
      p.onupgradeneeded = () => p.result.createObjectStore("kv");
      p.onsuccess = () => ok(p.result);
      p.onerror = () => mal(p.error);
    });
    const v = await new Promise((ok, mal) => {
      const t = db.transaction("kv", "readonly").objectStore("kv").get("umbral");
      t.onsuccess = () => ok(t.result);
      t.onerror = () => mal(t.error);
    });
    db.close();
    /* Si la clave no está, el umbral es null y no el último que leímos: quien
       borró su cota en la app dejó de tener umbral, y la píldora tiene que
       volver al verde. */
    const u = typeof v === "number" && isFinite(v) ? v : null;
    if (u !== rio.umbral) {
      rio.umbral = u;
      avisar();
    }
  } catch (e) {
    /* Sin IndexedDB la píldora se queda con los umbrales oficiales, que es lo
       que ve cualquiera que todavía no calculó su cota. */
  }
}

async function leerNivel() {
  try {
    const r = await fetch("/api/nivel");
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (typeof j.altura !== "number") throw new Error("sin altura");

    /* Los umbrales oficiales los publica la estación del INA y vienen en la
       respuesta. Los del objeto son el respaldo para cuando contesta el
       reporte diario, que no los trae. */
    /* Con el MISMO filtro que la app, el widget y el service worker. Acá no
       estaba: se adoptaba cualquier número que viniera, así que una respuesta
       con la evacuación por debajo de la alerta habría pintado la franja de
       la portada con el río en aguas medias. */
    const of = umbralesDe(j);
    if (of) {
      rio.alerta = of.alerta;
      rio.evacuacion = of.evacuacion;
    }
    rio.altura = j.altura;
    rio.delta = typeof j.delta === "number" ? j.delta : null;
    rio.fechaTexto = j.fecha_dato || "";
    rio.fecha = fechaINA(rio.fechaTexto);
    rio.sinDato = false;
  } catch (e) {
    /* No se borra nada. Una lectura que ya tenemos se sigue mostrando —el
       renglón del pie dice de cuándo es y la franja no sale si venció—:
       tirarla porque un pedido falló sería quedarse sin el único número que
       había, justo el día que hace falta. Si nunca llegó ninguna, `altura`
       sigue en null y la píldora dice "sin dato". */
  }
  avisar();
}

/* Cada diez minutos, y al volver a la pestaña. El INA publica una vez por día
   y Vercel cachea /api/nivel una hora en su CDN, así que esto no lo golpea:
   es para que una pestaña abierta desde ayer no muestre el nivel de ayer. */
const CADA_MS = 10 * 60 * 1000;
setInterval(leerNivel, CADA_MS);
addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  leerNivel();
  /* Y el umbral: alguien pudo haber cargado su cota en la app, en otra
     pestaña, mientras esta estaba de fondo. */
  leerUmbralPropio();
});

/* El reloj de la frescura: no pide nada, sólo repinta para que el "hace N
   min" avance y para que un dato pueda vencerse con la pestaña abierta. */
setInterval(avisar, 30 * 1000);

/* ==========================================================================
   4. EL ESTADO EN VIVO: LA PÍLDORA, LA FRANJA Y LA FRESCURA
   --------------------------------------------------------------------------
   Las tres se suscriben al mismo objeto `rio` y por eso no se pueden
   contradecir. Ninguna hace fetch; ninguna guarda su propia copia del número.
   ========================================================================== */

/* En qué estado está el río. El orden importa y es el de la gravedad: los
   umbrales OFICIALES le ganan al personal, porque son los que mandan una
   evacuación. El personal sólo se usa mientras el río va por debajo de la
   alerta del INA, que es justamente el hueco que la app existe para llenar:
   en muchos barrios el agua llega bastante antes de los 5,30 m. */
function estadoDelRio(r) {
  if (r.altura === null) return "";
  if (r.altura >= r.evacuacion) return "evacuacion";
  if (r.altura >= r.alerta) return "alerta";
  if (r.umbral !== null && r.altura >= r.umbral) return "propio";
  return "ok";
}

/* Sube, baja o está quieto. Sale del `delta` que publica la serie del INA —la
   diferencia contra la lectura anterior—, no de una cuenta nuestra. Menos de
   un centímetro es ruido y se llama estable: el hidrómetro se lee al
   centímetro y un "▲ sube" por medio centímetro sería inventar una tendencia
   donde hay una medición. */
function tendencia(r) {
  if (r.delta === null || Math.abs(r.delta) < 0.005) return "estable";
  return r.delta > 0 ? "sube" : "baja";
}

const SIGNO = { sube: "▲ sube", baja: "▼ baja", estable: "▂ estable" };
const EN_VOZ = { sube: " y sube", baja: " y baja", estable: " y está estable" };

/* ---------- la píldora de la barra ---------- */
function pintarPildora(r) {
  const caja = $("pildora-rio");
  const punto = $("pildora-punto");
  const nivel = $("pildora-nivel");
  const tend = $("pildora-tendencia");
  if (!caja || !punto || !nivel || !tend) return;

  if (r.altura === null) {
    punto.removeAttribute("data-estado"); // gris: no sabemos, no decimos
    nivel.textContent = "— sin dato";
    tend.hidden = true;
    caja.setAttribute("aria-label", "No se pudo leer el nivel del río");
    return;
  }

  const t = tendencia(r);
  punto.setAttribute("data-estado", estadoDelRio(r));
  nivel.textContent = m(r.altura) + " m";
  tend.textContent = SIGNO[t];
  tend.setAttribute("data-tendencia", t);
  tend.hidden = false;
  /* El aria-label reemplaza el contenido para quien escucha: "Río 4,86 m
     ▲ sube" no es una frase, y el triángulo se lee como "triángulo negro
     apuntando hacia arriba". */
  caja.setAttribute(
    "aria-label",
    "El río está a " + m(r.altura) + " metros" + EN_VOZ[t],
  );
}

/* ---------- la franja de estado oficial ----------
   No existe en día normal: el contenedor queda vacío y `:empty` lo saca del
   flujo, así que no reserva ni un pixel. Y no sale NUNCA con un dato vencido

   que ninguna—: para eso está la guarda de `estaVencido()`. */
function pintarFranja(r) {
  const caja = $("franja-estado");
  if (!caja) return;

  const nivel = r.altura;
  if (nivel === null || estaVencido() || nivel < r.alerta) {
    if (caja.firstChild) caja.textContent = "";
    return;
  }

  const evacua = nivel >= r.evacuacion;
  const texto = evacua
    ? "Evacuación oficial en curso (río a " +
      m(nivel) +
      " m). La orden la da Defensa Civil — 103."
    : "Alerta oficial activa: el río está a " +
      m(nivel) +
      " m, sobre los " +
      m(r.alerta) +
      " m de alerta.";

  /* Se repinta sólo si cambió: el store avisa cada 30 segundos y volver a
     armar los nodos cortaría la animación del punto en cada vuelta. */
  if (caja.dataset.texto === texto) return;
  caja.dataset.texto = texto;
  caja.textContent = "";

  const franja = document.createElement("div");
  franja.className = "franja" + (evacua ? " evacuacion" : "");
  const fila = document.createElement("div");
  fila.className = "ancho";

  const p = document.createElement("p");
  const punto = document.createElement("span");
  punto.className = "punto-estado";
  punto.setAttribute("aria-hidden", "true");
  p.append(punto, texto);

  const ir = document.createElement("a");
  ir.href = "/puntos-de-encuentro";
  ir.textContent = "Ver puntos de encuentro";

  fila.append(p, ir);
  franja.append(fila);
  caja.append(franja);
}

suscribir(pintarPildora);
suscribir(pintarFranja);

leerNivel();
leerUmbralPropio();

  /* La única puerta hacia afuera. landing.js toma de acá lo que necesita para
     el mockup y el renglón de frescura del pie. */
  window.CC = {
    rio,
    suscribir,
    m,
    minutosDesde,
    estaVencido,
    EN_MINUTOS,
    VENCE_MINUTOS,
  };
})();
