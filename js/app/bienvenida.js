/* js/app/bienvenida.js — la primera visita.
   Muestra el río antes de pedir nada: arrancar con un formulario vacío hacía
   que la mayoría se fuera sin ver para qué era. Es un overlay y no una vista,
   para no meter una quinta entrada en el sistema de pestañas. */

import { estado, guardado } from "./estado.js";
import { m } from "./formato.js";
import { ALERTA, EVACUACION } from "./oficiales.js";
import { irA } from "./vista.js";

/* ================= BIENVENIDA =================
   Primera visita: se muestra el río antes de pedir nada. La app no sirve de
   nada hasta que cargás la cota de tu terreno, pero arrancar con un formulario vacío hace
   que la mayoría se vaya sin ver para qué era. */

const YA_ENTRO = "cc_bienvenida";

export function mostrarBienvenida() {
  const caja = document.getElementById("bienvenida");
  if (!caja) return;
  // Si ya cargó la cota de su terreno alguna vez, esto no tiene nada que ofrecerle.
  if (guardado.get(YA_ENTRO) === "1" || guardado.get("cc_cota")) return;
  caja.hidden = false;
  document.body.classList.add("con-bienvenida");
}

export function cerrarBienvenida(ir) {
  const caja = document.getElementById("bienvenida");
  guardado.set(YA_ENTRO, "1");
  if (caja) caja.hidden = true;
  document.body.classList.remove("con-bienvenida");
  if (ir) irA(ir);
}

/* El número de la bienvenida sale del mismo estado que el resto: no se pide
   el nivel dos veces. */
export function pintarBienvenida() {
  const n = document.getElementById("bv-nivel");
  const pie = document.getElementById("bv-pie");
  if (!n || !pie || estado.rio == null) return;
  n.textContent = m(estado.rio);
  n.appendChild(pie);
  pie.textContent =
    estado.rio >= EVACUACION
      ? "Nivel de evacuación"
      : estado.rio >= ALERTA
        ? "Nivel de alerta"
        : "Por debajo del nivel de alerta";
}
