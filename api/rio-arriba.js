// api/rio-arriba.js — Vercel Serverless Function
// Lo que midió el INA hoy en las escalas del Paraná aguas arriba del Puerto.
// Aparte de /api/nivel a propósito: son cuatro pedidos más al INA, y los cinco
// consumidores de nivel no tienen por qué pagarlos.

import { leerRioArriba } from "../lib/ina.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  try {
    const datos = await leerRioArriba();
    return res
      .status(200)
      .json({ ...datos, consultado: new Date().toISOString() });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: e.message });
  }
}
