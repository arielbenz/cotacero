// scripts/paginas/hidrometro.js — /hidrometro. La escribe emitir.js.

import { ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import { SITIO, historia, pagina } from "./base.js";

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
const sobreMar = (v) => "≈ " + nm(Math.round((v + CERO) * 10) / 10, 1) + " m";

/* Una tabla y no una ficha: con «en la regla» y «sobre el mar» escritos en
   cada fila, a 390 px el número se separaba de su unidad. */
const fila = (nombre, v) =>
  `            <tr><td>${nombre}</td><td class="n">${nm(v, 2)} m</td><td>${sobreMar(v)}</td></tr>`;

const htmlHidrometro = pagina({
  clave: "hidrometro",
  migaja: "El hidrómetro",
  h1: "Qué mide el hidrómetro del Puerto de Santa Fe",
  lead:
    "Cuando se dice que el río está en 5 metros, es lo que marca esta regla. " +
    "<b>No es la profundidad del río ni su altura sobre el mar.</b>",
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
      html: `        <p>
          El hidrómetro es una regla graduada en el Dique 2 del Puerto de Santa
          Fe. La lee <b>Prefectura Naval</b> y el <b>INA</b> guarda sus
          lecturas${historia ? ` desde el ${enPalabras(historia.desde)}` : ""}.
        </p>
        <p>
          Lo que en los diarios aparece como «la altura del río» o «la cota del
          río» —y que en la app de Cota Cero se llama el nivel del río— es lo que
          marca esa regla. Son tres nombres para el mismo número.
        </p>
        <div class="ficha-estacion">
          <div><span class="k">Estación</span><span class="v">${ESTACION.descripcion}</span></div>
          <div><span class="k">Río</span><span class="v">${ESTACION.rio}</span></div>
          <div><span class="k">Quién la lee</span><span class="v">${ESTACION.propietario}</span></div>
          <div><span class="k">Quién la publica</span><span class="v">INA, serie n.º ${ESTACION.serieId}</span></div>
        </div>`,
    },
    {
      id: "cero",
      titulo: "Cuenta desde su propio cero",
      html: `        <p>
          Los metros del hidrómetro se cuentan desde el <b>cero de la regla</b>,
          que está a unos <b>${nm(CERO, 2)} m sobre el nivel del mar</b>, en
          metros IGN: los mismos de los planos y las escrituras.
        </p>
        <p>
          Por eso no es la profundidad${
            MINIMO
              ? `: en la bajante de ${MINIMO[4].slice(0, 4)} la regla marcó
          <b>${nm(MINIMO[3], 2)} m</b>, por debajo de su cero, y el río seguía
          ahí`
              : ""
          }. Y tampoco es la altura sobre el mar: para eso hay que sumarle el
          cero. Esa suma es la «cota» del agua, y es la que se compara con la
          de un terreno.
        </p>
        <table class="cuenta">
          <thead><tr><th></th><th scope="col">En la regla</th><th scope="col">Sobre el mar</th></tr></thead>
          <tbody>
${fila("Alerta de la ciudad", ESTACION.alerta)}
${fila("Evacuación de la ciudad", ESTACION.evacuacion)}
${RECORD ? fila("Récord, " + RECORD[2].slice(0, 4), RECORD[1]) + "\n" : ""}${MINIMO ? fila("La más baja, " + MINIMO[4].slice(0, 4), MINIMO[3]) + "\n" : ""}          </tbody>
        </table>
        <p class="chico">
          Entre fuentes oficiales el cero varía unos centímetros (el INA midió
          8,378), por eso la altura sobre el mar va con un decimal.
          <a href="/datos#abiertas">De dónde sale el ${nm(CERO, 2)}</a>.
          Las mayores crecidas, año por año, están en
          <a href="/historia">cien años del Paraná</a>.
        </p>`,
    },
    {
      id: "horarios",
      titulo: "Por qué Prefectura y el INA no dicen lo mismo",
      html: `        <p>
          Prefectura lee la regla <b>cada 12 horas</b>, a las 00:00 y a las
          12:00, y publica cada lectura. El INA guarda <b>una por día</b>, la de
          las 00:00, y es la que muestra Cota Cero. Los diarios citan una u otra.
        </p>
        <p>
          Un ejemplo: el 29 de octubre de 2026, Prefectura mostraba 4,25 m de
          las 00:00 de ese día y 4,24 m de las 12:00 del anterior; el INA,
          4,23 m de las 00:00 del 28. No se contradicen: son lecturas de horas
          distintas. Por eso cada número, acá y en la app, va con su fecha.
        </p>`,
    },
    {
      oscuro: true,
      titulo: "La regla no sabe dónde está tu casa",
      html: `        <p>
          El mismo número del hidrómetro no significa lo mismo en cada barrio:
          depende de la altura de tu terreno y de cuántos kilómetros río arriba
          esté. Cota Cero hace esa cuenta con tu dirección y te da tu nivel de
          aviso: el nivel del río a partir del cual el agua puede llegar a tu
          terreno. Es un cálculo aproximado. ${
            /* Sin botón: pagina() ya cierra con «Abrir Cota Cero». */ ""
          }<a href="/">La altura del río hoy, en la portada</a>.
        </p>`,
    },
  ],
});

export {
  htmlHidrometro,
};
