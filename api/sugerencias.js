// api/sugerencias.js — recibe sugerencias y reportes de error de la gente.
//
// NO es un canal de emergencia y el formulario lo dice antes que nada: si
// alguien pide ayuda acá, nadie lo lee en el momento.
//
// No guardamos la IP. Se usa sólo para limitar envíos, y hasheada: alcanza
// para contar sin quedarnos con de dónde vino cada mensaje.

import crypto from "node:crypto";
import {
  esCategoria,
  MAX_TEXTO,
  MAX_CONTACTO,
  POR_HORA,
} from "../lib/sugerencias.js";
import { redis, hayAlmacen } from "../lib/push.js";
import { CLAVE_SUGERENCIAS as CLAVE } from "../lib/metricas.js";

const MAX_GUARDADAS = 500; // la lista no crece para siempre
/* Los topes y las categorías salen de lib/sugerencias.js: los comparten este
   endpoint, el tablero y los dos formularios. */

function claveLimite(req) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "sin-ip";
  // Hasheada con el CRON_SECRET de sal: sirve para contar, no para rastrear.
  const h = crypto
    .createHash("sha256")
    .update(ip + "|" + (process.env.CRON_SECRET || ""))
    .digest("hex")
    .slice(0, 16);
  return "cc:rl:" + h;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Usá POST" });
  if (!hayAlmacen())
    return res
      .status(503)
      .json({ error: "Las sugerencias no están configuradas todavía." });

  const cuerpo = req.body || {};
  const categoria = esCategoria(cuerpo.categoria) ? cuerpo.categoria : "otro";
  const texto = String(cuerpo.texto || "").trim();
  const contacto = String(cuerpo.contacto || "").trim();

  if (texto.length < 10)
    return res
      .status(400)
      .json({ error: "Contanos un poco más: al menos 10 caracteres." });
  if (texto.length > MAX_TEXTO)
    return res
      .status(400)
      .json({ error: "Quedó muy largo. Máximo " + MAX_TEXTO + " caracteres." });
  if (contacto.length > MAX_CONTACTO)
    return res.status(400).json({ error: "El contacto es demasiado largo." });

  try {
    const clave = claveLimite(req);
    const cuantas = await redis("INCR", clave);
    if (Number(cuantas) === 1) await redis("EXPIRE", clave, 3600);
    if (Number(cuantas) > POR_HORA)
      return res.status(429).json({
        error: "Ya mandaste varias seguidas. Probá de nuevo en un rato.",
      });

    await redis(
      "LPUSH",
      CLAVE,
      JSON.stringify({
        fecha: new Date().toISOString(),
        categoria,
        texto,
        contacto: contacto || null,
      }),
    );
    await redis("LTRIM", CLAVE, 0, MAX_GUARDADAS - 1);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(502)
      .json({ error: "No se pudo guardar. Probá más tarde." });
  }
}
