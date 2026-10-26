// datos-crudos/arroyo-leyes-alias-2026-10-26.mjs
//
//   node datos-crudos/arroyo-leyes-alias-2026-10-26.mjs
//
// Arma public/datos-abiertos/calles-leyes-alias.json: cómo se llama hoy cada
// calle de Arroyo Leyes y cómo se llamaba antes, que es como la rotulan Georef,
// OpenStreetMap y el mapa de la app («Calle 18»).
//
// La fuente es la Ordenanza 47/2021 de la Comuna de Arroyo Leyes (18/11/2021),
// que renombra las calles de toda la localidad y numera las casas:
//   https://arroyoleyes.gob.ar/imagenes/ordenanzas/3.pdf   cuerpo
//   https://arroyoleyes.gob.ar/imagenes/ordenanzas/4.pdf   Anexo I
//   https://arroyoleyes.gob.ar/imagenes/ordenanzas/5.pdf   Anexo II
// Los textos de los tres, extraídos del PDF con extraer-texto.swift (PDFKit,
// sólo macOS: los PDF traen capa de texto), están en
// arroyo-leyes-ordenanza-47-2021/ para poder auditar lo que se parsea.
//
// Del Anexo II sale, línea por línea, «TIPO  ANTERIOR  NUEVO  ALTURA inicio-fin»:
// con eso, para cada nombre nuevo, los números anteriores que tuvo y el rango de
// numeración de casas de cada uno. Del Anexo I sale la categoría (árboles: las
// calles perpendiculares a la Ruta 1; aves: las paralelas; histórica: el casco).
//
// Qué NO hace: no ubica ninguna casa. La ordenanza dice que la numeración crece
// hacia el oeste desde el este de la ruta y hacia el norte desde el límite con
// Rincón, pero ningún dato abierto dice dónde cae cada altura; eso se verificaría
// aparte. Sirve para traducir «Curupíes 3006» a «Calle 18».
//
// Sin dependencias, como el resto del proyecto.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = join(RAIZ, "datos-crudos", "arroyo-leyes-ordenanza-47-2021");
const SALIDA = join(RAIZ, "public", "datos-abiertos", "calles-leyes-alias.json");

const lineas = (archivo) =>
  readFileSync(join(FUENTE, archivo), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Sin tildes, sin puntos ni guiones y con un solo espacio: el Anexo I escribe
// «BRIG. ESTANISLAO LOPEZ» y «CHAL-CHAL» donde el II dice «BRIGADIER…» y «CHAL CHAL».
const sinTildes = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/BRIG\./g, "BRIGADIER")
    .replace(/[.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- Anexo II: tipo, anterior, nuevo, alturas ---------- */
const TIPOS = [
  "SERVIDUMBRE DE PASO",
  "PASILLO EN CONDOMINIO",
  "SERVIDUMBRE",
  "PASILLO",
  "BOULEVARD",
  "AVENIDA",
  "COLECTORA",
  "CALLE",
];
// Las alturas van al final: uno o dos rangos «2500-2000», o una cifra sola.
const COLA = /((?:\d+\s*-\s*\d+|\d+)(?:\s+(?:\d+\s*-\s*\d+|\d+))*)\s*$/;
// Un número de calle anterior: «18», «110B», «90BIS», «S/N».
const ANTERIOR = /^(\d+(?:[A-Z]|BIS)?|S\/N)$/;

const porNombre = new Map(); // nombre nuevo -> { tipo, tramos: [{ anterior, alturas }] }
let descartadas = 0;

for (const l of lineas("anexo-2.txt")) {
  if (/^(===|ANEXO II|TIPO_C|TOTAL|ALTURAS)/.test(l)) continue;
  // Las líneas que son sólo cifras son la segunda columna del PDF («ALTURAS DE
  // CALLES»), que se parte en dos renglones: no llevan nombre.
  if (/^[\d\s\-y,]+$/.test(l)) continue;
  const tipo = TIPOS.find((t) => l.startsWith(t + " "));
  if (!tipo) {
    descartadas++;
    continue;
  }
  const resto = l.slice(tipo.length).trim();
  const m = resto.match(COLA);
  if (!m) {
    descartadas++;
    continue;
  }
  const alturas = m[1].trim();
  const palabras = resto.slice(0, m.index).trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) continue;
  let anterior = null;
  // «CALLE 13 DE SEPTIEMBRE» es una calle nueva con nombre de fecha, no la
  // antigua «13» llamada «DE SEPTIEMBRE».
  if (
    ANTERIOR.test(palabras[0]) &&
    palabras.length > 1 &&
    !(palabras[0] === "13" && palabras[1] === "DE")
  ) {
    anterior = palabras.shift();
    if (palabras[0] === "BIS") anterior += " " + palabras.shift();
  }
  const nombre = palabras.join(" ");
  if (!nombre) continue;
  if (!porNombre.has(nombre)) porNombre.set(nombre, { tipo, tramos: [] });
  porNombre.get(nombre).tramos.push({ anterior, alturas });
}

/* ---------- Anexo I: categoría ---------- */
const anexo1 = lineas("anexo-1.txt").filter((l) => !/^(===|ANEXO I|TOTAL)/.test(l));
const categoriaDe = (nombre) => {
  const n = " " + sinTildes(nombre) + " ";
  const l = anexo1.find((x) => (" " + sinTildes(x) + " ").includes(n));
  if (!l) return "";
  if (/ARBOLES/.test(sinTildes(l))) return "árboles";
  if (/\bAVES\b/.test(sinTildes(l))) return "aves";
  if (/HISTORICA/.test(sinTildes(l))) return "histórica";
  return "";
};

/* ---------- salida ---------- */
// De cada tramo sólo importan el número anterior y el rango de alturas que cubre
// (menor y mayor de todas las cifras de sus segmentos).
const cifras = (s) => (s.match(/\d+/g) || []).map(Number);
const calles = [];
for (const [nombre, d] of [...porNombre].sort((a, b) =>
  a[0].localeCompare(b[0], "es"),
)) {
  const porAnterior = new Map();
  for (const t of d.tramos) {
    const c = cifras(t.alturas);
    if (!c.length) continue;
    const k = t.anterior || "";
    const p = porAnterior.get(k) || [Infinity, -Infinity];
    porAnterior.set(k, [Math.min(p[0], ...c), Math.max(p[1], ...c)]);
  }
  calles.push([
    nombre,
    categoriaDe(nombre),
    [...porAnterior].map(([a, [min, max]]) => [a, min, max]),
  ]);
}

const salida = {
  fuente:
    "Comuna de Arroyo Leyes, Ordenanza 47/2021 (18/11/2021), Anexos I y II — https://arroyoleyes.gob.ar/ordenanzas.php",
  generado: new Date().toISOString().slice(0, 10),
  formato:
    "[nombre nuevo, categoría, [[número anterior, altura mínima, altura máxima], …]]; número anterior vacío si el tramo no lo tenía",
  nota: "Los números anteriores son los de «Calle 18», que es como la rotulan Georef, OpenStreetMap y el mapa de la app. Las alturas son las de la numeración de casas de la ordenanza.",
  calles,
};
const texto = JSON.stringify(salida);
writeFileSync(SALIDA, texto);

const conAnterior = calles.filter((c) => c[2].some((t) => t[0]));
console.log("líneas descartadas      :", descartadas);
console.log("calles con nombre nuevo :", calles.length);
console.log("con número anterior     :", conAnterior.length);
console.log(
  "sin categoría           :",
  calles.filter((c) => !c[1]).length,
  calles.filter((c) => !c[1]).slice(0, 6).map((c) => c[0]),
);
console.log("tamaño                  :", (Buffer.byteLength(texto) / 1024).toFixed(0), "KB");
const ej = calles.find((c) => c[0] === "LOS CURUPIES");
console.log("ejemplo                 :", JSON.stringify(ej));
