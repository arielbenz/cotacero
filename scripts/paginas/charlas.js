// scripts/paginas/charlas.js — /charlas. La escribe emitir.js.

import { CHARLAS } from "../../lib/charlas.js";
import { esc, pagina } from "./base.js";

/* ---------- /charlas ----------
   Cada dato de acá —evento, año, duración— está verificado contra la ficha de
   ted.com, no copiado de un borrador. Dos salieron distintos de lo que decía
   el diseño: la de Vicki Arroyo es de TEDGlobal, no de TED a secas, y la de
   Kongjian Yu es de TEDxBoston 2022, no una charla TED sin fecha. La de Yu va
   sin duración a propósito: no la pude confirmar en la fuente y no se inventa
   un número para llenar un casillero. */

/* Escrito con palabras y no con un número: "Seis charlas" en un lead y luego
   siete en la lista es el clásico literal que se desincroniza de los datos. */
const NUMERO_CHARLAS =
  ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"][
    CHARLAS.length
  ] || String(CHARLAS.length);

const htmlCharlas = pagina({
  clave: "charlas",
  migaja: "Charlas",
  h1: "Charlas que explican por qué existe esta app",
  lead:
    NUMERO_CHARLAS +
    " charlas TED y TEDx, cortas y gratuitas: prepararse antes, organizarse entre " +
    "vecinos, convivir con el agua y abrir los datos.",
  acciones: `        <p class="chico">En inglés, con subtítulos en ted.com · Ninguna habla de Santa Fe.</p>`,
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Charlas para seguir pensando — Cota Cero",
    numberOfItems: CHARLAS.length,
    itemListElement: CHARLAS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: c.url,
      name: c.original,
    })),
  },
  bloques: [],
  sueltos: [
    `      <section class="charlas">
${CHARLAS.map(
  (
    c,
  ) => `        <a class="charla t-${c.tono}" href="${c.url}" target="_blank" rel="noopener">
          ${
            /* La miniatura es el fotograma que TED publica como og:image,
               alojado acá y no enlazado a pi.tedcdn.com: la CSP es
               img-src 'self', /charlas está precacheada, y enlazarla le
               mandaría a TED la IP de cada lector. Las baja
               scripts/charlas.js. `alt` vacío y aria-hidden porque el título
               que sigue dice lo mismo: para un lector de pantalla la imagen
               es ruido, no información. */ ""
          }
          <span class="mini">
            <img src="/img/charlas/${c.url.replace(/.*\/talks\//, "")}.jpg"
                 width="320" height="180" loading="lazy" decoding="async"
                 alt="" aria-hidden="true" />
            <span class="dur">${Math.round(c.duracion / 60)} min</span>
          </span>
          <span class="cuerpo">
            <span class="tit">${esc(c.titulo)}</span>
            <span class="ficha">${esc(c.ficha)} · «${esc(c.original)}»</span>
            <span class="txt">${esc(c.porque)}</span>
          </span>
        </a>`,
).join("\n")}
      </section>`,
  ],
  bloquesFinales: [
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          ¿Conocés una charla que debería estar acá?
          <a href="/contacto">Mandala →</a>
        </p>`,
    },
  ],
});

export {
  NUMERO_CHARLAS,
  htmlCharlas,
};
