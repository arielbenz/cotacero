/* js/app/mapa.js — MapLibre, los 30 puntos y la búsqueda de direcciones.
   El motor va self-hosteado en vendor/: no depende de ningún CDN, el service
   worker lo cachea —así el mapa abre sin conexión, sin tiles pero con los
   puntos— y deja la CSP con script-src 'self' sin una sola excepción.
   Las coordenadas NO se geocodifican en runtime: se probó y salía mal. */

import { aTitulo, cargarCalles, cerrarSugerencias } from "./calles.js";
import { BOTON_MARCAR, fijarCotaEstimada } from "./cota.js";
import { curvas, elevacionDe } from "./elevacion.js";
import { PUNTOS, estado, guardado } from "./estado.js";
import { m } from "./formato.js";
import { pintarPuntos } from "./puntos.js";
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
  pinCasa = null;

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
   de /legal que los nombra y LICENCIAS en scripts/paginas.js. */

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

/* Devuelve { c: [lon, lat], nombre, exacta } o null. `exacta` es la altura
   —interpolada dentro de la cuadra, que para curvas cada 50 cm alcanza— y no
   la calle entera. Se filtra por localidad censal y no por departamento:
   con «La Capital» Georef también se va a la calle homónima de Santo Tomé.
   Sin altura no contesta nada útil —la ubicación es un punto cualquiera de la
   calle—, así que se descarta y sigue Nominatim. */
async function georef(texto) {
  const j = await traerJson(
    "https://apis.datos.gob.ar/georef/api/direcciones?" +
      new URLSearchParams({
        direccion: texto,
        provincia: "Santa Fe",
        localidad_censal: "Santa Fe",
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
    nombre: aTitulo(f.calle.nombre + " " + f.altura.valor) + ", Santa Fe",
    exacta: true,
  };
}

/* El viewbox con `bounded=1` es un filtro duro, no un sesgo: sin él Nominatim
   se va a la calle homónima de Rosario. Pero es un rectángulo, y adentro
   quedan Santo Tomé —cruzando el Salado—, Rincón y Candioti, que tienen las
   mismas calles con las mismas alturas. Por eso se piden varios resultados
   con `addressdetails` y se toma el primero que OpenStreetMap ubica dentro
   del municipio: la relación «Santa Fe Capital», que llevan todos los puntos
   de la ciudad —Alto Verde y Colastiné incluidos— y ninguno de los vecinos. */
const VIEWBOX_SF = "-60.90,-31.35,-60.45,-31.85";
const enElMunicipio = (a) =>
  Boolean(a) && (a.municipality === "Santa Fe Capital" || a.city === "Santa Fe");

async function nominatim(texto) {
  const j = await traerJson(
    "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: texto + ", Santa Fe, Argentina",
        format: "jsonv2",
        limit: "5",
        viewbox: VIEWBOX_SF,
        bounded: "1",
        addressdetails: "1",
      }),
    10000,
  );
  if (!Array.isArray(j)) return null;
  // Un resultado de tipo "city"/"state" es el centroide de la ciudad, no la
  // dirección: como cota no dice nada.
  const f = j.find(
    (x) =>
      enElMunicipio(x.address) &&
      !["city", "state", "country", "municipality"].includes(x.addresstype),
  );
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
  };
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
    var r = /\d/.test(q) ? await georef(q) : null;
    if (!r) r = await nominatim(q);
    const sinBarrio = q.replace(PREFIJO_BARRIO, "$1").trim();
    if (!r && sinBarrio && sinBarrio !== q) r = await nominatim(sinBarrio);
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
    e.textContent = "Buscando entre las curvas de nivel…";
    var res = await elevacionDe(r.c[1], r.c[0]);
    if (!res) {
      e.innerHTML =
        "<b>Encontramos la dirección, pero no la altura de ese terreno.</b> El " +
        "plano de alturas del municipio cubre la ciudad, no toda el área " +
        "metropolitana.";
      return;
    }
    var alt = Math.round(res.cota * 100) / 100;
    estado.cotaDistancia = res.distancia;
  } finally {
    liberar();
  }
  // Se guarda qué encontró, no lo que la persona escribió: el geocodificador
  // puede haber entendido otra cosa, y así se puede desmentir.
  fijarCotaEstimada(
    alt,
    "direccion",
    r.nombre.split(",").slice(0, 4).join(",").trim(),
  );
  if (!r.exacta)
    e.innerHTML +=
      ' <b style="color:var(--alerta-texto)">Ubicó la calle, no el número exacto</b>, ' +
      "así que puede estar a varias cuadras. Si no es tu casa, escribí la altura a mano.";
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
  ],
};

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
    attributionControl: { compact: true },
  });
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
        const el = document.createElement("div");
        el.className = "pin yo";
        new maplibregl.Marker({ element: el })
          .setLngLat(miPos)
          .setPopup(
            new maplibregl.Popup({ offset: 14 }).setHTML(
              "<strong>Estás acá</strong>",
            ),
          )
          .addTo(mapa);
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
      const cerca = orden[0];
      Object.values(pinDe).forEach((el) => el.classList.remove("cerca"));
      if (pinDe[cerca.nombre]) pinDe[cerca.nombre].classList.add("cerca");
      if (mapa)
        // MapLibre toma un array plano [a, b] como [sw, ne] al pie de la
        // letra: si vienen al revés arma un bounds invertido y se va al mundo
        // entero (zoom -0.15). Por eso se construye con extend().
        mapa.fitBounds(
          new maplibregl.LngLatBounds(miPos, miPos).extend(cerca.coord),
          { padding: 70, maxZoom: 14 },
        );
      e.innerHTML =
        "El más cercano es <b>" +
        cerca.nombre +
        "</b>, a " +
        cerca.km.toFixed(1) +
        " km en línea recta. <b>Fijate el recorrido real</b>: el camino más " +
        "corto puede pasar por zona baja.";
      pintarPuntos(document.getElementById("buscar-punto").value, cerca.nombre);
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

const pedirToque = (texto) =>
  avisoMapa(
    "<b>" +
      (texto || "Acercá el mapa hasta ver tu cuadra y tocá tu casa.") +
      "</b>" +
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
      "Ese punto queda fuera del plano de alturas del municipio, que cubre " +
        "la ciudad y no toda el área metropolitana. Probá con otro.",
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
