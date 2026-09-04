/* js/app/oficiales.js — alerta, evacuación y el récord.
   Lo único del cálculo que cambia en caliente: los umbrales los publica la
   estación del INA en cada consulta y el récord sale de la serie histórica.
   Los valores escritos acá son el arranque —para que la regla se dibuje bien
   antes de que llegue el dato— y el respaldo para cuando contesta el reporte
   diario, que no los trae.

   Se mueven SÓLO con fijarUmbrales() y fijarRecord(). Un import de ESM es de
   sólo lectura, así que nadie más puede asignarlos aunque quiera; el resto
   del código los ve actualizados por el enlace vivo del import. */

import { UMBRALES_RESPALDO } from "/lib/comun.js";

/* Los umbrales oficiales del Puerto. Van con `let` y no con `const` porque
   desde que la app lee la API del INA los publica la propia estación
   (`nivel_alerta` / `nivel_evacuacion`): estos valores son el arranque y el
   respaldo para cuando contesta el reporte diario, que no los trae. Si el INA
   los corrigiera, la app se entera sola en vez de mostrar dos números
   distintos que los de la fuente. */
export let ALERTA = UMBRALES_RESPALDO.alerta;

export let EVACUACION = UMBRALES_RESPALDO.evacuacion;

/* El récord vigente del hidrómetro del Puerto. Da la escala real de la
   decisión: de la alerta al récord hay poco más de dos metros, y sin esa
   marca la evacuación parece el techo del mundo.

   Va con `let` porque ya no está escrito a mano: sale de datos/historia.json,
   que `node scripts/historia.js` arma con la serie del INA desde 1925. Estos
   valores son el arranque, para que la regla se dibuje bien antes de que el
   archivo llegue —y si alguna crecida rompe el récord, se actualiza volviendo
   a correr el script, no editando este renglón. */
export let RECORD = 7.43;

export let RECORD_ANIO = 1992;

export const etiquetaRecord = () => "Récord " + RECORD_ANIO;

/* Los umbrales oficiales y el récord son lo único que cambia en caliente: los
   publica la estación del INA y la serie histórica. Se tocan por acá y no por
   asignación directa desde otro archivo, porque en módulos ES un import es de
   sólo lectura — y así queda en un solo lugar quién puede moverlos. El resto
   del código los ve actualizados solo, por el enlace vivo del import. */
export function fijarUmbrales(a, e) {
  ALERTA = a;
  EVACUACION = e;
}

export function fijarRecord(v, anio) {
  RECORD = v;
  RECORD_ANIO = anio;
}
