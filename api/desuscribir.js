// api/desuscribir.js — saca un endpoint de la lista.

import { redis, CLAVE_SUBS, endpointValido, hayAlmacen } from "./_push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Usá POST" });
  if (!hayAlmacen()) return res.status(503).json({ error: "Avisos no configurados" });

  const endpoint = req.body && req.body.endpoint;
  if (!endpointValido(endpoint))
    return res.status(400).json({ error: "Endpoint inválido" });

  try {
    await redis("SREM", CLAVE_SUBS, endpoint);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
