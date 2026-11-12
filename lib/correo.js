// lib/correo.js — avisa por correo que llegó una sugerencia.
//
// Las sugerencias se guardan en Redis y se leen en el tablero, pero nadie
// mira un tablero todos los días: sin esto, un aviso de «este punto de
// encuentro cerró» podía esperar semanas. Lo manda Brevo (brevo.com), por su
// API HTTP y sin librería, como el resto del proyecto.
//
// Tres decisiones:
//  - Es un AVISO, no el almacén. La sugerencia ya está guardada cuando esto
//    corre: si Brevo no contesta, la persona igual ve «Gracias, llegó», y es
//    cierto. Por eso nunca lanza: devuelve "ok", "apagado" o "error".
//  - Sale del servidor, no del navegador: la IP de la persona no llega a
//    Brevo y la CSP no cambia. El texto y el correo que dejó sí pasan por
//    ahí, y /legal lo dice.
//  - Sin las dos variables no hace nada. `AVISO_CORREO` es la casilla que
//    recibe; no va escrita en el repo.
//
// Brevo exige que el remitente esté registrado y verificado en la cuenta
// (account.brevo.com/senders). Por defecto es la misma casilla que recibe:
// uno se escribe a sí mismo. `CORREO_REMITENTE` lo cambia, para cuando haya
// una casilla del dominio.

import { CATEGORIAS } from "./sugerencias.js";

const ESPERA_MS = 4000;

export const hayCorreo = () =>
  Boolean(process.env.BREVO_API_KEY && process.env.AVISO_CORREO);

export async function avisarSugerencia({ categoria, texto, contacto, fecha }) {
  if (!hayCorreo()) return "apagado";
  const nombre = CATEGORIAS[categoria] || categoria;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MS);
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: corte.signal,
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Cota Cero",
          email: process.env.CORREO_REMITENTE || process.env.AVISO_CORREO,
        },
        to: [{ email: process.env.AVISO_CORREO }],
        subject: "Cota Cero · sugerencia: " + nombre,
        // Texto plano: lo que escribió la persona no se interpreta como HTML.
        textContent:
          texto +
          "\n\n—\nCategoría: " +
          nombre +
          "\nCorreo: " +
          (contacto || "no dejó") +
          "\nFecha: " +
          fecha,
        // «Responder» le escribe a la persona, no a uno mismo.
        ...(contacto ? { replyTo: { email: contacto } } : {}),
      }),
    });
    /* Que quede en los registros de Vercel por qué no salió: remitente sin
       verificar, clave mala. Sin esto el fallo era mudo. No se registra el
       texto de la persona, sólo lo que contestó Brevo. */
    if (!r.ok)
      console.error(
        "Brevo no aceptó el aviso:",
        r.status,
        await r.text().catch(() => ""),
      );
    return r.ok ? "ok" : "error";
  } catch (e) {
    return "error";
  } finally {
    clearTimeout(reloj);
  }
}
