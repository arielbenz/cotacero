// scripts/vapid.js — genera el par de claves VAPID. Se corre UNA vez:
//   node scripts/vapid.js
// La pública va en app.js (CONFIG.VAPID_PUBLIC_KEY) y también como variable
// de entorno. La privada va SÓLO en variables de entorno de Vercel.

import crypto from "node:crypto";

const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-65);
const priv = privateKey.export({ type: "pkcs8", format: "der" }).subarray(36, 68);

console.log("Pegá esto en las variables de entorno de Vercel:\n");
console.log("VAPID_PUBLIC_KEY  =", b64url(pub));
console.log("VAPID_PRIVATE_KEY =", b64url(priv));
console.log("VAPID_SUBJECT     = mailto:tu@correo.com");
console.log("CRON_SECRET       =", b64url(crypto.randomBytes(24)));
console.log("\nY la pública también en app.js, en CONFIG.VAPID_PUBLIC_KEY.");
