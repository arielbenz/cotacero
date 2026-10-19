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

  /* showModal() atrapa el foco, habilita Escape y deja el resto de la página
     inerte para un lector de pantalla. Si el navegador no tiene <dialog>
     —iOS anterior a 15.4— se cae al atributo `open`, que lo deja exactamente
     como estaba antes: visible, sin trampa de foco. */
  if (typeof caja.showModal === "function") caja.showModal();
  else caja.setAttribute("open", "");

  /* Escape dispara `close` sin pasar por nuestros botones: equivale a "Ahora
     no". Se registra una sola vez. */
  if (!caja.dataset.enganchado) {
    caja.dataset.enganchado = "1";
    caja.addEventListener("close", () => cerrarBienvenida());
  }
  document.body.classList.add("con-bienvenida");
}

export function cerrarBienvenida(ir) {
  const caja = document.getElementById("bienvenida");
  guardado.set(YA_ENTRO, "1");
  /* Ojo con el ciclo: close() dispara el evento `close`, que vuelve a llamar
     acá. La guarda de `open` lo corta. */
  if (caja && caja.open) {
    if (typeof caja.close === "function") caja.close();
    else caja.removeAttribute("open");
  }
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
