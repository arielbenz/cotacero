// scripts/paginas/hidrometro.js — /hidrometro. La escribe emitir.js.

import { ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import { SITIO, historia, pagina, selloFuente } from "./base.js";

/* ---------- /hidrometro ----------
   Qué es el número que todos llaman «la altura del río». Search Console (28
   días al 27/10/2026): «cota del río paraná» y «cota rio parana», 171
   impresiones; «hidrómetro río paraná», 57; «qué es la cota de un río», 14;
   «cómo se mide la altura del río paraná», 8. Iban a la portada, que no lo
   explica, o a una pregunta plegada de /preguntas, que se mudó acá para que
   las dos no compitan.

   Las palabras: la interfaz le dice «nivel del río» y reserva «altura» para
   el terreno (CLAUDE.md, «Tres conceptos»). Esta página existe para quien
   busca con las otras palabras, así que las nombra una vez y las traduce.

   Cada número sale de una fuente: los umbrales de ESTACION, el récord y el
   mínimo de historia.json (serie 30 del INA). El cero va escrito como en
   /datos —config.js no se puede importar desde acá— y es CERO_IGN de
   js/app/config.js redondeado: si cambia, se cambia en los dos. Lo de
   Prefectura y sus 12 horas se comprobó en su tabla el 29/10/2026 (columna
   «Periodo: 12»; 4,25 m a las 00:00 del 29 y 4,24 m a las 12:00 del 28),
   con el INA en 4,23 m a las 00:00 del 28. */
const CERO = 8.42;

const MESES =
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(
    " ",
  );
const enPalabras = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
};

/* [anio, max, fecha_max, min, fecha_min, …], como en /historia. Sin
   historia.json la página sale igual, sin esas dos filas. */
const ANIOS = historia ? historia.anios : [];
const RECORD = ANIOS.length
  ? ANIOS.reduce((a, b) => (b[1] > a[1] ? b : a))
  : null;
const MINIMO = ANIOS.length
  ? ANIOS.reduce((a, b) => (b[3] < a[3] ? b : a))
  : null;

/* Un decimal sobre el mar: entre fuentes oficiales el cero varía 4 cm
   (8,378 a 8,4214, AUDITORIA.md §1), y el segundo decimal sería inventado. */
const mar1 = (v) => nm(Math.round((v + CERO) * 10) / 10, 1);
/* El signo menos y no el guion: «-0,23» se lee «guion cero coma veintitrés». */
const conSigno = (t) => t.replace(/^-/, "−");
const regla2 = (v) => conSigno(nm(v, 2));

/* Las marcas de la página, en el orden de la regla. Sin historia.json se caen
   el récord y el mínimo, y el dibujo y la tabla salen igual sin esas dos. */
const MARCAS = [
  RECORD && { clave: "record", nombre: "Récord, " + RECORD[2].slice(0, 4), v: RECORD[1] },
  { clave: "evac", nombre: "Evacuación de la ciudad", v: ESTACION.evacuacion },
  { clave: "alerta", nombre: "Alerta de la ciudad", v: ESTACION.alerta },
  { clave: "cero", nombre: "Cero de la regla", v: 0 },
  MINIMO && { clave: "minimo", nombre: "La más baja, " + MINIMO[4].slice(0, 4), v: MINIMO[3] },
].filter(Boolean);

/* ---------- el dibujo de la regla ----------
   La idea de la página es espacial —se cuenta desde un cero que está a 8,42 m
   sobre el mar— y escrita costaba dos párrafos. Es la regla de la app y de la
   portada, quieta y sin agua: no hay dato del día en una página estática, y
   un agua dibujada a cualquier altura se leería como el río de hoy.

   SVG en el HTML, sin JavaScript: anda sin conexión y lo emite el generador
   con los mismos números que la tabla. Los colores son las variables del
   tema, así que sigue al oscuro solo. La tabla de abajo es la versión que lee
   un lector de pantalla; el dibujo lleva un resumen en `aria-label`.

   Escala: 30 px por metro de −1 a 8 m. Lo que hay entre el cero y el mar
   (8,42 m) no entra a escala: va cortado, y la medida se escribe. */
const PX = 30;
const ARRIBA = 40;
/* Redondeada: sin esto el HTML llevaba «127.00000000000001». */
const y = (v) => Math.round((ARRIBA + (8 - v) * PX) * 100) / 100;
const ANCHO = 340;
const Y_CORTE = y(-1) + 22;
const Y_MAR = Y_CORTE + 34;
const ALTO = Y_MAR + 22;

/* Alerta y evacuación quedan a 12 px una de otra: una etiqueta va arriba de
   su línea y la otra abajo. Lo mismo el cero y el mínimo. */
const ABAJO = new Set(["alerta", "minimo"]);

function dibujoRegla() {
  const marcas = [];
  for (let d = -10; d <= 80; d++) {
    const v = d / 10;
    const largo = d % 10 === 0 ? 18 : d % 5 === 0 ? 11 : 6;
    marcas.push(
      `<line class="marca${d % 10 === 0 ? "" : " chica"}" x1="40" x2="${40 + largo}" y1="${y(v)}" y2="${y(v)}"/>`,
    );
  }
  const numeros = [];
  for (let v = -1; v <= 8; v++)
    numeros.push(
      `<text class="k mono" x="34" y="${y(v) + 4}" text-anchor="end">${conSigno(String(v))}</text>`,
    );
  const lineas = MARCAS.map((mk) => {
    const yy = y(mk.v);
    const ty = ABAJO.has(mk.clave) ? yy + 17 : yy - 6;
    return (
      `<line class="l-${mk.clave}" x1="40" x2="${ANCHO - 4}" y1="${yy}" y2="${yy}"/>` +
      `<text class="t-${mk.clave}" x="66" y="${ty}">${mk.nombre} · <tspan class="mono">${regla2(mk.v)}</tspan></text>` +
      `<text class="k mono" x="${ANCHO - 4}" y="${ty}" text-anchor="end">${mar1(mk.v)}</text>`
    );
  });
  const resumen =
    `La regla del hidrómetro, de −1 a 8 metros. Su cero está a unos ${nm(CERO, 2)} m sobre el mar. ` +
    MARCAS.map((mk) => `${mk.nombre}: ${regla2(mk.v)} m en la regla, unos ${mar1(mk.v)} m sobre el mar.`).join(" ");
  return `        <svg class="regla-svg" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${resumen}">
          <text class="k" x="4" y="16">En la regla (m)</text>
          <text class="k" x="${ANCHO - 4}" y="16" text-anchor="end">Sobre el mar (m)</text>
          <rect class="cuerpo" x="40" y="${y(8)}" width="18" height="${9 * PX}"/>
          ${marcas.join("")}
          ${numeros.join("")}
          ${lineas.join("\n          ")}
          <path class="corte" d="M30 ${Y_CORTE - 4} l8 -6 l8 6 l8 -6 l8 6 M30 ${Y_CORTE + 4} l8 -6 l8 6 l8 -6 l8 6"/>
          <text class="k" x="66" y="${Y_CORTE + 4}">${nm(CERO, 2)} m más abajo, fuera de escala</text>
          <line class="l-mar" x1="30" x2="${ANCHO - 4}" y1="${Y_MAR}" y2="${Y_MAR}"/>
          <text class="t-mar" x="66" y="${Y_MAR + 16}">Nivel del mar</text>
          <text class="k mono" x="${ANCHO - 4}" y="${Y_MAR + 16}" text-anchor="end">0</text>
        </svg>`;
}

/* La tabla con los mismos números: es lo que lee un lector de pantalla, lo que
   indexa un buscador y lo que se copia. Va plegada debajo del dibujo para no
   decir lo mismo dos veces a la vista. */
const filaTabla = (mk) =>
  `              <tr><th scope="row">${mk.nombre}</th><td class="n">${regla2(mk.v)} m</td><td>≈ ${mar1(mk.v)} m</td></tr>`;

const htmlHidrometro = pagina({
  clave: "hidrometro",
  migaja: "El hidrómetro",
  h1: "Qué mide el hidrómetro del Puerto de Santa Fe",
  /* La respuesta entera arriba, con la palabra con la que más se llega desde
     Google («cota del río paraná», 171 impresiones en 28 días). */
  lead:
    "Lo que los diarios llaman la altura o la cota del río es lo que marca " +
    "una regla en el Puerto, <b>contada desde su propio cero</b>, que está a " +
    "unos " +
    nm(CERO, 2) +
    " m sobre el mar. No es la profundidad del río ni su altura sobre el mar.",
  /* Quien buscó «cota del río» casi seguro quería el número de hoy, y la
     página no lo lleva a propósito: se le dice dónde está, arriba. */
  acciones: `        <p class="chico">¿Buscás el nivel de hoy? Está en la barra de arriba, con su fecha, y en <a href="/">la portada</a>.</p>`,
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Qué mide el hidrómetro del Puerto de Santa Fe",
    inLanguage: "es-AR",
    mainEntityOfPage: SITIO + "/hidrometro",
    author: { "@type": "Person", name: "Ariel Benz", url: "https://arielbenz.com" },
  },
  bloques: [
    {
      id: "regla",
      titulo: "Una regla en el Puerto, leída por Prefectura",
      /* Las dos acepciones de «cota», juntas y acá, donde aparece la palabra.
         Estaban a una pantalla de distancia y el lector las conciliaba solo. */
      html: `        <p>
          El hidrómetro es una regla graduada en el Dique 2 del Puerto de Santa
          Fe. La lee <b>Prefectura Naval</b> y el <b>Instituto Nacional del Agua
          (INA)</b> guarda sus lecturas${historia ? ` desde el ${enPalabras(historia.desde)}` : ""}.
        </p>
        <p>
          Los diarios dicen «la altura del río» o «la cota del río», y en la app
          de Cota Cero se llama el nivel del río: es lo que marca esa regla. Ojo
          con «cota»: en los planos y las escrituras es otra cosa, <b>la altura
          sobre el mar</b>, en metros del Instituto Geográfico Nacional (IGN).
          La del agua es lo que marca la regla más su cero.
        </p>
        ${selloFuente("nivelRio", "serie " + ESTACION.serieId + ", altura hidrométrica")}`,
    },
    {
      id: "cero",
      titulo: "Cuenta desde su propio cero",
      /* El dibujo primero: es lo que explica la página, y abajo de dos párrafos
         quedaba en la segunda pantalla y media del teléfono. En escritorio va
         al lado del texto (.regla-y-texto).

         El último párrafo existe porque la columna «sobre el mar» invita a
         comparar la escritura contra ella. Esa cuenta se saltea el margen de
         la altura y el desnivel río arriba (umbralDe en modelo.js): en Arroyo
         Leyes, una cota de 14,2 daba «5,78» a mano y ≈ 3,7 en la app. Decía
         «es la que se compara con la de un terreno»; ya no. */
      html: `        <div class="regla-y-texto">
${dibujoRegla()}
          <div>
            <p>
              Los metros del hidrómetro se cuentan desde el <b>cero de la
              regla</b>, que está a unos <b>${nm(CERO, 2)} m sobre el nivel del
              mar</b>.
            </p>
            <p>
              Por eso no es la profundidad${
                MINIMO
                  ? `: en la bajante de ${MINIMO[4].slice(0, 4)} la regla marcó
              <b>${regla2(MINIMO[3])} m</b>, por debajo de su cero, y el río
              seguía ahí`
                  : ""
              }. Y tampoco es la altura sobre el mar: para eso hay que sumarle
              el cero. Es la columna de la derecha.
            </p>
            <p>
              Esa columna está en la misma escala que las escrituras, pero
              <b>no alcanza con comparar tu terreno contra ella</b>. Río arriba
              del Puerto, para la misma lectura de la regla, el agua está más
              alta, y la altura de un terreno tiene error. Esa cuenta, con su
              margen, la hace <a href="/app">la app de Cota Cero</a> con tu
              dirección.
            </p>
          </div>
        </div>
        <p class="chico">
          Entre fuentes oficiales el cero varía unos centímetros (el INA midió
          8,378), por eso la altura sobre el mar va con un decimal.
          <a href="/datos#abiertas">De dónde sale el ${nm(CERO, 2)}</a>.
          Las mayores crecidas, año por año, están en
          <a href="/historia">cien años del Paraná</a>.
        </p>
        <details class="h-detalle">
          <summary>Los mismos números, en una tabla</summary>
          <table class="cuenta">
            <thead><tr><td></td><th scope="col">En la regla</th><th scope="col">Sobre el mar</th></tr></thead>
            <tbody>
${MARCAS.map(filaTabla).join("\n")}
            </tbody>
          </table>
        </details>`,
    },
    {
      id: "horarios",
      titulo: "Por qué Prefectura y el INA no dicen lo mismo",
      /* Era una oración con tres lecturas y tres horas. Los números, todos
         comprobados: 4,24 (12:00 del 28) y 4,25 (00:00 del 29) en la tabla de
         Prefectura el 29/10/2026; 4,23 (00:00 del 28) en el INA esa mañana, y
         4,25 (00:00 del 29) en el INA el mismo día, en el log del build de la
         portada. Que las dos 00:00 coincidan muestra que es la misma regla. */
      html: `        <p>
          Prefectura lee la regla <b>cada 12 horas</b>, a las 00:00 y a las
          12:00, y publica cada lectura. El INA guarda <b>una por día</b>, la de
          las 00:00, y es la que muestra Cota Cero. Los diarios citan una u otra.
        </p>
        <table class="cuenta">
          <thead><tr><th scope="col">Lectura</th><th scope="col">Prefectura</th><th scope="col">INA</th></tr></thead>
          <tbody>
            <tr><th scope="row">28/10, 12:00</th><td class="n">4,24 m</td><td>no la guarda</td></tr>
            <tr><th scope="row">29/10, 00:00</th><td class="n">4,25 m</td><td>4,25 m</td></tr>
          </tbody>
        </table>
        <p>
          La mañana del 29,
          <a href="https://contenidosweb.prefecturanaval.gob.ar/alturas/" target="_blank" rel="noopener">la tabla de Prefectura</a>
          ya mostraba la lectura de las 00:00 y el INA todavía no la había
          publicado: seguía la del 28, 4,23 m. Más tarde esa mañana llegó la
          misma, 4,25 m. Es una sola regla; cambia la hora que se mira y cuándo se
          publica. Por eso cada número, acá y en la app, va con su fecha.
        </p>`,
    },
    {
      oscuro: true,
      titulo: "La regla no sabe dónde está tu casa",
      /* Sin botón: pagina() ya cierra con «Abrir Cota Cero». Y «nivel», no
         «altura»: en la voz propia «altura» es la del terreno; las palabras
         de los diarios van entre comillas, arriba. */
      html: `        <p>
          El mismo número del hidrómetro no significa lo mismo en cada barrio:
          depende de la altura de tu terreno y de cuántos kilómetros río arriba
          del Puerto esté. Cota Cero hace esa cuenta con tu dirección y te da tu
          nivel de aviso: el nivel del río a partir del cual el agua puede
          llegar a tu terreno. Es un cálculo aproximado.
        </p>`,
    },
  ],
});

export {
  htmlHidrometro,
};
