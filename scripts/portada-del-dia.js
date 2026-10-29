// scripts/portada-del-dia.js — escribe la lectura del día en la portada.
//
//   node scripts/portada-del-dia.js
//
// Lo corre Vercel como `buildCommand` en cada deploy, y un deploy hook lo
// dispara dos veces por día (.github/workflows/portada-del-dia.yml). Toca
// sólo public/index.html, y sólo en la copia del build: en el repo la portada
// queda sin número, con la descripción de lib/paginas.js.
//
// Por qué: en «altura del río en santa fe hoy» los resultados de arriba
// muestran el número y la portada no mostraba ninguno. La portada sigue
// siendo un archivo estático —servirla desde una función se descartó: una
// caída de la función tiraba la portada—; lo que cambia una vez por día es el
// archivo. El INA publica una sola lectura por día, así que alcanza.
//
// Escribe dos cosas: la meta description (descripcionDelDia en
// lib/paginas.js) y el número grande del mockup con la fecha, que
// js/landing.js reemplaza en cuanto llega el dato en vivo. Así quien no
// corre JavaScript —un buscador— ve el número del día y no «—».
//
// Si el INA no contesta, o el dato tiene más de VENCE_HORAS, sale sin tocar
// nada y el deploy sigue: la portada sin número es la de siempre. Si el HTML
// cambió y no encuentra dónde escribir, falla, porque eso no se arregla solo.
//
// Corrido a mano deja public/index.html modificado: `git checkout` antes de
// commitear. Si se olvida, `node scripts/paginas.js` falla al comparar la
// descripción con lib/paginas.js.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerNivelINA } from "../lib/ina.js";
import { PAGINAS, descripcionDelDia } from "../lib/paginas.js";
import {
  UMBRALES_RESPALDO,
  VENCE_HORAS,
  nm,
  umbralesDe,
} from "../public/lib/comun.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORTADA = join(RAIZ, "public", "index.html");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* «28/10/2026 00:00», hora de Argentina, que no cambia en verano. */
function horasDesde(fechaDato) {
  const p = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(fechaDato || "");
  if (!p) return null;
  const t = Date.UTC(+p[3], +p[2] - 1, +p[1], +p[4] + 3, +p[5]);
  return (Date.now() - t) / 36e5;
}

/* Reemplaza exactamente una aparición; si no está, el HTML cambió. */
function cambiar(html, buscado, nuevo, que) {
  const veces = html.split(buscado).length - 1;
  if (veces !== 1)
    throw new Error(
      `index.html: «${que}» aparece ${veces} veces y tendría que ser una. ` +
        "Si cambió el marcado del hero, actualizá este script.",
    );
  return html.replace(buscado, nuevo);
}

let lectura;
try {
  lectura = await leerNivelINA();
} catch (e) {
  console.warn("portada del día: el INA no contestó, queda sin número —", e.message);
  process.exit(0);
}

const horas = horasDesde(lectura.fecha_dato);
if (horas === null || horas > VENCE_HORAS) {
  console.warn(
    `portada del día: el dato es del ${lectura.fecha_dato}, ` +
      `más viejo que ${VENCE_HORAS} h o sin fecha legible; queda sin número`,
  );
  process.exit(0);
}

const { alerta, evacuacion } = umbralesDe(lectura) || UMBRALES_RESPALDO;
const dia = lectura.fecha_dato.slice(0, 10);
const descripcion = descripcionDelDia({
  altura: lectura.altura,
  fecha: dia.slice(0, 5),
  alerta,
  evacuacion,
});

let html = await readFile(PORTADA, "utf8");
html = cambiar(
  html,
  `content="${PAGINAS.inicio.descripcion}"`,
  `content="${esc(descripcion)}"`,
  "la descripción de lib/paginas.js",
);
html = cambiar(
  html,
  `<span class="dato" id="nivel">—</span>`,
  `<span class="dato" id="nivel">${nm(lectura.altura, 2)}</span>`,
  "el número del mockup",
);
html = cambiar(
  html,
  `<p class="chico" id="nivel-pie">Buscando el último dato…</p>`,
  `<p class="chico" id="nivel-pie">Medición del INA del ${dia}</p>`,
  "el pie del número",
);
await writeFile(PORTADA, html);

console.log(
  `portada del día: ${nm(lectura.altura, 2)} m del ${lectura.fecha_dato} ` +
    `(${lectura.origen}${lectura.degradado ? ", degradado" : ""})\n  ${descripcion}`,
);
