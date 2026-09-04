/* js/app/config.js — las constantes del cálculo y las listas fijas.
   Los tres números que gobiernan el modelo —CERO_IGN, PENDIENTE y ERROR_DEM—
   están en discusión técnica abierta: no se tocan sin leer AUDITORIA.md.
   MOCHILA y PREVIA se guardan por posición: no reordenar (ver CLAUDE.md). */

import { guardado } from "./estado.js";
import { m } from "./formato.js";

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

export const CERO_IGN = 8.2;

export const PENDIENTE = 0.045;

export const ESCALA_MIN = 0;

export const ESCALA_MAX = 8;

/* Incertidumbre de la cota, en metros.
   Las curvas del municipio vienen cada 50 cm, así que interpolar entre dos
   deja como mucho medio metro de error: es la convención cartográfica y es lo
   que se usa acá. Simplificar la geometría para que el archivo pesara 72 KB
   costó 2 cm de media y 42 cm en el peor de los 30 puntos de encuentro, o sea
   que cabe dentro del mismo medio metro.

   Historia, para que no vuelva: acá había 3,0 "de estimación satelital", sin
   medir. Cuando se midió contra 36 puntos de nivelación del IGN, el error de
   esa fuente resultó ser 7,5 m de desvío — más que todo el rango de decisión
   de la app. Por eso ya no se usa un modelo satelital. */
export const ERROR_DEM = 0.5;

export const VENCE_HORAS = 48; // a partir de acá el dato guardado no se presenta como vigente

export const REFRESCO_MS = 5 * 60 * 1000; // piso entre refrescos automáticos

export const PRECISION_MAX = 100; // error de GPS, en metros, arriba del cual no consultamos elevación

/* Los km sólo están publicados para Arroyo Leyes (24). El resto son
   estimaciones propias, y a 4,5 cm por km equivocarse 5 km son 22 cm: el
   mismo orden que los márgenes con los que se decide. Lo decimos en pantalla,
   no sólo en el README. */
export const KM_PUBLICADO = new Set(["centro", "leyes"]);

/* Distancia sobre el río desde el hidrómetro del puerto, en km.
   ATENCIÓN: sólo Arroyo Leyes (24 km) está publicado. El resto son
   estimaciones propias y conviene ajustarlas midiendo sobre el cauce. */
export const ZONAS = [
  {
    id: "centro",
    n: "Santa Fe — centro / puerto",
    km: 0,
    nota: "Dentro del anillo de defensas.",
  },
  {
    id: "altoverde",
    n: "Alto Verde",
    km: 2,
    nota: "Fuera del anillo de defensas.",
  },
  {
    id: "guadalupe",
    n: "Guadalupe / Costanera Este",
    km: 4,
    nota: "Dentro del anillo, con sectores bajos.",
  },
  {
    id: "vuelta",
    n: "La Vuelta del Paraguayo",
    km: 5,
    nota: "Fuera del anillo. Evacúa temprano.",
  },
  { id: "laguardia", n: "La Guardia", km: 7, nota: "Fuera del anillo." },
  { id: "colsur", n: "Colastiné Sur", km: 8, nota: "Fuera del anillo." },
  {
    id: "colnorte",
    n: "Colastiné Norte",
    km: 11,
    nota: "Fuera del anillo. Zona históricamente expuesta.",
  },
  {
    id: "rincon",
    n: "San José del Rincón",
    km: 16,
    nota: "Defensa local propia.",
  },
  {
    id: "leyes",
    n: "Arroyo Leyes",
    km: 24,
    nota: "Defensa local a cota 17 IGN.",
  },
  {
    id: "calchines",
    n: "Santa Rosa de Calchines",
    km: 40,
    nota: "Estimación gruesa: verificá con la comuna.",
  },
  {
    id: "otro",
    n: "Otra zona — pongo los km a mano",
    km: null,
    nota: "",
  },
];

/* Las dos listas del plan viven en lib/listas.js: las necesita también
   scripts/paginas.js para la hoja imprimible, y desde acá no las puede leer
   —config.js importa de estado.js, que toca el DOM—. Se re-exportan para que
   nada de la app cambie de import. */
export { MOCHILA, PREVIA } from "../../lib/listas.js";