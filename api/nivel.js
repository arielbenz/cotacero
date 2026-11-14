// api/nivel.js — Vercel Serverless Function
// Devuelve el nivel de Santa Fe como JSON. El navegador no puede pedirlo
// directo porque el INA no habilita CORS.

import { leerNivelINA } from "../lib/ina.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Vercel cachea en su CDN 10 minutos y sirve el viejo mientras revalida.
  // Era 1 hora, cuando la única fuente era la lectura diaria del INA; con
  // el río arriba de la alerta Prefectura lee cada 2 horas, y una hora de
  // caché era la mitad de ese intervalo. Son a lo sumo 6 pedidos por hora
  // a cada organismo, no importa cuánta gente entre.
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");

  try {
    const datos = await leerNivelINA();
    return res
      .status(200)
      .json({ ...datos, consultado: new Date().toISOString() });
  } catch (e) {
    // El Cache-Control de arriba se fija antes del try: sin pisarlo acá, una
    // falla pasajera del INA se quedaría cacheada en el CDN durante una hora.
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: e.message });
  }
}
