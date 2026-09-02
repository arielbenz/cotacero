// lib/fuentes.js — de dónde sale cada cosa, escrito UNA sola vez.
//
// Antes los nombres de los organismos y sus URLs estaban repartidos entre
// app.js, scripts/paginas.js, lib/ina.js y el HTML de la portada. Cambiar un
// enlace obligaba a acordarse de cinco lugares, y ya habían quedado
// desincronizados. Acá está el original; todo lo demás lo lee de acá.
//
// Quién lo consume:
//   lib/ina.js          la estación y los endpoints del INA
//   scripts/paginas.js  los bloques de fuentes de las páginas generadas
//   scripts/fuentes.js  escribe datos/fuentes.json, que lee la app
//
// REGLA DE JERARQUÍA, en este orden y sin excepciones:
//   1. organismo oficial   (INA, IGN, Municipalidad, Provincia)
//   2. universidad         (FICH-UNL)
//   3. normativa           (leyes, ordenanzas, reglamentos)
//   4. prensa              sólo para contexto histórico, y sólo cuando no
//                          exista fuente primaria. Nunca para un número que
//                          entre en el cálculo.
// `rango` marca ese nivel en cada entrada. La interfaz no muestra prensa y
// organismo con el mismo peso visual.

/* `corto` es el rótulo del pie del sitio: tiene que entrar en una columna
   angosta, así que va lo más breve posible sin dejar de ser reconocible. El
   nombre completo está en `nombre`. */
export const ORGANISMOS = {
  ina: {
    nombre: "Instituto Nacional del Agua",
    sigla: "INA",
    corto: "INA — reporte diario",
    que: "Organismo nacional. Mide y publica el nivel de los ríos.",
    // Al reporte diario y no a la raíz del sitio: alerta.ina.gob.ar/ contesta
    // una de cada tres veces (probado con timeout de 25 s), y el reporte
    // responde siempre. Un enlace "ver la fuente" que se cuelga es peor que no
    // ponerlo.
    url: "https://alerta.ina.gob.ar/a5/diario/reporte_diario",
    rango: "oficial",
  },
  ign: {
    nombre: "Instituto Geográfico Nacional",
    sigla: "IGN",
    corto: "IGN",
    que: "Define el sistema de alturas del país y la red de nivelación.",
    url: "https://www.ign.gob.ar/",
    rango: "oficial",
  },
  prefectura: {
    nombre: "Prefectura Naval Argentina",
    sigla: "PNA",
    corto: "Prefectura Naval",
    que: "Lee la escala hidrométrica del Puerto de Santa Fe.",
    url: "https://www.argentina.gob.ar/prefecturanaval",
    rango: "oficial",
  },
  muni: {
    nombre: "Municipalidad de Santa Fe",
    sigla: "Municipalidad",
    corto: "Municipalidad de Santa Fe",
    que: "Publica la cartografía de la ciudad, curvas de nivel incluidas.",
    url: "https://geo.santafeciudad.gov.ar/",
    rango: "oficial",
  },
  gestionRiesgos: {
    nombre: "Dirección de Gestión de Riesgos",
    sigla: "Gestión de Riesgos",
    corto: "Gestión de Riesgos",
    que: "El área del municipio a cargo del plan de contingencia.",
    url: "https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/",
    rango: "oficial",
  },
  idesf: {
    nombre: "Infraestructura de Datos Espaciales de Santa Fe",
    sigla: "IDESF",
    corto: "IDESF — Provincia de Santa Fe",
    que: "El catálogo de datos geográficos de la Provincia.",
    url: "https://www.santafe.gov.ar/idesf/",
    rango: "oficial",
  },
  fich: {
    nombre: "Facultad de Ingeniería y Ciencias Hídricas — UNL",
    sigla: "FICH-UNL",
    corto: "FICH — UNL",
    que: "Investigación en hidrología del Paraná y el Salado.",
    url: "https://www.fich.unl.edu.ar/cim/",
    rango: "universidad",
  },
};

/* Los cuatro datos que la app muestra, con su origen. La clave la usa la
   interfaz para pedir "la fuente de esto" sin repetir el nombre del
   organismo en cada pantalla. */
export const FUENTES = {
  nivelRio: {
    titulo: "El nivel del río",
    organismo: "ina",
    detalle: "Altura, alerta y evacuación del hidrómetro del Puerto.",
    url: "https://alerta.ina.gob.ar/a5/diario/reporte_diario",
    verificar:
      "https://alerta.ina.gob.ar/a5/obs/puntual/series/30" +
      "?timestart=2026-01-01&timeend=2100-01-01",
    rango: "oficial",
  },
  topografia: {
    titulo: "La altura de tu terreno",
    organismo: "muni",
    detalle:
      "Curvas de nivel de la ciudad, Secretaría de Recursos Hídricos " +
      "(Departamento de Relevamientos Planialtimétricos).",
    url: "https://geo.santafeciudad.gov.ar/",
    verificar:
      "https://geoserver.santafeciudad.gov.ar/geoserver/sitmax/ows" +
      "?service=WFS&version=1.0.0&request=GetFeature" +
      "&typeName=sitmax:curvas_nivel&outputFormat=application/json" +
      "&srsName=EPSG:4326",
    rango: "oficial",
  },
  emergencias: {
    titulo: "Puntos de encuentro y qué hacer",
    organismo: "gestionRiesgos",
    detalle: "Plan de contingencia y los 30 puntos de encuentro oficiales.",
    url: "https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/plan-de-contingencia/",
    verificar:
      "https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows" +
      "?service=WFS&version=1.0.0&request=GetFeature" +
      "&typeName=publico:puntos_de_encuentro&outputFormat=application/json",
    rango: "oficial",
  },
  historia: {
    titulo: "Cien años de mediciones",
    organismo: "ina",
    detalle:
      "Serie diaria del hidrómetro del Puerto de Santa Fe desde 1925, " +
      "medición directa.",
    url: "https://alerta.ina.gob.ar/a5/obs/puntual/series/30",
    verificar:
      "https://alerta.ina.gob.ar/a5/obs/puntual/series/30/observaciones" +
      "?timestart=1925-01-01&timeend=2100-01-01",
    rango: "oficial",
  },
  altimetria: {
    titulo: "El sistema de alturas",
    organismo: "ign",
    detalle:
      "Red de nivelación y cero de las escalas hidrométricas (SRVN16).",
    url: "https://www.ign.gob.ar/NuestrasActividades/Geodesia/Nivelacion/Escalas",
    verificar:
      "https://www.ina.gob.ar/delta/pdf/03_02_INA-DELTA_Info04_CerosHidrometricos.pdf",
    rango: "oficial",
  },
  cartografia: {
    titulo: "Cartografía provincial",
    organismo: "idesf",
    detalle: "Servicios OGC de la Provincia de Santa Fe.",
    url: "https://www.santafe.gov.ar/idesf/geoportal/paginas/servicios-OGC",
    rango: "oficial",
  },
};

/* Normativa y antecedentes. No entran en el cálculo: sirven para explicar el
   marco y, en el caso de Rincón, para mostrar que el 8,20 no es un invento
   nuestro sino el número que usa la normativa local. */
export const NORMATIVA = [
  {
    n: "Ley provincial 11.730",
    que: "Uso de las áreas inundables. La Provincia distingue legalmente zonas según el riesgo hídrico.",
    url: "https://www.santafe.gov.ar/index.php/web/content/view/full/128300",
    rango: "normativa",
  },
  {
    n: "Ley provincial 14.477",
    que: "Emergencia hídrica provincial. Es el marco institucional del que nace esta herramienta; no respalda el modelo.",
    url: "https://www.santafe.gov.ar/normativa/",
    nota: "Sin ficha estable en el buscador de normativa al momento de escribir esto: el enlace va al buscador.",
    rango: "normativa",
  },
  {
    n: "Reglamento de Edificaciones — Comuna de San José del Rincón",
    que: 'Fija la cota de edificación en "16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)". La diferencia entre esos dos números es exactamente 8,20.',
    url: "https://capsf.org.ar/modulos/ejercicio_prof./archivos/rincon.pdf",
    rango: "normativa",
  },
];

/* La estación. Todo lo que identifica al hidrómetro del que sale el número
   grande de la app, en un solo lugar, para que lib/ina.js no lo repita. */
export const ESTACION = {
  // id de la serie de altura hidrométrica por medición directa en la API a5
  serieId: 30,
  estacionId: 30,
  // el id con el que la Prefectura la identifica
  idExterno: "240",
  abreviatura: "SAFE",
  nombre: "Santa Fe",
  descripcion: "Hidrómetro del Puerto de Santa Fe",
  rio: "Paraná",
  propietario: "Prefectura Naval Argentina",
  red: "Escalas de Prefectura Naval",
  lat: -31.6514772196376,
  lon: -60.7002319185745,
  // Estos tres los sirve la API en cada consulta: los de acá son el respaldo
  // para cuando la API no responde y la app cae al reporte diario.
  alerta: 5.3,
  evacuacion: 5.7,
  aguasBajas: 2.0,
};

export const ENDPOINTS = {
  // La API REST del sistema de alerta. Es la que consume el propio visor del
  // INA: JSON estructurado, sin clave, con la serie completa desde 1925.
  api: "https://alerta.ina.gob.ar/a5/obs/puntual/series",
  // El reporte diario en HTML. Era la fuente única; ahora es el respaldo.
  reporte: "https://alerta.ina.gob.ar/a5/diario/reporte_diario",
  // El visor público. OJO: alerta.ina.gob.ar/pub/ se cae seguido (probado:
  // tres intentos seguidos con timeout de 30 s, cero respuestas). Por eso
  // ningún camino de la app depende de /pub/ — ni para leer ni para citar.
  mapa: "https://alerta.ina.gob.ar/a5/diario/reporte_diario",
};
