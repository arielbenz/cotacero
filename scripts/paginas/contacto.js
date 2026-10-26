// scripts/paginas/contacto.js — /contacto. La escribe emitir.js.

import {
  AYUDAS,
  CATEGORIAS,
  CATEGORIA_POR_DEFECTO,
  MAX_TEXTO,
  MAX_CONTACTO,
} from "../../lib/sugerencias.js";
import { esc, pagina } from "./base.js";

/* ---------- /contacto ----------
   El formulario de sugerencias tenía un solo lugar: plegado al pie de la app.
   Quien entra desde un buscador —un periodista, alguien de un organismo, un
   vecino que vio un dato mal— no lo encuentra nunca. Esta página lo saca a
   una URL propia.

   DOS COSAS QUE NO SE NEGOCIAN

   1. El aviso de emergencia va ARRIBA DE TODO, antes del título. En una app
      de riesgo hídrico cualquier caja de texto se puede leer como una vía
      para pedir auxilio, y alguien con agua en la puerta no lee hasta el
      final. Por eso está antes del H1 y el 103 es un enlace que llama.
   2. Las opciones son <input type="radio"> de verdad, dibujados como
      pastillas. Se ven como botones pero llegan con teclado y con lector de
      pantalla sin una línea de JavaScript: elegir una categoría funciona
      aunque el script no cargue. El JS sólo manda el formulario.

   Las categorías salen de lib/sugerencias.js, el mismo módulo que valida el
   endpoint: no se pueden desincronizar. */
const AVISO_EMERGENCIA = `      <div class="aviso-emergencia">
        <p>
          <b>¿Es una emergencia?</b> Esto no es una vía de auxilio: nadie lo
          lee en el momento.
        </p>
        <a class="btn-emergencia" href="tel:103">
          <span>Llamá al</span><b>103</b>
        </a>
      </div>`;

const opcionesCategoria = Object.entries(CATEGORIAS)
  .map(
    ([
      clave,
      etiqueta,
    ]) => `            <input type="radio" name="categoria" id="cat-${clave}"
              value="${clave}" class="cat-radio"${clave === CATEGORIA_POR_DEFECTO ? " checked" : ""}
              data-ayuda="${esc(AYUDAS[clave][0] || "")}" data-ejemplo="${esc(AYUDAS[clave][1])}" />
            <label class="cat-chip" for="cat-${clave}">${esc(etiqueta)}</label>`,
  )
  .join("\n");

const htmlContacto = pagina({
  clave: "contacto",
  migaja: "Contacto",
  script: "/js/contacto.js",
  antes: AVISO_EMERGENCIA,
  h1: "Escribinos",
  lead:
    "Cada dato corregido, cada zona que falta y cada texto que no se entiende " +
    "mejora la app para toda la ciudad.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contacto — Cota Cero",
    inLanguage: "es-AR",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <form id="form-contacto" novalidate>
          <fieldset class="campo-cat">
            <legend>¿Sobre qué es?</legend>
            <div class="cat-chips">
${opcionesCategoria}
            </div>
          </fieldset>
          ${
            /* La ayuda del tema elegido. Sale con la del tema por defecto en
               el HTML; js/contacto.js la cambia al elegir otro, y sin JS se
               queda en ésa, que sigue siendo cierta. */ ""
          }<p class="chico sug-ayuda" id="sug-ayuda">${esc(AYUDAS[CATEGORIA_POR_DEFECTO][0] || "")}</p>

          <label class="campo" for="sug-texto"><span>Tu mensaje</span></label>
          <textarea id="sug-texto" name="texto" required maxlength="${MAX_TEXTO}"
            rows="6" aria-describedby="sug-ayuda" placeholder="${esc(AYUDAS[CATEGORIA_POR_DEFECTO][1])}"></textarea>
          <p class="chico cuenta-texto" id="sug-cuenta" aria-live="polite"></p>

          ${
            /* Dictar es una ayuda, no un camino aparte: escribe en el mismo
               cuadro y lo que se manda es el texto, revisado. El botón sale
               escondido y js/contacto.js lo muestra sólo si el navegador sabe
               reconocer voz; sin eso, el formulario es el de siempre. La
               frase de al lado no es de relleno: en Chrome el audio lo
               procesa Google, y eso se dice antes de grabar. */ ""
          }<div class="dictado" id="dictado" hidden>
            <button class="btn sec" type="button" id="sug-voz" aria-pressed="false">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
              <span>Dictar con la voz</span>
            </button>
            <p class="chico" id="voz-estado" role="status" aria-live="polite">
              Se escribe en el cuadro y lo revisás antes de enviar. Tu navegador
              procesa el audio: en Chrome, lo hace Google.
              <a href="/legal#privacidad">Qué sale del teléfono</a>.
            </p>
          </div>

          <label class="campo" for="sug-contacto">
            <span>Un contacto para responderte <i>(opcional)</i></span>
          </label>
          <input type="text" id="sug-contacto" name="contacto" maxlength="${MAX_CONTACTO}"
            autocomplete="off" placeholder="Correo o teléfono — solo si querés respuesta" />

          <button class="btn" type="submit" id="sug-enviar">Enviar sugerencia</button>
          <p class="chico" id="sug-estado" role="status" aria-live="polite"></p>
        </form>

        <p class="chico letra-chica">
          Es lo único que manda texto tuyo a un servidor. <b>No se guarda tu
          IP</b>: se usa sólo para limitar envíos, transformada de modo
          irreversible. Si dejás un contacto, se usa únicamente para
          responderte. <b>No pongas tu dirección.</b>
          <a href="/legal#privacidad">Qué se guarda</a>.
        </p>
      </section>

      <div class="rejilla-2 tarjetas-contacto">
        <section class="mini-tarjeta">
          <h2>¿Encontraste un dato mal?</h2>
          <p>
            Es lo más valioso que nos podés mandar. Decinos la dirección o el
            lugar exacto: con eso se comprueba contra la fuente.
          </p>
        </section>
        <section class="mini-tarjeta">
          <h2>¿Sos de un organismo o de prensa?</h2>
          <p>
            El modelo busca revisión técnica. Si podés ayudar a validarlo,
            escribinos. <a href="/datos">La metodología</a>.
          </p>
        </section>
      </div>`,
  ],
});

export {
  AVISO_EMERGENCIA,
  htmlContacto,
  opcionesCategoria,
};
