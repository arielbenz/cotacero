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

import crypto from "node:crypto";
import {
  redis,
  hayAlmacen,
  CLAVE_SUBS,
  enviarPushDetalle,
} from "../lib/push.js";
import { claveCorrecta } from "../lib/metricas.js";

/* Un par VAPID son dos mitades de la misma llave: la pública va en app.js y
   el teléfono se suscribe con ella; la privada firma en el servidor. Si no
   son del mismo par, o si la pública del servidor no es la de app.js, Apple
   rechaza con VapidPkHashMismatch y no hay aviso que llegue.
   Derivar la pública de la privada dice cuál de las dos está mal. */
function revisarVapid() {
  const publica = process.env.VAPID_PUBLIC_KEY || null;
  const privada = process.env.VAPID_PRIVATE_KEY || null;
  if (!publica || !privada)
    return { ok: false, motivo: "falta VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY" };
  try {
    const raw = Buffer.from(
      privada.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (raw.length !== 32)
      return { ok: false, motivo: "VAPID_PRIVATE_KEY no mide 32 bytes" };
    const der = Buffer.concat([
      Buffer.from(
        "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
        "hex",
      ),
      raw,
    ]);
    const priv = crypto.createPrivateKey({
      key: der,
      format: "der",
      type: "pkcs8",
    });
    const jwk = crypto.createPublicKey(priv).export({ format: "jwk" });
    const b64 = (v) => Buffer.from(v, "base64url");
    const derivada = Buffer.concat([
      Buffer.from([4]),
      b64(jwk.x),
      b64(jwk.y),
    ]).toString("base64url");
    return {
      ok: derivada === publica,
      publica_del_servidor: publica,
      publica_derivada_de_la_privada: derivada,
      motivo:
        derivada === publica
          ? "el par es coherente; comparar publica_del_servidor con CONFIG.VAPID_PUBLIC_KEY de app.js"
          : "la privada NO corresponde a la pública: son de pares distintos",
    };
  } catch (e) {
    return { ok: false, motivo: "no se pudo leer la privada: " + e.message };
  }
}

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
      vapid: revisarVapid(),
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
