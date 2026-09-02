// scripts/historia.js — genera datos/historia.json desde la API del INA.
//
//   node scripts/historia.js
//
// De dónde sale: serie 30 del SIyAH, "Altura hidrométrica / medición directa"
// del hidrómetro del Puerto de Santa Fe. Son ~39.000 lecturas diarias desde
// el 2 de enero de 1925. Es la misma serie de la que sale el número que la
// app muestra todos los días, así que la historia y el presente no pueden
// contradecirse: salen del mismo lugar.
//
// La descarga completa son ~10 MB. Acá se resume a lo que la página de
// historia necesita —un renglón por año— y queda en unos 8 KB, que el service
// worker puede precachear sin pensarlo. El resumen se hace en el script y no
// en el navegador a propósito: procesar 39.000 registros en un teléfono el
// día de una crecida no es aceptable.
//
// NADA de esto sale de la prensa. Si un número no está en la serie del INA,
// no está en el archivo.
//
// Sin dependencias, como el resto del proyecto.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESTACION, ENDPOINTS } from "../lib/fuentes.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "datos", "historia.json");

const URL_SERIE = `${ENDPOINTS.api}/${ESTACION.serieId}`;
const URL_OBS = `${URL_SERIE}/observaciones?timestart=1900-01-01&timeend=2100-01-01`;

const CABECERAS = {
  "User-Agent": "CotaCero/2.0 (herramienta ciudadana Santa Fe)",
  Accept: "application/json",
};

/* Argentina no mueve el reloj en verano: restar tres horas fijas alcanza y no
   depende de que Node traiga los datos de zonas horarias. Sin esto, las
   lecturas de las 00:00 caen en el día anterior y los máximos aparecen
   fechados un día antes de lo que publica el INA. */
const ARG_MS = 3 * 60 * 60 * 1000;
const diaLocal = (t) =>
  new Date(new Date(t).getTime() - ARG_MS).toISOString().slice(0, 10);

const r2 = (v) => Math.round(v * 100) / 100;

console.log("Bajando la serie completa del INA…");
const rSerie = await fetch(URL_SERIE, { headers: CABECERAS });
if (!rSerie.ok) throw new Error("El INA respondió " + rSerie.status);
const serie = await rSerie.json();

// Que la serie siga siendo la que creemos. Si el INA renumera, mejor
// reventar acá que publicar la historia de otro río.
const est = serie.estacion || {};
if (est.id !== ESTACION.estacionId)
  throw new Error(`La serie ${ESTACION.serieId} ya no es la estación Santa Fe`);
if (serie.unidades?.abrev !== "m")
  throw new Error("La serie no está en metros: " + serie.unidades?.abrev);

const rObs = await fetch(URL_OBS, { headers: CABECERAS });
if (!rObs.ok) throw new Error("El INA respondió " + rObs.status);
const obs = await rObs.json();
console.log("observaciones crudas :", obs.length);

/* Un valor por día. Algunos años recientes traen varias lecturas diarias
   (2016 tiene 1.192 registros para 366 días): si no se colapsa, "cuántos días
   estuvo sobre la alerta" cuenta lecturas y no días, y 2016 daría el triple
   de lo que fue. Nos quedamos con el máximo del día, que es el criterio con
   el que se decide en una crecida. */
const porDia = new Map();
let descartadas = 0;
for (const o of obs) {
  if (typeof o.valor !== "number" || !isFinite(o.valor)) {
    descartadas++;
    continue;
  }
  const d = diaLocal(o.timestart);
  if (!porDia.has(d) || o.valor > porDia.get(d)) porDia.set(d, o.valor);
}
const dias = [...porDia.keys()].sort();
console.log("días con lectura     :", dias.length, "| descartadas:", descartadas);

const ALERTA = est.nivel_alerta ?? ESTACION.alerta;
const EVAC = est.nivel_evacuacion ?? ESTACION.evacuacion;

/* Un renglón por año: hasta dónde llegó, hasta dónde bajó, cuántos días
   estuvo sobre cada umbral oficial, y con cuántas lecturas se calculó todo
   eso — sin ese último número no se puede saber si un año flojo fue un año
   seco o un año con la libreta incompleta. */
const anios = new Map();
for (const d of dias) {
  const a = +d.slice(0, 4);
  const v = porDia.get(d);
  if (!anios.has(a))
    anios.set(a, { a, max: -Infinity, fmax: "", min: Infinity, fmin: "", n: 0, da: 0, de: 0 });
  const e = anios.get(a);
  e.n++;
  if (v > e.max) {
    e.max = v;
    e.fmax = d;
  }
  if (v < e.min) {
    e.min = v;
    e.fmin = d;
  }
  if (v >= ALERTA) e.da++;
  if (v >= EVAC) e.de++;
}

const filas = [...anios.values()]
  .sort((x, y) => x.a - y.a)
  .map((e) => [e.a, r2(e.max), e.fmax, r2(e.min), e.fmin, e.n, e.da, e.de]);

/* Huecos. Un año con menos de 300 días medidos no se puede comparar de igual
   a igual con uno completo, y la página lo tiene que poder decir. */
const incompletos = filas.filter((f) => f[5] < 300).map((f) => f[0]);

/* Distribución de la serie diaria, en 101 escalones. Sirve para una sola
   frase —"el río estuvo más bajo que hoy en el X % de los días medidos desde
   1925"— que es un hecho sobre la serie, no una categoría inventada. Guardar
   los escalones evita mandarle los 37.000 días al teléfono. */
const orden = [...porDia.values()].sort((a, b) => a - b);
const cuantiles = [];
for (let p = 0; p <= 100; p++)
  cuantiles.push(r2(orden[Math.min(orden.length - 1, Math.round((p / 100) * (orden.length - 1)))]));

const crecidas = [...filas].sort((a, b) => b[1] - a[1]).slice(0, 8);
const bajantes = [...filas].sort((a, b) => a[3] - b[3]).slice(0, 8);

const salida = {
  fuente:
    "Instituto Nacional del Agua — SIyAH, serie " +
    ESTACION.serieId +
    " (altura hidrométrica, medición directa), " +
    ESTACION.descripcion,
  url: URL_OBS,
  estacion: {
    nombre: est.nombre || ESTACION.nombre,
    id: ESTACION.estacionId,
    id_externo: ESTACION.idExterno,
    propietario: est.propietario || ESTACION.propietario,
    // Lo que el INA publica hoy como cero de esta escala. La app NO lo usa
    // para calcular: ver AUDITORIA.md.
    cero_ign_ina: est.cero_ign ?? null,
  },
  unidad: "metros sobre el cero del hidrómetro",
  alerta: ALERTA,
  evacuacion: EVAC,
  generado: new Date().toISOString().slice(0, 10),
  desde: dias[0],
  hasta: dias[dias.length - 1],
  dias: dias.length,
  // Antes de 1925 el INA no publica esta serie. La crecida de 1905 que se
  // cita seguido queda afuera: no la inventamos ni la traemos de un diario.
  incompletos,
  columnas: ["anio", "max", "fecha_max", "min", "fecha_min", "dias", "dias_alerta", "dias_evac"],
  anios: filas,
  cuantiles,
};

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, JSON.stringify(salida));

const kb = (JSON.stringify(salida).length / 1024).toFixed(1);
console.log("\nrango       :", salida.desde, "→", salida.hasta);
console.log("años        :", filas.length, "| incompletos:", incompletos.join(", ") || "ninguno");
console.log("\nmayores crecidas registradas");
for (const c of crecidas) console.log("  ", c[0], String(c[1]).padStart(5), c[2], "| días ≥ alerta:", c[6]);
console.log("\nbajantes más hondas");
for (const b of bajantes) console.log("  ", b[0], String(b[3]).padStart(5), b[4]);
console.log("\nmediana de la serie diaria:", cuantiles[50], "m");
console.log("tamaño      :", kb, "KB");
console.log("escrito en  : datos/historia.json");
