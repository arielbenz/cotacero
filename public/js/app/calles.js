/* js/app/calles.js — las sugerencias del buscador de dirección.
   Filtra en el teléfono contra datos-abiertos/calles.json, el callejero de
   Georef para la ciudad, o contra calles-rincon.json si la zona elegida es
   San José del Rincón (los genera scripts/calles.js; Arroyo Leyes no
   tiene uno que sirva, ver zonas.js). Mientras la persona
   escribe no sale nada del dispositivo: /legal promete que la búsqueda
   consulta afuera sólo cuando ella la inicia, y la política de Nominatim
   prohíbe autocompletar contra su API.

   Es una ayuda, no una reja. Si la lista no bajó —sin señal, o el archivo
   falló— el buscador anda igual que antes, y una calle que no está en la
   lista se puede buscar igual: puede ser un barrio, que eso lo resuelve
   Nominatim. */

import { VECINAS } from "./zonas.js";
import { estado } from "./estado.js";

const CALLEJERO_CIUDAD = "/datos-abiertos/calles.json";

const callejeros = new Map(); // archivo -> promesa de [{ nombre, palabras, desde, hasta }] | null
let opciones = [], // lo que se está mostrando, para las flechas
  activa = -1;

/* Qué callejero y qué nombre corresponden a la zona elegida. Sin zona, o con
   una de la ciudad, es la ciudad. `archivo` es null donde no hay callejero. */
function callejeroActual() {
  const v = VECINAS.find((x) => x.id === estado.zona);
  return v
    ? { archivo: v.localidad.callejero, lugar: v.n, vecina: v }
    : { archivo: CALLEJERO_CIUDAD, lugar: "Santa Fe", vecina: null };
}

/* «BV GALVEZ» → «Bv Galvez». Georef da los nombres en mayúsculas y sin
   tildes; la app los muestra así para que la persona pueda desmentir lo que
   se encontró. Lo usa también js/app/mapa.js. */
export function aTitulo(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (m, sep, c) => sep + c.toUpperCase())
    .replace(/\s(De|Del|La|Las|Los|Y|E)(?=\s)/g, (m) => m.toLowerCase());
}

/* Minúsculas, sin tildes, sin puntos ni «°». «Bv. Gálvez» y «bv galvez» son
   lo mismo. La ñ se aplana a n: Georef escribe «PENALOZA». */
function normalizar(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:°º'"´`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Cómo lo escribe la gente → cómo lo abrevia Georef. */
const ALIAS = {
  bulevar: "bv", boulevard: "bv", boulevar: "bv", bvard: "bv", blvd: "bv",
  avenida: "av", avda: "av",
  pasaje: "pje", psje: "pje", pje: "pje",
  diagonal: "diag",
  doctor: "dr",
  callejon: "cjon",
  gobernador: "gdor", gob: "gdor",
  peatonal: "peat",
  monsenor: "mons",
  general: "grl", gral: "grl",
  presbitero: "pbro",
  presidente: "pres", pte: "pres",
  republica: "rca",
  camino: "cno",
  coronel: "cnl", cnel: "cnl",
  comandante: "cmte", cdte: "cmte",
  capitan: "cap",
  alferez: "alfz",
  acceso: "acc",
  cortada: "cort",
};

/* El tipo de vía no ayuda a encontrar la calle y a veces estorba: la gente
   escribe «Avenida Pellegrini» y Georef la tiene como «BV PELLEGRINI». Se
   ignora en la consulta. Lo mismo los conectores: «Galvez al 1500». */
const IGNORAR = new Set([
  "bv", "av", "pje", "diag", "peat", "cjon", "cno", "acc", "cort", "calle",
  "de", "del", "y", "al", "e",
]);

const palabrasDe = (s) =>
  normalizar(s)
    .split(" ")
    .filter(Boolean)
    .map((w) => ALIAS[w] || w);

export function cargarCalles(archivo = callejeroActual().archivo) {
  if (!archivo) return Promise.resolve(null);
  if (callejeros.has(archivo)) return callejeros.get(archivo);
  const promesa = fetch(archivo)
    .then((r) => {
      if (!r.ok) throw new Error("sin callejero");
      return r.json();
    })
    .then((j) =>
      j.calles.map(([nombre, desde, hasta]) => ({
        nombre: aTitulo(nombre),
        palabras: palabrasDe(nombre),
        desde,
        hasta,
      })),
    )
    .catch(() => {
      // Sin lista no hay sugerencias, y nada más. Se puede reintentar.
      callejeros.delete(archivo);
      return null;
    });
  callejeros.set(archivo, promesa);
  return promesa;
}

/* Distancia de edición ≤ 1 entre dos palabras cortas. Alcanza para
   «Pelegrini», «Galves» o una letra de más; no se busca más lejos porque
   en una lista de 845 calles empieza a sugerir cualquier cosa. */
function aUnaLetra(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++dif > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}

/* ¿La palabra q que escribió la persona es el comienzo de w? Con una letra
   de error si la palabra ya es larga. */
function empieza(w, q, tolerar) {
  if (w.startsWith(q)) return true;
  if (!tolerar || q.length < 4) return false;
  for (let L = q.length - 1; L <= q.length + 1; L++)
    if (L <= w.length && aUnaLetra(w.slice(0, L), q)) return true;
  return false;
}

/* «Santa Fe» al principio o al final dice la ciudad, no la calle: «Santa Fe
   República de Siria 3701» no la encontraba ningún proveedor. Se saca sólo si
   lo que queda tiene letras y un número —«Santa Fe 1234» es la avenida, y
   «Santa Fe y Mitre» una esquina—. Lo usan el filtro de acá y la búsqueda de
   mapa.js. */
const CIUDAD = /^\s*santa\s+fe[\s,]+|[\s,]+santa\s+fe\s*$/i;
export function sinCiudad(texto) {
  const t = String(texto).replace(CIUDAD, " ").replace(/\s+/g, " ").trim();
  return /[a-z]/i.test(t) && /\d/.test(t) ? t : String(texto);
}

/* Separa lo que escribió en calle y número. El número es el ÚLTIMO grupo de
   cifras, y sólo si hay una palabra antes: «25 de Mayo» no tiene número,
   «25 de Mayo 3000» sí. Lo que va después de una coma —«, Santa Fe»,
   «, Candioti»— no es la calle. */
function partir(texto) {
  const antes = sinCiudad(texto).split(",")[0];
  const m = antes.match(/^(.*\D)\s(\d{1,5})\s*$/);
  return m
    ? { calle: m[1].trim(), numero: +m[2] }
    : { calle: antes.trim(), numero: null };
}

function buscarCalles(calles, textoCalle) {
  // null = todavía es muy poco para opinar («Av», «B»).
  const q = palabrasDe(textoCalle).filter((w) => !IGNORAR.has(w));
  const claves = q;
  if (!q.length || q.join("").length < 2) return null;
  const probar = (tolerar) =>
    calles
      .map((c) => {
        const propias = c.palabras.filter((w) => !IGNORAR.has(w));
        if (!q.every((x) => c.palabras.some((w) => empieza(w, x, tolerar))))
          return null;
        // Primero las que empiezan por lo que escribió, después las más
        // cortas: «Mitre» antes que «Pje Mitre» y que «Bartolome Mitre».
        const alPrincipio = propias[0] && empieza(propias[0], q[0], tolerar);
        const igual = propias.join(" ") === claves.join(" ");
        return {
          c,
          rango: (igual ? 0 : 2) + (alPrincipio ? 0 : 1),
          largo: propias.length,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.rango - b.rango ||
          a.largo - b.largo ||
          a.c.nombre.localeCompare(b.c.nombre, "es"),
      )
      .map((x) => x.c);
  const exactas = probar(false);
  return exactas.length ? exactas : probar(true);
}

const $ = (id) => document.getElementById(id);

function pista(html, aviso) {
  const p = $("pista-dir");
  if (!p) return;
  p.innerHTML = html;
  p.classList.toggle("aviso-dir", Boolean(aviso));
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export function cerrarSugerencias() {
  const ul = $("sug-dir"),
    inp = $("in-dir");
  opciones = [];
  activa = -1;
  if (ul) {
    ul.hidden = true;
    ul.innerHTML = "";
  }
  if (inp) {
    inp.setAttribute("aria-expanded", "false");
    inp.removeAttribute("aria-activedescendant");
  }
}

function mostrar(lista, numero) {
  const ul = $("sug-dir"),
    inp = $("in-dir");
  opciones = lista.slice(0, 5);
  activa = -1;
  inp.removeAttribute("aria-activedescendant");
  if (!opciones.length) return cerrarSugerencias();
  ul.innerHTML = opciones
    .map(
      (c, i) =>
        `<li role="option" id="sug-dir-${i}" aria-selected="false" ` +
        `data-accion="elegir-calle" data-calle="${esc(c.nombre)}">` +
        `<span>${esc(c.nombre)}${numero != null ? " " + numero : ""}</span>` +
        (c.hasta != null ? `<small>${rango(c)}</small>` : "") +
        `</li>`,
    )
    .join("");
  ul.hidden = false;
  inp.setAttribute("aria-expanded", "true");
}

/* «va del 400 al 699», o «llega hasta el 2399» si arranca en cero. */
const rango = (c) =>
  c.desde > 0 ? `va del ${c.desde} al ${c.hasta}` : `llega hasta el ${c.hasta}`;

/* La escribió entera: las mismas palabras, sin contar el tipo de vía. */
const sustantivas = (s) => palabrasDe(s).filter((w) => !IGNORAR.has(w)).join(" ");
const exacta = (c, calle) => sustantivas(c.nombre) === sustantivas(calle);

/* El renglón de abajo del campo: dice qué entendió y qué falta, antes de
   apretar Buscar. Dice «número» y no «altura»: en esta app «altura» es la
   del terreno sobre el mar, y mezclar las dos al lado del cálculo confunde. */
function opinar(calle, numero, lista, lugar) {
  if (!calle || lista === null) {
    pista("Escribí la calle y el número de tu casa.");
    return;
  }
  // «Barrio Centenario», «B° Candioti»: se busca igual, pero un barrio da
  // un punto cualquiera del barrio y eso hay que decirlo antes.
  if (!lista.length && /^\s*(barrio\s|b\s*[°º]|bo\.)/i.test(calle)) {
    pista(
      "Buscar un barrio da un punto cualquiera del barrio, no tu casa. " +
        "Si podés, escribí calle y número.",
    );
    return;
  }
  if (!lista.length) {
    pista(
      `No hay ninguna calle de ${lugar} que se escriba así. Revisá cómo ` +
        "está escrita, o buscá igual: si es un barrio o un lugar, lo " +
        "buscamos en OpenStreetMap.",
      true,
    );
    return;
  }
  // Se da por identificada sólo si la escribió entera. Si hay una sola
  // candidata pero a medias —«Ris 1745», «Pelegrini»—, se pregunta: Georef
  // no entiende «Ris», y tocar la sugerencia la completa.
  if (!exacta(lista[0], calle)) {
    pista(
      lista.length === 1
        ? `¿Es <b>${esc(lista[0].nombre)}</b>? Tocala en la lista para completarla.`
        : numero == null
          ? "Elegí tu calle de la lista, o seguí escribiendo."
          : "Hay más de una calle que se escribe así: elegí la tuya de la lista.",
    );
    return;
  }
  const c = lista[0];
  if (numero == null) {
    pista(
      c.hasta != null
        ? `Ahora el número: <b>${esc(c.nombre)}</b> ${rango(c)}.`
        : `Ahora el número de tu casa en <b>${esc(c.nombre)}</b>.`,
    );
    return;
  }
  // Se avisa cuando el número queda fuera de lo que el callejero tiene de esa
  // calle: pasa el último o es anterior al primero («Santa Fe 2500» no existe,
  // la avenida va del 9401 al 10099). Entre los tramos puede haber huecos, y
  // ahí decide la búsqueda. Si hay dos calles que se escriben igual, alcanza
  // con que el número entre en una.
  const iguales = lista.filter((x) => exacta(x, calle));
  const entra = (x) =>
    x.hasta == null || (numero <= x.hasta && numero >= x.desde);
  if (!iguales.some(entra)) {
    pista(
      `<b>${esc(c.nombre)}</b> ${rango(c)}. Revisá el número.`,
      true,
    );
    return;
  }
  pista(`<b>${esc(c.nombre)} ${numero}</b>. Apretá Buscar.`);
}

/* Lo llama el delegador de principal.js en cada tecla (data-input). */
export async function sugerirCalle() {
  const inp = $("in-dir");
  if (!inp) return;
  pintarZonaDir();
  const valor = inp.value;
  const { archivo, lugar } = callejeroActual();
  // Arroyo Leyes: Georef no tiene sus calles con nombre. Se dice, en vez de
  // dejar al campo mudo, y se señala el camino que sí anda.
  if (!archivo) {
    cerrarSugerencias();
    pista(
      `${lugar} casi no tiene calles con nombre en los mapas abiertos, así ` +
        "que acá no hay sugerencias. Probá con calle y número; si no aparece, " +
        "tocá «Marcarla en el mapa» más abajo.",
    );
    return;
  }
  const calles = await cargarCalles(archivo);
  // Mientras bajaba la lista pudo seguir escribiendo —o cambiar de zona—: se
  // pinta lo último.
  if (inp.value !== valor || callejeroActual().archivo !== archivo) return;
  const { calle, numero } = partir(valor);
  if (!calles) {
    cerrarSugerencias();
    pista(calle ? "" : "Escribí la calle y el número de tu casa.");
    return;
  }
  const lista = calle ? buscarCalles(calles, calle) : null;
  const identificada =
    lista && lista.length && numero != null && exacta(lista[0], calle);
  // Con la calle ya escrita entera y el número puesto, la lista sobra.
  if (identificada || !lista) cerrarSugerencias();
  else mostrar(lista, numero);
  opinar(calle, numero, lista, lugar);
}

/* Dónde busca lo dice el paso anterior —la zona elegida— y, si la dirección
   cae en otra, el resultado. Antes un renglón arriba de Buscar decía «Buscando
   en la ciudad» y ofrecía las vecinas: era texto que había que leer antes de
   escribir una calle, y si no se encuentra, el error ya ofrece buscarla en
   Rincón o Arroyo Leyes. Acá queda lo que sirve a lectores de pantalla. */
export function pintarZonaDir() {
  const ul = $("sug-dir");
  if (ul) ul.setAttribute("aria-label", "Calles de " + callejeroActual().lugar);
}

/* La zona cambió: las sugerencias salen de otro callejero. Si hay algo
   escrito se vuelve a pintar; si no, no se baja nada hasta que escriba. */
export function cambioDeZona() {
  pintarZonaDir();
  cerrarSugerencias();
  const inp = $("in-dir");
  if (inp && inp.value.trim()) sugerirCalle();
}

/* Toca una sugerencia: queda la calle tal cual la conoce Georef, se
   conserva el número si ya lo había escrito, y el foco vuelve al campo con
   el cursor al final para que siga con el número. */
export function elegirCalle(nombre) {
  const inp = $("in-dir");
  if (!inp) return;
  const { numero } = partir(inp.value);
  inp.value = nombre + " " + (numero != null ? numero : "");
  cerrarSugerencias();
  inp.focus();
  try {
    inp.setSelectionRange(inp.value.length, inp.value.length);
  } catch (e) {}
  sugerirCalle();
}

function marcar(i) {
  const ul = $("sug-dir"),
    inp = $("in-dir");
  activa = i;
  ul.querySelectorAll("[role=option]").forEach((li, k) => {
    li.setAttribute("aria-selected", k === i ? "true" : "false");
  });
  if (i >= 0) inp.setAttribute("aria-activedescendant", "sug-dir-" + i);
  else inp.removeAttribute("aria-activedescendant");
}

/* Flechas, Enter y Escape sobre el campo, el patrón de combobox de ARIA.
   Devuelve true si la tecla era para la lista; si no, principal.js sigue
   con lo suyo (Enter busca). */
export function teclaEnDireccion(ev) {
  if (!opciones.length) return false;
  if (ev.key === "ArrowDown") {
    marcar((activa + 1) % opciones.length);
  } else if (ev.key === "ArrowUp") {
    marcar(activa <= 0 ? opciones.length - 1 : activa - 1);
  } else if (ev.key === "Enter" && activa >= 0) {
    elegirCalle(opciones[activa].nombre);
  } else if (ev.key === "Escape") {
    cerrarSugerencias();
  } else return false;
  ev.preventDefault();
  return true;
}
