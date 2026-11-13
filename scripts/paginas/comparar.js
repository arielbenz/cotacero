// scripts/paginas/comparar.js — /comparar. La escribe emitir.js.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ORGANISMOS, FUENTES, ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import { PUBLICO, SITIO, esc, pagina } from "./base.js";

/* ---------- /comparar ----------
   Todos los años del hidrómetro, uno arriba del otro de enero a diciembre, con
   el año en curso resaltado y, marcados, los tres que más se le parecen en
   estas fechas. Es la pregunta que se hace cualquiera con el río subiendo:
   «¿esto ya pasó?».

   LO QUE NO ES: un pronóstico. Las líneas de los años parecidos siguen hasta
   diciembre porque esos años ya terminaron, y eso se lee solo como «así va a
   seguir». Por eso el texto lo dice al lado del gráfico y no al pie: que dos
   años se parezcan hasta hoy no dice cómo sigue éste. La línea del año en
   curso termina en la última lectura y no se extiende.

   La app no dice «normal», «alto» ni «bajo» (README, «Cien años del Paraná»),
   y acá tampoco: se muestra dónde estuvo el río cada año y a cuántos
   centímetros quedó del de ahora.

   Los datos salen de datos-abiertos/serie-diaria.json, que escribe
   `node scripts/historia.js` de la misma bajada que historia.json. El gráfico
   lo dibuja /js/comparar.js, que le suma los últimos 30 días de /api/nivel.
   Acá van el texto, los controles y la tabla mes a mes: con el gráfico caído,
   los números siguen estando (CLAUDE.md, «No volver a mover contenido al
   JavaScript»). */

let serie;
try {
  serie = JSON.parse(
    await readFile(join(PUBLICO, "datos-abiertos", "serie-diaria.json"), "utf8"),
  );
} catch (e) {
  throw new Error(
    "/comparar necesita datos-abiertos/serie-diaria.json — corré `node scripts/historia.js`.",
  );
}

/* La descripción de lib/paginas.js promete la serie desde 1925. Una copia
   armada sin red arranca más tarde: sirve para mirar la página, no para
   publicarla. */
if (serie.provisoria || serie.desde > "1926")
  console.warn(
    "\n  ⚠  /comparar: serie-diaria.json va de " +
      serie.desde +
      " a " +
      serie.hasta +
      (serie.provisoria ? " y es PROVISORIA" : "") +
      ".\n     Corré `node scripts/historia.js` antes de publicar.\n",
  );

const MESES =
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(
    " ",
  );
const CORTOS = "ene feb mar abr may jun jul ago sep oct nov dic".split(" ");
const INICIO_MES = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const enPalabras = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
};
const metros = (cm) =>
  cm == null ? "—" : (cm < 0 ? "−" : "") + nm(Math.abs(cm) / 100, 2);

const ANIOS = Object.keys(serie.anios).sort();

/* Los años que alguien viene a buscar sin saber el número: las crecidas más
   grandes y las bajantes más hondas, de la serie misma (no escritos a mano).
   El año en curso queda afuera: ya está resaltado y todavía no terminó. */
const extremos = ANIOS.slice(0, -1).map((a) => {
  const v = serie.anios[a].filter((x) => x != null);
  return { a, max: Math.max(...v), min: Math.min(...v) };
});
const CRECIDAS = [...extremos].sort((p, q) => q.max - p.max).slice(0, 5);
const BAJANTES = [...extremos].sort((p, q) => p.min - q.min).slice(0, 3);
/* Cada ficha dice su número en el nombre accesible: «1992, máximo 7,43 m». */
const ficha = (a, que, cm) =>
  `<button type="button" class="cmp-ficha" data-anio="${a}" aria-pressed="false" aria-label="${a}, ${que} ${metros(cm)} m" disabled>${a}</button>`;

/* La tabla: el nivel del día 1 de cada mes. Es el gráfico en números, a una
   resolución que entra en una tabla; un día sin lectura queda en raya. */
const tabla = ANIOS.map(
  (a) =>
    `                  <tr><td>${a}</td>${INICIO_MES.map((i) => `<td>${metros(serie.anios[a][i])}</td>`).join("")}</tr>`,
).join("\n");

const htmlComparar = pagina({
  clave: "comparar",
  migaja: "Este año y los anteriores",
  script: "/js/comparar.js",
  /* El h1 nombra el río y la ciudad con las palabras de la búsqueda
     («altura del río Paraná en Santa Fe»): el anterior no decía ninguna. */
  h1: "La altura del río Paraná en Santa Fe, este año y todos los anteriores",
  lead:
    'Cada línea es un año del <a href="/hidrometro">hidrómetro</a> del Puerto de Santa Fe, de enero a ' +
    "diciembre, desde " + serie.desde.slice(0, 4) + ". " +
    "La más oscura es la de este año y termina en la última lectura. " +
    "<b>Sirve para ver si esto ya pasó; no para saber cómo sigue.</b>",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Altura diaria del río Paraná en el Puerto de Santa Fe, año por año",
    description:
      "Lectura diaria del hidrómetro del Puerto de Santa Fe (río Paraná), ordenada por año y por día del año, publicada por el Instituto Nacional del Agua.",
    inLanguage: "es-AR",
    creator: {
      "@type": "Organization",
      name: ORGANISMOS.ina.nombre,
      url: ORGANISMOS.ina.url,
    },
    isAccessibleForFree: true,
    temporalCoverage: serie.desde + "/" + serie.hasta,
    dateModified: serie.hasta,
    spatialCoverage: "Puerto de Santa Fe, Santa Fe, Argentina",
    /* La descarga, para Google Dataset Search. Sin `license`, como en
       /historia: el INA no publica una para esta serie. */
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: SITIO + "/datos-abiertos/serie-diaria.json",
    },
    variableMeasured: "Altura hidrométrica, en metros sobre el cero de escala",
    url: SITIO + "/comparar",
  },
  bloques: [],
  sueltos: [
    /* El orden es el de la pregunta: primero la respuesta («¿esto ya pasó?»,
       en cuántos años el río estuvo más alto esta fecha), después el gráfico,
       y la instrucción de uso abajo. En el teléfono la respuesta estaba a
       900 px y el gráfico a más de una pantalla (crítica del 13/11/2026). */
    `      <section class="bloque cmp-seccion" id="cmp-seccion">
        <p id="cmp-dato" class="cmp-dato"></p>
        <p id="cmp-alerta" class="aviso neutro cmp-aviso" hidden></p>
        <h2>Cada año, de enero a diciembre</h2>
        <noscript><p>Sin JavaScript el gráfico no se dibuja. Los mismos datos, mes a mes, están en la tabla de más abajo.</p></noscript>
        <div class="cmp-vista" role="group" aria-label="Qué parte del año se ve">
          <button type="button" class="cmp-ficha" data-vista="anio" aria-pressed="true" disabled>Todo el año</button>
          <button type="button" class="cmp-ficha" data-vista="cerca" aria-pressed="false" disabled>Cerca de hoy</button>
        </div>
        <p id="cmp-lectura" class="cmp-lectura" role="status"></p>
        <div class="cmp-caja">
          <canvas id="cmp-grafico" class="cmp-grafico" tabindex="0" role="slider"
            aria-label="Gráfico de la altura del río Paraná en el Puerto de Santa Fe, una línea por año. Recorrelo día por día."
            aria-describedby="cmp-ayuda" aria-valuemin="1" aria-valuemax="366" aria-valuenow="1"></canvas>
        </div>
        <ul class="cmp-leyenda" aria-hidden="true">
          <li><i class="cmp-l-actual"></i>Este año</li>
          <li><i class="cmp-l-parecido"></i>Los que más se le parecen</li>
          <li><i class="cmp-l-ventana"></i>Los 30 días que se comparan</li>
          <li><i class="cmp-l-alto"></i>Más alto que la última lectura, esa fecha</li>
        </ul>
        <p class="chico" id="cmp-ayuda">
          Recorré el gráfico con el dedo o el cursor, o elegí un año debajo
          para resaltarlo.
          <span class="cmp-teclado">Con el teclado, sobre el gráfico: ← y →
          cambian el día, Re Pág y Av Pág de a un mes, Inicio y Fin van a las
          puntas, ↑ y ↓ pasan a la línea de arriba o de abajo, y Escape
          suelta.</span>
          Los mismos datos, mes a mes, están en
          <a href="#cmp-tabla">la tabla de más abajo</a>.
        </p>
        <div class="cmp-anios">
          <div class="cmp-grupo" role="group" aria-labelledby="cmp-g-alto" hidden>
            <span class="cmp-grupo-t" id="cmp-g-alto">Más alto que ahora en esta fecha</span>
            <span class="cmp-fichas" id="cmp-fichas-alto"></span>
          </div>
          <div class="cmp-grupo" role="group" aria-labelledby="cmp-g-par">
            <span class="cmp-grupo-t" id="cmp-g-par">Los más parecidos a éste</span>
            <span class="cmp-fichas" id="cmp-fichas-par"></span>
          </div>
          <div class="cmp-grupo" role="group" aria-labelledby="cmp-g-cre">
            <span class="cmp-grupo-t" id="cmp-g-cre">Las crecidas más grandes</span>
            <span class="cmp-fichas">
              ${CRECIDAS.map((e) => ficha(e.a, "máximo", e.max)).join("\n              ")}
            </span>
          </div>
          <div class="cmp-grupo" role="group" aria-labelledby="cmp-g-baj">
            <span class="cmp-grupo-t" id="cmp-g-baj">Las bajantes más hondas</span>
            <span class="cmp-fichas">
              ${BAJANTES.map((e) => ficha(e.a, "mínimo", e.min)).join("\n              ")}
            </span>
          </div>
          <div class="cmp-grupo">
            <label class="cmp-grupo-t" for="cmp-anio">Cualquier otro</label>
            <select id="cmp-anio" disabled>
              <option value="">Elegí un año</option>
            </select>
          </div>
        </div>
      </section>

      <section class="bloque" id="parecidos">
        <h2>Los años que más se parecen a éste</h2>
        <p>
          Se toman los últimos 30 días de este año y se comparan, fecha contra
          fecha, con los mismos 30 días de cada año anterior. Los tres que
          quedaron más cerca, en promedio, son los que el gráfico marca.
        </p>
        <p id="cmp-parecidos-texto" class="chico" role="status">Buscando los años más parecidos…</p>
        <ul id="cmp-parecidos" class="cmp-parecidos"></ul>
        <p class="chico">
          <b>Que se parezcan hasta hoy no dice cómo sigue.</b> Esos años ya
          terminaron y por eso su línea continúa; después de estas fechas cada
          uno hizo algo distinto. Lo que hay que hacer lo marcan la alerta y
          la evacuación de la ciudad, y lo decide la Defensa Civil
          (<a href="tel:103">103</a>).
        </p>
      </section>

      <section class="bloque">
        <details class="h-detalle" id="cmp-tabla">
          <summary>La tabla: la altura del río el día 1 de cada mes, año por año</summary>
          <div class="h-tabla-caja">
            <table class="h-tabla cmp-tabla">
              <thead><tr><th scope="col">Año</th>${CORTOS.map((m) => `<th scope="col">${m}</th>`).join("")}</tr></thead>
              <tbody>
${tabla}
              </tbody>
            </table>
          </div>
          <p class="chico">
            En metros del hidrómetro. La raya es un día sin lectura.
          </p>
        </details>
      </section>

      <section class="bloque oscuro">
        <h2>Esto es historia, no pronóstico</h2>
        <p>
          El gráfico muestra dónde estuvo el río, no dónde va a estar. En cien
          años cambiaron las presas aguas arriba y el régimen del río, y la
          ciudad tampoco es la misma: un mismo número del hidrómetro no
          significaba lo mismo antes que ahora.
        </p>
        <p>
          La alerta de la ciudad es de <b>${nm(ESTACION.alerta, 2)} m</b> y la
          evacuación, de <b>${nm(ESTACION.evacuacion, 2)} m</b>; las dos las
          publica la estación del INA. Alcanzar una altura no significa que el
          agua entre a una casa:
          <a href="/datos#no-dice">por qué el nivel del río no es una predicción de inundación</a>.
          El resumen de cada año, con sus máximos y sus días en alerta, está en
          <a href="/historia">Cien años del Paraná</a>.
        </p>
      </section>

      <section class="bloque borde">
        <p class="kicker">La fuente</p>
        <p class="chico">
          Lectura diaria del hidrómetro del Puerto de Santa Fe:
          <b>${serie.dias.toLocaleString("es-AR")} días medidos</b> en
          ${ANIOS.length} años, del ${enPalabras(serie.desde)} al
          ${enPalabras(serie.hasta)}. Fuente: ${esc(ORGANISMOS.ina.nombre)},
          serie ${ESTACION.serieId} (altura hidrométrica, medición directa).
          Cuando un día tiene más de una lectura se toma la más alta. Los
          últimos 30 días se actualizan solos con la lectura del día.
        </p>
        <p class="fuente-enlaces">
          <a class="btn sec" href="${FUENTES.historia.url}" target="_blank" rel="noopener">Ver fuente</a>
          <a class="enlace-crudo" href="/datos-abiertos/serie-diaria.json">Bajar la serie día por día</a>
        </p>
      </section>`,
  ],
});

export { htmlComparar };
