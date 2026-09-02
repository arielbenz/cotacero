// lib/ina.js — el nivel del río, del INA.
// Lo comparten /api/nivel (que lo sirve al navegador) y el cron de avisos.
// Vive fuera de /api a propósito: ahí adentro cada archivo se publica como
// una función, y esto es un módulo, no un endpoint.
//
// DOS FUENTES, EN ESTE ORDEN
//
//   1. API REST del SIyAH (alerta.ina.gob.ar/a5)  ← preferida
//      JSON estructurado, sin clave. Es la misma API que consume el visor
//      del propio INA. Devuelve, además del número: la fecha exacta, el
//      nivel de alerta, el de evacuación y el cero IGN de la escala, o sea
//      que esos tres dejan de estar hardcodeados de nuestro lado.
//
//   2. Reporte diario en HTML (raspado)           ← respaldo
//      Lo que se usaba hasta ahora. Se queda como red: ya se rompió una vez
//      —cambiaron <strong> por <b>— y el modo de falla fue silencioso.
//
// El campo `origen` dice cuál de las dos contestó. /api/nivel lo devuelve al
// navegador, así que si la API se cae se ve en el JSON en vez de descubrirlo
// meses después.
//
// POR QUÉ NO USAMOS EL ENVOLTORIO DOCUMENTADO (alerta.ina.gob.ar/pub/datos)
// Es la ruta que documenta argentina.gob.ar, y sería la primera opción. No
// anda: `datosDia` rechaza `seriesId` pidiendo `series_id`, `datos` contesta
// "Argumento timeStart faltante" con timeStart puesto, `percentiles` devuelve
// un error de Perl, y /pub/ entero se cayó tres veces seguidas con timeout de
// 30 s mientras se escribía esto. La ruta /a5 es la que el INA usa en
// producción y la que responde. Vale la pena reintentar /pub/ más adelante.

import { ESTACION, ENDPOINTS } from "./fuentes.js";

export const FUENTE = ENDPOINTS.reporte;

const CABECERAS = {
  "User-Agent": "CotaCero/2.0 (herramienta ciudadana Santa Fe)",
  Accept: "application/json, text/html",
};

// Sin esto, un INA que acepta la conexión y no contesta cuelga la función
// hasta el límite de la plataforma.
const ESPERA_MS = 8000;

/* El récord de la serie del INA desde 1925 es 7,43 m y la bajante más honda
   −0,23. Si un cambio de formato nos hiciera leer un número de otra columna,
   preferimos fallar y mostrar el último dato guardado antes que publicar
   cualquier cosa como si fuera el nivel del río. */
const MIN_PLAUSIBLE = -2;
const MAX_PLAUSIBLE = 12;

function plausible(v) {
  return typeof v === "number" && isFinite(v) && v > MIN_PLAUSIBLE && v < MAX_PLAUSIBLE;
}

/* La app espera "DD/MM/AAAA HH:MM" —lo parsea `fechaINA()` y la portada le
   corta los diez primeros caracteres—, así que la API tiene que entregar el
   mismo formato que entregaba el raspado. Argentina no mueve el reloj en
   verano: el desfase fijo de 3 horas es correcto y no depende de que la
   plataforma traiga los datos de zonas horarias. */
const ARG_MS = 3 * 60 * 60 * 1000;
function fechaArgentina(iso) {
  const d = new Date(new Date(iso).getTime() - ARG_MS);
  if (isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return (
    p(d.getUTCDate()) +
    "/" +
    p(d.getUTCMonth() + 1) +
    "/" +
    d.getUTCFullYear() +
    " " +
    p(d.getUTCHours()) +
    ":" +
    p(d.getUTCMinutes())
  );
}

const iso = (d) => d.toISOString().slice(0, 10);

/* ---------- Fuente 1: la API del SIyAH ---------- */
async function desdeAPI() {
  // Una ventana de doce días: suficiente para que un fin de semana largo sin
  // publicación no deje la respuesta vacía, y corta como para que la
  // respuesta pese poco. La serie completa son 10 MB; esto son unos 2 KB.
  const hasta = new Date(Date.now() + 2 * 864e5);
  const desde = new Date(Date.now() - 12 * 864e5);
  const url =
    `${ENDPOINTS.api}/${ESTACION.serieId}` +
    `?timestart=${iso(desde)}&timeend=${iso(hasta)}`;

  const r = await fetch(url, {
    headers: CABECERAS,
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!r.ok) throw new Error("La API del INA respondió " + r.status);
  const j = await r.json();

  const obs = (j.observaciones || [])
    .filter((o) => plausible(o.valor))
    .sort((a, b) => new Date(a.timestart) - new Date(b.timestart));
  if (!obs.length) throw new Error("La API no devolvió observaciones válidas");

  const ultima = obs[obs.length - 1];
  const previa = obs[obs.length - 2];

  // Que la API conteste no garantiza que conteste lo que creemos: si algún
  // día la serie 30 pasara a ser otra cosa, mejor caer al reporte diario.
  const est = j.estacion || {};
  if (est.id != null && est.id !== ESTACION.estacionId)
    throw new Error("La serie " + ESTACION.serieId + " ya no es Santa Fe");
  const unidad = j.unidades && j.unidades.abrev;
  if (unidad && unidad !== "m")
    throw new Error("La serie dejó de estar en metros: " + unidad);

  return {
    altura: ultima.valor,
    // El salto contra la lectura anterior de la serie. El reporte diario
    // publica su propio delta; acá lo calculamos, que es lo mismo y además
    // sabemos contra qué fecha.
    delta: previa ? Math.round((ultima.valor - previa.valor) * 100) / 100 : null,
    fecha_dato: fechaArgentina(ultima.timestart),
    // En la API no existe "fecha del reporte": el dato tiene su propia hora
    // y no hay una publicación diaria que lo envuelva.
    fecha_reporte: null,
    estacion: est.nombre || ESTACION.nombre,
    rio: ESTACION.rio,
    // Los umbrales oficiales vienen de la estación, no de una constante
    // nuestra. Si el INA los corrige, la app se entera sola.
    alerta: typeof est.nivel_alerta === "number" ? est.nivel_alerta : ESTACION.alerta,
    evacuacion:
      typeof est.nivel_evacuacion === "number"
        ? est.nivel_evacuacion
        : ESTACION.evacuacion,
    aguas_bajas:
      typeof est.nivel_aguas_bajas === "number" ? est.nivel_aguas_bajas : null,
    /* El cero IGN que publica el INA para esta escala. NO es el que usa el
       cálculo de la app: ver AUDITORIA.md, "El cero del hidrómetro". Se
       expone para poder mostrarlo y compararlo, no para reemplazar nada. */
    cero_ign: typeof est.cero_ign === "number" ? est.cero_ign : null,
    serie_id: ESTACION.serieId,
    estacion_id: est.id ?? ESTACION.estacionId,
    origen: "api",
    fuente: "INA — Sistema de Información y Alerta Hidrológico (SIyAH)",
    url: ENDPOINTS.reporte,
    verificar: url,
  };
}

/* ---------- Fuente 2: el reporte diario en HTML ---------- */
async function desdeReporte() {
  const r = await fetch(ENDPOINTS.reporte, {
    headers: CABECERAS,
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!r.ok) throw new Error("El reporte del INA respondió " + r.status);
  const html = await r.text();

  // Acotamos al bloque de la fila de Santa Fe para no leer Paraná ni Rosario,
  // que están pegadas arriba y abajo en la misma tabla.
  const i = html.indexOf(">Santa Fe<");
  if (i === -1) throw new Error("No se encontró la fila de Santa Fe");
  const bloque = html.slice(i, i + 1200);

  const mNivel = bloque.match(/fecha:\s*([\d/]+)\s*([\d:]+)\s*([\d,]+)\s*m/);
  if (!mNivel) throw new Error("No se pudo leer el nivel");

  const altura = parseFloat(mNivel[3].replace(",", "."));
  if (!plausible(altura)) throw new Error("Nivel fuera de rango: " + altura);

  // El INA escribe con coma decimal ("0,05 m"). Un regex con punto no matchea
  // nada y el delta queda null: el único día que coincidía era con variación 0.
  const mDif = bloque.match(/registro anterior:\s*(-?[\d.,]+)\s*m/);
  const delta = mDif ? parseFloat(mDif[1].replace(",", ".")) : NaN;

  // El INA sirve esta fecha dentro de <b>, no de <strong>: el regex viejo no
  // matcheaba y fecha_reporte venía siempre null. Toleramos las dos.
  const mFecha = html.match(
    /Fecha de actualización:\s*<(b|strong)>([\d/]+)<\/\1>/,
  );

  return {
    altura,
    delta: isFinite(delta) ? delta : null,
    fecha_dato: mNivel[1] + " " + mNivel[2],
    fecha_reporte: mFecha ? mFecha[2] : null,
    estacion: ESTACION.nombre,
    rio: ESTACION.rio,
    alerta: ESTACION.alerta,
    evacuacion: ESTACION.evacuacion,
    aguas_bajas: null,
    cero_ign: null,
    serie_id: ESTACION.serieId,
    estacion_id: ESTACION.estacionId,
    origen: "reporte",
    fuente: "INA — Alerta Hidrológico Cuenca del Plata (reporte diario)",
    url: ENDPOINTS.reporte,
    verificar: ENDPOINTS.reporte,
  };
}

/* La API primero; el raspado sólo si falla. Cuando hay que usar el respaldo
   la respuesta lo dice en `degradado`, así el problema se ve en el JSON en
   lugar de quedar tapado por un valor que igual llega. */
export async function leerNivelINA() {
  try {
    return await desdeAPI();
  } catch (eApi) {
    const dato = await desdeReporte();
    dato.degradado = "API no disponible: " + eApi.message;
    return dato;
  }
}
