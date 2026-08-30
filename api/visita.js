// api/visita.js — cuenta una apertura de la app. Nada más.
//
// Va en su propia función y no dentro de /api/nivel a propósito: nivel.js
// está cacheado una hora en el CDN de Vercel, así que la mayoría de las
// llamadas nunca llegan a ejecutarse. Contar ahí daría un número mucho más
// bajo que el real, y peor: más bajo justo los días de tráfico alto, que son
// los que importan.
//
// No se guarda la IP ni el identificador: entran a un HyperLogLog, que sólo
// sabe cuántos distintos vio. Ver lib/metricas.js.

import crypto from "node:crypto";
import { redis, hayAlmacen } from "../lib/push.js";
import { diaAR, claveDia, DIAS_QUE_VIVEN, idValido } from "../lib/metricas.js";

/* Sin esto, cualquiera puede inflar la cuenta mandando identificadores al
   azar en un bucle. La IP se hashea con sal, igual que en sugerencias.js:
   sirve para limitar, no para saber de dónde vino nadie. */
const POR_HORA = 30;

function claveLimite(req) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "sin-ip";
  const h = crypto
    .createHash("sha256")
    .update(ip + "|" + (process.env.CRON_SECRET || ""))
    .digest("hex")
    .slice(0, 16);
  return "cc:rlv:" + h;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Usá POST" });

  // Sin almacén no se cuenta, pero tampoco es un error que valga la pena
  // mostrarle a nadie: es telemetría, no una función de la app.
  if (!hayAlmacen()) return res.status(200).json({ ok: false });

  const id = (req.body && req.body.id) || "";
  if (!idValido(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const limite = claveLimite(req);
    const cuantas = Number(await redis("INCR", limite));
    if (cuantas === 1) await redis("EXPIRE", limite, 3600);
    if (cuantas > POR_HORA) return res.status(429).json({ ok: false });

    const clave = claveDia(diaAR());
    // PFADD devuelve 1 sólo si el conteo cambió: renovamos el vencimiento
    // únicamente cuando la clave se tocó de verdad.
    const nuevo = Number(await redis("PFADD", clave, id));
    if (nuevo === 1) await redis("EXPIRE", clave, DIAS_QUE_VIVEN * 86400);
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Que falle el contador no es asunto de quien está usando la app.
    return res.status(200).json({ ok: false });
  }
}
