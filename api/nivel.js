// api/nivel.js — Vercel Serverless Function
// Lee el reporte diario del INA y devuelve el nivel de Santa Fe como JSON.
// El navegador no puede pedirlo directo porque el INA no habilita CORS.

const FUENTE = "https://alerta.ina.gob.ar/a5/diario/reporte_diario";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Vercel cachea en su CDN 1 hora y sirve el viejo mientras revalida.
  // El INA actualiza una vez por día: no tiene sentido golpearlo más.
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  try {
    const r = await fetch(FUENTE, {
      headers: {
        "User-Agent": "CotaCero/1.0 (herramienta ciudadana Santa Fe)",
      },
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

    const mDif = bloque.match(/registro anterior:\s*(-?[\d.]+)\s*m/);
    const mFecha = html.match(
      /Fecha de actualización:\s*<strong>([\d/]+)<\/strong>/,
    );

    return res.status(200).json({
      altura,
      delta: mDif ? parseFloat(mDif[1]) : null,
      fecha_dato: mNivel[1] + " " + mNivel[2],
      fecha_reporte: mFecha ? mFecha[1] : null,
      estacion: "Santa Fe",
      rio: "Paraná",
      alerta: 5.3,
      evacuacion: 5.7,
      fuente: "INA — Alerta Hidrológico Cuenca del Plata",
      url: FUENTE,
      consultado: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
