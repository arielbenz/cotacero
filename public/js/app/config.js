/* js/app/config.js — las constantes del cálculo y las listas fijas.
   Los tres números que gobiernan el modelo —CERO_IGN, PENDIENTE y ERROR_DEM—
   están en discusión técnica abierta: no se tocan sin leer AUDITORIA.md.
   MOCHILA y PREVIA se guardan por posición: no reordenar (ver CLAUDE.md).

   No importa nada que toque el DOM, a propósito: así scripts/comprobar.js
   lo puede cargar desde Node. Importaba guardado y m sin usarlos, y con eso
   arrastraba a estado.js, que lee el HTML al cargarse. */

/* ==========  CONFIGURACIÓN  ==========
   Lo único que tenés que tocar para poner esto en marcha. */
export const CONFIG = {
  // Clave pública VAPID para los avisos. Se genera con `node scripts/vapid.js`
  // y la privada va SÓLO en las variables de entorno de Vercel.
  // Vacía = avisos apagados; la app funciona igual.
  VAPID_PUBLIC_KEY:
    "BLbYpcsVuEVYGieE3kyi-Yj3ZRXCPCoWh28nkeBZmTBTmriOcHuXLV7n8W88E__e-f-Ph40Eqpotf6vSWM9E-lQ",

  // La funcion serverless que lee el nivel del INA.
  // En local con `vercel dev`: '/api/nivel' funciona igual.
  NIVEL_ENDPOINT: "/api/nivel",
};

/* 8,9524 (cero de la escala en el sistema del ex MOP, según Vías Navegables)
   − 0,531 (H_IGN = H_MOP − 0,531, IGN 2017) = 8,4214. Hasta el 26/10/2026 era
   8,20, que ningún organismo respalda (AUDITORIA.md §1). */
export const CERO_IGN = 8.4214;

export const PENDIENTE = 0.045;

export const ESCALA_MIN = 0;

export const ESCALA_MAX = 8;

/* Incertidumbre de la cota, en metros.
   Las curvas del municipio vienen cada 50 cm, así que interpolar entre dos
   deja como mucho medio metro de error: es la convención cartográfica y es lo
   que se usa acá. Simplificar la geometría para que el archivo pesara 72 KB
   costó 2 cm de media y 42 cm en el peor de los 30 puntos de encuentro, o sea
   que cabe dentro del mismo medio metro.

   Medido el 22/10/2026 contra 330 puntos fijos de la red municipal: cubre al
   98 % del lado que importa (la curva más alta que el terreno). Los seis que
   se escapan son puntos sueltos con nombre, no un barrio. AUDITORIA.md §4.

   Historia, para que no vuelva: acá había 3,0 "de estimación satelital", sin
   medir. Cuando se midió contra 36 puntos de nivelación del IGN, el error de
   esa fuente resultó ser 7,5 m de desvío — más que todo el rango de decisión
   de la app. Por eso ya no se usa un modelo satelital. */
export const ERROR_DEM = 0.5;

/* El margen de la otra fuente: los puntos con cota de la costa, que se usan
   sólo fuera del área de las curvas (Rincón, Arroyo Leyes). Estimando cada
   punto con sus cuatro vecinos, en la costa el 12,5 % quedaba más de 0,5 m
   por arriba del real —el lado que hace avisar tarde— contra el 4,7 % en la
   ciudad: el terreno cambia más entre terraplenes, cunetas y rellenos. Con
   1,0 m la costa queda en 4,6 %, lo mismo que la ciudad con 0,5.
   AUDITORIA.md §7, pregunta 24. No se toca sin leer eso. */
export const ERROR_PUNTOS = 1.0;

/* A partir de acá el dato guardado no se presenta como vigente. Sale de
   lib/comun.js, que es de donde lo lee también la barra del sitio: eran dos
   constantes con la misma intención y unidades distintas (48 h contra
   48 * 60 minutos), sostenidas por un comentario que pedía no olvidarse. */
export { VENCE_HORAS } from "/lib/comun.js";

export const REFRESCO_MS = 5 * 60 * 1000; // piso entre refrescos automáticos

export const PRECISION_MAX = 100; // error de GPS, en metros, arriba del cual no consultamos elevación

/* Las zonas —km, defensa, lo observado, la localidad— viven en zonas.js. */

/* Las dos listas del plan viven en lib/listas.js: las necesita también
   scripts/paginas.js para la hoja imprimible, y desde acá no las puede leer
   —config.js importa de estado.js, que toca el DOM—. Se re-exportan para que
   nada de la app cambie de import. */
export { MOCHILA, PREVIA, SALIDA } from "../../lib/listas.js";