/* js/app/puntos.js — la lista de puntos de encuentro y su filtro. */

import { esIOS } from "./avisos.js";
import { PUNTOS } from "./estado.js";
import { atr, m, nm } from "./formato.js";
import { coordsPuntos, distanciaKm, mapa, miPos } from "./mapa.js";
import { ver } from "./vista.js";

// La lista completa medía cinco pantallas y media de scroll. Arranca corta:
// si diste ubicación, los más cercanos; si no, los primeros. El buscador
// siempre muestra todo lo que coincide.
const PUNTOS_VISIBLES = 6;

let verTodosLosPuntos = false;

/* Los tres más cercanos, cuando la persona dio su ubicación. Van en
   tarjetas arriba y salen de la lista, que sigue desde el 4: con las tres
   repetidas abajo la lista volvía a empezar por lo que ya se había leído. */
let cercanos = [];

const enc = encodeURIComponent;

/* Ni iPhone ni Android: una computadora, o algo que no tiene app de mapas
   que abra `geo:`. Ahí el enlace va a un mapa web, en otra pestaña: en la
   misma, la persona perdía la app para mirar un mapa. */
const enEscritorio = () => !esIOS() && !/Android/i.test(navigator.userAgent);
export const destinoEnlace = () =>
  enEscritorio() ? ' target="_blank" rel="noopener"' : "";

/* El enlace a la app de mapas del teléfono. `geo:` abre la que la persona ya
   tenga, sin JavaScript. Safari en iPhone no lo entiende y el toque no hacía
   nada: ahí va Apple Maps, que abre la app de Mapas del sistema. Con `ruta`
   («Cómo llegar»), en iPhone pide la ruta a pie; `geo:` no tiene forma de
   pedir una ruta, pero la app que abre la ofrece con un toque. */
export function enlaceMapa(n, d, ruta = false) {
  const c = coordsPuntos[n];
  const dir = enc(d + ", Santa Fe, Argentina");
  /* En una computadora `geo:` no lo entiende nadie: el clic no hacía nada
     (lo contó alguien desde el escritorio). Ahí va OpenStreetMap, que es de
     donde sale el mapa base y no suma a Google; con `ruta`, la ruta a pie. */
  if (enEscritorio()) {
    if (!c) return `https://www.openstreetmap.org/search?query=${dir}`;
    return ruta
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${c[1]}%2C${c[0]}#map=16/${c[1]}/${c[0]}`
      : `https://www.openstreetmap.org/?mlat=${c[1]}&mlon=${c[0]}#map=17/${c[1]}/${c[0]}`;
  }
  if (esIOS()) {
    if (ruta)
      return c
        ? `https://maps.apple.com/?daddr=${c[1]},${c[0]}&dirflg=w&q=${enc(n)}`
        : `https://maps.apple.com/?daddr=${dir}&dirflg=w`;
    return c
      ? `https://maps.apple.com/?ll=${c[1]},${c[0]}&q=${enc(n)}`
      : `https://maps.apple.com/?q=${dir}`;
  }
  return c
    ? `geo:${c[1]},${c[0]}?q=${c[1]},${c[0]}(${enc(n)})`
    : `geo:0,0?q=${dir}`;
}

/* La distancia es en línea recta, porque es lo único que se puede calcular
   sin mandar la ubicación a nadie, y la pantalla lo dice. Los minutos salen
   de esa misma distancia a 5 km/h: es un piso, no una promesa. */
const distancia = (km) =>
  km < 1 ? Math.round(km * 100) * 10 + " m" : nm(km, 1) + " km";
const aPie = (km) => Math.max(1, Math.round((km / 5) * 60));

/* Las tres tarjetas. La primera, destacada, con el único botón sólido de la
   pantalla: es adónde ir. La línea del agua que corre va al pie y no en
   cada tarjeta: es una regla para todo el camino. */
export function pintarCercanos(orden) {
  const tres = orden.slice(0, 3);
  cercanos = tres.map((o) => o.nombre);
  const cont = document.getElementById("cercanos");
  if (!cont) return;
  cont.innerHTML =
    '<h3 class="cercanos-titu">Los más cercanos a vos</h3>' +
    '<p class="chico">Según dónde estás ahora, en línea recta: el camino ' +
    "real puede ser más largo.</p>" +
    '<ol class="cercanos">' +
    tres
      .map(
        (o, i) =>
          `<li class="cercano${i === 0 ? " primero" : ""}">` +
          `<span class="punto-num" aria-hidden="true">${i + 1}</span>` +
          `<span class="c-txt"><b>${atr(o.nombre)}</b>` +
          `<span>${atr(o.dir)}${i ? " · " + distancia(o.km) : ""}</span>` +
          (i === 0
            ? `<span class="c-dist"><b>${distancia(o.km)}</b> en línea recta · ≈ ${aPie(o.km)} min a pie</span>`
            : "") +
          `</span><a class="btn${i ? " sec mini" : ""}" href="${atr(enlaceMapa(o.nombre, o.dir, true))}"${destinoEnlace()}>Cómo llegar</a></li>`,
      )
      .join("") +
    "</ol>" +
    '<p class="chico">Si en el camino hay agua que corre, <b>no la ' +
    "cruces</b>: buscá otro punto.</p>";
}

export function alternarTodosLosPuntos() {
  verTodosLosPuntos = !verTodosLosPuntos;
  pintarPuntos(document.getElementById("buscar-punto").value);
}

export function pintarPuntos(filtro = "", destacar = null) {
  const f = filtro.toLowerCase().trim();
  const lista = PUNTOS.filter(
    ([n, d]) =>
      !f || n.toLowerCase().includes(f) || d.toLowerCase().includes(f),
  );
  // Con ubicación conocida, ordenar por distancia: antes quedaba alfabético y
  // había que cazar el resaltado entre 30 filas.
  if (miPos)
    lista.sort(
      (a, b) =>
        distanciaKm(miPos, coordsPuntos[a[0]] || [0, 0]) -
        distanciaKm(miPos, coordsPuntos[b[0]] || [0, 0]),
    );
  const cont = document.getElementById("lista-puntos");
  /* Con los cercanos en tarjetas, la lista es «los demás» y sigue la cuenta
     desde el 4. Una búsqueda muestra todo lo que coincide, cercanos
     incluidos: sacarle resultados a una búsqueda desconcierta. */
  const demas = Boolean(miPos && !f && cercanos.length);
  if (demas) {
    const quitar = new Set(cercanos);
    for (let i = lista.length - 1; i >= 0; i--)
      if (quitar.has(lista[i][0])) lista.splice(i, 1);
  }
  const titulo = document.getElementById("titulo-demas");
  if (titulo) titulo.hidden = !demas;
  const desde = demas ? cercanos.length + 1 : 0;
  // Con búsqueda activa mostramos todo lo que coincide: recortar un
  // resultado de búsqueda sería desconcertante.
  const recorta = !f && !verTodosLosPuntos && lista.length > PUNTOS_VISIBLES;
  const ocultos = recorta ? lista.length - PUNTOS_VISIBLES : 0;
  const mostrar = recorta ? lista.slice(0, PUNTOS_VISIBLES) : lista;
  if (!lista.length) {
    cont.innerHTML =
      '<p class="chico">Ningún punto coincide con esa búsqueda.</p>';
    return;
  }
  cont.innerHTML = mostrar
    .map(([n, d], i) => {
      const c = coordsPuntos[n];
      const href = enlaceMapa(n, d);
      const km = miPos && c ? " · " + distancia(distanciaKm(miPos, c)) : "";
      const num = desde
        ? `<span class="punto-num" aria-hidden="true">${desde + i}</span> `
        : "";
      return `<a class="punto ${destacar === n ? "destacado" : ""}" href="${href}"${destinoEnlace()}
data-accion="ver-en-mapa" data-nombre="${atr(n)}">
<div class="n">${num}${n}${destacar === n ? ' <span style="color:var(--ok-texto);font-size: var(--t-xs)">· el más cercano</span>' : ""}</div>
<div class="d">${d}${km}</div>
<span class="ir">Mapas →</span></a>`;
    })
    .join("");
  if (recorta || (!f && verTodosLosPuntos))
    cont.innerHTML +=
      '<button class="btn sec mini" style="margin:12px 0 0;display:block;width:100%" ' +
      'data-accion="ver-todos">' +
      (recorta ? "Ver los otros " + ocultos + " puntos" : "Ver menos") +
      "</button>";
}

export function filtrarPuntos() {
  pintarPuntos(document.getElementById("buscar-punto").value);
}

export function verEnMapa(n) {
  const c = coordsPuntos[n];
  if (c && mapa) {
    mapa.flyTo({ center: c, zoom: 15 });
  }
}
