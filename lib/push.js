// lib/push.js — Web Push sin dependencias.
//
// Mandamos push SIN CONTENIDO. Es una decisión de privacidad, no una
// limitación: el servidor no sabe la cota de nadie ni a qué altura hay que
// avisarle. Sólo despierta al teléfono; el service worker consulta el nivel,
// lo compara contra el umbral que está guardado en el dispositivo, y arma ahí
// la notificación.
//
// Efecto secundario: un push sin contenido no se cifra (RFC 8291 sólo aplica
// al payload), así que alcanza con firmar un JWT ES256 para VAPID. Por eso
// este proyecto sigue sin package.json.
//
// De la suscripción guardamos únicamente el endpoint. Las claves p256dh y
// auth sólo sirven para cifrar contenido: acá no hacen falta y no se piden.

import crypto from "node:crypto";

const b64url = (b) =>
  Buffer.from(b)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/* La clave privada llega como 32 bytes en base64url. La envolvemos en un
   PKCS#8 mínimo para que node:crypto la acepte. */
function clavePrivadaPem(b64) {
  const raw = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (raw.length !== 32) throw new Error("VAPID_PRIVATE_KEY inválida");
  const der = Buffer.concat([
    Buffer.from(
      "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
      "hex",
    ),
    raw,
  ]);
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

const cacheJwt = new Map(); // un JWT por origen, reutilizable 12 h

function tokenVapid(origen) {
  const guardado = cacheJwt.get(origen);
  if (guardado && guardado.exp > Date.now() / 1000 + 300) return guardado.jwt;

  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const cab = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const cue = b64url(
    JSON.stringify({
      aud: origen,
      exp,
      sub: process.env.VAPID_SUBJECT || "mailto:info@example.com",
    }),
  );
  const firma = crypto.sign("sha256", Buffer.from(cab + "." + cue), {
    key: clavePrivadaPem(process.env.VAPID_PRIVATE_KEY),
    dsaEncoding: "ieee-p1363", // JWT pide r||s crudo, no DER
  });
  const jwt = cab + "." + cue + "." + b64url(firma);
  cacheJwt.set(origen, { jwt, exp });
  return jwt;
}

/* Devuelve "ok" | "muerta" | "error". "muerta" = el navegador se desinstaló o
   limpió datos: hay que sacarla de la lista o crece con basura para siempre. */
export async function enviarPush(endpoint, urgencia = "normal") {
  let origen;
  try {
    origen = new URL(endpoint).origin;
  } catch {
    return "muerta";
  }
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "43200",
        Urgency: urgencia,
        "Content-Length": "0",
        Authorization: `vapid t=${tokenVapid(origen)}, k=${process.env.VAPID_PUBLIC_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 404 || r.status === 410) return "muerta";
    return r.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

/* ---------- almacén (Upstash Redis por REST: fetch y nada más) ---------- */

const URL_KV = () =>
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_KV = () =>
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hayAlmacen = () => Boolean(URL_KV() && TOKEN_KV());

export async function redis(...comando) {
  if (!hayAlmacen())
    throw new Error("Falta configurar el almacén (KV_REST_API_URL / _TOKEN)");
  const r = await fetch(URL_KV(), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + TOKEN_KV(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comando.map(String)),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("Almacén respondió " + r.status);
  const j = await r.json();
  if (j.error) throw new Error("Almacén: " + j.error);
  return j.result;
}

export const CLAVE_SUBS = "cc:subs";
export const CLAVE_NIVEL = "cc:ultimo_nivel";
export const CLAVE_AVISADO = "cc:nivel_avisado";

/* Un endpoint de push es una URL larga y opaca del servicio del navegador.
   No lo aceptamos de cualquier lado. */
export function endpointValido(e) {
  if (typeof e !== "string" || e.length < 30 || e.length > 800) return false;
  try {
    const u = new URL(e);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
