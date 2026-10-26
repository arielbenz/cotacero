/* js/app/alias.js — los nombres nuevos de las calles de Arroyo Leyes.
   Puro: no toca el DOM ni el estado, así lo carga scripts/comprobar.js.

   Desde la Ordenanza 47/2021 de la Comuna (18/11/2021) las calles de Arroyo
   Leyes tienen nombres de árboles y aves —«Los Curupíes», «Los Crespines»— y las
   casas, número de portal. Pero Georef, OpenStreetMap y el mapa de la app
   siguen con los números de antes: «Calle 18», «Calle 53». Quien escribe
   «Curupies 3006» no encontraba nada, aunque la calle existiera.

   Esto traduce lo que escribió al número anterior, que sí se puede buscar. De
   dónde sale la tabla, y qué no dice, está en
   datos-crudos/arroyo-leyes-alias-2026-10-26.mjs. */

export const ALIAS_URL = "/datos-abiertos/calles-leyes-alias.json";

let promesa = null;

/* [{ nombre, palabras, categoria, tramos: [{ anterior, min, max }] }] */
export function cargarAlias(url = ALIAS_URL) {
  if (promesa) return promesa;
  promesa = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("sin tabla de nombres");
      return r.json();
    })
    .then((j) =>
      j.calles.map(([nombre, categoria, tramos]) => ({
        nombre,
        palabras: palabrasDe(nombre),
        categoria,
        tramos: tramos.map(([anterior, min, max]) => ({ anterior, min, max })),
      })),
    )
    .catch(() => {
      promesa = null; // sin la tabla la búsqueda anda igual, sin los nombres
      return null;
    });
  return promesa;
}

/* Minúsculas, sin tildes ni puntos: «Curupíes» y «curupies» son lo mismo. */
const normalizar = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:°º'"´`\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* Lo que no distingue una calle de otra: «Los Curupíes», «Curupíes» y «Calle
   Curupíes» son la misma. */
const VACIAS = new Set([
  "calle", "avenida", "av", "boulevard", "bv", "pasillo", "pje", "pasaje",
  "los", "las", "el", "la", "de", "del", "y", "e",
]);

function palabrasDe(s) {
  return normalizar(s)
    .split(" ")
    .filter((w) => w && !VACIAS.has(w));
}

/* Las calles cuyo nombre nuevo empieza como lo escrito, la más parecida
   primero: todas las palabras escritas tienen que ser el comienzo de alguna del
   nombre. Las tildes no cuentan: «Curupies» es «Curupíes». */
export function buscarAlias(tabla, texto) {
  if (!tabla) return [];
  const q = palabrasDe(texto);
  if (!q.length || q.join("").length < 3) return [];
  const empieza = (w, x) => w.startsWith(x);
  return tabla
    .filter((c) => q.every((x) => c.palabras.some((w) => empieza(w, x))))
    .map((c) => ({
      c,
      // Igual de largas = la escribió entera: primero. Después, las más cortas.
      rango: c.palabras.join(" ") === q.join(" ") ? 0 : 1,
      largo: c.palabras.length,
    }))
    .sort(
      (a, b) =>
        a.rango - b.rango ||
        a.largo - b.largo ||
        a.c.nombre.localeCompare(b.c.nombre, "es"),
    )
    .map((x) => x.c);
}

/* A qué número anterior corresponde una calle nueva, dada la altura de la casa
   si la escribió. Una calle puede haber tenido varios números según el tramo
   —«Los Curupíes» fue la 18 al oeste de la ruta, la 16 y la 26 al este—, y la
   numeración de casas de cada tramo está en la ordenanza: la altura elige. Sin
   altura, o con una que no cae en ningún tramo, queda el tramo más largo, y
   `dentro` dice que no se pudo confirmar.

   Devuelve { nombre, anterior, anteriores, dentro } o null si la calle no tuvo
   número anterior que buscar. */
export function resolverAlias(tabla, texto, altura) {
  const c = buscarAlias(tabla, texto)[0];
  if (!c) return null;
  const conNumero = c.tramos.filter((t) => t.anterior && t.anterior !== "S/N");
  if (!conNumero.length) return null;
  const anteriores = [...new Set(conNumero.map((t) => t.anterior))];
  let elegido = null;
  let dentro = false;
  if (altura != null) {
    elegido = conNumero.find((t) => altura >= t.min && altura <= t.max);
    dentro = Boolean(elegido);
  }
  if (!elegido) {
    // El tramo más largo, o el más cercano a la altura que escribió.
    elegido = [...conNumero].sort((a, b) =>
      altura != null
        ? distancia(altura, a) - distancia(altura, b)
        : b.max - b.min - (a.max - a.min),
    )[0];
  }
  return { nombre: c.nombre, anterior: elegido.anterior, anteriores, dentro };
}

const distancia = (n, t) => (n < t.min ? t.min - n : n > t.max ? n - t.max : 0);

/* «18» -> «Calle 18», «90BIS» -> «Calle 90 BIS»: como la rotulan los mapas. */
export const comoCalle = (anterior) =>
  "Calle " + anterior.replace(/(\d)BIS$/, "$1 BIS");
