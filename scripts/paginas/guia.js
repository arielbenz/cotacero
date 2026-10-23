// scripts/paginas/guia.js — /guia, la hoja para imprimir. La escribe emitir.js.

import { ESTACION } from "../../public/lib/fuentes.js";
import { nm } from "../../public/lib/comun.js";
import { MOCHILA, PREVIA } from "../../public/lib/listas.js";
import { esc, marcaSvg, pagina } from "./base.js";

/* ---------- /guia: la hoja para imprimir ----------
   Es lo contrario del plan que imprime la app: ésta sale EN BLANCO, con
   renglones y casillas, para llenar con birome. El público es el que la app no
   alcanza —quien no tiene teléfono, o lo tiene y nunca cargó nada—, y el
   camino es que alguien la imprima en el centro vecinal y la reparta.

   Las dos listas salen de public/lib/listas.js, las MISMAS que usa la app: si mañana
   se agrega algo a la mochila, aparece acá solo. Los teléfonos también son los
   verificados del proyecto, no una lista nueva.

   Entra en UNA carilla A4 y eso no es estética: fotocopiar cien de dos
   carillas es el doble de plata. `node scripts/guia-pdf.js` lo verifica y
   avisa si se pasó. */
const renglones = (n) =>
  Array.from({ length: n }, () => '<span class="g-linea"></span>').join("");

const casillas = (lista) =>
  lista
    .map(
      ([texto, municipal]) =>
        `<li><span class="g-caja"></span><span${municipal ? ' class="g-muni"' : ""}>${esc(texto)}</span></li>`,
    )
    .join("\n          ");

/* Los cinco que entran y sirven en una crecida. Los siete completos están en
   la app y en /puntos-de-encuentro. */
const TELEFONOS_GUIA = [
  ["Defensa Civil", "103"],
  ["Emergencias", "911"],
  ["Bomberos", "100"],
  ["Prefectura (emergencias náuticas)", "106"],
  ["Municipalidad", "0800-777-5000"],
];

const htmlGuia = pagina({
  clave: "guia",
  migaja: "Guía de emergencia",
  css: "/css/guia.css",
  h1: "Guía de emergencia por crecida",
  lead:
    "Una hoja para llenar a mano y pegar en la heladera. Imprimila, completala " +
    "con la familia y dejala donde todos la vean. No necesita señal ni batería.",
  acciones: `        <p class="pg-acciones">
          <a class="btn" href="/guia.pdf" download>Descargar el PDF</a>
        </p>`,
  bloques: [
    {
      html: `        <div class="guia-hoja">
        <header class="g-cab">
          <div class="g-marca">
            ${marcaSvg("mg")}
            <div>
              <b>Guía de emergencia por crecida</b>
              <span class="g-familia">Familia <span class="g-linea g-larga"></span></span>
            </div>
          </div>
          <a class="g-103" href="tel:103"><span>Defensa Civil</span><b>103</b></a>
        </header>

        <section class="g-umbral">
          <span class="g-eti">Nuestro nivel de aviso <em>(lo dice la app, en «Mi casa»)</em></span>
          <p class="g-frase">
            Nos preparamos y salimos cuando el río llegue a
            <span class="g-linea g-media"></span> m, o cuando lo indique
            Defensa Civil — lo que pase primero.
          </p>
          <p class="g-chico">
            Alerta de la ciudad ${nm(ESTACION.alerta, 2)} m · evacuación
            ${nm(ESTACION.evacuacion, 2)} m. Es un cálculo aproximado y mide
            sólo el río: con mucha lluvia, la calle puede anegarse antes.
          </p>
        </section>

        <div class="g-cols">
          <div>
            <h2 class="g-h">Nos encontramos en</h2>
            <p class="g-campo">Punto principal: <span class="g-linea"></span></p>
            <p class="g-campo">Si no se puede: <span class="g-linea"></span></p>
            <p class="g-chico">
              Los puntos oficiales abren cuando el municipio los activa:
              confirmá al 103 antes de salir.
            </p>

            <h2 class="g-h">Teléfonos</h2>
            ${
              /* Dos renglones en blanco arriba de la lista fija: el teléfono
                 que importa en una crecida suele ser el de un familiar de otro
                 barrio, no el de un organismo. Sin la bajada nadie sabe qué
                 escribir ahí y quedan vacíos. */ ""
            }
            <p class="g-campo g-sub">Un familiar o vecino fuera de la zona:</p>
            <p class="g-campo">${renglones(2)}</p>
            <table class="g-tel">
${TELEFONOS_GUIA.map(([q, n]) => `              <tr><td>${esc(q)}</td><td>${esc(n)}</td></tr>`).join("\n")}
            </table>

            <h2 class="g-h">Quién hace qué</h2>
            <p class="g-campo">${renglones(3)}</p>

            <h2 class="g-h">Si tenemos que salir</h2>
            <ul class="g-reglas">
              <li><b>No cruzar agua que corre</b>, ni a pie ni en auto.</li>
              <li>30 cm —menos que una rodilla— arrastran a una persona.</li>
              <li>60 cm —por la cintura de un chico— arrastran un auto.</li>
              <li>Cortar la luz y el gas. Llevar esta hoja.</li>
            </ul>
          </div>

          <div>
            <h2 class="g-h">Mochila de emergencia</h2>
            <ul class="g-lista">
          ${casillas(MOCHILA)}
            </ul>

            <h2 class="g-h">En la casa, antes</h2>
            <ul class="g-lista">
          ${casillas(PREVIA)}
            </ul>
            <p class="g-chico g-sello">
              ● Los renglones marcados están en el Plan de Contingencia de la
              Municipalidad de Santa Fe. El resto lo agregamos nosotros.
            </p>
          </div>
        </div>

        <footer class="g-pie">
          <span>Cota Cero es una herramienta ciudadana que ayuda a interpretar
          información pública. El nivel de aviso es un cálculo aproximado; la
          orden de evacuación la da Defensa Civil. Nivel diario del río: reporte
          del INA.</span>
          <b>cotacerosf.com</b>
        </footer>
      </div>`,
    },
  ],
});

export {
  TELEFONOS_GUIA,
  casillas,
  htmlGuia,
  renglones,
};
