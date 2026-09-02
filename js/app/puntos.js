/* js/app/puntos.js — la lista de puntos de encuentro y su filtro. */

import { PUNTOS } from "./estado.js";
import { atr, m } from "./formato.js";
import { coordsPuntos, distanciaKm, mapa, miPos } from "./mapa.js";
import { ver } from "./vista.js";

// La lista completa medía cinco pantallas y media de scroll. Arranca corta:
// si diste ubicación, los más cercanos; si no, los primeros. El buscador
// siempre muestra todo lo que coincide.
const PUNTOS_VISIBLES = 6;

let verTodosLosPuntos = false;

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
    .map(([n, d]) => {
      const c = coordsPuntos[n];
      // geo: abre la app de mapas que la persona ya tenga en el teléfono
      const href = c
        ? `geo:${c[1]},${c[0]}?q=${c[1]},${c[0]}(${encodeURIComponent(n)})`
        : `geo:0,0?q=${encodeURIComponent(d + ", Santa Fe, Argentina")}`;
      const km =
        miPos && c ? " · " + distanciaKm(miPos, c).toFixed(1) + " km" : "";
      return `<a class="punto ${destacar === n ? "destacado" : ""}" href="${href}"
data-accion="ver-en-mapa" data-nombre="${atr(n)}">
<div class="n">${n}${destacar === n ? ' <span style="color:var(--ok-texto);font-size: var(--t-xs)">· el más cercano</span>' : ""}</div>
<div class="d">${d}${km}</div>
<span class="ir">Abrir en mapas →</span></a>`;
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
