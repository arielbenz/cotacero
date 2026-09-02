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

/* Las dos listas del plan, con una marca por renglón: `true` = está en el
   Plan de Contingencia de la Municipalidad; `false` = lo agregamos nosotros.
   La distinción importa. Una app que mezcla las recomendaciones del municipio
   con las propias, sin decir cuál es cuál, se atribuye un respaldo que no
   tiene; y esconder lo agregado sería fingir que el plan oficial dice más de
   lo que dice.

   Los cinco puntos de la "Mochila de Emergencia", textuales del plan:
     · Documentos importantes en bolsa de plástico (DNI y todo otro documento
       familiar de importancia).
     · Botiquín de primeros auxilios y medicinas habituales.
     · Manta ligera y ropa de abrigo.
     · Linterna y baterías extra.
     · Radio y pilas para mantenerse informados si se corta la luz.
   Lo demás es sentido común de crecida, no doctrina municipal.

   NO REORDENAR ESTAS LISTAS. Cada casilla se guarda por su posición
   (`cc_mo3`, `cc_pv5`...), así que mover un renglón le cambia el tilde de
   lugar a todo el que ya venía llenando el plan: alguien que tenía la mochila
   a medias abriría la app y vería marcadas otras cosas. Se agrega al final. */
export const MOCHILA = [
  ["Documentos de todos, en bolsa de nylon cerrada", true],
  ["Medicación habitual y recetas", true],
  ["Botiquín de primeros auxilios", true],
  ["Agua potable para tres días", false],
  ["Alimentos que no necesiten cocción ni frío", false],
  ["Linterna y pilas de repuesto", true],
  ["Radio a pilas (para cuando no haya luz ni datos)", true],
  ["Cargador y batería portátil cargada", false],
  ["Mantas y ropa de abrigo", true],
  ["Muda de ropa por persona", false],
  ["Pañales, mamadera y leche si hay bebés", false],
  ["Comida y correa de los animales", false],
  ["Efectivo en billetes chicos", false],
  ["Copia de llaves", false],
  ["Anotado: teléfonos en papel, por si se apaga el celular", false],
];

/* Del plan municipal, para la preparación previa: identificar el punto de
   encuentro más cercano y el recorrido hasta él, asignar roles a cada
   integrante de la familia, y saber cortar la energía eléctrica y cerrar las
   llaves de gas. El resto lo agregamos nosotros. */
export const PREVIA = [
  ["Saber la cota de mi terreno", false],
  ["Elegir el punto de encuentro y probar el recorrido", true],
  ["Acordar quién hace qué el día que haya que salir", true],
  ["Guardar los documentos importantes en alto", false],
  ["Levantar del piso lo que se arruina con el agua", false],
  ["Fijarme dónde se corta la luz y el gas, y que otro más lo sepa", true],
  ["Limpiar la cuneta y el desagüe de la vereda", false],
  ["No dejar escombros ni ramas en la calle", false],
  ["Hablar con los vecinos: quién necesita ayuda para salir", false],
  ["Cargar el celular y la batería portátil cuando anuncian tormenta", false],
  ["Tener a mano el número del contacto fuera de la zona", false],
];
