/* js/app/bienvenida.js — la primera visita.
   Muestra el río antes de pedir nada: arrancar con un formulario vacío hacía
   que la mayoría se fuera sin ver para qué era. Es un overlay y no una vista,
   para no meter una quinta entrada en el sistema de pestañas. */

import { estado, guardado } from "./estado.js";
import { m } from "./formato.js";
import { ALERTA, EVACUACION } from "./oficiales.js";
import { iosSinInstalar } from "./plataforma.js";
import { irA } from "./vista.js";
import { ESTADOS } from "/lib/comun.js";

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

  /* En iPhone sin instalar el orden se invierte: primero agregarla a inicio
     y recién ahí cargar la casa (plataforma.js). El sólido pasa a abrir los
     pasos —la acción «instalar» de siempre—, cargar la casa en el navegador
     queda de secundario, y «ver el río» baja a enlace: dos botones, no tres. */
  if (iosSinInstalar()) {
    const uno = document.getElementById("bv-uno");
    const dos = document.getElementById("bv-dos");
    const nota = document.getElementById("bv-ios");
    const despues = document.getElementById("bv-despues-ios");
    if (uno && dos && nota && despues) {
      nota.hidden = false;
      uno.textContent = "Ver cómo agregarla";
      uno.dataset.accion = "instalar";
      dos.textContent = "Cargar mi casa acá igual";
      dos.dataset.accion = "bv-calcular";
      despues.hidden = false;
    }
  }

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
/* `guardado` lo decide rio.js, que ya importa este archivo (importarlo al
   revés armaba un ciclo): con el último dato guardado o vencido en pantalla
   —mientras viaja el pedido, o si falló— el pie dice de cuándo es y no el
   estado de la ciudad, que sería la cara de un dato de hoy. */
export function pintarBienvenida({ guardado = false } = {}) {
  const n = document.getElementById("bv-nivel");
  const pie = document.getElementById("bv-pie");
  if (!n || !pie || estado.rio == null) return;
  /* En alerta o evacuación de la ciudad —con dato vigente— la bienvenida lo
     dice como el resto de la app: «de la ciudad», con su color, y debajo el
     verbo de lo que hay que hacer y el 103. Decía «Nivel de alerta» en gris:
     era la primera pantalla de quien llega en plena crecida. */
  const grave = guardado
    ? null
    : estado.rio >= EVACUACION
      ? "evacuacion"
      : estado.rio >= ALERTA
        ? "alerta"
        : null;
  n.textContent = m(estado.rio);
  n.appendChild(pie);
  pie.dataset.tono = grave || "";
  pie.textContent = guardado
    ? "Último dato guardado" +
      (estado.rioFecha ? ", del " + estado.rioFecha.slice(0, 5) : "")
    : grave
      ? ESTADOS[grave].titulo
      : "Por debajo de la alerta de la ciudad";
  const caja = document.getElementById("bv-grave");
  if (!caja) return;
  caja.hidden = !grave;
  caja.innerHTML = grave
    ? "<b>" +
      ESTADOS[grave].verbo +
      '</b> Dudas: Defensa Civil, <a href="tel:103">103</a>.'
    : "";
}
