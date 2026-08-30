// api/cron/avisar.js — lo dispara Vercel Cron.
//
// Lee el nivel del INA y decide si vale despertar a los teléfonos. No decide
// a QUIÉN avisarle —no puede, no sabe la cota de nadie— sino SI el río se
// movió lo suficiente como para que a alguien le importe. El filtro fino lo
// hace cada service worker contra el umbral guardado en su propio dispositivo.

import { leerNivelINA } from "../../lib/ina.js";
import {
  enviarPush,
  redis,
  hayAlmacen,
  CLAVE_SUBS,
  CLAVE_NIVEL,
  CLAVE_AVISADO,
} from "../../lib/push.js";

const ALERTA = 5.3;
const EVACUACION = 5.7;
// Cuánto tiene que subir desde el último aviso para volver a molestar.
// Con el río estable son un puñado de avisos por temporada; en crecida,
// uno por día, que es exactamente cuando corresponde.
const SUBIDA_MINIMA = 0.15;
const LOTE = 40;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Vercel manda el CRON_SECRET como Bearer. Sin esto, cualquiera dispara
  // avisos a todo el mundo.
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return res.status(503).json({ error: "Falta CRON_SECRET" });
  if (req.headers.authorization !== "Bearer " + esperado)
    return res.status(401).json({ error: "No autorizado" });
  if (!hayAlmacen())
    return res.status(503).json({ error: "Avisos no configurados" });

  try {
    const { altura, fecha_dato } = await leerNivelINA();
    const previo = parseFloat(await redis("GET", CLAVE_NIVEL));
    const avisado = parseFloat(await redis("GET", CLAVE_AVISADO));
    await redis("SET", CLAVE_NIVEL, String(altura));

    const cruzo = (u) => isFinite(previo) && previo < u && altura >= u;
    const oficial = cruzo(ALERTA) || cruzo(EVACUACION);
    // La referencia baja con el río: así una crecida nueva vuelve a disparar
    // aunque la anterior haya avisado más arriba.
    const base = isFinite(avisado) ? Math.min(avisado, altura) : altura;
    const subio = altura - base >= SUBIDA_MINIMA;

    if (!oficial && !subio) {
      if (base !== avisado) await redis("SET", CLAVE_AVISADO, String(base));
      return res
        .status(200)
        .json({ altura, previo, aviso: false, motivo: "sin movimiento" });
    }

    const endpoints = (await redis("SMEMBERS", CLAVE_SUBS)) || [];
    const urgencia = oficial ? "high" : "normal";
    let ok = 0,
      muertas = 0,
      errores = 0;

    for (let i = 0; i < endpoints.length; i += LOTE) {
      const tanda = endpoints.slice(i, i + LOTE);
      const rs = await Promise.all(tanda.map((e) => enviarPush(e, urgencia)));
      const aBorrar = [];
      rs.forEach((r, k) => {
        if (r === "ok") ok++;
        else if (r === "muerta") {
          muertas++;
          aBorrar.push(tanda[k]);
        } else errores++;
      });
      // Las suscripciones muertas se sacan o la lista se llena de basura.
      if (aBorrar.length) await redis("SREM", CLAVE_SUBS, ...aBorrar);
    }

    await redis("SET", CLAVE_AVISADO, String(altura));
    return res.status(200).json({
      altura,
      previo,
      fecha_dato,
      aviso: true,
      motivo: oficial ? "cruce de umbral oficial" : "subida",
      urgencia,
      enviados: ok,
      muertas,
      errores,
      total: endpoints.length,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
