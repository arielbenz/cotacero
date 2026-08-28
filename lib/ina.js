// lib/ina.js — lectura del reporte diario del INA.
// Lo comparten /api/nivel (que lo sirve al navegador) y el cron de avisos.
// Vive fuera de /api a propósito: ahí adentro cada archivo se publica como
// una función, y esto es un módulo, no un endpoint.

export const FUENTE = "https://alerta.ina.gob.ar/a5/diario/reporte_diario";

export async function leerNivelINA() {
  const r = await fetch(FUENTE, {
    headers: {
      "User-Agent": "CotaCero/1.0 (herramienta ciudadana Santa Fe)",
    },
    // Sin esto, un INA que acepta la conexión y no contesta cuelga la
    // función hasta el límite de la plataforma.
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("El INA respondió " + r.status);
  const html = await r.text();

  // Acotamos al bloque de la fila de Santa Fe para no leer Paraná ni Rosario,
  // que están pegadas arriba y abajo en la misma tabla.
  const i = html.indexOf(">Santa Fe<");
  if (i === -1) throw new Error("No se encontró la fila de Santa Fe");
  const bloque = html.slice(i, i + 1200);

  const mNivel = bloque.match(/fecha:\s*([\d/]+)\s*([\d:]+)\s*([\d,]+)\s*m/);
  if (!mNivel) throw new Error("No se pudo leer el nivel");

  const altura = parseFloat(mNivel[3].replace(",", "."));
  if (!isFinite(altura)) throw new Error("Nivel inválido");
  // Si el regex llegara a agarrar un número de otra columna, mejor fallar
  // que publicar cualquier cosa: el récord histórico es 7,43 m.
  if (altura < -1 || altura > 12)
    throw new Error("Nivel fuera de rango: " + altura);

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
    estacion: "Santa Fe",
    rio: "Paraná",
    alerta: 5.3,
    evacuacion: 5.7,
    fuente: "INA — Alerta Hidrológico Cuenca del Plata",
    url: FUENTE,
  };
}
