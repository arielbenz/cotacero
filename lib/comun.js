/* lib/comun.js — lo que TODOS necesitan y nadie debería volver a escribir.
 *
 * El proyecto corre en cuatro contextos que no se pueden importar entre sí:
 * los módulos ES de la app, los scripts clásicos del sitio, el service worker
 * y Node. Cada cosa que hacía falta en dos de esos cuatro terminaba copiada.
 * Los umbrales oficiales llegaron a estar escritos a mano en ocho archivos, y
 * son un número de seguridad: si el INA corrige uno y una copia queda vieja,
 * ese consumidor avisa tarde.
 *
 * Este archivo es la única fuente. Lo leen:
 *   - los módulos ES y Node, por `import`
 *   - el service worker y los scripts clásicos, por `lib/comun-clasico.js`,
 *     que EMITE `scripts/paginas.js` a partir de éste y no se edita a mano
 *
 * Por eso acá NO va ningún `import`: el gemelo clásico sale de sacarle los
 * `export` a este archivo, y eso sólo funciona si no depende de nadie. Nada de
 * DOM, nada de fetch, nada de estado — funciones puras y constantes.
 */

/* ---------- los umbrales oficiales ----------
   Los publica la estación del INA en cada consulta y llegan en /api/nivel.
   Estos son el ARRANQUE —para dibujar la regla antes de que llegue el dato— y
   el RESPALDO para cuando contesta el reporte diario, que no los trae.
   `lib/fuentes.js` los toma de acá para armar ESTACION. */
export const UMBRALES_RESPALDO = { alerta: 5.3, evacuacion: 5.7 };

/* El filtro de plausibilidad, que estaba copiado en cinco lados. No es
   paranoia: si la API devolviera una evacuación por debajo de la alerta, la
   app diría "evacuación" con el río en aguas medias. Devuelve los umbrales o
   null, y quien lo llama se queda con los de respaldo. */
export function umbralesDe(j) {
  if (!j) return null;
  const a = j.alerta;
  const e = j.evacuacion;
  if (typeof a !== "number" || typeof e !== "number") return null;
  if (!(a > 0 && e > a && e < 10)) return null;
  return { alerta: a, evacuacion: e };
}

/* ---------- frescura ----------
   El INA publica UNA lectura por día, sellada a las 00:00. Pasadas estas
   horas el dato guardado deja de presentarse como vigente: mostrar el de
   anteayer con la cara de uno de hoy es peor que no mostrar nada. */
export const VENCE_HORAS = 48;

/* ---------- cómo se escriben los números ----------
   No es cosmética. `mU()` existe para que el nivel de aviso NUNCA salga con
   dos decimales: la cota del terreno viene de curvas cada ~50 cm y el segundo
   decimal sería precisión inventada. En un número que se usa para decidir si
   sacar a alguien de la casa, la precisión inventada se lee como certeza. */

/* El primitivo: un número con coma decimal y sin unidad. Todo lo demás se
   arma con esto, así que la coma se decide en un solo lugar. */
export const nm = (v, dec = 1) => Number(v).toFixed(dec).replace(".", ",");

/* El nivel del río: dos decimales, que es como lo publica el INA. */
export const m = (v) => (v == null || isNaN(v) ? "—" : nm(v, 2) + " m");

/* El nivel de aviso: un decimal y tilde de aproximación, siempre.
   Única excepción en todo el proyecto: el desglose del cálculo en /app, que
   conserva la aritmética exacta y aclara al pie por qué la pantalla muestra
   otra cosa. */
export const mU = (v) =>
  v == null || isNaN(v) ? "—" : "≈ " + nm(Math.round(v * 10) / 10, 1) + " m";

/* Una distancia: debajo del metro en centímetros, que es como se habla de
   esto cuando falta poco; arriba, en metros con un decimal. "217 cm" no lo
   lee nadie, y "360 cm" es lo que esta función existe para evitar. */
export const mCm = (v) => {
  const a = Math.abs(v);
  return a < 1 ? Math.round(a * 100) + " cm" : nm(Math.round(a * 10) / 10, 1) + " m";
};
