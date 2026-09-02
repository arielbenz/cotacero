/* js/app/mapa.js — MapLibre, los 30 puntos y la búsqueda de direcciones.
   El motor va self-hosteado en vendor/: no depende de ningún CDN, el service
   worker lo cachea —así el mapa abre sin conexión, sin tiles pero con los
   puntos— y deja la CSP con script-src 'self' sin una sola excepción.
   Las coordenadas NO se geocodifican en runtime: se probó y salía mal. */

import { calcular, pintarOrigenCota } from "./cota.js";
import { curvas, elevacionDe } from "./elevacion.js";
import { PUNTOS, estado, guardado } from "./estado.js";
import { enCampo, m } from "./formato.js";
import { pintarPuntos } from "./puntos.js";
import { pintarRio } from "./rio.js";
import { aLaVista, ocupar } from "./vista.js";

/* ================= MAPA ================= */
export let mapa = null,
  mapaPedido = false,
  promesaPuntos = null,
  pinDe = {},
  coordsPuntos = {},
  miPos = null;

/* Geocodifica una dirección con Nominatim (OpenStreetMap). Devuelve
   [lon,lat] o null. Sólo la usa la búsqueda de dirección de la persona: los
   puntos de encuentro tienen coordenadas oficiales y no pasan por acá.
   `bounded=1` con viewbox es un filtro duro, no un sesgo: sin él el
   geocodificador se va a la calle homónima de Rosario o Santo Tomé.
   La política de uso de Nominatim pide no hacer consultas sistemáticas: acá
   va una por búsqueda que inicia la persona, y se cachea en el dispositivo. */
const VIEWBOX_SF = "-60.90,-31.35,-60.45,-31.85";

async function geocodificar(texto, cache = true) {
  // cc_geo4_: cambió el proveedor, la caché anterior no sirve.
  const clave = "cc_geo4_" + texto.replace(/\s+/g, "_").slice(0, 60);
  if (cache) {
    const g = guardado.get(clave);
    if (g) {
      try {
        return JSON.parse(g);
      } catch (e) {}
    }
  }
  try {
    const u =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: texto,
        format: "jsonv2",
        limit: "1",
        viewbox: VIEWBOX_SF,
        bounded: "1",
      });
    const r = await fetch(u, { headers: { Accept: "application/json" } });
    const j = await r.json();
    const f = j && j[0];
    if (!f) return null;
    // Un resultado de tipo "city"/"state" es el centroide de la ciudad, no la
    // dirección: como cota no dice nada. Mejor no devolver nada.
    if (["city", "state", "country", "municipality"].includes(f.addresstype))
      return null;
    const c = [parseFloat(f.lon), parseFloat(f.lat)];
    if (!isFinite(c[0]) || !isFinite(c[1])) return null;
    // Devolvemos también qué encontró y con cuánta precisión. "house"/"building"
    // es la altura exacta; "road" es un punto cualquiera de la calle, que en
    // una avenida larga puede estar a kilómetros. Eso hay que decirlo, no
    // esconderlo detrás de un número que parece firme.
    const res = {
      c,
      nombre: f.display_name || "",
      exacta: ["house", "building", "place"].includes(f.addresstype),
    };
    if (cache) guardado.set(clave, JSON.stringify(res));
    return res;
  } catch (e) {
    return null;
  }
}

export function abrirBuscadorDireccion() {
  document.getElementById("caja-dir").style.display = "block";
  document.getElementById("in-dir").focus();
}

export async function buscarDireccion() {
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
    var r = await geocodificar(q + ", Santa Fe, Argentina", false);
    if (!r) {
      e.textContent = "No se encontró esa dirección. Probá con calle y altura.";
      return;
    }
    e.textContent = "Buscando entre las curvas de nivel…";
    var res = await elevacionDe(r.c[1], r.c[0]);
    if (!res) {
      e.innerHTML =
        "<b>Encontramos la dirección, pero no la cota de ese terreno.</b> Las curvas de " +
        "nivel del municipio cubren la ciudad, no toda el área metropolitana.";
      return;
    }
    var alt = Math.round(res.cota * 100) / 100;
    estado.cotaDistancia = res.distancia;
  } finally {
    liberar();
  }
  estado.cota = alt;
  estado.cotaEsEstimada = true;
  estado.cotaOrigen = "direccion";
  // Guardamos qué encontró, no lo que la persona escribió: el geocodificador
  // puede haber entendido otra cosa, y así se puede desmentir.
  estado.cotaDetalle = r.nombre.split(",").slice(0, 4).join(",").trim();
  document.getElementById("in-cota").value = enCampo(alt);
  guardado.set("cc_cota", String(alt));
  guardado.set("cc_cota_est", "1");
  guardado.set("cc_cota_origen", "direccion");
  guardado.set("cc_cota_detalle", estado.cotaDetalle);
  pintarOrigenCota();
  if (!r.exacta)
    e.innerHTML +=
      ' <b style="color:var(--alerta-texto)">Ubicó la calle, no la altura exacta</b>, ' +
      "así que puede estar a varias cuadras. Si no es tu casa, cargá la cota a mano.";
  calcular();
  pintarRio();
}

/* Baja MapLibre bajo demanda. Una sola vez, aunque se pida de nuevo.
   Va self-hosteado en /vendor: no depende de ningún CDN, el service worker lo
   guarda y así el mapa abre sin conexión (los tiles no, pero la app degrada
   sola). Además deja la CSP con `script-src 'self'` sin excepciones. */
let promesaMapLibre = null;

function cargarMapLibre() {
  if (promesaMapLibre) return promesaMapLibre;
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

export async function armarMapa() {
  if (mapa || mapaPedido) return;
  mapaPedido = true;
  const cont = document.getElementById("mapa");
  try {
    await cargarMapLibre();
  } catch (e) {
    cont.innerHTML =
      '<div style="padding:18px"><p class="chico">No se pudo cargar el mapa. ' +
      "La lista de puntos de acá abajo funciona igual.</p></div>";
    mapaPedido = false;
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
