/* js/app/sugerencias.js — el formulario de sugerencias.
   Es lo ÚNICO de la app que manda texto de la persona a un servidor, y el
   formulario lo dice. Abre con la negación —no es una vía para pedir ayuda—
   y los teléfonos de emergencia, porque en una app así cualquier caja de
   texto se puede leer como un pedido de auxilio. */

import { estado } from "./estado.js";
import { atr, m } from "./formato.js";
import { aLaVista, ocupar } from "./vista.js";

/* ================= SUGERENCIAS =================
   Lo único de la app que manda texto de la persona a un servidor, y el
   formulario lo dice con todas las letras. */
const SUG_MAX = 600;

export function contarSugerencia() {
  const t = document.getElementById("sug-texto");
  const c = document.getElementById("sug-cuenta");
  if (!t || !c) return;
  const n = t.value.trim().length;
  c.textContent = n ? n + " de " + SUG_MAX + " caracteres" : "";
  c.style.color = n > SUG_MAX - 60 ? "var(--alerta)" : "var(--tenue)";
}

export async function enviarSugerencia() {
  const est = document.getElementById("sug-estado");
  const texto = document.getElementById("sug-texto").value.trim();
  if (texto.length < 10) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Contanos un poco más</b>, con diez caracteres no se entiende.';
    document.getElementById("sug-texto").focus();
    return;
  }
  const liberar = ocupar('[data-accion="sug-enviar"]', "Enviando…");
  est.textContent = "Enviando…";
  try {
    const r = await fetch("/api/sugerencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: document.getElementById("sug-categoria").value,
        texto,
        contacto: document.getElementById("sug-contacto").value.trim(),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
    document.getElementById("sug-texto").value = "";
    document.getElementById("sug-contacto").value = "";
    contarSugerencia();
    est.innerHTML =
      '<b style="color:var(--ok-texto)">Gracias, llegó.</b> Lo va a leer una persona. ' +
      "Si dejaste contacto y hace falta, te escribimos.";
  } catch (e) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">' +
      atr(e.message) +
      "</b> Podés intentar de nuevo más tarde.";
  } finally {
    liberar();
    aLaVista(est);
  }
}
