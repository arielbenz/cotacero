// scripts/serie-diaria.js — la forma de datos-abiertos/serie-diaria.json.
//
// No es un comando: lo importa scripts/historia.js, que ya baja la serie
// entera del INA y arma el mapa «día → nivel». De ese mismo mapa salen el
// resumen por año (historia.json) y este archivo, que guarda TODOS los días
// para /comparar. Así los dos no pueden contradecirse.
//
// La forma, pensada para que la lea cualquiera sin este código:
//
//   anios: { "1992": [ 366 números ] }
//
// Cada año son 366 casilleros, uno por día de un calendario bisiesto: el 1 de
// marzo cae siempre en el casillero 60, haya o no 29 de febrero. Eso permite
// poner un año arriba de otro sin correr las fechas. El valor va en
// CENTÍMETROS enteros (5,54 m → 554) y `null` es «ese día no hay lectura»
// —también el 29/2 de un año que no lo tuvo—. Nada se rellena.

const INICIO_MES = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/* «AAAA-MM-DD» → casillero 0..365. */
export const casillero = (d) =>
  INICIO_MES[+d.slice(5, 7) - 1] + +d.slice(8, 10) - 1;

/* `porDia` es un Map «AAAA-MM-DD» → metros, un valor por día. `cabecera` son
   los campos que describen de dónde salió (fuente, url, generado). */
export function armarSerieDiaria(porDia, cabecera = {}) {
  const dias = [...porDia.keys()].sort();
  const anios = {};
  for (const d of dias) {
    const a = d.slice(0, 4);
    if (!anios[a]) anios[a] = new Array(366).fill(null);
    anios[a][casillero(d)] = Math.round(porDia.get(d) * 100);
  }
  return {
    ...cabecera,
    unidad: "centímetros sobre el cero del hidrómetro",
    casilleros:
      "366 por año, calendario bisiesto: el 1 de marzo es siempre el 60. " +
      "null = sin lectura ese día.",
    desde: dias[0],
    hasta: dias[dias.length - 1],
    dias: dias.length,
    anios,
  };
}
