/* js/app/destacar.js — qué bloques de la pestaña Río van a la vista.
   La pestaña eran 479 palabras y más de cuatro pantallas: debajo del nivel
   venían lluvia, tendencia, río arriba, contexto y compartir, todos abiertos
   y cada uno con su párrafo. «Abrumadora», dijo un ingeniero que la probó
   (octubre de 2026). Ahora arriba va lo de hoy y el resto espera plegado en
   «Más sobre el río»; un bloque sube cuando tiene algo que decir. En una
   crecida la pestaña muestra más, que es justo cuando hace falta.

   Los criterios son puros —sin estado ni DOM— para que scripts/comprobar.js
   los pruebe desde Node. ordenarRio() toca el DOM sólo cuando se la llama. */

import { ATENCION_ANTES_M, faltaCm } from "/lib/comun.js";

/* Desde cuántos mm en un día la lluvia sube a la vista: los mismos 40 que
   marca la línea de las barras (MM_UMBRAL en lluvia.js), desde donde empieza
   a costar sacar el agua de la ciudad. */
export const LLUVIA_FUERTE_MM = 40;

export const lluviaFuerte = (picoMm) =>
  typeof picoMm === "number" && picoMm >= LLUVIA_FUERTE_MM;

/* El río está cerca de algo que importa: a ATENCION_ANTES_M (1 m) o menos
   de la alerta de la ciudad —el mismo metro del estado «Atención»— o de tu
   nivel de aviso, que puede estar muy por debajo de la alerta. Ahí la
   tendencia y lo que viene de río arriba dejan de ser contexto. */
export function rioCerca(nivel, alerta, umbral) {
  if (nivel == null) return false;
  const tope = ATENCION_ANTES_M * 100;
  if (alerta != null && faltaCm(nivel, alerta) <= tope) return true;
  return umbral != null && faltaCm(nivel, umbral) <= tope;
}

/* Los bloques, en el orden de la pestaña. `por` dice qué hecho los sube;
   sin `por` quedan siempre plegados. `nombre` arma el resumen del plegable. */
const BLOQUES = [
  { id: "b-lluvia", por: "lluvia", nombre: "lluvia de la semana" },
  { id: "b-tendencia", por: "rio", nombre: "si viene subiendo" },
  { id: "b-arriba", por: "rio", nombre: "río arriba" },
  { id: "b-contexto", nombre: "en contexto" },
  { id: "b-compartir", nombre: "compartir" },
];

/* Los hechos llegan de a uno —el nivel de /api/nivel, la lluvia de
   Open-Meteo— y cada llegada reacomoda con lo que ya se sabe. */
const hechos = { lluvia: false, rio: false };

export function ordenarRio(nuevos) {
  Object.assign(hechos, nuevos);
  const arriba = document.getElementById("rio-destacado");
  const plegado = document.getElementById("mas-rio-cuerpo");
  if (!arriba || !plegado) return;
  const quedan = [];
  for (const b of BLOQUES) {
    const el = document.getElementById(b.id);
    if (!el) continue;
    const sube = b.por ? hechos[b.por] : false;
    (sube ? arriba : plegado).appendChild(el);
    if (!sube) quedan.push(b.nombre);
  }
  const que = document.getElementById("mas-rio-que");
  if (que) {
    const t =
      quedan.length > 1
        ? quedan.slice(0, -1).join(", ") + " y " + quedan[quedan.length - 1]
        : quedan.join("");
    que.textContent = t.charAt(0).toUpperCase() + t.slice(1);
  }
}
