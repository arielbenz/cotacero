// scripts/calles.js — genera datos-abiertos/calles.json desde Georef.
//
//   node scripts/calles.js
//
// De dónde sale el dato: el recurso `calles` de Georef, la API de
// direcciones del Estado nacional (apis.datos.gob.ar/georef), filtrado a la
// localidad censal Santa Fe (82063170). Georef lo arma sobre el callejero del
// INDEC; es el mismo que después ubica la dirección en js/app/mapa.js, así
// que lo que se sugiere es lo que Georef sabe encontrar.
//
// Para qué: las sugerencias del buscador de dirección. Se filtran en el
// teléfono contra esta lista, no se le pregunta a nadie mientras la persona
// escribe. Dos motivos:
//   1. /legal dice que la búsqueda consulta afuera «sólo cuando vos la
//      iniciás». Un autocompletado contra la API mandaría cada letra de la
//      dirección de alguien a un servidor ajeno antes de que apriete Buscar.
//   2. La política de uso de Nominatim prohíbe autocompletar contra su API, y
//      Georef tardó hasta 3 s por consulta en la medición: a ese ritmo, una
//      sugerencia por tecla llega tarde.
//
// Cada calle va con el rango de numeración que Georef conoce, para avisar
// antes de buscar si el número no existe en esa calle. Hay calles con rango
// 0–0: Georef no tiene la numeración. Ahí va null y la app no opina.
//
// Los nombres van tal cual los da Georef —mayúsculas, sin tildes, con el
// prefijo BV/AV/PJE—, así el archivo se puede comparar contra la fuente. La
// app los pasa a minúsculas al mostrarlos.
//
// Sin dependencias, como el resto del proyecto.

import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "datos-abiertos", "calles.json");
const LOCALIDAD = "82063170"; // Santa Fe, departamento La Capital

const url =
  "https://apis.datos.gob.ar/georef/api/calles?" +
  new URLSearchParams({
    provincia: "Santa Fe",
    localidad_censal: LOCALIDAD,
    max: "5000",
    campos: "id,nombre,categoria,altura,localidad_censal.id",
  });

const r = await fetch(url, { headers: { Accept: "application/json" } });
if (!r.ok) throw new Error("Georef contestó " + r.status);
const j = await r.json();
if (!Array.isArray(j.calles)) throw new Error("Georef no devolvió calles");
if (j.total > j.calles.length)
  throw new Error(
    `Georef tiene ${j.total} calles y devolvió ${j.calles.length}: hay que paginar`,
  );

// Un mismo nombre puede venir en varios tramos (ids distintos). Se juntan:
// para sugerir importa el nombre, y el rango es la unión de los tramos.
const porNombre = new Map();
let ajenas = 0;
for (const c of j.calles) {
  // El filtro por localidad de Georef es por texto y deja pasar alguna de
  // «San Francisco de Santa Fe». Se vuelve a filtrar por id.
  if (!c.localidad_censal || c.localidad_censal.id !== LOCALIDAD) {
    ajenas++;
    continue;
  }
  // «PJE S N 141,30»: pasajes sin nombre que nadie escribe en un buscador.
  if (/\bS N\b/.test(c.nombre)) continue;
  // Georef trae «PEZU?A DE VACA»: la Ñ se le pierde en la codificación.
  const nombre = c.nombre.replace(/\?/g, "Ñ");
  const a = c.altura || {};
  const ini = a.inicio || {},
    fin = a.fin || {};
  const desde = Math.min(ini.derecha ?? Infinity, ini.izquierda ?? Infinity);
  const hasta = Math.max(fin.derecha ?? 0, fin.izquierda ?? 0);
  const previa = porNombre.get(nombre);
  if (!previa) porNombre.set(nombre, { desde, hasta });
  else {
    previa.desde = Math.min(previa.desde, desde);
    previa.hasta = Math.max(previa.hasta, hasta);
  }
}

const calles = [...porNombre.entries()]
  .sort((x, y) => x[0].localeCompare(y[0], "es"))
  .map(([nombre, { desde, hasta }]) =>
    hasta > 0
      ? [nombre, isFinite(desde) ? desde : 0, hasta]
      : [nombre, null, null],
  );

const salida = {
  fuente:
    "Georef, API de direcciones del Estado nacional — https://apis.datos.gob.ar/georef/api/calles",
  localidad: "Santa Fe (localidad censal " + LOCALIDAD + ")",
  generado: new Date().toISOString().slice(0, 10),
  formato:
    "[nombre, desde, hasta]; desde/hasta null si Georef no tiene la numeración",
  calles,
};

const texto = JSON.stringify(salida);
await writeFile(SALIDA, texto);

const sinRango = calles.filter((c) => c[2] == null).length;
console.log(
  "tramos de Georef : " +
    j.calles.length +
    " (" +
    ajenas +
    " de otra localidad, descartados)",
);
console.log("calles           : " + calles.length);
console.log("sin numeración   : " + sinRango);
console.log(
  "tamaño           : " + (Buffer.byteLength(texto) / 1024).toFixed(0) + " KB",
);
console.log("escrito en       : datos-abiertos/calles.json");
