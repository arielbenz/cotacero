/* js/app/zonas.js — las zonas de la app: distancia, defensa, lo que pasó
   otras veces y, para las localidades vecinas, cómo se las busca.
   Vivían repartidas: los datos en config.js y lo que hace falta para buscar
   una dirección en Rincón o en Arroyo Leyes, escrito aparte en mapa.js. Una
   zona nueva —o una fuente de altura nueva para una zona que hoy no tiene—
   se agrega acá y nada más.

   Puro dato: no importa nada, y scripts/comprobar.js lo carga desde Node para
   verificar que sea consistente. */

/* Los km sólo están publicados para Arroyo Leyes (24). El resto son
   estimaciones propias, y a 4,5 cm por km equivocarse 5 km son 22 cm: el
   mismo orden que los márgenes con los que se decide. Lo decimos en pantalla,
   no sólo en el README. */
/* "laboca" va acá aunque nadie lo publicó: queda río ABAJO del puerto (4 km al
   sur, centro de la vecinal municipal) y el modelo no corrige hacia abajo, así
   que el 0 es una regla, no una estimación — avisar «estimación propia» sería
   falso. Ver AUDITORIA.md §9. */
export const KM_PUBLICADO = new Set(["centro", "leyes", "laboca"]);

/* Distancia sobre el río desde el hidrómetro del puerto, en km.
   ATENCIÓN: sólo Arroyo Leyes (24 km) está publicado. El resto son
   estimaciones propias y conviene ajustarlas midiendo sobre el cauce.

   `defensa` dice qué hay entre el río y las casas: "anillo" (el de la
   ciudad), "local" (una defensa propia, fuera del anillo), "ninguna", o null
   si no lo sabemos. `observado` son niveles del hidrómetro del Puerto a los
   que PASÓ algo en esa zona —en una crecida, o según el municipio— con su
   fuente. No son umbrales ni predicciones: van al lado del cálculo para que
   nadie lea «≈ 5,4» como «a 5,4 me tengo que ir» en un barrio que en 2016 vio
   el río en 6,61 detrás de un terraplén que aguantó. Cada renglón tiene que
   poder rastrearse: AUDITORIA.md §9 lista de dónde salió cada uno. Un renglón
   sin fuente no entra.

   `sinPlano: true` marca las zonas donde no tenemos ninguna fuente de altura:
   ahí ni el GPS, ni la dirección, ni el mapa pueden dar una altura, y la app
   lo dice de entrada en vez de mandar de un camino al otro. Rincón y Arroyo
   Leyes lo fueron hasta el 22/10/2026, cuando llegaron los puntos con cota
   de la costa (elevacion.js); queda Calchines, que no tiene ni curvas ni
   puntos. */
const AIRE_2023 =
  "Secretaría de Recursos Hídricos municipal, en AIRE, 30/12/2023";
const ENERO_2016 = "crónicas de enero de 2016 (El Litoral, Pausa)";

export const ZONAS = [
  {
    id: "centro",
    n: "Santa Fe — Centro / Candioti / Puerto",
    km: 0,
    nota: "Dentro del anillo de defensas.",
    defensa: "anillo",
    observado: [],
  },
  {
    id: "altoverde",
    n: "Alto Verde",
    km: 2,
    nota: "Fuera del anillo de la ciudad, con defensa propia. La Boca, en la isla Sirgadero, va aparte.",
    defensa: "local",
    observado: [
      {
        nivel: 5.3,
        que: "se corta el camino a La Boca, en la isla Sirgadero; en 2023 se defendió hasta 5,60.",
        fuente: AIRE_2023,
      },
      {
        nivel: 6.38,
        que: "1/1/2016: 24 familias del frente del riacho Santa Fe en refugios municipales.",
        fuente: "El Litoral, 1/1/2016",
      },
    ],
  },
  {
    id: "laboca",
    n: "La Boca (Alto Verde)",
    km: 0,
    nota: "Paraje de Alto Verde en la isla Sirgadero, río abajo del puerto: por eso no se descuenta nada por distancia. El municipio lo cuenta entre los sectores con riesgo de quedar aislados.",
    defensa: null,
    observado: [
      {
        nivel: 5.3,
        que: "se corta el camino que lo une con Alto Verde; en 2023 se defendió hasta 5,60.",
        fuente: AIRE_2023,
      },
    ],
  },
  {
    id: "guadalupe",
    n: "Guadalupe / Costanera Este / El Pozo",
    km: 4,
    nota: "Dentro del anillo, con sectores bajos. El asentamiento Los Alisos, sobre el bañado de la Setúbal en El Pozo, queda afuera de las defensas según el municipio. Para El Pozo se usan los km de Guadalupe.",
    defensa: "anillo",
    observado: [
      {
        nivel: 6.38,
        que: "1/1/2016: 4 familias de El Pozo en refugios municipales, en el salón del MTL.",
        fuente: "El Litoral, 1/1/2016",
      },
    ],
  },
  {
    id: "vuelta",
    n: "La Vuelta del Paraguayo",
    km: 5,
    nota: "Fuera del anillo, sin defensa. Evacúa temprano.",
    defensa: "ninguna",
    observado: [
      {
        nivel: 5.3,
        que: "empieza la evacuación; la escuela y la iglesia, lo más alto del barrio, aguantan hasta 5,70.",
        fuente: AIRE_2023,
      },
      {
        nivel: 6.0,
        que: "evacuación completa del barrio.",
        fuente: AIRE_2023,
      },
      {
        nivel: 6.38,
        que: "1/1/2016: 38 familias en refugios municipales, más las que se fueron por su cuenta.",
        fuente: "El Litoral, 1/1/2016",
      },
    ],
  },
  {
    id: "laguardia",
    n: "La Guardia",
    km: 7,
    nota: "Fuera del anillo de la ciudad, con defensa propia; la Bajada Distéfano queda afuera de ella.",
    defensa: "local",
    observado: [
      {
        nivel: 6.61,
        que: "máximo de 2016: La Guardia no figura entre los sectores evacuados de la ciudad.",
        fuente: ENERO_2016,
      },
    ],
  },
  {
    id: "colsur",
    n: "Colastiné Sur",
    km: 8,
    nota: "Fuera del anillo de la ciudad. Tiene defensa, más baja que la del resto, y las casas junto al club Caza y Pesca quedan afuera de ella.",
    defensa: "local",
    observado: [
      {
        nivel: 4.7,
        que: "entra agua en las casas junto al club Caza y Pesca, afuera de la defensa.",
        fuente: AIRE_2023,
      },
      {
        nivel: 5.7,
        que: "el INA recomendó evacuar el barrio a ese nivel.",
        fuente: "estudio del INA citado por AIRE, 30/12/2023",
      },
      {
        nivel: 6.0,
        que: "cerca de los 6 m el terraplén y la napa filtran, y el barrio se encharca.",
        fuente: "El Litoral, sin fecha",
      },
      {
        nivel: 6.4,
        que: "2/1/2016: filtró agua por la defensa en el ex camping municipal; 130 familias evacuadas.",
        fuente: "El Litoral, enero de 2016",
      },
    ],
  },
  {
    id: "colnorte",
    n: "Colastiné Norte",
    km: 11,
    nota: "Fuera del anillo de la ciudad, detrás del terraplén Garello (1992), en reparación desde 2024.",
    defensa: "local",
    observado: [
      {
        nivel: 6.0,
        que: "con lluvia fuerte, riesgo por la napa alta en las casas por debajo de los 14,50 m sobre el mar (cota IGN).",
        fuente: AIRE_2023,
      },
      {
        nivel: 6.61,
        que: "máximo de 2016: el Garello aguantó y el barrio no se evacuó.",
        fuente: ENERO_2016,
      },
    ],
  },
  {
    id: "rincon",
    n: "San José del Rincón",
    km: 16,
    localidad: { re: /san jos[eé] del rinc[oó]n/i, georef: "San José del Rincón" },
    nota: "Defensa propia al este; unos 3 km de la margen oeste no la tienen, y la obra proyectada no se adjudicó.",
    defensa: "local",
    observado: [
      {
        nivel: 5.3,
        que: "filtraciones por debajo del terraplén en los barrios bajos, como Los Espinillos.",
        fuente: AIRE_2023,
      },
      {
        nivel: 6.0,
        que: "con lluvia fuerte, riesgo por la napa alta por debajo de los 14,50 m sobre el mar (cota IGN).",
        fuente: AIRE_2023,
      },
    ],
  },
  {
    id: "leyes",
    n: "Arroyo Leyes",
    km: 24,
    localidad: { re: /arroyo leyes/i, georef: null },
    nota: "Defensa a 17 m sobre el mar (cota IGN) al este; los barrios del oeste no tienen, y la obra licitada no se adjudicó.",
    defensa: "local",
    observado: [
      {
        nivel: 6.53,
        que: "4/1/2016: entre 125 y 200 evacuados, en los barrios bajos del oeste.",
        fuente: "Provincia de Santa Fe y Pausa, 4/1/2016",
      },
    ],
  },
  {
    id: "calchines",
    n: "Santa Rosa de Calchines",
    km: 40,
    nota: "Estimación gruesa: verificá con la comuna.",
    defensa: null,
    sinPlano: true,
    observado: [
      {
        nivel: 6.53,
        que: "4/1/2016: entre 350 y 412 evacuados, la localidad más afectada después de la capital.",
        fuente: "Provincia de Santa Fe y Pausa, 4/1/2016",
      },
    ],
  },
  {
    id: "otro",
    n: "Otra zona — pongo los km a mano",
    km: null,
    nota: "",
    defensa: null,
    observado: [],
  },
];

/* `localidad`, sólo en las vecinas que no son el municipio de Santa Fe y que
   la app calcula: `re` las reconoce en lo que devuelve Nominatim —que pone a
   Rincón en `municipality` y a Arroyo Leyes en `village`—, y `georef` es su
   localidad censal en Georef, que tiene el callejero de Rincón (217 calles) y
   no el de Arroyo Leyes. Calchines no la lleva: no tiene datos de altura y
   además queda fuera del viewbox de la búsqueda. */
export const VECINAS = ZONAS.filter((z) => z.localidad);

/* Hasta dónde llegan los planos, en palabras: la usan los mensajes de «no
   tenemos la altura de ese punto». Estaba escrita a mano en tres lugares y
   quedó vieja dos veces en una semana. */
export const COBERTURA =
  "la ciudad, " + VECINAS.map((z) => z.n).join(" y ");
