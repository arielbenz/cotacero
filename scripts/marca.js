// scripts/marca.js — la marca, en un solo lugar.
//
// Marca 1a del canvas de diseño: un cero partido por la línea del agua. El
// círculo es el cero del hidrómetro; la mitad de abajo, llena, es el agua; la
// línea horizontal que lo cruza es el nivel. Es literalmente lo que hace la
// app, y funciona a 24 px y en una sola tinta.
//
// Lo usan scripts/paginas.js (cabecera de las páginas) y scripts/iconos.js
// (rasterizado a PNG). El HTML de la landing y de la app llevan el mismo SVG
// escrito a mano; si cambia acá, hay que cambiarlo allá.

/* `id` tiene que ser único por documento: dos clipPath con el mismo id hacen
   que el navegador use el primero para los dos. */
export function marca({
  id = "m",
  tam = 30,
  trazo = "#16242c",
  agua = "#1779a3",
} = {}) {
  // El orden importa. En el SVG original el agua llevaba relleno Y trazo del
  // mismo color, así que por debajo de la línea tapaba el anillo y la marca
  // se leía como una canasta. Acá el agua rellena sólo el interior y el
  // anillo se dibuja encima, entero: queda un cero con agua adentro.
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 60 60" role="img" aria-label="Cota Cero">
  <defs><clipPath id="${id}"><rect x="0" y="33" width="60" height="27"/></clipPath></defs>
  <circle cx="30" cy="30" r="21" fill="${agua}" clip-path="url(#${id})"/>
  <circle cx="30" cy="30" r="21" fill="none" stroke="${trazo}" stroke-width="7"/>
  <line x1="2" y1="33" x2="58" y2="33" stroke="${trazo}" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;
}

/* Marca + nombre, que es como aparece en las cabeceras. */
export function lockup({
  id = "m",
  tam = 30,
  trazo = "#16242c",
  agua = "#1779a3",
} = {}) {
  return `<span class="lockup">${marca({ id, tam, trazo, agua })}<span class="lockup-nombre">Cota Cero</span></span>`;
}
