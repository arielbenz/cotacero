// api/probar-aviso.js — manda un push de prueba y cuenta qué pasó.
//
// El cron sólo devuelve "enviados: 1", que confunde: significa que el
// servicio de push aceptó el pedido, NO que el teléfono lo mostró. Entre esas
// dos cosas hay varios lugares donde se puede perder. Esto expone el código y
// el cuerpo exactos que contestaron Apple o Google.
//
// Va con la misma clave que el tablero: manda avisos a todo el mundo, así que
// no puede quedar abierto. Y sólo por POST, para que no lo dispare el
// prefetch de un navegador.

import {
  redis,
  hayAlmacen,
  CLAVE_SUBS,
  enviarPushDetalle,
} from "../lib/push.js";
import { claveCorrecta } from "../lib/metricas.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const q = req.query || {};
  const dada = q.clave || req.headers["x-clave"] || "";
  if (!claveCorrecta(dada)) return res.status(404).json({ error: "No existe" });
  if (req.method !== "POST") return res.status(405).json({ error: "Usá POST" });
  if (!hayAlmacen())
    return res.status(503).json({ error: "Avisos no configurados" });

  // En iPhone, un push de urgencia "normal" lo puede demorar u omitir el
  // sistema para ahorrar batería. Para una prueba eso es ruido: por defecto
  // va en "high", que es lo mismo que usa un aviso de cruce de umbral.
  const urgencia = q.urgencia === "normal" ? "normal" : "high";

  // Sin VAPID_SUBJECT el JWT sale con un mailto de relleno y algunos
  // servicios lo rechazan. Vale la pena decirlo antes que el resultado.
  const sujeto = process.env.VAPID_SUBJECT || null;

  try {
    const endpoints = (await redis("SMEMBERS", CLAVE_SUBS)) || [];
    const detalles = await Promise.all(
      endpoints.map(async (e) => {
        const r = await enviarPushDetalle(e, urgencia);
        let host = "?";
        try {
          host = new URL(e).host;
        } catch {
          /* endpoint ilegible: ya lo marca enviarPushDetalle */
        }
        // El endpoint completo es una credencial: identifica al dispositivo y
        // sirve para mandarle avisos. Se muestran los últimos 8 caracteres,
        // suficiente para distinguir dos teléfonos.
        return { host, id: String(e).slice(-8), ...r };
      }),
    );

    // Las muertas se limpian, igual que en el cron.
    const aBorrar = endpoints.filter((_, i) => detalles[i].estado === "muerta");
    if (aBorrar.length) await redis("SREM", CLAVE_SUBS, ...aBorrar);

    return res.status(200).json({
      urgencia,
      vapid_subject: sujeto || "SIN CONFIGURAR (se usa un mailto de relleno)",
      suscriptos: endpoints.length,
      aceptados: detalles.filter((d) => d.estado === "ok").length,
      dados_de_baja: aBorrar.length,
      detalles,
      nota: "«aceptado» = el servicio de push tomó el pedido. Que el teléfono lo muestre depende del sistema operativo.",
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
