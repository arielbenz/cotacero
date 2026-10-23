/* js/app/mapa.js — MapLibre, los 30 puntos y la búsqueda de direcciones.
   El motor va self-hosteado en vendor/: no depende de ningún CDN, el service
   worker lo cachea —así el mapa abre sin conexión, sin tiles pero con los
   puntos— y deja la CSP con script-src 'self' sin una sola excepción.
   Las coordenadas NO se geocodifican en runtime: se probó y salía mal. */

import { aTitulo, cargarCalles, cerrarSugerencias } from "./calles.js";
import { COBERTURA, VECINAS, ZONAS } from "./zonas.js";
import {
  BOTON_MARCAR,
  elegirZona,
  fijarCotaEstimada,
  pintarOrigenCota,
} from "./cota.js";
import { elevacionDe } from "./elevacion.js";
import { PUNTOS, estado, guardado } from "./estado.js";
import { m } from "./formato.js";
import { pintarCercanos, pintarPuntos } from "./puntos.js";
import { aLaVista, irA, ocupar } from "./vista.js";

/* ================= MAPA ================= */
export let mapa = null,
  promesaPuntos = null,
  pinDe = {},
  coordsPuntos = {},
  miPos = null;
/* La promesa de armarMapa() mientras el mapa se construye (ver ahí), y el
   pin de la casa marcada a mano, para reemplazarlo si marca de nuevo. */
let promesaMapa = null,
  pinCasa = null,
  // Uno solo: cada «Mostrar el más cercano» sumaba un «Estás acá» nuevo.
  pinYo = null;

/* ---------- la búsqueda de dirección: Georef primero, Nominatim detrás ----------
   Georef es la API de direcciones del Estado nacional (apis.datos.gob.ar).
   Normaliza lo que escribe la gente —«Bv Galvez al 1500», «Boulevard
   Pellegrini 3100», con o sin tilde— y ubica la altura interpolando sobre el
   callejero del INDEC. Sin clave ni cuota. Nominatim (OpenStreetMap) sólo
   conoce las alturas que alguien cargó a mano, que en Santa Fe son pocas:
   cuando no la tiene devuelve una esquina o la calle entera, hasta 1,4 km de
   la casa, y la cota de ese punto no dice nada.

   Medido el 17/10/2026 con 30 direcciones escritas como las escribe la
   gente: Georef ubicó la altura en 25; Nominatim en 15, y en otras 3 la ubicó
   pero en Santo Tomé o Candioti. Cuando los dos la tienen, coinciden a menos
   de 50 m.

   Georef no resuelve barrios ni parajes («Alto Verde», «Colastiné Norte»):
   eso sigue siendo de Nominatim. Y si Georef no contesta —es un servicio del
   Estado, puede estar caído— Nominatim queda detrás. Dos proveedores sin
   clave, no uno. Los dos reciben una consulta por búsqueda que inicia la
   persona, nunca un barrido; la política de uso de Nominatim lo pide así.
   Cambiar de proveedor toca también connect-src en vercel.json, el párrafo
   de /legal que los nombra y LICENCIAS en scripts/paginas/legal.js. */

/* Un fetch con tope de tiempo. Sin él, un proveedor colgado deja el botón en
   «Buscando…» para siempre, y acá hay un segundo esperando turno.
   AbortController y no AbortSignal.timeout(): el segundo no existe en los
   Android viejos que este proyecto sostiene. */
async function traerJson(url, ms) {
  const ctl =
    typeof AbortController === "function" ? new AbortController() : null;
  const t = ctl && setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    if (t) clearTimeout(t);
  }
}

/* Las vecinas que la app calcula con los puntos de la costa (elevacion.js) y
   que caen dentro del viewbox. Antes del 22/10/2026 no tenían plano: quien
   vivía ahí leía «no se encontró» —como si hubiera escrito mal— y el mapa le
   contestaba «fuera del plano». Tres sugerencias de Rincón en dos días.
   Cómo se las reconoce y en qué localidad de Georef buscarlas está en
   `localidad`, en zonas.js. Un mismo resultado de Nominatim puede traer dos
   localidades: el campo más chico va primero. */
function vecinaDe(a) {
  if (!a) return null;
  for (const campo of [a.village, a.town, a.city, a.municipality]) {
    const v = campo && VECINAS.find((x) => x.localidad.re.test(campo));
    if (v) return v.id;
  }
  return null;
}
const vecinaElegida = () => VECINAS.find((v) => v.id === estado.zona);

/* Devuelve { c: [lon, lat], nombre, exacta, vecina } o null. `exacta` es la
   altura —interpolada dentro de la cuadra, que para curvas cada 50 cm
   alcanza— y no la calle entera. Se filtra por localidad censal y no por
   departamento: con «La Capital» Georef también se va a la calle homónima de
   Santo Tomé. La localidad es la de la zona elegida: con Rincón elegido,
   «Dorrego 2414» es la de Rincón. Sin altura no contesta nada útil —la
   ubicación es un punto cualquiera de la calle—, así que se descarta y sigue
   Nominatim. `v` es la vecina donde buscar, o null para la ciudad. */
async function georef(texto, v) {
  if (v && !v.localidad.georef) return null;
  const localidad = v ? v.localidad.georef : "Santa Fe";
  const j = await traerJson(
    "https://apis.datos.gob.ar/georef/api/direcciones?" +
      new URLSearchParams({
        direccion: texto,
        provincia: "Santa Fe",
        localidad_censal: localidad,
        max: "1",
      }),
    8000,
  );
  const f = j && j.direcciones && j.direcciones[0];
  if (!f || !f.altura || f.altura.valor == null || !f.ubicacion) return null;
  const c = [+f.ubicacion.lon, +f.ubicacion.lat];
  if (!isFinite(c[0]) || !isFinite(c[1])) return null;
  return {
    c,
    nombre: aTitulo(f.calle.nombre + " " + f.altura.valor) + ", " + localidad,
    exacta: true,
    vecina: v ? v.id : null,
  };
}

/* El viewbox con `bounded=1` es un filtro duro, no un sesgo: sin él Nominatim
   se va a la calle homónima de Rosario. Pero es un rectángulo, y adentro
   quedan Santo Tomé —cruzando el Salado—, Rincón y Candioti, que tienen las
   mismas calles con las mismas alturas. Por eso se piden varios resultados
   con `addressdetails` y se toma el primero que OpenStreetMap ubica dentro
   del municipio: la relación «Santa Fe Capital», que llevan todos los puntos
   de la ciudad —Alto Verde y Colastiné incluidos— y ninguno de los vecinos.
   Además de la ciudad se aceptan las VECINAS de zonas.js, que tienen
   los puntos de la costa; Santo Tomé y Candioti siguen afuera. */
const VIEWBOX_SF = "-60.90,-31.35,-60.45,-31.85";
const enElMunicipio = (a) =>
  Boolean(a) && (a.municipality === "Santa Fe Capital" || a.city === "Santa Fe");

async function nominatim(texto, v) {
  const j = await traerJson(
    "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        // Con una vecina elegida se nombra la localidad: si no, «Dorrego
        // 2414» sale primero la de la ciudad.
        q: texto + (v ? ", " + v.n : "") + ", Santa Fe, Argentina",
        format: "jsonv2",
        limit: "5",
        viewbox: VIEWBOX_SF,
        bounded: "1",
        addressdetails: "1",
      }),
    10000,
  );
  if (!Array.isArray(j)) return null;
  // Un resultado de tipo "city"/"state"/"village" es el centroide de la
  // localidad, no la dirección: como cota no dice nada.
  const util = j.filter(
    (x) =>
      (enElMunicipio(x.address) || vecinaDe(x.address)) &&
      !["city", "town", "village", "state", "country", "municipality"].includes(
        x.addresstype,
      ),
  );
  // Primero la localidad de la zona elegida; si no, la ciudad; si no, una
  // vecina. Así una calle homónima no le gana a la de quien busca.
  const f =
    (v && util.find((x) => vecinaDe(x.address) === v.id)) ||
    util.find((x) => enElMunicipio(x.address)) ||
    util[0];
  if (!f) return null;
  const c = [parseFloat(f.lon), parseFloat(f.lat)];
  if (!isFinite(c[0]) || !isFinite(c[1])) return null;
  // "house"/"building"/"place" es la altura exacta; "road" es un punto
  // cualquiera de la calle, que en una avenida larga puede estar a kilómetros.
  // Eso hay que decirlo, no esconderlo detrás de un número que parece firme.
  return {
    c,
    nombre: f.display_name || "",
    exacta: ["house", "building", "place"].includes(f.addresstype),
    vecina: enElMunicipio(f.address) ? null : vecinaDe(f.address),
  };
}

/* «Pasar a esa zona», cuando la dirección cayó en una vecina que no es la
   zona elegida. La altura ya está bien; lo que cambia es la distancia río
   arriba, y con ella el nivel de aviso. El renglón de estado se reescribe sin
   el botón, así que el foco va ahí y no se pierde en el <body>. */
export function vivoEnVecina(id) {
  elegirZona(id);
  pintarOrigenCota();
  const e = document.getElementById("estado-cota");
  e.setAttribute("tabindex", "-1");
  aLaVista(e);
  e.focus({ preventScroll: true });
}

/* Si la dirección no queda en la zona elegida, decirlo: la zona pone los km
   río arriba, y Rincón con la zona del centro da un nivel de aviso 72 cm más
   alto que el real. No se cambia sola —Rincón tiene calles homónimas de la
   ciudad—: lo confirma la persona. */
function avisoDeZona(r) {
  const elegida = vecinaElegida();
  if (r.vecina && r.vecina !== estado.zona) {
    const z = ZONAS.find((x) => x.id === r.vecina);
    return (
      ' <b style="color:var(--alerta-texto)">Esa dirección queda en ' +
      z.n +
      "</b>, y tu zona dice otra cosa: la distancia río arriba cambia el " +
      'resultado. <button class="enlace-crudo" type="button" ' +
      'data-accion="zona-vecina" data-zona="' +
      z.id +
      '">Pasar a ' +
      z.n +
      "</button>."
    );
  }
  if (!r.vecina && elegida)
    return (
      ' <b style="color:var(--alerta-texto)">Esa dirección queda en la ciudad ' +
      "de Santa Fe</b>, no en tu zona. Si no es tu casa, escribí también la " +
      "localidad."
    );
  return "";
}

export function abrirBuscadorDireccion() {
  document.getElementById("caja-dir").style.display = "block";
  document.getElementById("in-dir").focus();
  // Las sugerencias se filtran contra el callejero (js/app/calles.js): se
  // baja ahora, mientras empieza a escribir, y no al abrir la app.
  cargarCalles();
}

/* Nominatim no encuentra «Barrio Centenario» y sí «Centenario»: en
   OpenStreetMap el barrio se llama sin el prefijo. Pero así lo escribe todo el
   mundo en Santa Fe —y «B° Candioti» en los papeles—, así que si la búsqueda
   vuelve vacía se prueba UNA vez más sin él. Sigue siendo una consulta que
   inició la persona, no un barrido. */
const PREFIJO_BARRIO = /(^|[\s,])(?:barrio\s+|b\s*[°º]\s*|bo\.\s*)/gi;

export async function buscarDireccion() {
  cerrarSugerencias();
  const q = document.getElementById("in-dir").value.trim();
  const e = document.getElementById("estado-cota");
  if (!q) {
    e.textContent = "Escribí una dirección.";
    return;
  }
  const liberar = ocupar('[data-accion="buscar-dir"]', "Buscando…");
  try {
    e.textContent = "Buscando la dirección…";
    aLaVista(e);
    // Georef sólo con una altura: sin número lo que escribió es un barrio,
    // una plaza o una calle entera, y eso lo sabe Nominatim.
    const conNumero = /\d/.test(q);
    const sinBarrio = q.replace(PREFIJO_BARRIO, "$1").trim();
    /* Primero en la localidad de la zona elegida; si ahí no aparece, en la
       ciudad. Quien eligió Rincón y escribe una dirección del centro la
       encuentra igual, y avisoDeZona() le dice dónde quedó. */
    const elegida = vecinaElegida();
    var r = null;
    for (const v of elegida ? [elegida, null] : [null]) {
      r = conNumero ? await georef(q, v) : null;
      if (!r) r = await nominatim(q, v);
      if (!r && sinBarrio && sinBarrio !== q) r = await nominatim(sinBarrio, v);
      if (r) break;
    }
    if (!r) {
      // Hay calles nuevas que ningún callejero tiene todavía —pasó con
      // «Avenida de los Ombúes»—: ahí ningún intento más la va a encontrar,
      // y lo que sirve es el mapa.
      e.innerHTML =
        "No se encontró esa dirección. Probá con calle y número; si sigue " +
        "sin aparecer, " +
        BOTON_MARCAR +
        ".";
      return;
    }
    e.textContent = "Buscando la altura de ese terreno…";
    var res = await elevacionDe(r.c[1], r.c[0]);
    if (!res) {
      e.innerHTML =
        "<b>Encontramos la dirección, pero no la altura de ese terreno.</b> " +
        "Los planos que usamos cubren " +
        COBERTURA +
        ", no toda el área metropolitana.";
      return;
    }
    var alt = Math.round(res.cota * 100) / 100;
  } finally {
    liberar();
  }
  // Se guarda qué encontró, no lo que la persona escribió: el geocodificador
  // puede haber entendido otra cosa, y así se puede desmentir.
  fijarCotaEstimada(
    alt,
    "direccion",
    r.nombre.split(",").slice(0, 4).join(",").trim(),
    res.distancia,
    res.fuente,
  );
  if (!r.exacta)
    e.innerHTML +=
      ' <b style="color:var(--alerta-texto)">Ubicó la calle, no el número exacto</b>, ' +
      "así que puede estar a varias cuadras. Si no es tu casa, escribí la altura a mano.";
  e.innerHTML += avisoDeZona(r);
}

/* Baja MapLibre bajo demanda. Una sola vez, aunque se pida de nuevo.
   Va self-hosteado en /vendor: no depende de ningún CDN, el service worker lo
   guarda y así el mapa abre sin conexión (los tiles no, pero la app degrada
   sola). Además deja la CSP con `script-src 'self'` sin excepciones. */
let promesaMapLibre = null;

function cargarMapLibre() {
  if (promesaMapLibre) return promesaMapLibre;

  /* Antes de pedir nada: MapLibre dibuja con WebGL, y sin WebGL falla igual
     pero DESPUÉS de bajar 275 KB. En un teléfono viejo con datos contados eso
     es gastarle el crédito para mostrarle un error. Se pregunta primero. */
  const prueba = document.createElement("canvas");
  const hayWebGL = Boolean(
    prueba.getContext("webgl2") ||
      prueba.getContext("webgl") ||
      prueba.getContext("experimental-webgl"),
  );
  if (!hayWebGL) {
    promesaMapLibre = Promise.reject(new Error("este teléfono no tiene WebGL"));
    return promesaMapLibre;
  }

  promesaMapLibre = new Promise((ok, mal) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/maplibre-gl.css";
    // Antes de app.css, no después: si se agrega al final gana el cascade y
    // los popups vuelven al blanco de MapLibre en vez del tema de la app.
    const propio = document.querySelector('link[href="/css/app.css"]');
    if (propio) document.head.insertBefore(css, propio);
    else document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/vendor/maplibre-gl.js";
    s.onload = () => ok();
    s.onerror = () => mal(new Error("no se pudo cargar maplibre-gl"));
    document.head.appendChild(s);
  });
  return promesaMapLibre;
}

/* Basemap del IGN (Instituto Geográfico Nacional). Sin clave y sin cuota, y
   es el mismo que usa el GeoPortal de la Municipalidad de Santa Fe. El
   servicio es TMS, con la Y contada desde abajo: de ahí scheme "tms".
   Los ajustes de raster lo oscurecen para que entre en el tema de la app. */
const ESTILO_IGN = {
  version: 8,
  sources: {
    ign: {
      type: "raster",
      tiles: [
        "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/" +
          "capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png",
      ],
      scheme: "tms",
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '<a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">Instituto Geográfico Nacional</a> · ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    },
    /* La foto aérea, sólo para «Marcar mi casa»: el argenmap no dibuja
       edificios ni numeración, y a la altura de una cuadra se veía una
       manzana lisa. Son los vuelos fotogramétricos del IGN de 2013 (40 cm)
       y del 9/7/2014 (30 cm), según su capa de áreas de vuelo; la app dice
       la fecha en pantalla porque una casa más nueva sale como baldío.
       Va por WMS en JPEG y no por su TMS en PNG: 15 KB contra 190 KB por
       tile, y en una crecida se mira con datos móviles. Sin clave ni cuota,
       como el resto del mapa. */
    vuelos: {
      type: "raster",
      tiles: [
        "https://imagenes.ign.gob.ar/geoserver/mosaicos_vuelos/wms?service=WMS" +
          "&version=1.1.1&request=GetMap&layers=mosaicos_vuelos&styles=" +
          "&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256" +
          "&format=image/jpeg",
      ],
      tileSize: 256,
      attribution:
        'Foto aérea: <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">IGN</a>, vuelos de 2013 y 2014',
    },
    // Los nombres de las calles, transparentes, encima de la foto.
    calles: {
      type: "raster",
      tiles: [
        "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/" +
          "mapabase_hibrido@EPSG:3857@png/{z}/{x}/{y}.png",
      ],
      scheme: "tms",
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "fondo",
      type: "background",
      paint: { "background-color": "#16292f" },
    },
    {
      id: "ign",
      type: "raster",
      source: "ign",
      // El oscurecido lo hace un filtro CSS sobre el canvas (ver app.css):
      // sobre un basemap claro da mucho mejor resultado que las propiedades
      // raster, que sólo bajan brillo y dejan todo lavado.
      paint: { "raster-saturation": -0.15 },
    },
    // Apagadas hasta que se marca: una capa oculta no pide tiles.
    { id: "vuelos", type: "raster", source: "vuelos", layout: { visibility: "none" } },
    { id: "calles", type: "raster", source: "calles", layout: { visibility: "none" } },
  ],
};

/* Al marcar, la foto reemplaza al argenmap, que deja de pedir tiles. Antes
   de que termine de cargar el estilo MapLibre no acepta cambios de capa:
   ahí se espera al `load`. */
function fondoDeMarcar(prender) {
  if (!mapa) return;
  try {
    const v = prender ? "visible" : "none";
    mapa.setLayoutProperty("vuelos", "visibility", v);
    mapa.setLayoutProperty("calles", "visibility", v);
    mapa.setLayoutProperty("ign", "visibility", prender ? "none" : "visible");
  } catch (e) {
    mapa.once("load", () => fondoDeMarcar(prender));
  }
}

/* Si el IGN no contesta, el mapa quedaba con el fondo liso y los puntos
   encima, sin decir nada: «se ve sólo gris», contó alguien. Pasa sin señal y
   pasa cuando el servidor del IGN anda lento. Se cuentan los tiles que llegan
   y los que fallan, y cuando el mapa se queda quieto se decide: si falló
   alguno y no llegó ninguno, se avisa. Un servidor colgado no dispara ningún
   error, así que 15 s sin un solo tile también cuentan como falla. */
let llegaron = 0;
let fallaron = 0;
let relojFondo = null;
const FONDOS = new Set(["ign", "vuelos", "calles"]);

function vigilarFondo() {
  mapa.on("data", (e) => {
    if (FONDOS.has(e.sourceId) && e.tile) llegaron++;
  });
  mapa.on("error", (e) => {
    if (FONDOS.has(e.sourceId)) fallaron++;
    // Con un oyente propio MapLibre deja de escribir sus errores en la
    // consola: los que no son del fondo se siguen mostrando.
    else console.error(e.error || e);
  });
  mapa.on("dataloading", (e) => {
    if (!FONDOS.has(e.sourceId) || relojFondo) return;
    relojFondo = setTimeout(() => {
      relojFondo = null;
      if (!llegaron) avisoFondo(true);
    }, 15000);
  });
  mapa.on("idle", () => {
    clearTimeout(relojFondo);
    relojFondo = null;
    if (llegaron) avisoFondo(false);
    else if (fallaron) avisoFondo(true);
    llegaron = fallaron = 0;
  });
}

function avisoFondo(mostrar) {
  const cont = document.getElementById("mapa");
  if (!cont) return;
  let el = cont.querySelector(".mapa-fondo");
  if (!mostrar) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.className = "mapa-fondo";
    el.setAttribute("role", "status");
    cont.appendChild(el);
  }
  el.innerHTML = navigator.onLine
    ? "<b>El mapa de fondo no está cargando:</b> el servidor del Instituto " +
      "Geográfico Nacional no responde. Probá en un rato. Los puntos de " +
      "encuentro y la lista de abajo funcionan igual."
    : "<b>Sin conexión, el mapa de fondo no carga.</b> Los puntos de " +
      "encuentro y la lista de abajo funcionan igual.";
}

/* Ubica los 29 puntos EN PARALELO. Antes era un await dentro de un for:
   29 viajes de ida y vuelta en serie en la primera carga de cada dispositivo,
   en 3G decenas de segundos. Va separado de armarMapa() porque la lista, las
   distancias y los links a la app de mapas necesitan las coordenadas aunque
   nunca se abra el mapa. */
export function ubicarPuntos() {
  if (promesaPuntos) return promesaPuntos;
  // Ya no se geocodifica nada: las coordenadas son las oficiales del municipio
  // y están en PUNTOS. Sale instantáneo, anda sin red y no consume cuota de
  // ningún proveedor. Sigue siendo una promesa porque armarMapa() la espera.
  for (const [n, , c] of PUNTOS) coordsPuntos[n] = c;
  document.getElementById("estado-mapa").innerHTML =
    PUNTOS.length +
    " puntos de encuentro, ubicados con las coordenadas oficiales del municipio. " +
    "<b>Fijate el recorrido real</b>: el camino más corto puede pasar por zona baja.";
  pintarPuntos();
  promesaPuntos = Promise.resolve();
  return promesaPuntos;
}

/* Devuelve SIEMPRE la misma promesa mientras el mapa se arma. Era un flag
   (`mapaPedido`) y la segunda llamada volvía al instante con `mapa` todavía
   nulo. «Marcar mi casa en el mapa» hace irA("donde") —que dispara
   armarMapa() sin esperarlo— y recién después lo espera: como un <script>
   carga siempre asíncrono, encontraba el mapa a medio armar y decía «Este
   teléfono no puede mostrar el mapa» con el mapa cargando bien. Fallaba en
   el primer uso, para todo el mundo, sin un error en consola. */
export function armarMapa() {
  if (!promesaMapa) promesaMapa = construirMapa();
  return promesaMapa;
}

async function construirMapa() {
  const cont = document.getElementById("mapa");
  try {
    await cargarMapLibre();
  } catch (e) {
    /* Sin mapa la pestaña sigue sirviendo: la lista de abajo está completa y
       cada punto abre en la app de mapas del teléfono. Se saca el alto fijo
       del contenedor para no dejar 340 px de caja vacía empujando la lista
       fuera de la pantalla. */
    cont.style.height = "auto";
    cont.innerHTML =
      '<div style="padding:18px"><p class="chico">Este teléfono no puede ' +
      "mostrar el mapa. La lista de acá abajo funciona igual, y cada lugar " +
      "abre en la aplicación de mapas del teléfono.</p></div>";
    promesaMapa = null;
    return;
  }
  mapa = new maplibregl.Map({
    container: "mapa",
    style: ESTILO_IGN,
    center: [-60.7, -31.63],
    zoom: 11,
    /* El IGN publica hasta el 18. Más cerca MapLibre estira el tile y sólo
       se ve una manzana lisa y borrosa: parecía que el mapa no cargaba. */
    maxZoom: 18,
    attributionControl: { compact: true },
  });
  vigilarFondo();
  mapa.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  await ubicarPuntos();
  for (const [n, d] of PUNTOS) {
    const c = coordsPuntos[n];
    if (!c) continue;
    const el = document.createElement("div");
    el.className = "pin";
    el.dataset.nombre = n;
    // MapLibre v5 no acepta `new Marker(elemento)`: hay que pasar {element}.
    // Con la firma vieja ignoraba el pin propio y dibujaba el suyo.
    new maplibregl.Marker({ element: el })
      .setLngLat(c)
      .setPopup(
        new maplibregl.Popup({ offset: 14 }).setHTML(
          `<strong>${n}</strong><br><span style="font-size: var(--t-s);color:#7E959D">${d}</span>`,
        ),
      )
      .addTo(mapa);
    pinDe[n] = el;
  }
}

export function distanciaKm(a, b) {
  const R = 6371,
    dLat = ((b[1] - a[1]) * Math.PI) / 180,
    dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function ubicarmeEnMapa() {
  const e = document.getElementById("estado-mapa");
  if (!navigator.geolocation) {
    e.textContent = "Este navegador no da ubicación.";
    return;
  }
  e.textContent = "Pidiendo tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      miPos = [pos.coords.longitude, pos.coords.latitude];
      if (mapa && typeof maplibregl !== "undefined") {
        if (pinYo) pinYo.setLngLat(miPos);
        else {
          const el = document.createElement("div");
          el.className = "pin yo";
          pinYo = new maplibregl.Marker({ element: el })
            .setLngLat(miPos)
            .setPopup(
              new maplibregl.Popup({ offset: 14 }).setHTML(
                "<strong>Estás acá</strong>",
              ),
            )
            .addTo(mapa);
        }
      }
      // Sale de coordsPuntos y no de los marcadores: así funciona
      // aunque el mapa nunca se haya abierto o no haya podido cargar.
      const ubicados = PUNTOS.filter(([n]) => coordsPuntos[n]);
      if (!ubicados.length) {
        e.textContent = "Los puntos todavía no están ubicados.";
        return;
      }
      const orden = ubicados
        .map(([n, d]) => ({
          nombre: n,
          dir: d,
          coord: coordsPuntos[n],
          km: distanciaKm(miPos, coordsPuntos[n]),
        }))
        .sort((a, b) => a.km - b.km);
      /* Los tres más cercanos, numerados en el mapa como en las tarjetas:
         con uno solo, si el primero quedaba cruzando agua no había a cuál
         ir. */
      const tres = orden.slice(0, 3);
      Object.values(pinDe).forEach((el) => {
        el.classList.remove("cerca");
        el.textContent = "";
      });
      tres.forEach((o, i) => {
        const el = pinDe[o.nombre];
        if (!el) return;
        el.classList.add("cerca");
        el.textContent = String(i + 1);
      });
      if (mapa) {
        // MapLibre toma un array plano [a, b] como [sw, ne] al pie de la
        // letra: si vienen al revés arma un bounds invertido y se va al mundo
        // entero (zoom -0.15). Por eso se construye con extend().
        const caja = new maplibregl.LngLatBounds(miPos, miPos);
        tres.forEach((o) => caja.extend(o.coord));
        mapa.fitBounds(caja, { padding: 50, maxZoom: 15 });
      }
      e.textContent = "";
      pintarCercanos(orden);
      pintarPuntos(document.getElementById("buscar-punto").value);
      /* Con las tarjetas a la vista, el sólido de la pantalla es «Cómo
         llegar» del primero: este botón pasa a secundario. */
      const b = document.querySelector('[data-accion="ubicarme"]');
      if (b) {
        b.classList.add("sec");
        b.textContent = "Actualizar mi ubicación";
      }
    },
    () => {
      e.textContent = "No diste permiso de ubicación.";
    },
    { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
  );
}

/* ================= LISTA DE PUNTOS ================= */

/* ---------- marcar la casa tocando el mapa ----------
   La cuarta forma de conseguir la altura, y la única que no pide saber nada:
   ni la cota, ni la calle y altura exacta. Para quien no sabe su dirección
   formal pero reconoce su cuadra desde arriba.
   Reutiliza el mapa de "Dónde ir" —no arma un segundo mapa— y elevacionDe(),
   que ya trabaja con lat/lon sueltos contra las curvas precacheadas.
   No se guarda ninguna coordenada: sólo la altura que sale de ella.

   Es un MODO, con principio y fin: el mapa lleva la clase `marcando`, el
   aviso va SOBRE el mapa —donde está el dedo, no debajo del botón de «más
   cercano»— y el toque no decide solo: deja el pin a la vista, dice qué
   altura encontró y pide confirmar. Antes mandaba a «Mi casa» en el acto,
   sin que se viera dónde quedó la marca, y nadie sabía si había tocado bien.
   Cambiar de pestaña cancela (vista.js): no queda un toque armado esperando
   en «Dónde ir». */
let marca = null; // lo que devolvió elevacionDe() para el punto tocado

const CANCELAR =
  ' <button class="enlace-crudo" type="button" data-accion="mapa-cancelar">Cancelar</button>';

function avisoMapa(html) {
  const cont = document.getElementById("mapa");
  if (!cont) return;
  let el = cont.querySelector(".mapa-aviso");
  if (!html) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.className = "mapa-aviso";
    el.setAttribute("role", "status");
    cont.appendChild(el);
  }
  el.innerHTML = html;
}

/* La fecha va en el pedido, no sólo en la atribución plegada: una casa
   construida después de 2014 sale como baldío, y quien la busca tiene que
   saber por qué no la encuentra. */
const pedirToque = (texto) =>
  avisoMapa(
    "<b>" +
      (texto || "Acercá el mapa hasta ver tu cuadra y tocá tu casa.") +
      "</b>" +
      (texto
        ? ""
        : " La foto es del IGN, de 2013 y 2014: si tu casa es más nueva, " +
          "guiate por las calles.") +
      CANCELAR,
  );

const estaMarcando = () =>
  Boolean(document.getElementById("mapa")?.classList.contains("marcando"));

function ponerPin(lngLat) {
  if (pinCasa) pinCasa.remove();
  const el = document.createElement("div");
  el.className = "pin yo";
  pinCasa = new maplibregl.Marker({ element: el })
    .setLngLat(lngLat)
    .setPopup(
      new maplibregl.Popup({ offset: 14 }).setHTML(
        "<strong>Tu casa</strong>, marcada a mano",
      ),
    )
    .addTo(mapa);
}

async function alTocar(e) {
  if (!estaMarcando()) return;
  // Tocó un punto de encuentro, no su casa: se abre el popup del punto y se
  // sigue esperando.
  const destino = e.originalEvent && e.originalEvent.target;
  if (destino && destino.closest && destino.closest(".pin")) {
    mapa.once("click", alTocar);
    return;
  }
  /* Sin zoom suficiente el dedo tapa varias cuadras y la altura sería de
     cualquier lado: se pide acercar y se sigue esperando. */
  if (mapa.getZoom() < 15) {
    pedirToque("Acercá más: desde esta altura el dedo tapa varias cuadras.");
    mapa.once("click", alTocar);
    return;
  }
  const r = await elevacionDe(e.lngLat.lat, e.lngLat.lng);
  if (!r) {
    pedirToque(
      "Ese punto queda fuera de los planos de alturas, que cubren " +
        COBERTURA +
        ", no toda el área metropolitana. Probá con otro.",
    );
    mapa.once("click", alTocar);
    return;
  }
  ponerPin(e.lngLat);
  marca = r;
  avisoMapa(
    "Marcaste un punto a <b>" +
      m(r.cota) +
      " sobre el mar</b>. ¿Es tu casa?" +
      '<div class="mapa-aviso-botones">' +
      '<button class="btn mini" type="button" data-accion="mapa-confirmar">Sí, usar esta altura</button>' +
      ' <button class="enlace-crudo" type="button" data-accion="mapa-de-nuevo">Marcar de nuevo</button>' +
      CANCELAR +
      "</div>",
  );
}

function salirDeMarcar() {
  const cont = document.getElementById("mapa");
  if (cont) cont.classList.remove("marcando");
  fondoDeMarcar(false);
  avisoMapa(null);
  if (mapa) mapa.off("click", alTocar);
  marca = null;
}

export async function marcarCasaEnMapa() {
  const est = document.getElementById("estado-cota");
  irA("donde");
  await armarMapa();
  if (!mapa) {
    if (est)
      est.innerHTML =
        "<b>Este teléfono no puede mostrar el mapa.</b> Probá con «Buscar " +
        "dirección», o escribí la altura a mano.";
    irA("cota");
    return;
  }
  const cont = document.getElementById("mapa");
  // irA() dejó la página arriba de todo y el mapa puede quedar bajo el
  // pliegue: el pedido tiene que verse, no sólo existir.
  aLaVista(cont);
  if (estaMarcando()) return; // ya está esperando el toque: no armar dos
  cont.classList.add("marcando");
  fondoDeMarcar(true);
  // Si ya pidió «el más cercano a mí», arrancamos sobre su posición: le
  // ahorra el viaje a dedo desde la vista de toda la ciudad.
  if (miPos) mapa.jumpTo({ center: miPos, zoom: 16 });
  pedirToque();
  mapa.once("click", alTocar);
}

export function confirmarMarca() {
  if (!marca) return;
  const r = marca;
  salirDeMarcar();
  fijarCotaEstimada(
    Math.round(r.cota * 100) / 100,
    "mapa",
    "punto marcado a mano en el mapa",
    r.distancia,
    r.fuente,
  );
  irA("cota");
}

export function marcarDeNuevo() {
  if (!estaMarcando()) return;
  if (pinCasa) {
    pinCasa.remove();
    pinCasa = null;
  }
  marca = null;
  pedirToque();
  mapa.once("click", alTocar);
}

/* `volver` = false cuando lo llama el cambio de pestaña: ya se está yendo. */
export function cancelarMarca(volver = true) {
  if (!estaMarcando()) return;
  // Un pin sin confirmar no se queda.
  if (marca && pinCasa) {
    pinCasa.remove();
    pinCasa = null;
  }
  salirDeMarcar();
  if (volver) irA("cota");
}
