/* js/app/estado.js — el estado de la sesión y lo que persiste.
   `guardado` envuelve localStorage con degradación elegante: en modo privado
   de Safari tirar por escribir ahí rompía la app entera.
   PUNTOS y TELEFONOS se leen del HTML, que es la fuente de verdad de los 30
   puntos de encuentro: así los indexa un buscador, se ven sin JS y no hay dos
   listas que se puedan desincronizar. */

import { ZONAS } from "./config.js";

/* Los 30 puntos de encuentro viven en el HTML (ver index.html), con las
   coordenadas OFICIALES del municipio en atributos data-. Los leemos de ahí en
   vez de tener una copia acá: así el listado lo indexa un buscador, se ve
   aunque el JS no arranque, y no hay dos fuentes que se puedan desincronizar.
   Fuente: capa `puntos_de_encuentro` del GeoServer público de la
   Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. Para
   actualizarlas:
     https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows
       ?service=WFS&version=1.0.0&request=GetFeature
       &typeName=publico:puntos_de_encuentro&outputFormat=application/json */
export const PUNTOS = [...document.querySelectorAll("#lista-puntos li[data-lon]")].map(
  (li) => [
    li.querySelector(".n").textContent.trim(),
    li.querySelector(".d").textContent.trim(),
    [parseFloat(li.dataset.lon), parseFloat(li.dataset.lat)],
  ],
);

/* Igual que los puntos: el HTML es la fuente. */
export const TELEFONOS = [...document.querySelectorAll("#lista-tel li")].map((li) => [
  li.querySelector(".q").textContent.trim(),
  li.querySelector(".n").textContent.trim(),
]);

/* ---------- almacenamiento con degradación elegante ----------
   localStorage falla en algunos visores embebidos y en modo privado.
   Si falla, seguimos en memoria: la app funciona igual durante la sesión. */
export const guardado = (() => {
  let ok = true,
    mem = {};
  try {
    localStorage.setItem("_t", "1");
    localStorage.removeItem("_t");
  } catch (e) {
    ok = false;
  }
  return {
    ok,
    get(k) {
      try {
        return ok ? localStorage.getItem(k) : mem[k];
      } catch (e) {
        return mem[k];
      }
    },
    set(k, v) {
      try {
        ok ? localStorage.setItem(k, v) : (mem[k] = v);
      } catch (e) {
        mem[k] = v;
      }
    },
  };
})();

/* Las versiones anteriores cacheaban las coordenadas de los 30 puntos en
   localStorage, con prefijos que ya no se usan. Ahora las coordenadas son las
   oficiales del municipio y viven en el código: esas entradas quedaron
   ocupando lugar en el teléfono de cualquiera que haya usado la app antes.
   Se barren una sola vez. */
const CLAVE_LIMPIEZA = "cc_limpieza_1";

export function limpiarGuardadoViejo() {
  if (!guardado.ok || guardado.get(CLAVE_LIMPIEZA) === "1") return;
  try {
    const muertas = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // cc_geo_, cc_geo2_ y cc_geo3_ sí; cc_geo4_ es la que se usa hoy.
      if (k && /^cc_geo(|2|3)_/.test(k)) muertas.push(k);
    }
    muertas.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* si el navegador no deja, no pasa nada */
  }
  guardado.set(CLAVE_LIMPIEZA, "1");
}

export let estado = {
  rio: null, // altura del hidrómetro en metros
  rioOrigen: "",
  delta: null, // variación contra la medición anterior, en metros
  rioFecha: "", // fecha de la medición, tal como la publica el INA
  rioVencido: false, // el dato guardado ya no se puede presentar como vigente
  rioVia: "", // "api" | "reporte": cuál de las dos fuentes del INA contestó
  rioVerificar: "", // la URL exacta con la que se puede comprobar el número
  ceroINA: null, // el cero IGN que publica el INA. No entra en el cálculo.
  cota: null, // cota IGN del terreno
  cotaEsEstimada: false,
  // "mano" | "gps" | "direccion". Antes sólo se guardaba si era estimada o
  // no, y las dos estimaciones quedaban indistinguibles: una sacada del GPS
  // es la altura del lugar donde estabas parado, que puede no ser tu casa.
  cotaOrigen: "",
  cotaDetalle: "", // la dirección encontrada, o la precisión del GPS
  zona: "centro",
  kmManual: null,
  lluvia: null,
};

/* null = todavía no eligió zona. Antes arrancaba en "centro" (0 km), que es
   la zona MÁS protegida: quien no tocaba el selector recibía el cálculo más
   optimista, hasta 1,80 m de diferencia contra la zona más expuesta. En una
   app que en todo lo demás elige el escenario pesimista, ese default iba para
   el otro lado. */
export const kmDeZona = () => {
  if (!estado.zona) return null;
  if (estado.zona === "otro") return estado.kmManual ?? 0;
  const z = ZONAS.find((z) => z.id === estado.zona);
  return z ? (z.km ?? 0) : 0;
};
