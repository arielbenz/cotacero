/* GENERADO por scripts/paginas.js desde public/lib/comun.js. NO EDITAR:
   el próximo `node scripts/paginas.js` lo pisa. El original es public/lib/comun.js. */
(function (raiz) {
  "use strict";
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
const UMBRALES_RESPALDO = { alerta: 5.3, evacuacion: 5.7 };

/* El filtro de plausibilidad, que estaba copiado en cinco lados. No es
   paranoia: si la API devolviera una evacuación por debajo de la alerta, la
   app diría "evacuación" con el río en aguas medias. Devuelve los umbrales o
   null, y quien lo llama se queda con los de respaldo. */
function umbralesDe(j) {
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
const VENCE_HORAS = 48;

/* ---------- cómo se escriben los números ----------
   No es cosmética. `mU()` existe para que el nivel de aviso NUNCA salga con
   dos decimales: la cota del terreno viene de curvas cada ~50 cm y el segundo
   decimal sería precisión inventada. En un número que se usa para decidir si
   sacar a alguien de la casa, la precisión inventada se lee como certeza. */

/* El primitivo: un número con coma decimal y sin unidad. Todo lo demás se
   arma con esto, así que la coma se decide en un solo lugar. */
const nm = (v, dec = 1) => Number(v).toFixed(dec).replace(".", ",");

/* El nivel del río: dos decimales, que es como lo publica el INA. */
const m = (v) => (v == null || isNaN(v) ? "—" : nm(v, 2) + " m");

/* El nivel de aviso: un decimal y tilde de aproximación, siempre.
   Única excepción en todo el proyecto: el desglose del cálculo en /app, que
   conserva la aritmética exacta y aclara al pie por qué la pantalla muestra
   otra cosa. */
const mU = (v) =>
  v == null || isNaN(v) ? "—" : "≈ " + nm(Math.round(v * 10) / 10, 1) + " m";

/* Una distancia: debajo del metro en centímetros, que es como se habla de
   esto cuando falta poco; arriba, en metros con un decimal. "217 cm" no lo
   lee nadie, y "360 cm" es lo que esta función existe para evitar. */
const mCm = (v) => {
  const a = Math.abs(v);
  return a < 1 ? Math.round(a * 100) + " cm" : nm(Math.round(a * 10) / 10, 1) + " m";
};

/* ---------- los estados y cómo se dicen ----------
   La misma situación se cuenta en la notificación (sw.js), en la pantalla del
   río (rio.js) y en Mi casa (cota.js). Estaban copiadas a mano en cuatro
   archivos, y la pantalla ya decía «Terminá la mochila» a los 50 cm cuando
   la notificación —y la tabla del README— decían «Andá armando». Son textos
   de seguridad: una copia vieja es una instrucción distinta para la misma
   situación.

   Las reglas, que comprueba scripts/comprobar.js: en los estados graves el
   texto EMPIEZA con el verbo de lo que hay que hacer y lleva el 103, y el
   cuerpo de una notificación no pasa de 180 caracteres —Android corta ahí,
   y la línea que se cortaba era la del 103—. README, «Los ocho estados». */
const ESTADOS = {
  sinDato: { titulo: "Cambió el nivel del río" },
  superado: {
    titulo: "El río pasó tu nivel de aviso",
    verbo: "Mové a las personas, los remedios y los documentos.",
  },
  evacuacion: {
    titulo: "Evacuación en la ciudad",
    verbo: "Si Defensa Civil dice que salgas, salí.",
  },
  alerta: {
    titulo: "Alerta en la ciudad",
    verbo: "Armá la mochila y avisale a tu familia.",
  },
  // A 20 cm o menos de tu nivel de aviso.
  cerca: { verbo: "Terminá la mochila y avisale a tu familia." },
  // A 50 cm o menos.
  acercandose: { verbo: "Andá armando la mochila." },
  // Los dos de la pantalla del río y de la imagen para compartir, debajo de
  // la alerta de la ciudad. No son notificaciones.
  atencion: { titulo: "Atención", verbo: "Armá la mochila hoy." },
  normal: { titulo: "Río normal" },
};

/* Desde cuántos metros antes de la alerta de la ciudad la pantalla pasa a
   «Atención». Estaba escrito como 4,3 en dos archivos, sin fuente: es un
   criterio propio —un metro de anticipación para armar la mochila—, no un
   umbral oficial (AUDITORIA.md, resumen). Relativo a la alerta, para que
   siga valiendo si el INA la corrige. */
const ATENCION_ANTES_M = 1.0;

/* Cuánto le falta al río para tu nivel de aviso, en centímetros enteros.
   Cero o menos: ya lo alcanzó. Las comparaciones van por acá y no con < o >=
   sobre los metros: el nivel de aviso sale de una resta y vale, por ejemplo,
   5,200000000000001, y con el río en 5,20 la pantalla decía «faltan unos
   0 cm» en vez de «el río pasó tu nivel de aviso». */
const faltaCm = (nivel, umbral) => Math.round((umbral - nivel) * 100);

/* Qué estado corresponde, en este orden: tu nivel de aviso superado manda
   sobre la ciudad, la evacuación sobre la alerta. `alerta` y `evacuacion`
   son los que publica la estación, o los de respaldo. */
function estadoDe(nivel, umbral, alerta, evacuacion) {
  if (nivel == null) return "sinDato";
  if (umbral != null && faltaCm(nivel, umbral) <= 0) return "superado";
  if (nivel >= evacuacion) return "evacuacion";
  if (nivel >= alerta) return "alerta";
  if (umbral == null) return "subioSinCasa";
  /* En centímetros: 4,70 − 4,50 da 0,2000000000000002 en coma flotante, y
     a 20 cm justos —el borde que importa— decía «andá armando» en vez de
     «terminá». */
  const cm = faltaCm(nivel, umbral);
  if (cm <= 20) return "cerca";
  if (cm <= 50) return "acercandose";
  return "subio";
}

/* Los dos estados graves de la ciudad, como los dice la pantalla: el título,
   el verbo y el resto. Antes vivía en rio.js; lo usan también la pestaña
   «Ahora» y la tarjeta del río. null si la ciudad no está en alerta. */
function textoGrave(r, alerta, evacuacion) {
  if (r == null) return null;
  if (r >= evacuacion)
    return {
      titu: ESTADOS.evacuacion.titulo,
      verbo: ESTADOS.evacuacion.verbo,
      resto:
        "El río pasó los " +
        m(evacuacion) +
        ". Si necesitás ayuda para salir, llamá al 103. No cruces agua que " +
        "corre: con 30 cm —menos que una rodilla— te arrastra.",
    };
  if (r >= alerta)
    return {
      titu: ESTADOS.alerta.titulo,
      verbo: ESTADOS.alerta.verbo,
      resto:
        "El río pasó los " +
        m(alerta) +
        ". En los barrios de afuera del terraplén (el anillo de defensas) ya " +
        "empiezan a sacar gente. Si te dicen que salgas, salí. Dudas: 103.",
    };
  return null;
}

/* La notificación. Vivía en sw.js como armarAviso(); acá se puede comprobar
   desde Node que cada cuerpo entra en 180 caracteres. `oficiales` son los
   umbrales que publicó la estación, o null; `cerca` es si la persona pidió
   el aviso anticipado en Ajustes. */
function avisoDe(nivel, umbral, cerca, oficiales) {
  const alerta = (oficiales && oficiales.alerta) || UMBRALES_RESPALDO.alerta;
  const evacuacion =
    (oficiales && oficiales.evacuacion) || UMBRALES_RESPALDO.evacuacion;
  let e = estadoDe(nivel, umbral, alerta, evacuacion);
  // El aviso anticipado sólo si lo pidió: sin eso, es «el río subió».
  if (!cerca && (e === "cerca" || e === "acercandose")) e = "subio";
  const falta = umbral != null && nivel != null ? umbral - nivel : null;
  switch (e) {
    case "sinDato":
      return {
        titulo: ESTADOS.sinDato.titulo,
        cuerpo: "Abrí Cota Cero para ver cuánto mide hoy.",
        urgente: false,
        ir: "/app",
      };
    case "superado":
      /* El más importante de los ocho, y el que más se pasaba de largo: a
         203 caracteres Android lo cortaba justo antes del 103. Se va la
         explicación —"el agua puede llegar aunque no la veas" ya está en la
         pantalla— y queda la acción, el dato y el teléfono. */
      return {
        titulo: ESTADOS.superado.titulo,
        cuerpo:
          ESTADOS.superado.verbo +
          ` El río está en ${nm(nivel, 2)} m y tu nivel de aviso es ${mU(umbral)}. ` +
          ESTADOS.evacuacion.verbo +
          " 103.",
        urgente: true,
        ir: "/app?ir=plan",
      };
    case "evacuacion":
      return {
        titulo: `${ESTADOS.evacuacion.titulo}: ${nm(nivel, 2)} m`,
        cuerpo:
          ESTADOS.evacuacion.verbo +
          ` El río pasó los ${nm(evacuacion, 2)} m. ` +
          "No cruces agua que corre: con 30 cm te arrastra. Ayuda: 103.",
        urgente: true,
        ir: "/app?ir=ahora",
      };
    case "alerta":
      return {
        titulo: `${ESTADOS.alerta.titulo}: ${nm(nivel, 2)} m`,
        cuerpo:
          ESTADOS.alerta.verbo +
          ` El río pasó los ${nm(alerta, 2)} m: afuera del terraplén ya empiezan a sacar gente. ` +
          "Dudas: 103.",
        urgente: true,
        ir: "/app?ir=ahora",
      };
    case "cerca":
      return {
        titulo: `Faltan unos ${mCm(falta)} para tu nivel de aviso`,
        cuerpo:
          `El río está en ${nm(nivel, 2)} m; tu nivel de aviso es ${mU(umbral)}. ` +
          ESTADOS.cerca.verbo,
        urgente: true,
        ir: "/app?ir=plan",
      };
    case "acercandose":
      return {
        titulo: `Faltan unos ${mCm(falta)} para tu nivel de aviso`,
        cuerpo: `El río está en ${nm(nivel, 2)} m. ` + ESTADOS.acercandose.verbo,
        urgente: false,
        ir: "/app?ir=plan",
      };
    case "subio":
      return {
        titulo: `El río subió a ${nm(nivel, 2)} m`,
        cuerpo: `Faltan unos ${mCm(falta)} para tu nivel de aviso (${mU(umbral)}). Por ahora, seguí mirando.`,
        urgente: false,
        ir: "/app",
      };
    default:
      return {
        titulo: `El río subió a ${nm(nivel, 2)} m`,
        cuerpo:
          "Cargá tu casa en la app y te avisamos cuando el río importe para vos.",
        urgente: false,
        ir: "/app?ir=cota",
      };
  }
}

  raiz.CC_COMUN = { UMBRALES_RESPALDO, umbralesDe, VENCE_HORAS, nm, m, mU, mCm, ESTADOS, ATENCION_ANTES_M, faltaCm, estadoDe, textoGrave, avisoDe };
})(typeof self !== "undefined" ? self : globalThis);
