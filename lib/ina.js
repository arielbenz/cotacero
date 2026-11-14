// lib/ina.js — el nivel del río: la serie del INA y la última de Prefectura.
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
// Y ENCIMA, LA ÚLTIMA LECTURA DE PREFECTURA (noviembre de 2026)
//
//   La regla la lee Prefectura; el INA copia una lectura por día y la carga
//   a media mañana (entre las 10:30 y las 16:30, y algún domingo recién el
//   lunes). La tabla de Prefectura trae la última: cada 12 horas, y cada 2
//   con el río arriba de la alerta. Si es más nueva que la del INA, es la
//   que se sirve como nivel de ahora. Los umbrales, la serie y todo lo demás
//   siguen saliendo del INA. Ver «desdePrefectura», más abajo.
//
// El campo `origen` dice cuál contestó («prefectura», «api» o «reporte»). /api/nivel lo devuelve al
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

import { ESTACION, ENDPOINTS, RIO_ARRIBA } from "../public/lib/fuentes.js";

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
  // Una ventana de treinta días: alcanza para que un fin de semana largo sin
  // publicación no deje la respuesta vacía y para dibujar el último mes (la
  // placa de /placa), y es corta como para que la respuesta pese poco. La
  // serie completa son 10 MB; esto son unos 10 KB.
  const hasta = new Date(Date.now() + 2 * 864e5);
  const desde = new Date(Date.now() - 30 * 864e5);
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
    // El último mes, un renglón por lectura: [«AAAA-MM-DD», metros]. Sólo la
    // trae la API; el reporte diario no tiene historia, y quien la use tiene
    // que aguantar que falte.
    serie: obs.map((o) => [
      iso(new Date(new Date(o.timestart).getTime() - ARG_MS)),
      o.valor,
    ]),
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

/* ---------- La última lectura: la tabla de Prefectura ----------
   Es HTML raspado, como el reporte diario, así que desconfía de todo: la
   fila tiene que ser la de Santa Fe (el rótulo exacto —«SAN JAVIER (SANTA
   FE)» es otra— Y el id 240 del enlace al histórico), el río tiene que ser
   el Paraná y la fecha tiene que poder leerse. Si algo no cierra, tira un
   error y se sirve lo del INA, que es lo que había antes.

   Que es la misma medición se comprobó el 14/11/2026 contra el histórico de
   Prefectura: en 32 de 35 días la lectura del INA es la de las 00:00 de
   Prefectura al centímetro; desde que el río pasó la alerta y Prefectura
   lee cada 2 horas, el INA guarda la de las 04:00 a las 08:00 con el mismo
   sello de las 00:00. Está en AUDITORIA.md. */
const MESES_PNA = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

const dos = (n) => String(n).padStart(2, "0");

/* Pura, para que scripts/comprobar.js la pruebe con una fila guardada. */
export function filaPrefectura(html) {
  const i = html.indexOf(">SANTA FE</th>");
  if (i === -1) throw new Error("No se encontró la fila de Santa Fe");
  const fin = html.indexOf("</tr>", i);
  if (fin === -1) throw new Error("La fila de Santa Fe no cierra");
  const fila = html.slice(i, fin);
  if (!new RegExp("[?&]id=" + ESTACION.idExterno + "(?!\\d)").test(fila))
    throw new Error("La fila de Santa Fe ya no es la estación " + ESTACION.idExterno);
  const celda = (rotulo) => {
    const m = fila.match(
      new RegExp('data-label="' + rotulo + '"[^>]*>\\s*(?:<b>)?\\s*([^<]*)'),
    );
    return m ? m[1].trim() : "";
  };
  if (celda("Río:") !== "PARANA")
    throw new Error("La fila de Santa Fe no es del Paraná");
  const crudo = celda("Ultimo Registro:");
  if (!/^-?\d+(\.\d+)?$/.test(crudo))
    throw new Error("No se pudo leer el registro: " + crudo);
  const altura = parseFloat(crudo);
  if (!plausible(altura)) throw new Error("Nivel fuera de rango: " + altura);
  // «14/NOV/26 - 1000»: día, mes en letras, año de dos cifras, hora pegada.
  const f = celda("Fecha Hora:").match(
    /^(\d{1,2})\/([A-Z]{3})\/(\d{2})\s*-\s*(\d{2})(\d{2})$/,
  );
  const mes = f && MESES_PNA[f[2]];
  if (!f || !mes || +f[1] > 31 || +f[4] > 23 || +f[5] > 59)
    throw new Error("No se pudo leer la fecha: " + celda("Fecha Hora:"));
  const anio = 2000 + +f[3];
  return {
    altura,
    fecha_dato: `${dos(+f[1])}/${dos(mes)}/${anio} ${f[4]}:${f[5]}`,
    dia: `${anio}-${dos(mes)}-${dos(+f[1])}`,
    // La hora de la tabla es la de Argentina.
    t: Date.UTC(anio, mes - 1, +f[1], +f[4], +f[5]) + ARG_MS,
  };
}

async function desdePrefectura() {
  const r = await fetch(ENDPOINTS.prefectura, {
    headers: { ...CABECERAS, Accept: "text/html" },
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!r.ok) throw new Error("La tabla de Prefectura respondió " + r.status);
  return filaPrefectura(await r.text());
}

/* "DD/MM/AAAA HH:MM" de Argentina a milisegundos. */
function msDe(fecha) {
  const m = String(fecha || "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  if (!m) return NaN;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) + ARG_MS;
}

/* Entre la lectura del INA y la de Prefectura pasa a lo sumo un día y
   medio, y el río nunca se movió un metro en ese tiempo: una diferencia así
   es que se leyó otra columna u otra fila. Sólo se mira con el INA al día;
   si lleva una semana sin publicar, la diferencia puede ser de verdad. */
const SALTO_MAX = 1;
const INA_AL_DIA_MS = 4 * 864e5;

/* Pura: recibe lo que dio el INA y la fila de Prefectura, y devuelve lo que
   se sirve. `ahora` entra por parámetro para poder probarla. */
export function conPrefectura(ina, pna, ahora = Date.now()) {
  if (pna.t > ahora + 3600e3)
    throw new Error("La lectura de Prefectura tiene fecha futura: " + pna.fecha_dato);
  const tIna = msDe(ina.fecha_dato);
  // El INA al día o más nuevo: no hay nada que ganar.
  if (isFinite(tIna) && pna.t <= tIna) return ina;
  if (
    isFinite(tIna) &&
    pna.t - tIna < INA_AL_DIA_MS &&
    Math.abs(pna.altura - ina.altura) > SALTO_MAX
  )
    throw new Error(
      `Prefectura dice ${pna.altura} m y el INA ${ina.altura} m: demasiada diferencia`,
    );

  /* El movimiento se sigue contando contra la lectura diaria anterior, la
     del INA de un día previo. Contra el registro anterior de Prefectura
     serían 2 horas: con el río subiendo 12 cm por día daría «estable». */
  let previa = null;
  if (Array.isArray(ina.serie)) {
    for (const par of ina.serie) if (par[0] < pna.dia) previa = par;
  } else if (isFinite(tIna)) {
    const diaIna = iso(new Date(tIna - ARG_MS));
    if (diaIna < pna.dia) previa = [diaIna, ina.altura];
  }

  /* La serie del mes termina en la lectura que se muestra: si no, el
     gráfico de /comparar y la placa cerrarían en el número de ayer al lado
     del de hoy. Es sólo la punta; el resto es del INA, sin tocar. */
  let serie = ina.serie;
  if (Array.isArray(serie)) {
    serie = serie.filter((par) => par[0] < pna.dia);
    serie.push([pna.dia, pna.altura]);
  }

  return {
    ...ina,
    altura: pna.altura,
    delta: previa ? Math.round((pna.altura - previa[1]) * 100) / 100 : null,
    delta_desde: previa ? previa[0] : null,
    fecha_dato: pna.fecha_dato,
    ...(serie ? { serie } : {}),
    origen: "prefectura",
    fuente: "Prefectura Naval Argentina — Registro del estado de los ríos",
    fuente_corta: "Prefectura",
    url: ENDPOINTS.prefectura,
    verificar: ENDPOINTS.prefectura,
    // Lo que decía el INA, para poder comparar los dos sin otro pedido.
    ina: { altura: ina.altura, fecha_dato: ina.fecha_dato, origen: ina.origen },
  };
}

/* Sólo Prefectura, cuando el INA no contesta por ninguna de sus dos vías.
   Sin serie, sin movimiento y con los umbrales de respaldo. */
function soloPrefectura(pna, motivo) {
  return {
    altura: pna.altura,
    delta: null,
    fecha_dato: pna.fecha_dato,
    fecha_reporte: null,
    estacion: ESTACION.nombre,
    rio: ESTACION.rio,
    alerta: ESTACION.alerta,
    evacuacion: ESTACION.evacuacion,
    aguas_bajas: null,
    cero_ign: null,
    serie_id: ESTACION.serieId,
    estacion_id: ESTACION.estacionId,
    origen: "prefectura",
    fuente: "Prefectura Naval Argentina — Registro del estado de los ríos",
    fuente_corta: "Prefectura",
    url: ENDPOINTS.prefectura,
    verificar: ENDPOINTS.prefectura,
    degradado: "INA no disponible: " + motivo,
  };
}

/* El INA: la API primero; el raspado sólo si falla. Cuando hay que usar el
   respaldo la respuesta lo dice en `degradado`, así el problema se ve en el
   JSON en lugar de quedar tapado por un valor que igual llega. */
async function desdeINA() {
  try {
    return await desdeAPI();
  } catch (eApi) {
    const dato = await desdeReporte();
    dato.degradado = "API no disponible: " + eApi.message;
    return dato;
  }
}

/* Se llama «INA» por los tres que la importan; desde noviembre de 2026
   devuelve además la última de Prefectura cuando es más nueva. Los dos
   pedidos salen a la vez. Si Prefectura falla o no convence, queda lo del
   INA y el motivo va en `sin_prefectura`. */
export async function leerNivelINA() {
  const [ina, pna] = await Promise.allSettled([desdeINA(), desdePrefectura()]);
  if (ina.status === "rejected") {
    if (pna.status === "rejected") throw ina.reason;
    return soloPrefectura(pna.value, ina.reason.message);
  }
  const dato = { ...ina.value, fuente_corta: "INA" };
  if (pna.status === "rejected") {
    dato.sin_prefectura = pna.reason.message;
    return dato;
  }
  try {
    return conPrefectura(dato, pna.value);
  } catch (e) {
    dato.sin_prefectura = e.message;
    return dato;
  }
}

/* ---------- Río arriba ----------
   Lo que midió el INA, hoy, en las escalas del Paraná que están aguas arriba
   del Puerto. Es OBSERVACIÓN, no pronóstico: el INA no publica por su API
   abierta un pronóstico vigente para Santa Fe (la última corrida guardada de
   `tabprono_central` es de junio de 2024, comprobado el 26/10/2026), y esto
   no dice cuándo llegará nada. Una estación que no contesta, o que ya no es
   la que creemos, se omite sin tumbar a las demás. */
async function unaRioArriba(e) {
  const hasta = new Date(Date.now() + 2 * 864e5);
  const desde = new Date(Date.now() - 9 * 864e5);
  const r = await fetch(
    `${ENDPOINTS.api}/${e.serieId}?timestart=${iso(desde)}&timeend=${iso(hasta)}`,
    { headers: CABECERAS, signal: AbortSignal.timeout(ESPERA_MS) },
  );
  if (!r.ok) throw new Error("La serie " + e.serieId + " respondió " + r.status);
  const j = await r.json();
  const est = j.estacion || {};
  if (est.id != null && est.id !== e.estacionId)
    throw new Error("La serie " + e.serieId + " ya no es " + e.nombre);
  if (j.unidades && j.unidades.abrev && j.unidades.abrev !== "m")
    throw new Error("La serie " + e.serieId + " dejó de estar en metros");
  const obs = (j.observaciones || [])
    .filter((o) => plausible(o.valor))
    .sort((a, b) => new Date(a.timestart) - new Date(b.timestart));
  if (!obs.length) throw new Error("Sin lecturas en la serie " + e.serieId);
  const ultima = obs[obs.length - 1];
  const tUltima = new Date(ultima.timestart).getTime();
  // La lectura más cercana a una semana atrás, pero sólo si está a 5 días o
  // más: con menos, «en la semana» sería una mentira.
  let previa = null;
  for (const o of obs) {
    const dias = (tUltima - new Date(o.timestart).getTime()) / 864e5;
    if (dias >= 5 && (!previa || Math.abs(dias - 7) < Math.abs(previa.dias - 7)))
      previa = { dias: Math.round(dias), valor: o.valor };
  }
  return {
    nombre: e.nombre,
    serie_id: e.serieId,
    altura: ultima.valor,
    fecha_dato: fechaArgentina(ultima.timestart),
    cambio: previa
      ? {
          dias: previa.dias,
          m: Math.round((ultima.valor - previa.valor) * 100) / 100,
        }
      : null,
    alerta: typeof est.nivel_alerta === "number" ? est.nivel_alerta : null,
    evacuacion:
      typeof est.nivel_evacuacion === "number" ? est.nivel_evacuacion : null,
  };
}

export async function leerRioArriba() {
  const r = await Promise.allSettled(RIO_ARRIBA.map(unaRioArriba));
  const estaciones = r.filter((x) => x.status === "fulfilled").map((x) => x.value);
  if (!estaciones.length) throw new Error("Ninguna estación río arriba contestó");
  return { estaciones, origen: "api", url: ENDPOINTS.reporte };
}
