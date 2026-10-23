// lib/proveedores.js — los servicios de otro origen a los que el navegador le
// pide algo, y lo que cada uno exige.
//
// Tocar un proveedor tocaba cuatro archivos sin que nada avisara si faltaba
// uno (CLAUDE.md, «tocar uno toca cuatro archivos»): la CSP de vercel.json
// —si falta, el navegador bloquea el pedido y la app dice «no se encontró»
// como si fuera culpa de la dirección—, el párrafo de /legal que dice adónde
// va cada cosa, LICENCIAS y el código. Y faltaba: Open-Meteo estaba en la CSP
// y en el código desde siempre, y /legal no lo nombraba.
//
// scripts/paginas/emitir.js lo usa para verificar, y falla al generar si:
//   - un proveedor no está en las directivas de la CSP que dice `csp`;
//   - /legal no lo nombra (`quien`, tal cual);
//   - aparece en el código de public/js un host de otro origen que no está
//     acá ni en ENLACES: hay que decidir qué es.
// No genera la CSP: vercel.json no admite comentarios y conviene leerlo
// entero; acá se comprueba que diga lo que tiene que decir.
//
// Sólo Node: el navegador no necesita esta lista.

export const PROVEEDORES = [
  {
    host: "apis.datos.gob.ar",
    quien: "Georef",
    para: "buscar una dirección, al tocar Buscar",
    csp: ["connect-src"],
  },
  {
    host: "nominatim.openstreetmap.org",
    quien: "Nominatim",
    para: "buscar una dirección cuando Georef no la encuentra",
    csp: ["connect-src"],
  },
  // MapLibre baja los tiles con fetch: además de img-src, connect-src.
  {
    host: "wms.ign.gob.ar",
    quien: "Instituto Geográfico Nacional",
    para: "el fondo del mapa",
    csp: ["img-src", "connect-src"],
  },
  {
    host: "imagenes.ign.gob.ar",
    quien: "Instituto Geográfico Nacional",
    para: "la foto aérea de «Marcar mi casa»",
    csp: ["img-src", "connect-src"],
  },
  {
    host: "api.open-meteo.com",
    quien: "Open-Meteo",
    para: "el pronóstico de lluvia, con las coordenadas fijas del centro",
    csp: ["connect-src"],
  },
  {
    host: "flood-api.open-meteo.com",
    quien: "Open-Meteo",
    para: "la tendencia del caudal, con las coordenadas fijas del centro",
    csp: ["connect-src"],
  },
  // Sólo en las páginas del sitio: ni en /app ni en /widget (CLAUDE.md,
  // «Privacidad»). La CSP del widget no los lleva.
  {
    host: "www.googletagmanager.com",
    quien: "Google Analytics",
    para: "las estadísticas del sitio",
    csp: ["script-src", "img-src"],
  },
  {
    host: "*.google-analytics.com",
    quien: "Google Analytics",
    para: "las estadísticas del sitio",
    csp: ["img-src", "connect-src"],
  },
  {
    host: "*.analytics.google.com",
    quien: "Google Analytics",
    para: "las estadísticas del sitio",
    csp: ["connect-src"],
  },
];

/* Hosts que aparecen en el código pero sólo como enlace: el navegador no les
   pide nada por su cuenta, los abre la persona. No van en la CSP. */
export const ENLACES = [
  "www.openstreetmap.org",
  "maps.apple.com",
  "www.ign.gob.ar",
  "wa.me",
];
