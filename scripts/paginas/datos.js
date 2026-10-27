// scripts/paginas/datos.js — /datos. La escribe emitir.js.

import { ORGANISMOS, NORMATIVA, ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import {
  MEDICION,
  N_CURVAS,
  SITIO,
  bloque,
  esc,
  historia,
  pagina,
  selloFuente,
  tarjetaFuente,
} from "./base.js";

/* ---------- /datos ----------
   Esta página absorbió a `/mi-cota` (que ahora redirige acá con un 301, ver
   vercel.json). Eran dos páginas explicando la misma resta, la misma
   discusión del 8,20 y la misma comprobación de 1992, con el mismo H2
   «Honestidad también acá» escrito dos veces — y compitiendo entre sí por las
   mismas búsquedas.

   Contesta dos preguntas encadenadas: "¿cuál es la cota de mi terreno?" y
   "¿de dónde sale todo esto?". No es documentación para programadores: es el
   lugar donde una persona comprueba que no le estamos inventando el número.

   Va en este orden a propósito: los dos datos que la app lee (el río y el
   terreno), después la cuenta que los relaciona, después qué tan firme es
   todo eso, y al final las fuentes para ir a mirarlas. Quien lee las tres
   primeras secciones ya entendió lo que necesita.

   UN SOLO EJEMPLO EN TODA LA PÁGINA: Colastiné Norte, cota 15,80 m IGN, a
   11 km del puerto. Antes había dos juegos de números —uno acá con Arroyo
   Leyes a 24 km y otro en /mi-cota con Colastiné a 11— y quien leía las dos
   páginas no podía rehacer ninguna cuenta. Arroyo Leyes aparece sólo en «Qué
   tan firme es esto», para explicar por qué 1992 no comprueba la pendiente. */

/* El corte del terreno. Es la explicación que más nos costó escribir en
   palabras y la que sale sola en un dibujo: el río sube, la superficie del
   agua es una sola, y tu terreno está a cierta altura sobre esa misma
   referencia. Va en SVG inline porque tiene que verse sin conexión, pesar
   nada y seguir el tema claro/oscuro por sí solo. */
const CORTE_SVG = `        <svg class="corte" viewBox="0 0 340 190" role="img"
          aria-label="Corte del terreno: a la derecha el río, a la izquierda una casa sobre terreno más alto. La superficie del agua se prolonga en línea punteada hasta debajo de la casa, y la diferencia entre esa línea y el piso de la casa es el margen.">
          <defs>
            <linearGradient id="grad-agua" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--agua)" stop-opacity=".55"/>
              <stop offset="1" stop-color="var(--agua)" stop-opacity=".18"/>
            </linearGradient>
          </defs>
          <path d="M0 118 L96 118 L150 128 L214 141 L258 150 L340 150 L340 190 L0 190 Z"
            fill="var(--tierra)" opacity=".22"/>
          <path d="M214 141 L258 150 L340 150 L340 190 L214 190 Z" fill="url(#grad-agua)"/>
          <line x1="214" y1="141" x2="340" y2="141" stroke="var(--agua)" stroke-width="2"/>
          <line x1="12" y1="141" x2="214" y2="141" stroke="var(--agua)" stroke-width="1.5"
            stroke-dasharray="5 4" opacity=".8"/>
          <g transform="translate(52 86)">
            <path d="M0 14 L21 0 L42 14 L42 32 L0 32 Z" fill="none"
              stroke="var(--texto)" stroke-width="2" stroke-linejoin="round"/>
            <rect x="16" y="20" width="10" height="12" fill="var(--texto)" opacity=".45"/>
          </g>
          <line x1="26" y1="118" x2="26" y2="141" stroke="var(--acento)" stroke-width="2"/>
          <path d="M22 122 L26 118 L30 122" fill="none" stroke="var(--acento)" stroke-width="2"/>
          <path d="M22 137 L26 141 L30 137" fill="none" stroke="var(--acento)" stroke-width="2"/>
          <text x="36" y="134" fill="var(--acento)" font-size="12" font-family="var(--sans)">margen</text>
          <text x="10" y="78" fill="var(--texto)" font-size="12" font-family="var(--sans)">cota del terreno</text>
          <text x="228" y="134" fill="var(--agua)" font-size="12" font-family="var(--sans)">superficie del agua</text>
          <text x="292" y="176" fill="var(--tenue)" font-size="12" font-family="var(--sans)">Paraná</text>
        </svg>`;

/* La cuenta, en vertical y con un solo ejemplo. Tres sumandos y un total: si
   hubiera dos ejemplos o dos cuentas juntas se vuelve ilegible, que es
   exactamente lo que pasaba antes. */
const cuentaVertical = (filas) => `        <div class="cuenta-vertical">
${filas
  .map(([k, v, tipo]) =>
    tipo === "op"
      ? `          <div class="cv-op" aria-hidden="true">${k}</div>`
      : `          <div class="cv-fila${tipo ? " cv-" + tipo : ""}">
            <span class="cv-k">${esc(k)}</span><span class="cv-v">${esc(v)}</span>
          </div>`,
  )
  .join("\n")}
        </div>`;

/* El récord sale de datos-abiertos/historia.json y no escrito a mano: es la
   misma serie del INA de la que sale el número que muestra la app. */
const recordHist = historia
  ? [...historia.anios].sort((a, b) => b[1] - a[1])[0]
  : null;
const RECORD_M = recordHist ? nm(recordHist[1], 2) : "7,43";
const RECORD_ANIO = recordHist ? recordHist[0] : 1992;

/* Lo que va entre la alerta de la ciudad y el récord: el ancho entero de la
   escala con la que se decide. Sale de las constantes, no escrito a mano. */
const ESCALA_DECISION = nm(
  (recordHist ? recordHist[1] : 7.43) - ESTACION.alerta,
  2,
);

/* Una fila del ejemplo: número, qué se hace y el valor que queda. Reemplaza
   a los tres `paso()` sueltos, que eran tres tarjetas con su pastilla: la
   cuenta se leía repartida en media pantalla de cajas. */
const filaEjemplo = ({ n, titulo, html, valor }) => `          <li class="ej-fila">
            <span class="numerito" aria-hidden="true">${n}</span>
            <div>
              <h3>${esc(titulo)}</h3>
${html}
            </div>
            <span class="ej-valor">${esc(valor)}</span>
          </li>`;

const htmlDatos = pagina({
  clave: "datos",
  migaja: "La cota de tu terreno y los datos",
  /* El h1 se queda en la pregunta de la cota: es lo que se busca y lo que
     declara lib/paginas.js. El diseño de 2026 proponía «Cómo se calcula tu
     nivel de aviso», que es la pregunta de la app, no la del buscador. Sin
     chip encima: era un segundo título en chiquito. */
  h1: "¿Cuál es la cota de tu terreno en Santa Fe, y de dónde sale?",
  lead:
    "Tres datos —<b>la altura de tu terreno</b>, <b>el cero de la regla del " +
    "puerto</b> y <b>tu distancia al puerto</b>— dan tu umbral estimado: la " +
    "lectura del hidrómetro a la que el agua alcanzaría la cota de tu terreno. " +
    "En la app se llama «tu nivel de aviso».",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "La cota de tu terreno en Santa Fe: el cálculo y de dónde salen los datos",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/datos",
  },
  bloques: [
    {
      /* La cuenta entera arriba, para quien vino a buscar sólo eso, y los
         atajos a las cinco secciones. Los números son los del cálculo: si
         cambian en js/app/config.js, cambian acá (ver AUDITORIA.md). */
      oscuro: true,
      id: "cuenta-entera",
      titulo: "La cuenta, entera",
      html: `        <p class="formula">
          <span>cota del terreno <b>− 0,50</b></span>
          <span><b>−</b> cero del hidrómetro <b>(8,42)</b></span>
          <span><b>−</b> km río arriba <b>× 0,045</b></span>
          <span class="f-total"><b>=</b> tu nivel de aviso</span>
        </p>
        <p class="chico">Una referencia para prepararte, no el minuto en que entra el agua. Cota Cero <b>no genera información hidrológica propia</b>: toma datos públicos, los combina y los cita.</p>
        <nav class="atajos-num" aria-label="En esta página">
          <a href="#rio"><b>1</b> El nivel del río</a>
          <a href="#terreno"><b>2</b> La altura de tu terreno</a>
          <a href="#cuenta"><b>3</b> Cómo se relacionan</a>
          <a href="#firme"><b>4</b> Qué tan firme es esto</a>
          <a href="#fuentes"><b>5</b> Las fuentes</a>
        </nav>`,
    },
    {
      id: "rio",
      kicker: "1 · El nivel del río",
      titulo: "Lo mide el Estado, no nosotros",
      html: `        <p>
          El número grande de la app es la lectura del <b>hidrómetro del
          Puerto</b>: la lee Prefectura y la publica el INA. Cota Cero la
          muestra; no la mide, no la corrige y no la promedia.
        </p>
        <div class="ficha-estacion">
          <div><span class="k">Estación</span><span class="v">${esc(ESTACION.nombre)} · ${esc(ESTACION.abreviatura)}</span></div>
          <div><span class="k">Río</span><span class="v">${esc(ESTACION.rio)}</span></div>
          <div><span class="k">Serie del INA</span><span class="v">n.º ${ESTACION.serieId} — altura hidrométrica</span></div>
          <div><span class="k">Quién la lee</span><span class="v">${esc(ESTACION.propietario)}</span></div>
          <div><span class="k">Alerta</span><span class="v">${nm(ESTACION.alerta, 2)} m</span></div>
          <div><span class="k">Evacuación</span><span class="v">${nm(ESTACION.evacuacion, 2)} m</span></div>
        </div>
        <p class="chico">
          Los umbrales los publica la propia estación en la API del sistema de
          alerta del INA; si la API falla, la app cae sola al reporte diario.
          Si tampoco contesta, muestra la última lectura con su fecha, y a las
          48 horas deja de darla por vigente. <b>Nunca inventa un valor.</b>
        </p>
        ${selloFuente("nivelRio", "serie 30, altura hidrométrica")}`,
    },
    {
      id: "terreno",
      kicker: "2 · La altura de tu terreno",
      titulo: "La cota sale de las curvas de nivel del municipio",
      html: `        <p>
          La <b>cota</b> es la altura de un terreno sobre el mar, en el sistema
          oficial argentino (IGN). La Municipalidad publica <b>${N_CURVAS} curvas de
          nivel</b>, cada 50 cm: si caminás sobre una, no subís ni bajás.
        </p>
        <div class="curvas-dibujo" aria-hidden="true">
          <div class="cd-linea"><span>16,0 m</span><i></i></div>
          <div class="cd-casa">🏠 tu casa</div>
          <div class="cd-linea"><span>15,5 m</span><i></i></div>
        </div>
        <p>
          Si tu casa cae entre dos, la app estima su altura y <b>descuenta
          medio metro</b>, por las dudas.
        </p>
        <p>
          Las curvas terminan en el límite de la ciudad. En <b>San José del
          Rincón y Arroyo Leyes</b> la altura sale de los <b>puntos con cota</b>
          que midió la Provincia en 2005, en la misma campaña de la que salieron
          las curvas: la app toma los cuatro más cercanos a tu casa. Ahí el
          terreno cambia mucho de un lugar a otro —terraplenes, cunetas,
          rellenos—, así que descuenta <b>un metro</b> en vez de medio. Donde no
          hay ni curvas ni puntos te pide la cota a mano, en vez de caer a una
          fuente peor.
        </p>
        <p class="chico">
          Es una estimación, no una medición de tu terreno: la curva pasa cerca,
          no por tu puerta.
        </p>

        <h3>Cuánto se equivocan las curvas</h3>
        ${
          /* AUDITORIA.md §4: 330 puntos fijos de la red municipal, sin las
             marcas sobre estructuras, contra elevacionDe(). Si se repite la
             corrida, los cuatro números de acá salen de esa salida. */ ""
        }<p>
          Las comparamos con <b>${MEDICION.n} puntos que la Municipalidad midió en la
          calle</b>. La mitad cae a menos de ${MEDICION.mitad} de lo medido, y 9 de cada 10
          a menos de ${MEDICION.nueveDeDiez}. Casi siempre del lado seguro: las curvas dan el
          terreno <b>más bajo</b> de lo que es, y entonces la app avisa antes.
        </p>
        <p class="chico">
          Para el otro lado fallan en puntos sueltos —una bajada, el ingreso a
          un barrio, un anfiteatro—: en ${MEDICION.optimistas} de los ${MEDICION.n} el terreno quedó más bajo
          que lo que dicen las curvas, aun descontando el medio metro. Las
          curvas son de 2005 y se trazaron a mano sobre un relevamiento de 1992.
        </p>

        <h3>Por qué no un satélite</h3>
        <p>
          Los modelos satelitales miden <b>techos y copas de árboles</b>, no el
          piso. Contra <b>36 puntos medidos en campo por el IGN</b>, el que usaba
          la app tenía un <b>desvío estándar de 7,46 m</b>, con casos de hasta
          23 m.
        </p>
        ${
          /* Desvío estándar, NO error promedio: el sesgo medio era chico
             (0,89 m). Lo que descalifica a la fuente es la dispersión. Las
             barras van a la misma escala y el ancho sale de los números. */ ""
        }<div class="barras-error" role="img" aria-label="Desvío estándar del satélite, 7,46 metros, contra ${ESCALA_DECISION} metros entre la alerta de la ciudad y el récord.">
          <div class="be-fila">
            <span class="be-k">Error del satélite (desvío estándar)</span>
            <span class="be-pista"><i class="be-mal" style="width:100%"></i></span>
            <span class="be-v">7,46 m</span>
          </div>
          <div class="be-fila">
            <span class="be-k">De la alerta (${nm(ESTACION.alerta, 2)}) al récord (${RECORD_M})</span>
            <span class="be-pista"><i style="width:${((parseFloat(ESCALA_DECISION.replace(",", ".")) / 7.46) * 100).toFixed(1)}%"></i></span>
            <span class="be-v">${ESCALA_DECISION} m</span>
          </div>
        </div>
        <p><b>El error de la fuente era más grande que toda la escala de la decisión.</b></p>
        <p class="chico">
          Ni la mejor curva reemplaza un relevamiento de tu terreno: no sabe si
          está elevado sobre la vereda ni si la casa tiene escalones. <b>El
          número que vale es el de un relevamiento, la escritura o el plano de
          mensura.</b> Si lo conseguís, cargalo a mano en la app.
        </p>
        ${selloFuente("topografia", "curvas de nivel de la ciudad")}`,
    },
    {
      id: "cuenta",
      kicker: "3 · Cómo se relacionan",
      titulo: "Dos alturas, una resta",
      html: `        <p>
          El hidrómetro no mide altura sobre el mar: mide cuánto sube el agua
          sobre el <b>cero de su escala</b>, que está a una altura conocida.
          Sumando las dos se obtiene la superficie del agua en la misma escala
          que tu terreno.
        </p>
${cuentaVertical([
  ["Lectura del hidrómetro", "5,00 m"],
  ["+", "", "op"],
  ["Cero del hidrómetro", "8,42 m IGN"],
  ["+", "", "op"],
  ["Corrección río arriba (11 km)", "0,50 m"],
  ["=", "", "op"],
  ["Superficie de agua equivalente", "13,92 m IGN", "total"],
])}
${CORTE_SVG}
        <p>
          Lo que a una persona le sirve no es «cuánta agua hay hoy» sino
          <b>«¿qué tendría que marcar el hidrómetro para que el agua llegue a
          la altura de mi terreno?»</b>. Es la misma cuenta despejada.
        </p>`,
    },
  ],
  sueltos: [
    `      <section class="bloque ejemplo">
        <div class="ej-cabeza">
          <span class="eti">Ejemplo · Colastiné Norte</span>
          <span class="eti">11 km río arriba</span>
        </div>
        <ol class="ej-filas">
${[
  filaEjemplo({
    n: 1,
    titulo: "La altura de tu terreno, en metros IGN",
    html: `              <p>Entre dos curvas, medio metro por debajo, por las dudas: es el <b>escenario pesimista</b>, el número con el que hay que decidir.</p>`,
    valor: "15,80 → 15,30",
  }),
  filaEjemplo({
    n: 2,
    titulo: "Restar el cero del hidrómetro: 8,42 m",
    html: `              <p>Pasa tu terreno a la escala del hidrómetro. El INA midió 8,378: son 4 cm de diferencia entre fuentes oficiales. <a href="#abiertas">De dónde sale el 8,42</a>.</p>`,
    valor: "− 8,42 = 6,88",
    /* 15,30 − 8,4214 − 0,50 = 6,38. */
  }),
  filaEjemplo({
    n: 3,
    titulo: "Restar el desnivel río arriba: 0,045 m por km",
    html: `              <p>El río no es una pileta: río arriba el agua está más alta. 11 × 0,045 = 0,495, que redondeamos a 0,50.</p>`,
    valor: "− 0,50 = 6,38",
  }),
].join("\n")}
        </ol>
      </section>`,
    /* El resultado en la banda oscura. El número grande va con la convención
       de la app (≈ y un decimal) y la cuenta exacta debajo: es la excepción
       de CLAUDE.md, «el desglose conserva la aritmética exacta». */
    `      <section class="bloque oscuro resultado">
        <p class="kicker">Resultado del ejemplo</p>
        <p class="dato-grande">≈ 6,4 m</p>
        <p class="cuenta-chica">15,30 − 8,42 − 0,50 = 6,38</p>
        <p>
          Cuando el hidrómetro del Puerto se acerque a <b>6,38 m</b>, el nivel
          de agua equivalente alcanza la cota de ese terreno según el modelo.
          <b>No significa que el terreno se inunde exactamente a ese nivel</b>:
          lo que pase depende de las defensas, del bombeo, del viento y de la
          lluvia, y nada de eso está en la cuenta.
        </p>
      </section>`,
    bloque({
      id: "firme",
      kicker: "4 · Qué tan firme es esto",
      titulo: "Lo que se comprobó, lo que está en discusión y lo que falta",
      /* El orden es deliberado: antes los subtítulos abrían en negativo y
         quien leía en diagonal se llevaba sólo eso. Primero lo comprobado,
         después lo que falta, con el MISMO peso: tres tarjetas iguales. No se
         sacó ni se suavizó una sola admisión. El razonamiento largo del cero
         va plegado y no borrado: la app enlaza acá («por qué usamos 8,42») y
         tiene que encontrar la respuesta entera.

         «Se comprobó» decía «la crecida de 1992: Arroyo Leyes, registrado,
         16,70 IGN; el modelo da 16,71». No estaba registrado: la nota de El
         Litoral que lo publica (13/7/2026) dice que «se estima», y lo calcula
         con la misma pendiente que usa la app. Coincidir con eso no prueba
         nada (AUDITORIA.md §3). Lo que sí se comprobó contra algo
         independiente es la altura del terreno: los 330 puntos fijos de §4,
         los mismos números que la sección 2 de esta página. */
      html: `        <p>Preferimos publicar nuestros supuestos antes de que los encuentre otro.</p>
        <div class="firme-tres">
          <div class="firme-caja f-ok">
            <span class="eti">Se comprobó</span>
            <h3>La altura del terreno</h3>
            <table class="cuenta">
              <tr><td>Puntos medidos por la Municipalidad</td><td>${MEDICION.n}</td></tr>
              <tr><td>La mitad, a menos de</td><td>${MEDICION.mitad}</td></tr>
              <tr><td>9 de cada 10, a menos de</td><td>${MEDICION.nueveDeDiez}</td></tr>
              <tr class="total"><td>El margen de medio metro alcanza en</td><td>${MEDICION.alcanza} de 100</td></tr>
            </table>
            <p class="chico">Casi siempre del lado seguro: las curvas dan el terreno más bajo de lo que es. Es la altura del <b>terreno</b>; la del <b>agua</b> río arriba del Puerto no se pudo comprobar con ninguna medición.</p>
          </div>
          <div class="firme-caja f-discusion" id="abiertas">
            <span class="eti">En discusión</span>
            <h3>Dos números sin cerrar</h3>
            <p><b>El cero: 8,42, con una duda.</b> Sale de la nota de Vías Navegables (8,9524 en el sistema del ex MOP) pasada al sistema del IGN; el INA midió 8,378 en 2016. Falta saber en qué sistema de alturas están las curvas del municipio.</p>
            <p><b>La pendiente: 0,045 m/km.</b> No hay una medición que la respalde, y usamos un solo valor para todas las zonas. La cifra de ${RECORD_ANIO} que circula para Arroyo Leyes se calculó con esta misma pendiente: coincidir con ella no prueba nada.</p>
            <details class="h-detalle">
              <summary>De dónde sale cada uno</summary>
              <p class="chico">
                <b>El cero.</b> Hasta el 26 de octubre de 2026 usábamos 8,20:
                la diferencia que sale del Reglamento de Edificaciones de San
                José del Rincón
                (<span class="cita">16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)</span>),
                que repite la prensa. Ningún organismo lo respalda: en la nota
                del 23/7/2018 (expediente 01801-0049664-3, Ministerio de
                Infraestructura y Transporte de Santa Fe) la Subsecretaría de
                Puertos y Vías Navegables, que mantiene la escala, aclara que
                el 8,19 «no es un valor brindado por este organismo» y da el
                cero de la escala: +8,9524 en el sistema del ex Ministerio de
                Obras Públicas. El IGN publica que el pasaje de ese sistema al
                suyo es H<sub>IGN</sub> = H<sub>MOP</sub> − 0,531 m:
                8,9524 − 0,531 = <b>8,4214</b>. El INA midió 8,378 con el IGN en
                diciembre de 2016, y la propia nota usa un desnivel de 0,556
                que da 8,3964: los tres valores quedan a 4 cm. Lo que sigue
                abierto es que las curvas del municipio no declaran su sistema
                de alturas, y el 0,531 está medido en el Riachuelo, no en Santa
                Fe. Si las curvas estuvieran en un sistema anterior, 8,42 haría
                avisar hasta unos 20 cm antes: queda del lado seguro.
              </p>
              <p class="chico">
                <b>La pendiente.</b> El reglamento de Rincón, 16 km río arriba,
                convierte cota a hidrómetro sin ninguna corrección por
                distancia; con la pendiente de la app serían 72 cm más. O el
                reglamento simplifica, o la pendiente real en ese tramo es otra:
                depende del tramo, del caudal y de la condición hidráulica del
                momento.
              </p>
              <p class="chico">
                <b>Y por qué ${RECORD_ANIO} no la confirma.</b> La nota de prensa
                que publica la cota de Arroyo Leyes en ${RECORD_ANIO} —16,70
                IGN— dice que «se estima», y la saca de ${RECORD_M} m en el
                Puerto más 24 km a 4,5 cm por km. Es la misma cuenta que hace
                la app. Para cerrarla hace falta una sola cota del agua
                <b>medida</b> río arriba del Puerto, en ${RECORD_ANIO} o en 2016.
              </p>
            </details>
          </div>
          <div class="firme-caja f-falta">
            <span class="eti">Falta</span>
            <h3>Que lo revisen especialistas</h3>
            <p>Ningún organismo ni universidad revisó este modelo. Nadie lo aprobó.</p>
            <p class="chico">Hasta que lo revisen —Gestión de Riesgos, INA, FICH-UNL, Recursos Hídricos— lo que la app publica son <b>niveles de referencia estimados</b>, y así están nombrados en toda la interfaz. Cota Cero no tiene vínculo con esos organismos ni cuenta con su aval.</p>
          </div>
        </div>
        ${selloFuente("altimetria", "ceros de escala y sistema de alturas")}`,
    }),
    /* La app enlaza acá desde Mi casa («Qué no dice este número»): el ancla
       #no-dice no se puede mover. */
    bloque({
      id: "no-dice",
      titulo: "Hay dos maneras de inundarse. Cota Cero mira una sola.",
      html: `        <p>
          Un barrio puede tener margen amplio contra el Paraná y entrar en
          emergencia igual, por lluvia. El modelo tampoco sabe si entre el río y
          tu casa hay un terraplén, ni en qué estado está.
        </p>
        <div class="dos-maneras">
          <div class="dm-caja dm-fluvial">
            <span class="eti">Fluvial · lo que mira</span>
            <h3>Crece el río</h3>
            <p>El Paraná sube durante semanas y se ve venir en el hidrómetro. Es lo que traduce tu nivel de aviso.</p>
          </div>
          <div class="dm-caja dm-pluvial">
            <span class="eti">Pluvial · lo que no</span>
            <h3>Llueve sobre la ciudad</h3>
            <p>Mucha lluvia en pocas horas, o varios días seguidos, anegan calles y casas por los desagües, sola o combinada con el Salado. Puede pasar con el río bajo.</p>
          </div>
          <div class="dm-caja dm-juntan">
            <span class="eti">Cuando se juntan</span>
            <h3>Río alto + lluvia</h3>
            <p>Con el río alto las bombas no pueden desagotar contra el agua de afuera. El municipio planifica para <b>río en 6 m más lluvia de 200 a 300 mm</b>.</p>
          </div>
        </div>
        <p class="chico">
          Y una defensa protege mientras funciona: en 2003 el agua entró por un
          tramo abierto de una defensa existente. Que haya obra no es garantía.
          Más dudas de este tipo, contestadas cortas, en
          <a href="/preguntas">preguntas frecuentes</a>.
        </p>
        ${selloFuente("emergencias", "Plan de Contingencia")}`,
    }),
    bloque({
      oscuro: true,
      titulo: "Lo que todavía no sabe",
      html: `        <ul class="no-sabe">
          <li><b>En qué sistema de alturas están las curvas.</b> Los metadatos no lo declaran, y de eso depende si el cero de 8,42 corresponde a ellas o hay que corregirlo.</li>
          <li><b>Si la pendiente vale en todos los tramos.</b> Está contrastada en un punto de una crecida.</li>
          <li><b>Cuánto se equivoca la cota en tu cuadra.</b> Medido contra ${MEDICION.n} puntos del municipio, el medio metro alcanza en ${MEDICION.alcanza} de cada 100. En un pozo o una bajada que la curva no dibuja puede no alcanzar.</li>
          <li><b>Los km río arriba de cada zona.</b> Sólo Arroyo Leyes (24 km) está publicado. Equivocarse 5 km son 22 cm.</li>
          <li><b>En qué estado está la defensa de tu zona.</b> Cambia el resultado más que cualquiera de las constantes.</li>
          <li><b>Nada sobre la lluvia sobre tu barrio.</b> El agua puede llegar antes por el desagüe que por el río.</li>
        </ul>
        <p class="chico">
          Cuando no sabemos algo con precisión suficiente, preferimos decirlo
          antes que rellenar el hueco con un número que parezca firme.
        </p>`,
    }),
    bloque({
      id: "fuentes",
      kicker: "5 · Las fuentes",
      titulo: "Cada dato, con su enlace",
      html: `        <p>
          Todo lo que muestra la app sale de acá. Cada ficha lleva la página del
          organismo y el dato crudo, tal como lo pide la app.
        </p>
        <div class="fuentes-rejilla">
${[
  "nivelRio",
  "topografia",
  "topografiaCosta",
  "emergencias",
  "altimetria",
  "historia",
  "cartografia",
]
  .map(tarjetaFuente)
  .join("\n")}
        </div>
        <details class="h-detalle" style="margin-top:22px">
          <summary>Investigación, antecedentes y normativa</summary>
          <p class="chico">
            No aportan ningún número al cálculo: explican el contexto.
          </p>
          <ul class="pasos">
            <li><b>${esc(ORGANISMOS.fich.nombre)}</b> — ${esc(ORGANISMOS.fich.que)}
              Es la institución natural para revisar este modelo.
              <a href="${ORGANISMOS.fich.url}" target="_blank" rel="noopener">Ver</a></li>
${NORMATIVA.map(
  (n) =>
    `            <li><b>${esc(n.n)}</b> — ${esc(n.que)} <a href="${n.url}" target="_blank" rel="noopener">Ver</a></li>`,
).join("\n")}
          </ul>
          <p class="chico">
            La prensa se usa para contexto histórico o para llegar a una fuente
            primaria, nunca para un número del cálculo: si una nota cita a un
            especialista o a un documento, buscamos el original.
          </p>
        </details>`,
    }),
  ],
});

export {
  CORTE_SVG,
  ESCALA_DECISION,
  RECORD_ANIO,
  RECORD_M,
  cuentaVertical,
  filaEjemplo,
  htmlDatos,
  recordHist,
};
