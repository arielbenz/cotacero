/* js/app/modelo.js — la cuenta del modelo, sin estado y sin DOM.
   Cota del terreno → nivel del río en el hidrómetro del Puerto. Antes vivía
   dentro de cota.js, que importa estado.js, que lee el HTML al cargarse: la
   cuenta central de la app no se podía probar fuera de un navegador. Acá
   recibe todo lo que necesita como argumento y la comprueba
   scripts/comprobar.js.

   cota.js sigue teniendo cotaEnHidrometro() y margenCota(): son esta misma
   cuenta con los datos de la sesión. Nadie más la hace. Ver CLAUDE.md,
   «Escenario pesimista, en un solo lugar». */

import { CERO_IGN, ERROR_DEM, ERROR_PUNTOS, PENDIENTE } from "./config.js";

/* Cuánto se le descuenta a la altura antes de traducirla. Cero si la cargó
   la persona; si salió de un plano, el margen de ESA fuente: las curvas de la
   ciudad y los puntos de la costa no se equivocan lo mismo (config.js). */
export function margenDe({ estimada, fuente }) {
  if (!estimada) return 0;
  return fuente === "puntos" ? ERROR_PUNTOS : ERROR_DEM;
}

/* El nivel del río a partir del cual el agua alcanzaría esa cota. Por
   defecto, el escenario pesimista; `crudo` da la traducción sin margen, sólo
   para el desglose. null si falta la cota o la distancia. */
export function umbralDe({ cota, estimada, fuente, km, crudo = false }) {
  if (cota == null || km == null) return null;
  const usada = crudo ? cota : cota - margenDe({ estimada, fuente });
  return usada - CERO_IGN - PENDIENTE * km;
}
