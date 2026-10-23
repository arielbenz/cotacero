// scripts/marca.js — la marca, en un solo lugar.
//
// Marca 1a del canvas de diseño: un cero partido por la línea del agua. El
// círculo es el cero del hidrómetro; la mitad de abajo, llena, es el agua; la
// línea horizontal que lo cruza es el nivel. Es literalmente lo que hace la
// app, y funciona a 24 px y en una sola tinta.
//
// La arman de acá scripts/iconos.js (los PNG) y scripts/paginas/base.js (las
// páginas generadas, con marcaSvg()). El HTML a mano —la portada, la app y el
// widget— lleva sus copias, con su tamaño y su color; scripts/paginas/emitir.js
// las compara contra este dibujo y falla si alguna difiere. Si se cambia el
// dibujo, se cambia acá, se regenera, y el generador dice qué copias a mano
// quedaron viejas.

/* El dibujo, en la grilla de 60: el corte del agua, el anillo y la línea. */
const CORTE = 33;
const RADIO = 21;
const ANILLO = 7;
const LINEA = 4.5;

/* `id` tiene que ser único por documento: dos clipPath con el mismo id hacen
   que el navegador use el primero para los dos. `etiqueta` vacía es una marca
   decorativa (aria-hidden), al lado de un nombre que ya se lee; con texto, es
   una imagen con nombre. `sangria` y `cierre` son la indentación de los
   renglones de adentro y del </svg>, para que quede prolija donde se pegue. */
export function marca({
  id = "m",
  tam = 30,
  trazo = "#16242c",
  agua = "#1779a3",
  etiqueta = "Cota Cero",
  sangria = "  ",
  cierre = "",
} = {}) {
  const accesible = etiqueta
    ? `role="img" aria-label="${etiqueta}"`
    : 'aria-hidden="true"';
  // El orden importa. En el SVG original el agua llevaba relleno Y trazo del
  // mismo color, así que por debajo de la línea tapaba el anillo y la marca
  // se leía como una canasta. Acá el agua rellena sólo el interior y el
  // anillo se dibuja encima, entero: queda un cero con agua adentro.
  return [
    `<svg width="${tam}" height="${tam}" viewBox="0 0 60 60" ${accesible}>`,
    `${sangria}<defs><clipPath id="${id}"><rect x="0" y="${CORTE}" width="60" height="${60 - CORTE}"/></clipPath></defs>`,
    `${sangria}<circle cx="30" cy="30" r="${RADIO}" fill="${agua}" clip-path="url(#${id})"/>`,
    `${sangria}<circle cx="30" cy="30" r="${RADIO}" fill="none" stroke="${trazo}" stroke-width="${ANILLO}"/>`,
    `${sangria}<line x1="2" y1="${CORTE}" x2="58" y2="${CORTE}" stroke="${trazo}" stroke-width="${LINEA}" stroke-linecap="round"/>`,
    `${cierre}</svg>`,
  ].join("\n");
}

/* La geometría de una copia, sin lo que puede variar con el contexto —el
   tamaño, los colores, el id, el formato—: las figuras en orden, con sus
   números. Dos copias del mismo dibujo dan el mismo texto. */
const GEOMETRICOS = [
  "x", "y", "width", "height", "cx", "cy", "r",
  "x1", "y1", "x2", "y2", "stroke-width", "stroke-linecap",
];
export function geometriaDe(svg) {
  return [...svg.matchAll(/<(rect|circle|line)\b([^>]*?)\/?>/g)]
    .map(([, figura, atributos]) => {
      const a = Object.fromEntries(
        [...atributos.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
      );
      return figura + " " + GEOMETRICOS.filter((k) => k in a).map((k) => `${k}=${a[k]}`).join(" ");
    })
    .join(" | ");
}

export const GEOMETRIA = geometriaDe(marca());
