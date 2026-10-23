// scripts/paginas/medios.js — /para-medios. La escribe emitir.js.

import { SITIO, esc, pagina } from "./base.js";

/* ---------- /para-medios ----------
   La página que explica el widget. El widget en sí vive en /widget y es lo
   único del sitio que se deja embeber: su CSP lleva frame-ancestors *, y esa
   regla va después del comodín en vercel.json porque gana la última. */
/* El renglón de abajo NO es decoración. El crédito de adentro del widget
   («vía Cota Cero») vive en el iframe, y para Google un enlace dentro de un
   iframe es del documento del iframe, no de la nota que lo embebe: el medio
   que pegaba el código no dejaba ningún enlace hacia acá. Éste sí queda en
   su página. Va con la marca como texto y nada más: Google trata como spam
   los widgets que reparten enlaces con palabras clave. */
const CODIGO_WIDGET = `<iframe src="${SITIO}/widget"
  width="100%" height="220" loading="lazy"
  style="border:0;border-radius:16px"
  title="Nivel del río en el Puerto de Santa Fe — Cota Cero"></iframe>
<p style="margin:6px 0 0;font:13px/1.4 sans-serif">Fuente: <a href="${SITIO}/">Cota Cero</a>, con datos del INA</p>`;

/* [título, texto]. Tres y numeradas: son las reglas del préstamo, en orden
   de lo que más se rompe. */
const CONDICIONES = [
  [
    "No recortes el crédito",
    "Ni el «Datos: INA · vía Cota Cero» de adentro ni el renglón de abajo: es lo que le permite a tu lector ir a la fuente del número que estás publicando.",
  ],
  [
    "No es un pronóstico",
    "Muestra el nivel oficial y la alerta y la evacuación de la ciudad, no niveles de aviso personales. No lo presentes como predicción de inundación.",
  ],
  [
    "Mandan las autoridades",
    "Si Defensa Civil dice algo distinto que el widget, vale Defensa Civil.",
  ],
];

const htmlMedios = pagina({
  clave: "paraMedios",
  migaja: "Widget para medios",
  script: "/js/medios.js",
  h1: "El río, embebido en tu nota",
  lead:
    "El nivel del Paraná en el Puerto, con la alerta y la evacuación de la " +
    "ciudad, siempre actualizado. Pegás el código en tu nota y listo.",
  acciones: `        <ul class="hero-tildes medios-tildes">
          <li>Gratis</li>
          <li>Sin claves de API</li>
          <li>Sin cookies ni rastreo de tus lectores</li>
        </ul>
        <p class="pg-acciones"><a class="btn" href="#codigo">Copiar el código</a></p>`,
  jsonld: null,
  bloques: [
    {
      /* No son capturas: los dos son el widget de verdad, leyendo el reporte
         del INA ahora mismo. */
      html: `        <div class="muestras-widget">
          <figure>
            <iframe src="/widget" title="Widget de Cota Cero, tema claro" loading="lazy"></iframe>
            <figcaption class="chico">Tema claro, por defecto</figcaption>
          </figure>
          <figure>
            <iframe src="/widget?theme=dark" title="Widget de Cota Cero, tema oscuro" loading="lazy"></iframe>
            <figcaption class="chico">Tema oscuro: agregale <code>?theme=dark</code></figcaption>
          </figure>
        </div>`,
    },
    {
      id: "codigo",
      titulo: "Copiá, pegá, listo",
      html: `        <div class="caja-codigo">
          <button type="button" class="btn sec" id="copiar-widget" hidden>Copiar</button>
          <pre id="codigo-widget">${esc(CODIGO_WIDGET)}</pre>
        </div>
        <ul class="medida-widget">
          <li><b>Alto:</b> 220 px</li>
          <li><b>Ancho:</b> el de tu columna; abajo de 380 px el pie se reacomoda solo</li>
          <li><b>Se actualiza solo</b> con la lectura del INA. Si el dato envejece, muestra su fecha y lo dice: nunca inventa un número.</li>
        </ul>`,
    },
    {
      titulo: "Tres condiciones",
      html: `        <ol class="condiciones-tres">
${CONDICIONES.map(([t, c]) => `          <li><b>${esc(t)}</b><span>${esc(c)}</span></li>`).join("\n")}
        </ol>
        ${
          /* Preguntar es la única manera que tenemos, y el motivo es el mismo
             que la promesa de arriba: el widget no carga analytics ni deja
             cookies, así que del lado del servidor no queda rastro de quién lo
             embebe. Se podría contar el dominio del medio sin tocar al lector
             —document.referrer adentro del iframe—, pero eso volvería falsa la
             frase de /legal que dice que lo único que sale del dispositivo son
             las sugerencias. Se eligió preguntar. */ ""
        }<p class="chico">
          ¿Lo publicaste? <a href="/contacto">Contanos</a>: como no medimos a
          tus lectores, preguntar es la única forma de saberlo. Y si necesitás
          otro formato o la metodología, por el mismo lado: a prensa
          contestamos rápido.
        </p>`,
    },
  ],
});

export {
  CODIGO_WIDGET,
  CONDICIONES,
  htmlMedios,
};
