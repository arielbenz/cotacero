/* js/app/metricas.js — cuántos la usan, sin saber quiénes son.
   Un número al azar por dispositivo que entra a un HyperLogLog del lado del
   servidor: contesta cuántos distintos sin guardar a ninguno. */

import { guardado } from "./estado.js";

/* ---------- cuántos la usan ----------
   Un número al azar por instalación, guardado en el teléfono. No se manda con
   él ninguna otra cosa: ni la cota, ni la zona, ni el plan. Del lado del
   servidor entra a un HyperLogLog, que sabe cuántos distintos vio pero no
   guarda ninguno (ver lib/metricas.js).
   Sirve para una sola pregunta: si 500 aperturas son 500 personas o 30. */
function idInstalacion() {
  let id = guardado.get("cc_id");
  if (!/^[0-9a-f]{24}$/.test(id || "")) {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    guardado.set("cc_id", id);
  }
  return id;
}

/* Una sola vez por sesión, y sin bloquear nada: si falla, falla en silencio.
   Que no se pueda contar no es un problema de quien está usando la app. */
export function contarVisita() {
  try {
    if (sessionStorage.getItem("cc_visita") === "1") return;
    sessionStorage.setItem("cc_visita", "1");
  } catch (e) {
    /* en modo privado no hay sessionStorage: se cuenta igual */
  }
  if (navigator.onLine === false) return;
  fetch("/api/visita", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idInstalacion() }),
    keepalive: true,
  }).catch(() => {});
}
