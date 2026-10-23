// scripts/paginas/historia.js — /historia. La escribe emitir.js.

import { ORGANISMOS, FUENTES, ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import { SITIO, esc, historia, pagina } from "./base.js";

/* Los datos históricos, servidos en HTML.
   ------------------------------------------------------------------
   Antes esta página no tenía UN SOLO número en el marcado: las crecidas, las
   bajantes y la tabla las inyectaba historia.js, y el contenedor salía con
   `hidden`. Un buscador —o un lector de pantalla, o alguien con el JS
   bloqueado— veía "Cargando un siglo de mediciones…" y nada más. Justo en la
   página que existe para contar la historia del río.

   Ahora los números se emiten acá, al generar, desde el mismo
   datos-abiertos/historia.json que usa el navegador. El JavaScript quedó para
   lo que de verdad lo necesita —la franja del siglo y el tanque que se
   recorre—, y ya no reescribe estas listas. */
const MESES =
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(
    " ",
  );
const enPalabras = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
};
const anioDe = (f) => (f || "").slice(0, 4);

/* [anio, max, fecha_max, min, fecha_min, dias, dias_alerta, dias_evac] */
const filaHist = (f) => ({
  anio: f[0],
  max: f[1],
  fmax: f[2],
  min: f[3],
  fmin: f[4],
  dias: f[5],
  da: f[6],
  de: f[7],
});
const HIST = historia ? historia.anios.map(filaHist) : [];
const CRECIDAS = [...HIST].sort((a, b) => b.max - a.max).slice(0, 8);
const BAJANTES = [...HIST].sort((a, b) => a.min - b.min).slice(0, 8);
const RECORD = CRECIDAS[0];

/* Los rankings de crecidas y bajantes salieron de la página: quedaban dos
   listas de ocho puestos arriba de la tabla completa, que ya trae los mismos
   años con los mismos números. CRECIDAS y BAJANTES siguen calculándose porque
   los usa el resumen de arriba (el récord y la bajante más honda). */

const tablaHist = HIST.map(
  (e) =>
    `                  <tr><td>${e.anio}</td><td>${nm(e.max, 2)}</td><td>${nm(e.min, 2)}</td><td>${e.da}</td></tr>`,
).join("\n");

/* ---------- /historia ----------
   Cien años del Paraná. Los números salen de datos-abiertos/historia.json,
   que genera `node scripts/historia.js` desde la serie del INA, y van en el
   HTML: las fichas y la tabla los emite este script. historia.js sólo agrega
   la franja que se recorre. Si acá hubiera un número escrito a mano, el día
   que la serie se actualice quedaría mintiendo.

   Por qué existe: el hidrómetro es un número abstracto. "3,10 m" no le dice
   nada a nadie hasta que se lo ve al lado de los 7,43 de 1992 y de los −0,23
   de 2022. Esta página es la escala. */
const htmlHistoria = pagina({
  clave: "historia",
  migaja: "Cien años del Paraná",
  script: "/js/historia.js",
  // Sin chip ni kickers encima de los títulos: ver CLAUDE.md, «el mono en
  // mayúsculas etiqueta una cosa».
  h1: "Más de un siglo del río Paraná en Santa Fe",
  lead:
    "El hidrómetro marca un número y el número solo no dice nada. Esta página " +
    "lo pone al lado de <b>un siglo de mediciones oficiales</b> del mismo " +
    "instrumento, para que se vea qué es mucho y qué es poco.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Altura hidrométrica diaria del Puerto de Santa Fe, 1925-hoy",
    description:
      "Serie diaria de altura hidrométrica del Puerto de Santa Fe (río Paraná), publicada por el Instituto Nacional del Agua.",
    inLanguage: "es-AR",
    /* Organization y no GovernmentOrganization: Google sólo acepta Person u
       Organization en `creator` y no reconoce los subtipos. Sin `license`
       a propósito: el INA no publica una para esta serie, y declarar una
       sería inventar un dato. Search Console lo marca como leve. */
    creator: {
      "@type": "Organization",
      name: ORGANISMOS.ina.nombre,
      url: ORGANISMOS.ina.url,
    },
    isAccessibleForFree: true,
    temporalCoverage: historia
      ? historia.desde + "/" + historia.hasta
      : undefined,
    variableMeasured: "Altura hidrométrica, en metros sobre el cero de escala",
    url: SITIO + "/historia",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <h2>El Paraná en más de cien años de registros</h2>
        <p>
          El Instituto Nacional del Agua publica la lectura diaria del
          hidrómetro del Puerto de Santa Fe desde el ${enPalabras(historia.desde)}. Son
          <b>${historia.dias.toLocaleString("es-AR")} días medidos</b> del
          mismo instrumento, y es la misma serie de la que sale el número que
          la app muestra hoy.
        </p>
        ${
          /* Las cuatro fichas son los datos en el HTML, no en el JS: ver
             CLAUDE.md, «No volver a mover contenido al JavaScript». */ ""
        }<dl class="fichas-hist">
          <div><dt>Mayor altura · ${enPalabras(RECORD.fmax)}</dt><dd>${nm(RECORD.max, 2)} m</dd></div>
          <div><dt>Bajante más honda · ${enPalabras(BAJANTES[0].fmin)}</dt><dd>${BAJANTES[0].min < 0 ? "−" : ""}${nm(Math.abs(BAJANTES[0].min), 2)} m</dd></div>
          <div><dt>Mediana de la serie diaria</dt><dd>${nm(historia.cuantiles[50], 2)} m</dd></div>
          <div><dt>Años con registro</dt><dd>${HIST.length}</dd></div>
        </dl>
        <p class="chico">
          Antes de 1925 el INA no publica esta serie. La crecida de 1905 que se
          cita seguido queda afuera: no la reconstruimos desde recortes de
          diario.
        </p>
      </section>

      <p id="h-cargando" class="chico" role="status">Cargando la línea de tiempo…</p>

      ${
        /* Lo interactivo, y SÓLO lo interactivo, espera al JavaScript: los
           datos de arriba y la tabla de abajo ya están en el HTML. */ ""
      }<div id="h-contenido" hidden>
        <section class="bloque">
          <h2>Recorré la serie año por año</h2>
          <p>
            Cada barra es un año: va del nivel más bajo al más alto que marcó el
            hidrómetro. Tocá una barra, o usá las flechas, para ver ese año.
          </p>
          <ul class="h-leyenda" aria-hidden="true">
            <li><i class="h-b-normal"></i>No llegó a la alerta de la ciudad</li>
            <li><i class="h-b-alerta"></i>Llegó a la alerta de la ciudad</li>
            <li><i class="h-b-evac"></i>Llegó a la evacuación de la ciudad</li>
          </ul>
          <div id="h-franja" class="h-franja" role="slider" tabindex="0"
            aria-label="Año de la serie"></div>
          <div class="h-detalle-anio">
            <div class="h-sel">
              <button type="button" class="h-flecha" id="h-anterior" aria-label="Año anterior">‹</button>
              <b id="h-anio" class="h-anio"></b>
              <button type="button" class="h-flecha" id="h-siguiente" aria-label="Año siguiente">›</button>
            </div>
            <div id="h-detalle-datos" class="h-detalle-datos"></div>
            <p id="h-detalle-texto" class="h-detalle-texto" role="status"></p>
          </div>
        </section>
      </div>

      <section class="bloque">
        <details class="h-detalle">
          <summary>La tabla completa: los ${HIST.length} años, uno por uno</summary>
          <div class="h-tabla-caja">
            <table class="h-tabla">
              <thead><tr><th scope="col">Año</th><th scope="col">Máximo</th><th scope="col">Mínimo</th><th scope="col">Días en alerta</th></tr></thead>
              <tbody>
${tablaHist}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section class="bloque" id="umbrales">
        <h2>¿Qué significan estos números?</h2>
        <p>
          La <b>alerta de la ciudad</b> es de <b>${nm(ESTACION.alerta, 2)} m</b>
          en el hidrómetro del Puerto y la <b>evacuación</b>, de
          <b>${nm(ESTACION.evacuacion, 2)} m</b>. Las dos las publica la
          estación del INA. El récord de ${RECORD.anio} quedó
          <b>${nm(RECORD.max - ESTACION.evacuacion, 2)} m por encima</b> de la
          evacuación. Y todo el rango en el que se decide algo, de la alerta al
          récord, son <b>${nm(RECORD.max - ESTACION.alerta, 2)} m</b>: por eso
          diez centímetros en el modelo no son un detalle.
        </p>
        <p class="chico">
          Alcanzar una altura no significa que el agua entre a una casa: buena
          parte de la ciudad está protegida por defensas, compuertas y bombeo.
          <a href="/datos#no-dice">Por qué el nivel del río no es una predicción de inundación</a>.
        </p>
      </section>

      <section class="bloque oscuro">
        <h2>Esto es historia, no pronóstico</h2>
        <p>
          Que una altura se haya alcanzado pocas veces en cien años no dice
          nada sobre lo que va a pasar este año. En cien años cambiaron las
          presas aguas arriba, el uso del suelo de la cuenca y el propio
          régimen del río.
        </p>
        <p>
          Y la ciudad de 1925 no es la de hoy: un mismo número del hidrómetro
          no significaba lo mismo antes que ahora, porque cambió lo que hay
          entre el río y las casas. Y la serie mide sólo el Paraná: en 2003 no
          llegó a la alerta, y la ciudad se inundó igual por el Salado.
        </p>
        ${
          /* Era un bloque aparte, «Comparar con el río de hoy», con tres
             enlaces al pie: el patrón «Seguí por acá» que CLAUDE.md prohíbe.
             El enlace va donde el texto lo pide. */ ""
        }<p>
          Lo que marca el hidrómetro hoy está en la <a href="/">portada</a>, y
          qué significa para un terreno en particular, en la
          <a href="/app?ir=cota">app</a>.
        </p>
      </section>

      <section class="bloque borde">
        <p class="kicker">La fuente</p>
        <p class="chico">
          Serie diaria del hidrómetro del Puerto de Santa Fe:
          <b>${historia.dias.toLocaleString("es-AR")} días medidos</b> entre el
          ${enPalabras(historia.desde)} y el ${enPalabras(historia.hasta)}.
          Fuente: ${esc(ORGANISMOS.ina.nombre)}, serie ${ESTACION.serieId}
          (altura hidrométrica, medición directa). Descargado el
          ${enPalabras(historia.generado)}.
          ${historia.incompletos.length ? "Con la libreta incompleta: " + historia.incompletos.join(", ") + "." : ""}
        </p>
        <p class="fuente-enlaces">
          <a class="btn sec" href="${FUENTES.historia.url}" target="_blank" rel="noopener">Ver fuente</a>
          <a class="enlace-crudo" href="${esc(FUENTES.historia.verificar)}" target="_blank" rel="noopener">Ver la serie cruda</a>
        </p>
      </section>`,
  ],
});

export {
  BAJANTES,
  CRECIDAS,
  HIST,
  MESES,
  RECORD,
  anioDe,
  enPalabras,
  filaHist,
  htmlHistoria,
  tablaHist,
};
