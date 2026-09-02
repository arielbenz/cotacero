/* ==========================================================================
   COTA CERO — Santa Fe
   --------------------------------------------------------------------------
   MODELO HIDROLÓGICO
   El cero del hidrómetro del Puerto de Santa Fe está a ~8,20 m IGN.
   Entonces:   cota del agua (IGN) = lectura del hidrómetro + 8,20
   El río tiene pendiente natural: aguas arriba el mismo evento da cota más alta.
   Pendiente ~0,045 m por km.
   Verificación con la crecida de junio 1992:
     puerto 7,43 m -> 15,62 IGN.  Arroyo Leyes, 24 km arriba:
     15,62 + (0,045 x 24) = 16,70 IGN  <- coincide con el valor publicado.
   Es UNA sola validación independiente. Coincide bien, pero coincidir con una
   única crecida histórica no convierte esto en un modelo predictivo: falta la
   revisión de especialistas y organismos competentes (Dirección de Gestión de
   Riesgos, INA, FICH-UNL). Hasta entonces, lo que la app calcula son niveles
   de referencia estimados.
   Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m.

   TRES CONCEPTOS, TRES NOMBRES — nunca intercambiarlos en la interfaz:
     nivel del río     la lectura del hidrómetro del Puerto (dato oficial INA).
     cota del terreno  la elevación IGN del terreno, de las curvas del
                       municipio, con +-0,5 m de margen.
     umbral estimado   la lectura del hidrómetro a partir de la cual el nivel
                       de agua equivalente alcanzaría esa cota, según el modelo.
   Llamarle "tu cota" al umbral está prohibido: son cosas distintas y mezclarlas
   es exactamente lo que hacía sonar esto como una predicción de inundación.
   ========================================================================== */

/* ==========  CONFIGURACIÓN  ==========
   Lo único que tenés que tocar para poner esto en marcha. */
const CONFIG = {
  // Clave pública VAPID para los avisos. Se genera con `node scripts/vapid.js`
  // y la privada va SÓLO en las variables de entorno de Vercel.
  // Vacía = avisos apagados; la app funciona igual.
  VAPID_PUBLIC_KEY:
    "BLbYpcsVuEVYGieE3kyi-Yj3ZRXCPCoWh28nkeBZmTBTmriOcHuXLV7n8W88E__e-f-Ph40Eqpotf6vSWM9E-lQ",

  // La funcion serverless que lee el nivel del INA.
  // En local con `vercel dev`: '/api/nivel' funciona igual.
  NIVEL_ENDPOINT: "/api/nivel",
};

/* El reporte diario del INA. La app no lo lee desde el navegador —para eso
   está /api/nivel, que esquiva la falta de CORS—, pero sí lo enlaza en todas
   las pantallas donde muestra el nivel: quien quiera comprobar el número
   tiene que poder llegar al original en un toque. */
const FUENTE_RIO = "https://alerta.ina.gob.ar/a5/diario/reporte_diario";

/* De dónde sale cada cosa, para poder decirlo en la pantalla donde se muestra
   y no sólo en /datos. Es el mismo contenido que lib/fuentes.js, que es el
   original: acá va la copia mínima que necesita la interfaz —tres datos y sus
   enlaces— porque app.js es un script clásico y no puede importar módulos.
   Si cambia una URL, cambia en lib/fuentes.js y se refleja acá a mano. */
const FUENTES_APP = {
  rio: { quien: "INA", url: FUENTE_RIO },
  topografia: {
    quien: "Curvas de nivel · Municipalidad de Santa Fe",
    url: "https://geo.santafeciudad.gov.ar/",
  },
  emergencias: {
    quien: "Gestión de Riesgos · Municipalidad de Santa Fe",
    url: "https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/plan-de-contingencia/",
  },
};

/* El sello de fuente: quién publica el dato y adónde ir a mirarlo. Discreto a
   propósito — la trazabilidad tiene que estar siempre disponible sin competir
   con el número. */
const selloFuente = (f) =>
  '<span class="sello-fuente"><span class="k">Fuente</span> ' +
  atr(f.quien) +
  ' <a href="' +
  atr(f.url) +
  '" target="_blank" rel="noopener">ver</a></span>';

const CERO_IGN = 8.2;
const PENDIENTE = 0.045;
/* Los umbrales oficiales del Puerto. Van con `let` y no con `const` porque
   desde que la app lee la API del INA los publica la propia estación
   (`nivel_alerta` / `nivel_evacuacion`): estos valores son el arranque y el
   respaldo para cuando contesta el reporte diario, que no los trae. Si el INA
   los corrigiera, la app se entera sola en vez de mostrar dos números
   distintos que los de la fuente. */
let ALERTA = 5.3;
let EVACUACION = 5.7;
/* El récord vigente del hidrómetro del Puerto. Da la escala real de la
   decisión: de la alerta al récord hay poco más de dos metros, y sin esa
   marca la evacuación parece el techo del mundo.

   Va con `let` porque ya no está escrito a mano: sale de datos/historia.json,
   que `node scripts/historia.js` arma con la serie del INA desde 1925. Estos
   valores son el arranque, para que la regla se dibuje bien antes de que el
   archivo llegue —y si alguna crecida rompe el récord, se actualiza volviendo
   a correr el script, no editando este renglón. */
let RECORD = 7.43;
let RECORD_ANIO = 1992;
const etiquetaRecord = () => "Récord " + RECORD_ANIO;
const ESCALA_MIN = 0;
const ESCALA_MAX = 8;
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
const ERROR_DEM = 0.5;
const VENCE_HORAS = 48; // a partir de acá el dato guardado no se presenta como vigente
const REFRESCO_MS = 5 * 60 * 1000; // piso entre refrescos automáticos
const PRECISION_MAX = 100; // error de GPS, en metros, arriba del cual no consultamos elevación

/* Los km sólo están publicados para Arroyo Leyes (24). El resto son
   estimaciones propias, y a 4,5 cm por km equivocarse 5 km son 22 cm: el
   mismo orden que los márgenes con los que se decide. Lo decimos en pantalla,
   no sólo en el README. */
const KM_PUBLICADO = new Set(["centro", "leyes"]);

/* Distancia sobre el río desde el hidrómetro del puerto, en km.
   ATENCIÓN: sólo Arroyo Leyes (24 km) está publicado. El resto son
   estimaciones propias y conviene ajustarlas midiendo sobre el cauce. */
const ZONAS = [
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
const MOCHILA = [
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
const PREVIA = [
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
const PUNTOS = [...document.querySelectorAll("#lista-puntos li[data-lon]")].map(
  (li) => [
    li.querySelector(".n").textContent.trim(),
    li.querySelector(".d").textContent.trim(),
    [parseFloat(li.dataset.lon), parseFloat(li.dataset.lat)],
  ],
);

/* Igual que los puntos: el HTML es la fuente. */
const TELEFONOS = [...document.querySelectorAll("#lista-tel li")].map((li) => [
  li.querySelector(".q").textContent.trim(),
  li.querySelector(".n").textContent.trim(),
]);

/* ---------- almacenamiento con degradación elegante ----------
   localStorage falla en algunos visores embebidos y en modo privado.
   Si falla, seguimos en memoria: la app funciona igual durante la sesión. */
const guardado = (() => {
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

/* ---------- cuántos la usan ----------
   Un número al azar por instalación, guardado en el teléfono. No se manda con
   él ninguna otra cosa: ni la cota, ni la zona, ni el plan. Del lado del
   servidor entra a un HyperLogLog, que sabe cuántos distintos vio pero no
   guarda ninguno (ver lib/metricas.js).
   Sirve para una sola pregunta: si 500 aperturas son 500 personas o 30. */
function idInstalacion() {
  let id = guardado.get("cc_id");
  if (!/^[0-9a-f]{24}$/.test(id || "")) {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    guardado.set("cc_id", id);
  }
  return id;
}

/* Una sola vez por sesión, y sin bloquear nada: si falla, falla en silencio.
   Que no se pueda contar no es un problema de quien está usando la app. */
function contarVisita() {
  try {
    if (sessionStorage.getItem("cc_visita") === "1") return;
    sessionStorage.setItem("cc_visita", "1");
  } catch (e) {
    /* en modo privado no hay sessionStorage: se cuenta igual */
  }
  if (navigator.onLine === false) return;
  fetch("/api/visita", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idInstalacion() }),
    keepalive: true,
  }).catch(() => {});
}

/* Las versiones anteriores cacheaban las coordenadas de los 30 puntos en
   localStorage, con prefijos que ya no se usan. Ahora las coordenadas son las
   oficiales del municipio y viven en el código: esas entradas quedaron
   ocupando lugar en el teléfono de cualquiera que haya usado la app antes.
   Se barren una sola vez. */
const CLAVE_LIMPIEZA = "cc_limpieza_1";
function limpiarGuardadoViejo() {
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

let estado = {
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

// Lo sella cargarRio() y lo lee refrescarSiHaceFalta(). Va acá y no al
// lado del listener para no asignarlo antes de su propia declaración.
let ultimoRefresco = 0;

/* ---------------- navegación ---------------- */
/* `desdeHistorial` evita empujar una entrada nueva cuando el cambio de vista
   ya vino del historial (popstate) — si no, atrás y adelante se pelean. */
function ver(id, btn, desdeHistorial) {
  document.querySelectorAll(".vista").forEach((v) => v.classList.remove("on"));
  const panel = document.getElementById("v-" + id);
  panel.classList.add("on");
  document.querySelectorAll(".barra-app button").forEach((b) => {
    b.classList.remove("on");
    b.removeAttribute("aria-current");
  });
  // Ajustes no tiene botón: ninguna pestaña queda marcada, que es lo
  // correcto — no estás en ninguna de las cuatro.
  if (btn) {
    btn.classList.add("on");
    btn.setAttribute("aria-current", "true");
  }
  window.scrollTo(0, 0);
  // Sin esto el foco se queda en el botón de abajo y quien navega con
  // lector de pantalla no se entera de que cambió todo el contenido.
  panel.focus({ preventScroll: true });
  // El mapa se arma la primera vez que se abre la pestaña, no al inicio.
  if (id === "donde") armarMapa();
  // En modo standalone el botón atrás cerraba la app en vez de volver a la
  // pestaña anterior. Usamos el mismo ?ir= que ya leen los accesos directos
  // del manifest, así una vista se puede compartir por link.
  if (!desdeHistorial)
    history.pushState({ vista: id }, "", id === "rio" ? "./" : "?ir=" + id);
}

function irA(id, desdeHistorial) {
  // Ajustes no tiene botón en la barra: se llega desde el engranaje de la
  // cabecera, así la barra de emergencia se queda en cuatro.
  if (id === "ajustes") {
    ver("ajustes", null, desdeHistorial);
    return true;
  }
  const i = { rio: 0, cota: 1, plan: 2, donde: 3 }[id];
  if (i === undefined) return false;
  const b = document.querySelectorAll(".barra-app button")[i];
  if (!b) return false;
  ver(id, b, desdeHistorial);
  return true;
}

window.addEventListener("popstate", (ev) => {
  irA((ev.state && ev.state.vista) || "rio", true);
});

/* ---------------- utilidades ---------------- */
/* Escapa texto para meterlo dentro de un atributo HTML. */
const atr = (t) =>
  String(t)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const m = (v) =>
  v == null || isNaN(v) ? "—" : v.toFixed(2).replace(".", ",") + " m";
/* El umbral NUNCA se muestra con dos decimales. La cota del terreno sale de
   curvas cada 50 cm: el segundo decimal sería precisión inventada, y en un
   número que se usa para decidir si sacar a alguien de la casa la precisión
   inventada se lee como certeza. Un decimal y tilde de aproximación.
   Única excepción: el desglose del cálculo, que conserva la aritmética exacta
   y aclara al pie por qué la pantalla muestra otra cosa. */
const mU = (v) =>
  v == null || isNaN(v)
    ? "—"
    : "≈ " + (Math.round(v * 10) / 10).toFixed(1).replace(".", ",") + " m";
/* El margen contra el umbral también se presenta como aproximado. Debajo del
   metro va en centímetros, que es como se habla de esto cuando falta poco;
   arriba, en metros con un decimal — "217 cm" no lo lee nadie, y el segundo
   decimal sería la misma precisión inventada que en el umbral. */
const mCm = (v) => {
  const a = Math.abs(v);
  return a < 1
    ? Math.round(a * 100) + " cm"
    : (Math.round(a * 10) / 10).toFixed(1).replace(".", ",") + " m";
};
/* Acepta coma o punto. La app muestra "16,40" en todos lados y los campos
   pedían "16.40": la persona escribía lo que veía, el navegador descartaba el
   valor y no pasaba nada, sin ningún aviso. */
const aNumero = (v) =>
  parseFloat(
    String(v ?? "")
      .trim()
      .replace(",", "."),
  );
/* Y al revés, para precargar los campos con el mismo formato que se muestra. */
const enCampo = (v) =>
  v == null || isNaN(v) ? "" : v.toFixed(2).replace(".", ",");
/* null = todavía no eligió zona. Antes arrancaba en "centro" (0 km), que es
   la zona MÁS protegida: quien no tocaba el selector recibía el cálculo más
   optimista, hasta 1,80 m de diferencia contra la zona más expuesta. En una
   app que en todo lo demás elige el escenario pesimista, ese default iba para
   el otro lado. */
const kmDeZona = () => {
  if (!estado.zona) return null;
  if (estado.zona === "otro") return estado.kmManual ?? 0;
  const z = ZONAS.find((z) => z.id === estado.zona);
  return z ? (z.km ?? 0) : 0;
};

/* El INA publica "DD/MM/AAAA HH:MM" y Date no parsea ese formato:
   lo desarmamos a mano. Devuelve null si no se entiende. */
function fechaINA(txt) {
  const p = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(
    txt || "",
  );
  if (!p) return null;
  const d = new Date(+p[3], +p[2] - 1, +p[1], +(p[4] || 0), +(p[5] || 0));
  return isNaN(d.getTime()) ? null : d;
}
const horasDesde = (d) => (d ? (Date.now() - d.getTime()) / 36e5 : null);

/* ================= NIVEL DEL RÍO =================
   El INA publica el nivel de Santa Fe todos los días, pero sin CORS abierto:
   el navegador no puede pedirlo directo. Por eso la fuente 1 es una funcion
   serverless propia (api/nivel.js) que lo lee y lo reexpone.
   Si eso falla, quedan el último valor guardado y la carga manual. */
/* Los umbrales que publica la estación reemplazan a los nuestros, con un
   filtro: sólo si son números plausibles y en el orden correcto. Un cambio
   silencioso de la API no puede dejar la regla con la evacuación por debajo
   de la alerta. */
function adoptarUmbrales(j) {
  const a = j.alerta,
    e = j.evacuacion;
  if (typeof a !== "number" || typeof e !== "number") return;
  if (!(a > 0 && e > a && e < 10)) return;
  if (a === ALERTA && e === EVACUACION) return;
  ALERTA = a;
  EVACUACION = e;
  REFERENCIAS[0][1] = a;
  REFERENCIAS[1][1] = e;
}

async function cargarRio() {
  // Marcamos que estamos buscando: sin esto, entre el "Cargando" inicial y
  // el resultado no había diferencia visible con el estado de falla.
  const ver = document.getElementById("veredicto-rio");
  if (estado.rio == null) ver.classList.add("cargando");
  document.getElementById("origen-dato").textContent =
    "Buscando el nivel del río…";
  let valor = null,
    origen = "",
    extra = "";
  // El delta pertenece a la lectura fresca: si caemos a un valor
  // guardado no corresponde arrastrar el de la sesión anterior.
  estado.delta = null;
  estado.rioFecha = "";
  estado.rioVencido = false;
  ultimoRefresco = Date.now();

  // Fuente 1: nuestra función que lee el reporte diario del INA
  try {
    const r = await fetch(CONFIG.NIVEL_ENDPOINT, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (typeof j.altura === "number") {
        valor = j.altura;
        origen =
          j.origen === "api"
            ? "INA · Sistema de Alerta Hidrológico (SIyAH)"
            : "INA · reporte diario";
        estado.rioVia = j.origen || "";
        estado.rioVerificar = j.verificar || "";
        // El cero IGN que publica el INA para esta escala. No entra en el
        // cálculo —ver /datos, "Discusiones abiertas"—, se guarda para poder
        // mostrarlo al lado del que sí usamos.
        estado.ceroINA = typeof j.cero_ign === "number" ? j.cero_ign : null;
        adoptarUmbrales(j);
        if (j.fecha_dato) {
          extra = " Medición del " + j.fecha_dato + ".";
          estado.rioFecha = j.fecha_dato;
        }
        if (typeof j.delta === "number") estado.delta = j.delta;
        guardado.set("cc_rio_auto", String(j.altura));
        guardado.set("cc_rio_fecha", j.fecha_dato || "");
      }
    }
  } catch (e) {
    /* pasamos a la siguiente */
  }

  // Fuente 2: último valor automático conocido
  if (valor === null) {
    const a = guardado.get("cc_rio_auto");
    if (a) {
      valor = parseFloat(a);
      origen = "último dato del INA guardado";
      // cc_rio_fecha se guardaba y no se leía nunca. Decir de cuándo es
      // el número importa más que avisar en abstracto que puede ser
      // viejo, y pasadas VENCE_HORAS deja de presentarse como vigente:
      // durante una crecida, un nivel de hace cinco días con la misma
      // tipografía que el de hoy es peor que no tener ninguno.
      const f = guardado.get("cc_rio_fecha");
      const horas = horasDesde(fechaINA(f));
      estado.rioFecha = f || "";
      estado.rioVencido = horas === null || horas > VENCE_HORAS;
      extra = f
        ? " Es la medición del " + f + ", no el valor de ahora."
        : " Puede estar desactualizado.";
    }
  }

  // Fuente 3: último valor que cargó la persona
  if (valor === null) {
    const g = guardado.get("cc_rio");
    if (g) {
      valor = parseFloat(g);
      origen = "último valor cargado a mano";
      estado.rioVencido = true; // no sabemos de cuándo es ni de dónde salió
    }
  }

  if (valor === null) {
    estado.rio = null;
    estado.rioOrigen = "";
    document.getElementById("origen-dato").innerHTML =
      '<b style="color:var(--alerta-texto)">Sin dato automático.</b> Cargá la altura a mano acá abajo. ' +
      "La publican el INA, Prefectura y la FICH-UNL todos los días.";
    document.getElementById("det-manual").open = true;
  } else {
    estado.rio = valor;
    estado.rioOrigen = origen;
    /* La fuente deja de ser una frase y pasa a ser algo que se puede abrir.
       Es la diferencia entre "confiá en nosotros" y "andá a mirarlo": el
       enlace apunta al reporte del INA, y cuando contestó la API también al
       pedido exacto que devolvió este número. */
    document.getElementById("origen-dato").innerHTML =
      (estado.rioVencido
        ? '<b style="color:var(--alerta-texto)">Dato vencido.</b> '
        : "") +
      "Fuente: " +
      origen +
      "." +
      extra +
      ' <a href="' +
      atr(FUENTE_RIO) +
      '" target="_blank" rel="noopener">Ver el reporte del INA</a>' +
      (estado.rioVerificar
        ? ' · <a href="' +
          atr(estado.rioVerificar) +
          '" target="_blank" rel="noopener">ver el dato crudo</a>'
        : "");
    if (estado.rioVencido) document.getElementById("det-manual").open = true;
  }
  ver.classList.remove("cargando");
  pintarRio();
  calcular();
}

/* ---- Tendencia del caudal (GloFAS vía Open-Meteo) ----
   Esto SÍ funciona sin servidor ni clave. Ojo: es caudal en m³/s, no altura
   en metros. No sirve para decir "el río está en X", sí para ver si viene
   subiendo o bajando, y trae 7 días de pronóstico. */
async function cargarTendencia() {
  const caja = document.getElementById("tendencia");
  try {
    const u =
      "https://flood-api.open-meteo.com/v1/flood?latitude=-31.63&longitude=-60.70" +
      "&daily=river_discharge&past_days=30&forecast_days=7";
    const r = await fetch(u);
    const j = await r.json();
    const fechas = (j.daily && j.daily.time) || [];
    const bruta = (j.daily && j.daily.river_discharge) || [];
    if (fechas.length !== bruta.length || fechas.length < 10)
      throw new Error("serie corta");

    // El índice de hoy sale de las fechas, no de contar past_days.
    // GloFAS devuelve huecos (null); filtrarlos corría las posiciones y
    // "hoy" terminaba apuntando a otro día sin que fallara nada visible.
    const hoyISO = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    let hoyIdx = fechas.indexOf(hoyISO);
    if (hoyIdx === -1) hoyIdx = fechas.findIndex((f) => f >= hoyISO);
    if (hoyIdx === -1) hoyIdx = fechas.length - 1;

    // Los huecos se rellenan con el valor válido más cercano, sin mover
    // los índices.
    const cerca = (i) => {
      for (let d = 0; d < bruta.length; d++) {
        if (typeof bruta[i - d] === "number") return bruta[i - d];
        if (typeof bruta[i + d] === "number") return bruta[i + d];
      }
      return null;
    };
    const serie = bruta.map((_, i) => cerca(i));

    const hoy = cerca(hoyIdx);
    const haceUnaSemana = cerca(Math.max(0, hoyIdx - 7));
    const futuro = cerca(bruta.length - 1);
    if (hoy == null || haceUnaSemana == null || futuro == null)
      throw new Error("sin datos");

    // Sin este guard, un caudal de referencia en 0 daba "+Infinity%".
    const variacion = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const camb = variacion(hoy, haceUnaSemana);
    const proy = variacion(futuro, hoy);
    if (camb === null) throw new Error("referencia en cero");

    let flecha, color, txt;
    if (camb > 8) {
      flecha = "↗";
      color = "var(--alerta)";
      txt = "Viene subiendo";
    } else if (camb < -8) {
      flecha = "↘";
      color = "var(--ok)";
      txt = "Viene bajando";
    } else {
      flecha = "→";
      color = "var(--tenue)";
      txt = "Estable";
    }

    caja.innerHTML = `<span class="eti">Caudal del Paraná · modelo GloFAS</span>
<div class="tend">
  <div class="flecha" style="color:${color}">${flecha}</div>
  <div>
    <div style="font-family:var(--sans);font-weight:700;font-size: var(--t-l);
      letter-spacing:.03em;text-transform:uppercase;color:${color}">${txt}</div>
    <div class="chico">${camb >= 0 ? "+" : ""}${camb.toFixed(0)}% en los últimos 7 días${
      proy === null
        ? ""
        : ` · proyección a 7 días: ${proy >= 0 ? "+" : ""}${proy.toFixed(0)}%`
    }</div>
  </div>
</div>
${sparkline(serie, hoyIdx)}
<p class="chico" style="margin:9px 0 0">Es caudal simulado en metros cúbicos por segundo,
  no la altura del hidrómetro. Sirve para ver la tendencia, no para decidir.</p>`;
  } catch (e) {
    caja.innerHTML =
      '<span class="eti">Tendencia</span>' +
      '<p class="chico" style="margin:0">No se pudo cargar el modelo de caudal.</p>';
  }
}

function sparkline(serie, corte) {
  const w = 300,
    h = 46,
    min = Math.min(...serie),
    max = Math.max(...serie),
    rango = max - min || 1;
  const px = (i) => (i / (serie.length - 1)) * w;
  const py = (v) => h - ((v - min) / rango) * (h - 6) - 3;
  const pasado = serie
    .slice(0, corte + 1)
    .map((v, i) => `${px(i)},${py(v)}`)
    .join(" ");
  const futuro = serie
    .slice(corte)
    .map((v, i) => `${px(i + corte)},${py(v)}`)
    .join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
    role="img" aria-label="Curva del caudal: ${corte + 1} días pasados y la proyección
    de los ${serie.length - corte - 1} siguientes. Los números están en el texto de arriba.">
    <polyline points="${pasado}" fill="none" stroke="var(--agua)" stroke-width="2"/>
    <polyline points="${futuro}" fill="none" stroke="var(--acento)"
stroke-width="2" stroke-dasharray="4 3"/>
    <line x1="${px(corte)}" y1="0" x2="${px(corte)}" y2="${h}"
stroke="var(--linea)" stroke-width="1"/></svg>`;
}

function fijarRioManual() {
  const campo = document.getElementById("in-rio");
  const est = document.getElementById("origen-dato");
  const v = aNumero(campo.value);
  // Un alert() interrumpe, no queda en pantalla y un lector lo anuncia
  // fuera de contexto. #origen-dato ya es una región viva.
  if (isNaN(v)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Escribí un número</b>, por ejemplo 3,40.';
    campo.focus();
    return;
  }
  if (v < -1 || v > 10) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Ese valor está fuera de la escala del hidrómetro</b> ' +
      "(−1 a 10 m). El récord de " + RECORD_ANIO + " fue " + m(RECORD) + ".";
    campo.focus();
    return;
  }
  estado.rio = v;
  estado.rioOrigen = "cargado a mano";
  estado.delta = null;
  estado.rioVencido = false;
  estado.rioFecha = "";
  guardado.set("cc_rio", String(v));
  document.getElementById("origen-dato").textContent =
    "Fuente: cargado a mano.";
  document.getElementById("det-manual").open = false;
  pintarRio();
  calcular();
}

/* ---------------- la regla (elemento firma) ---------------- */
function pintarRio() {
  const regla = document.getElementById("regla");
  const pct = (v) => ((v - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100;

  // La escala vive en su propia columna, al lado de la pista y no encima.
  let escala = "";
  for (let t = ESCALA_MIN; t <= ESCALA_MAX; t += 0.5) {
    const mayor = Number.isInteger(t);
    escala += `<div class="tic ${mayor ? "mayor" : ""}" style="bottom:${pct(t)}%"></div>`;
    if (mayor)
      escala += `<div class="tic-num" style="bottom:${pct(t)}%">${t}</div>`;
  }
  document.getElementById("escala").innerHTML = escala;

  let html = "";
  const r = estado.rio;
  html += `<div class="agua" style="height:${r == null ? 0 : Math.max(0, Math.min(100, pct(r)))}%"></div>`;
  // "debajo": la etiqueta de alerta va del otro lado de su línea porque si no
  // se monta con la de evacuación, que está a 40 cm — 15px en esta escala.
  // Los números salen de las constantes, no escritos a mano: desde que los
  // publica la estación podrían no ser 5,30 y 5,70 para siempre.
  html += `<div class="marca-linea debajo" style="bottom:${pct(ALERTA)}%;color:var(--alerta-texto)"><b style="color:var(--alerta-texto)">${m(ALERTA).replace(" m", "")}</b></div>`;
  html += `<div class="marca-linea" style="bottom:${pct(EVACUACION)}%;color:var(--peligro-texto)"><b style="color:var(--peligro-texto)">${m(EVACUACION).replace(" m", "")}</b></div>`;
  // El récord de 1992 en tono tenue: no es un umbral que haya que cruzar, es
  // la escala. Sin él, 5,70 parece el techo del mundo.
  html += `<div class="marca-linea" style="bottom:${pct(RECORD)}%;color:var(--tenue)"><b>${m(RECORD).replace(" m", "")}</b></div>`;

  // tu umbral estimado, en la escala del hidrómetro
  const critico = cotaEnHidrometro();
  if (critico !== null && critico >= ESCALA_MIN && critico <= ESCALA_MAX) {
    html += `<div class="marca-linea propia" style="bottom:${pct(critico)}%;color:var(--tierra)">
       <b>vos</b></div>`;
  }
  regla.innerHTML = html;

  document.getElementById("lg-actual").textContent =
    r == null ? "sin dato" : m(r);
  const wrap = document.getElementById("lg-cota-wrap");
  if (critico !== null) {
    wrap.style.display = "block";
    document.getElementById("lg-cota").textContent = mU(critico);
    document.getElementById("lg-cota-k").textContent = estado.cotaEsEstimada
      ? "Tu umbral estimado, con la cota interpolada entre las curvas del municipio y el margen ya descontado"
      : "Tu umbral estimado: la lectura de referencia en el puerto para tu terreno";
  } else wrap.style.display = "none";

  pintarVeredictoRio();
  pintarPie();
  pintarCtaCota();
  guardarUmbral();
  pintarAvisos();

  // Las dos leen estado.rio, así que se repintan con el mismo dato.
  pintarContexto();
  pintarBienvenida();
}

/* Sin cota, la app no puede responder su propia pregunta — y en la pestaña
   Río eso no se decía en ningún lado: el renglón del umbral simplemente no
   aparecía. */
function pintarCtaCota() {
  const cta = document.getElementById("cta-cota");
  if (!cta) return;
  if (estado.cota != null && estado.zona) {
    /* Con el umbral ya cargado, este hueco no queda vacío: lleva LA línea de
       contexto de la pantalla. Una sola, no un bloque legal — el descargo
       completo vive en la pestaña Mi umbral y en /legal. */
    cta.innerHTML =
      '<div class="aviso" style="margin-bottom:14px">Tu umbral se estima con la ' +
      "cota de tu terreno (±0,5 m) y la pendiente del río: una referencia para " +
      "prepararte, <b>no el momento exacto en que entra el agua</b>.</div>";
    return;
  }
  cta.innerHTML =
    '<div class="aviso" style="margin-bottom:14px"><b>Todavía no sé dónde vivís.</b> ' +
    "Con tu zona y la cota de tu terreno estimo tu umbral: la lectura del " +
    "hidrómetro que te sirve de referencia." +
    '<button class="btn mini" style="margin-top:11px;display:block" data-accion="ir" data-vista="cota">' +
    "Calcular mi umbral</button></div>";
}

/* El pie decía "Actualizado <hoy>": la fecha del render, no la del dato. Abajo
   de todo la app afirmaba estar al día aunque el nivel fuera de hace cinco
   días, justo lo contrario de lo que dice el cartel de vencido. */
function pintarPie() {
  const el = document.getElementById("version");
  if (!el) return;
  el.textContent = estado.rioFecha
    ? "Nivel del río: medición del " + estado.rioFecha
    : estado.rio == null
      ? ""
      : "Nivel del río: " + estado.rioOrigen;
}

/* Cuántas cosas faltan en la mochila. Lo usan el veredicto y el contador. */
const faltanMochila = () =>
  MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1").length;

function pintarVeredictoRio() {
  const c = document.getElementById("veredicto-rio");
  const r = estado.rio;
  if (r == null) {
    // Lo primero que veía alguien que abre la app por primera vez era
    // "FALTA EL NIVEL DEL RÍO" en tipografía gigante: un reporte de lo que
    // no anda, antes de explicar para qué sirve. Ahora la pantalla vacía
    // dice qué hace la app, y el problema va en segundo plano.
    c.className = "veredicto v-neutro";
    c.innerHTML =
      '<div class="titu">¿Hasta dónde llega el agua?</div>' +
      '<p class="chico" style="margin:0 0 10px">Te dice <b>a qué altura del río ' +
      "el agua llega a tu terreno</b>. En muchas zonas eso pasa antes que la " +
      "alerta general de 5,30 m.</p>" +
      '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">Ahora mismo ' +
      "no pudimos leer el nivel del INA.</b> Cargalo a mano acá abajo, o probá de " +
      "nuevo en un rato.</p>";
    return;
  }
  let cls, titu, txt;
  if (r >= EVACUACION) {
    cls = "v-peligro";
    titu = "Nivel de evacuación";
    txt =
      "El río superó los 5,70 m. Seguí las indicaciones de Defensa Civil y del municipio.";
  } else if (r >= ALERTA) {
    cls = "v-peligro";
    titu = "Nivel de alerta";
    txt =
      "El río superó los 5,30 m. A esta altura arrancan las evacuaciones en los sectores fuera del anillo de defensas.";
  } else if (r >= 4.3) {
    cls = "v-alerta";
    titu = "Atención";
    txt =
      "Faltan " +
      m(ALERTA - r).replace(" m", "") +
      " m para el nivel de alerta. Buen momento para tener la mochila lista.";
  } else {
    cls = "v-ok";
    titu = "Nivel normal";
    txt =
      "Faltan " +
      m(ALERTA - r).replace(" m", "") +
      " m para el nivel de alerta. Es el momento de prepararse, no de esperar.";
  }
  // El INA publica la diferencia contra el registro anterior y hasta
  // ahora se guardaba sin mostrarse nunca.
  const d = estado.delta;
  const mov =
    typeof d === "number" && Math.abs(d) >= 0.01
      ? `<div class="chico" style="margin:-3px 0 8px">${d > 0 ? "▲ subió" : "▼ bajó"} ${Math.abs(
          d,
        )
          .toFixed(2)
          .replace(".", ",")} m desde la medición anterior</div>`
      : "";
  // Un dato vencido se sigue mostrando, pero nunca con la cara de un
  // dato de hoy: el cartel va arriba de todo, antes que el número.
  const vencido = estado.rioVencido
    ? `<div class="aviso grave" style="margin:0 0 12px"><b>Este dato no es de ahora.</b>
  ${
    estado.rioFecha
      ? "Es la medición del " + estado.rioFecha + "."
      : "No sabemos de cuándo es."
  }
  No hay conexión con el INA. Cargá la altura a mano acá abajo antes de decidir nada con este número.</div>`
    : "";
  /* La fila del umbral. Es lo que convierte esta tarjeta de "cómo está el río"
     en "qué significa para mí": la lectura oficial grande arriba, y debajo el
     umbral propio con el margen de hoy, en dos celdas que se leen de un golpe.
     Sin umbral cargado no se dibuja: la CTA de más abajo se encarga. */
  const u = cotaEnHidrometro();
  let celdas = "";
  if (u != null) {
    const margen = u - r;
    const superado = margen <= 0;
    // El estado del margen manda sobre el color de la tarjeta: si el río pasó
    // tu umbral, que la ciudad esté en "nivel normal" es un detalle.
    if (superado) cls = "v-peligro";
    else if (margen <= 0.5 && cls === "v-ok") cls = "v-alerta";
    const tono = superado ? "peligro" : cls === "v-ok" ? "ok" : "alerta";
    celdas =
      '<div class="celdas-umbral">' +
      '<div class="celda"><span class="k">Tu umbral estimado</span>' +
      '<span class="v">' +
      mU(u) +
      "</span></div>" +
      '<div class="celda t-' +
      tono +
      '"><span class="k">Margen hoy</span><span class="v">' +
      (superado ? "superado" : "≈ " + mCm(margen)) +
      "</span></div></div>";
    /* Y una oración en prosa, que es como esto se cuenta en la vereda.
       El ritmo sale del delta que publica el INA, no de una proyección propia:
       sin delta no se promete ningún plazo. */
    const dias = typeof d === "number" && d >= 0.02 ? margen / d : null;
    // Más de diez días de proyección no es información, es ruido: el río no se
    // mueve en línea recta y prometer un plazo así sería inventar un futuro.
    const ritmo =
      !superado && dias != null && dias <= 10
        ? " Al ritmo de la última medición, unos " +
          (dias < 1.5
            ? Math.round(dias * 24) + " horas"
            : Math.round(dias) + " días") +
          "."
        : "";
    txt = superado
      ? "El nivel superó tu umbral estimado (" +
        mU(u) +
        "). Aunque no veas agua todavía, mové personas y medicación y seguí a Defensa Civil."
      : "El río está a unos " +
        mCm(margen) +
        " de tu umbral estimado (" +
        mU(u) +
        ")." +
        ritmo;
    if (superado) titu = "El río superó tu umbral";
    else if (margen <= 0.5) titu = "Cerca de tu umbral";
  }
  // Con el río en alerta la app tenía todo para decir "te faltan 7 cosas de
  // la mochila" y no lo decía: las dos pestañas no se hablaban.
  const falta = faltanMochila();
  const plan =
    cls === "v-ok"
      ? ""
      : `<p class="chico" style="margin:10px 0 0;padding-top:9px;border-top:1px solid var(--linea)">${
          falta
            ? "Te faltan <b>" + falta + "</b> cosas de la mochila."
            : "Tu mochila está completa."
        }<button class="btn mini" style="margin-top:9px;display:block" data-accion="ir" data-vista="plan">Abrir mi plan</button></p>`;
  c.className = "veredicto " + cls;
  c.innerHTML = `${vencido}<div class="titu">${titu}</div>
    <div class="dato" style="margin-bottom:6px">${m(r)}<span class="unidad"> en el puerto</span></div>
    ${mov}
    ${celdas}
    <p class="chico" style="margin:0">${txt}</p>${plan}`;
}

/* ================= LLUVIA ================= */
async function cargarLluvia() {
  try {
    const u =
      "https://api.open-meteo.com/v1/forecast?latitude=-31.63&longitude=-60.70" +
      "&daily=precipitation_sum&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=7";
    const r = await fetch(u);
    const j = await r.json();
    estado.lluvia = j.daily;
    pintarLluvia();
  } catch (e) {
    document.getElementById("dias").innerHTML =
      '<p class="chico" style="grid-column:1/-1">No se pudo cargar el pronóstico. Revisá la conexión.</p>';
  }
}

const MM_ESCALA = 60; // tope de la barra, en mm
const MM_UMBRAL = 40; // desde acá el desagote se complica

function pintarLluvia() {
  const d = estado.lluvia;
  if (!d) return;
  const dd = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
  let html = "",
    total = 0,
    pico = 0;
  d.time.forEach((f, i) => {
    const mm = d.precipitation_sum[i] ?? 0;
    total += mm;
    pico = Math.max(pico, mm);
    const fecha = new Date(f + "T12:00:00");
    const cls = mm >= 40 ? "fuerte" : mm >= 1 ? "hay" : "";
    // Escala fija de 60 mm para que las semanas se puedan comparar entre sí;
    // con una escala relativa al máximo, una semana seca se vería igual de
    // dramática que una de tormenta.
    const alto = Math.min(100, (mm / MM_ESCALA) * 100);
    html += `<div class="dia ${mm >= 40 ? "fuerte" : ""}">
<div class="d">${dd[fecha.getDay()]}</div>
<div class="mm ${cls}">${mm >= 1 ? Math.round(mm) : "·"}</div>
<div class="barra" role="img" aria-label="${Math.round(mm)} milímetros">
<u style="bottom:${(MM_UMBRAL / MM_ESCALA) * 100}%"></u>
<i style="height:${alto}%"></i></div></div>`;
  });
  document.getElementById("dias").innerHTML = html;
  const res = document.getElementById("lluvia-resumen");
  if (total < 5)
    res.textContent = "Semana seca: " + Math.round(total) + " mm acumulados.";
  else if (pico >= 40)
    res.innerHTML =
      '<b style="color:var(--alerta-texto)">Se esperan ' +
      Math.round(pico) +
      " mm en un solo día.</b> Con el río alto, las bombas tardan más en desagotar.";
  else res.textContent = Math.round(total) + " mm acumulados en la semana.";
}

/* ================= CÁLCULO DE COTA ================= */
/* Traduce una cota IGN a lectura de hidrómetro.
   Por defecto devuelve el escenario PESIMISTA: si la cota vino del modelo
   interpolada le descuenta el margen de error, porque ése es el número con el
   que hay que decidir. Antes la regla usaba el crudo y el veredicto el
   pesimista, así que las dos pantallas mostraban a la vez valores con hasta
   3 m de diferencia para lo mismo — y la regla mostraba el optimista.
   `crudo: true` da la traducción sin margen, sólo para el desglose. */
function cotaEnHidrometro({ crudo = false } = {}) {
  if (estado.cota == null || kmDeZona() === null) return null;
  const cota =
    !crudo && estado.cotaEsEstimada ? estado.cota - ERROR_DEM : estado.cota;
  return cota - CERO_IGN - PENDIENTE * kmDeZona();
}

/* Los km a mano se persisten. `iniciar()` los leía de cc_km pero nadie
   escribía nunca esa clave: se perdían en cada recarga y el cálculo volvía
   en silencio a 0 km. */
function fijarKmManual(v) {
  estado.kmManual = aNumero(v) || 0;
  guardado.set("cc_km", String(estado.kmManual));
  calcular();
  pintarRio();
}

/* De dónde salió la cota que estamos usando. Lo consumen el renglón de
   estado, el desglose del cálculo y el plan exportado, así que la respuesta
   es siempre la misma en todos lados. */
function origenCota() {
  if (estado.cota == null) return null;
  if (estado.cotaOrigen === "gps")
    return {
      corto: "tu ubicación de ese momento",
      largo:
        "Sale de <b>dónde estabas parado</b> cuando tocaste el botón" +
        (estado.cotaDetalle ? " (" + atr(estado.cotaDetalle) + ")" : "") +
        ". Si no era tu casa, este número no sirve.",
      ojo: true,
    };
  if (estado.cotaOrigen === "direccion")
    return {
      corto: "una dirección buscada",
      largo:
        "Sale de la dirección <b>" +
        atr(estado.cotaDetalle || "que buscaste") +
        "</b>. Verificá que sea la tuya.",
      ojo: false,
    };
  return { corto: "lo que cargaste a mano", largo: "", ojo: false };
}

/* Deja el renglón de estado diciendo SIEMPRE de dónde salió la cota, no sólo
   justo después de la acción. */
function pintarOrigenCota() {
  const e = document.getElementById("estado-cota");
  const o = origenCota();
  if (!o) return (e.innerHTML = "");
  e.innerHTML =
    "Cota <b>" +
    m(estado.cota) +
    "</b>, tomada de " +
    (o.ojo
      ? '<b style="color:var(--alerta-texto)">' + o.corto + "</b>"
      : "<b>" + o.corto + "</b>") +
    "." +
    (o.largo ? " " + o.largo : "") +
    /* De dónde salió la altura, en el mismo renglón donde se la muestra. La
       cota que la persona carga a mano es suya, no nuestra: ahí no
       corresponde atribuir nada. */
    (estado.cotaEsEstimada ? selloFuente(FUENTES_APP.topografia) : "");
}

function marcarCotaManual() {
  const campo = document.getElementById("in-cota");
  const v = aNumero(campo.value);
  const est = document.getElementById("estado-cota");
  if (campo.value.trim() && isNaN(v)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">No entiendo ese número.</b> Escribilo así: 16,40.';
    return;
  }
  if (!isNaN(v) && (v < 0 || v > 40)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Esa cota está fuera de rango</b> (0 a 40 m sobre el nivel del mar).';
    return;
  }
  estado.cota = isNaN(v) ? null : v;
  estado.cotaEsEstimada = false;
  estado.cotaOrigen = isNaN(v) ? "" : "mano";
  estado.cotaDetalle = "";
  guardado.set("cc_cota", isNaN(v) ? "" : String(v));
  guardado.set("cc_cota_est", "0");
  guardado.set("cc_cota_origen", estado.cotaOrigen);
  guardado.set("cc_cota_detalle", "");
  pintarOrigenCota();
  calcular();
  pintarRio();
}

async function estimarCota() {
  const e = document.getElementById("estado-cota");
  if (!navigator.geolocation) {
    e.textContent = "Este navegador no da ubicación.";
    return;
  }
  // El GPS puede tardar hasta 12 s. Sin esto el botón queda igual todo ese
  // rato y parece que no hizo nada.
  const liberar = ocupar('[data-accion="cota-gps"]', "Ubicando…");
  e.textContent = "Pidiendo tu ubicación…";
  aLaVista(e);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude: la, longitude: lo, accuracy: prec } = pos.coords;
        // La app es explícita sobre el error del DEM y era muda sobre éste:
        // con un fix de ±800 m el modelo devuelve la elevación de otro
        // terreno, no del tuyo, y el número parece igual de firme.
        if (typeof prec === "number" && prec > PRECISION_MAX) {
          e.innerHTML =
            '<b style="color:var(--alerta-texto)">La ubicación llegó con ±' +
            Math.round(prec) +
            " m de error.</b> A esa distancia el modelo mide otro terreno. " +
            "Probá al aire libre, buscá la dirección, o cargá la cota a mano.";
          return;
        }
        e.textContent = "Buscando entre las curvas de nivel…";
        try {
          const r = await elevacionDe(la, lo);
          if (!r) throw new Error("fuera de cobertura");
          const alt = Math.round(r.cota * 100) / 100;
          estado.cota = alt;
          estado.cotaEsEstimada = true;
          estado.cotaDistancia = r.distancia;
          estado.cotaOrigen = "gps";
          estado.cotaDetalle =
            typeof prec === "number" ? "±" + Math.round(prec) + " m" : "";
          document.getElementById("in-cota").value = enCampo(alt);
          guardado.set("cc_cota", String(alt));
          guardado.set("cc_cota_est", "1");
          guardado.set("cc_cota_origen", "gps");
          guardado.set("cc_cota_detalle", estado.cotaDetalle);
          pintarOrigenCota();
          calcular();
          pintarRio();
        } catch (err) {
          e.innerHTML =
            "<b>No tenemos la cota de ese punto.</b> Las curvas de nivel del " +
            "municipio cubren la ciudad, no toda el área metropolitana. " +
            "Cargá la cota a mano si la conseguís.";
        }
      } finally {
        liberar();
        aLaVista(e);
      }
    },
    (err) => {
      liberar();
      e.textContent =
        err && err.code === 3
          ? "La ubicación tardó demasiado. Probá al aire libre, buscá la dirección, o cargá la cota a mano."
          : "No diste permiso de ubicación. Podés cargar la cota a mano.";
      aLaVista(e);
    },
    { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
  );
}

function calcular() {
  const sel = document.getElementById("sel-zona");
  if (sel) estado.zona = sel.value;

  const z = ZONAS.find((z) => z.id === estado.zona);
  const nz = document.getElementById("nota-zona");
  if (!estado.zona) {
    nz.innerHTML =
      '<span style="color:var(--alerta-texto)">Elegí tu zona</span>: la distancia ' +
      "río arriba cambia el resultado hasta 1,80 m.";
    document.getElementById("resultado").innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta tu zona</div>' +
      '<p class="chico" style="margin:0">Elegila arriba. No la damos por ' +
      "supuesta a propósito: suponer el centro daría el resultado más " +
      "optimista de todos.</p></div>";
    pintarRio();
    return;
  }
  if (estado.zona === "otro") {
    // Sólo lo creamos si todavía no está: rehacer el innerHTML en cada
    // tecla le sacaba el foco al campo mientras la persona escribía.
    if (!document.getElementById("in-km")) {
      nz.innerHTML =
        '<label class="campo" style="margin-top:8px"><span>Km sobre el río, aguas arriba del puerto</span>' +
        '<input type="number" id="in-km" step="1" min="0" max="120" value="' +
        (estado.kmManual ?? 0) +
        '" data-input="km-manual"></label>';
    }
  } else {
    nz.innerHTML =
      (z ? z.nota : "") +
      " A " +
      kmDeZona() +
      " km del hidrómetro, aguas arriba." +
      (KM_PUBLICADO.has(estado.zona)
        ? ""
        : ' <span style="color:var(--alerta-texto)">Esa distancia es una estimación ' +
          "propia, no una medición sobre el cauce.</span>");
  }

  const cont = document.getElementById("resultado");
  if (estado.cota == null) {
    cont.innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta la cota de tu terreno</div>' +
      '<p class="chico" style="margin:0">Cargala arriba y estimo el resto.</p></div>';
    pintarRio();
    return;
  }

  const km = kmDeZona();

  // Con la cota interpolada razonamos siempre con el escenario
  // pesimista, y sale de cotaEnHidrometro() para que la regla, el
  // veredicto y el plan exportado no puedan volver a divergir.
  const cotaPeor = estado.cotaEsEstimada
    ? estado.cota - ERROR_DEM
    : estado.cota;
  const criticoPeor = cotaEnHidrometro();

  const r = estado.rio;
  let html = "";

  // veredicto
  let cls = "v-ok",
    titu = "",
    txt = "";
  const ref = criticoPeor;
  if (r != null && r >= ref) {
    cls = "v-peligro";
    titu = "El río superó tu umbral";
    txt =
      "Con el río en " +
      m(r) +
      ", el nivel de agua equivalente en tu zona alcanza o supera la cota de tu terreno. " +
      "Aunque no veas agua todavía, mové personas y medicación y seguí a Defensa Civil.";
  } else if (ref <= ALERTA) {
    cls = "v-peligro";
    titu = "Tu umbral queda debajo de la alerta";
    txt =
      "Tu umbral estimado es " +
      mU(ref) +
      ", o sea <b>antes</b> de los 5,30 m " +
      "que disparan el aviso general: en este terreno conviene prepararse antes " +
      "de que suene la alerta.";
  } else if (ref <= EVACUACION) {
    cls = "v-alerta";
    titu = "Tu umbral cae en zona de evacuación";
    txt =
      "Tu umbral estimado queda entre los 5,30 y los 5,70 m del hidrómetro: " +
      "el tramo en el que la ciudad ya está evacuando sectores.";
  } else if (ref <= 6.5) {
    cls = "v-alerta";
    titu = "Margen ajustado";
    txt =
      "Tu umbral estimado es " +
      mU(ref) +
      ", por encima del nivel de evacuación, pero dentro del escenario que el " +
      "municipio dice estar planificando.";
  } else {
    cls = "v-ok";
    titu = "Margen amplio";
    txt =
      "Tu umbral estimado es " +
      mU(ref) +
      ". Para dimensionar: el récord de " +
      RECORD_ANIO +
      " fue " +
      m(RECORD) +
      ".";
  }

  html += `<div class="veredicto ${cls}"><div class="titu">${titu}</div>
    <p style="margin:0 0 12px;font-size: var(--t-base)">${txt}</p>
    <span class="eti">Tu umbral estimado · lectura de referencia en el puerto</span>
    <div class="dato">${mU(ref)}</div></div>`;

  // desglose
  html += `<div class="tarjeta"><h3 style="margin-top:0">Cómo sale ese número</h3>
    <table style="width:100%;font-family:var(--mono);font-size: var(--t-s);border-collapse:collapse">
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota de tu terreno<br>
        <span style="font-size: var(--t-xs)">según ${(origenCota() || {}).corto || "—"}</span></td>
  <td style="text-align:right;font-weight:700">${m(estado.cota)} IGN</td></tr>
    ${
      estado.cotaEsEstimada
        ? `<tr><td style="padding:6px 0;color:var(--alerta-texto)">Margen por interpolar entre curvas</td>
  <td style="text-align:right;color:var(--alerta-texto)">− ${ERROR_DEM.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota usada (la pesimista)</td>
  <td style="text-align:right;font-weight:700">${m(cotaPeor)} IGN</td></tr>`
        : ""
    }
    <tr><td style="padding:6px 0;color:var(--tenue)">Cero del hidrómetro</td>
  <td style="text-align:right">− ${CERO_IGN.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Pendiente del río (${km} km × 4,5 cm)${
      KM_PUBLICADO.has(estado.zona)
        ? ""
        : '<br><span style="color:var(--alerta-texto);font-size: var(--t-xs)">distancia estimada, no medida</span>'
    }</td>
  <td style="text-align:right">− ${(PENDIENTE * km).toFixed(2).replace(".", ",")} m</td></tr>
    <tr style="border-top:1px solid var(--linea)">
  <td style="padding:9px 0;font-weight:700">Tu umbral estimado</td>
  <td style="text-align:right;font-weight:700;color:var(--acento)">${m(ref)}</td></tr>
    </table>
    <p class="chico" style="margin:10px 0 0">La app lo muestra como ${mU(ref)}:
la cota del terreno viene de curvas cada 0,5 m, y más decimales serían una
precisión que el dato no tiene.</p>`;

  if (r != null) {
    const falta = ref - r;
    html += `<p class="chico" style="margin:12px 0 0">Hoy el río está en ${m(r)}.
${
  falta > 0
    ? "Faltan unos <b>" + mCm(falta) + "</b> hasta tu umbral estimado."
    : '<b style="color:var(--peligro-texto)">Ya lo superó.</b>'
}</p>`;
  }
  html += "</div>";

  if (estado.cotaEsEstimada) {
    html +=
      '<div class="aviso"><b>Cota interpolada entre curvas de nivel.</b> ' +
      "Sale de las curvas de la Municipalidad de Santa Fe (Secretaría de " +
      "Recursos Hídricos), que vienen cada 50 cm y están en metros IGN, el " +
      "mismo sistema que el cero del hidrómetro." +
      (estado.cotaDistancia != null
        ? " La curva más cercana a ese punto está a " +
          Math.round(estado.cotaDistancia) +
          " m."
        : "") +
      " El cálculo usa el escenario pesimista, medio metro por debajo.<br><br>" +
      "Es un buen dato para orientarte, pero <b>no reemplaza un relevamiento " +
      "de tu terreno</b>: la curva pasa cerca, no por tu puerta.</div>";
  }

  html +=
    '<div class="aviso grave"><b>Esto es una estimación, no una orden.</b> ' +
    "El umbral es una referencia hidráulica: el modelo asume terreno parejo y no " +
    "contempla el anillo de defensas, las bombas, el viento sur que empuja el agua, " +
    "ni las lluvias que se acumulan del lado de adentro. El agua puede llegar antes " +
    "por los desagües, o no llegar si las defensas resisten. " +
    "Y coincide bien con la crecida de 1992 — el único caso usado como control: " +
    "una sola validación no lo convierte en modelo predictivo. " +
    "Si el municipio o Defensa Civil indican evacuar, evacuá aunque acá diga que tenés margen.</div>";

  cont.innerHTML = html;
  pintarRio();
}

/* ================= PLAN ================= */
function pintarListas() {
  /* El sello va sólo en los renglones que están en el plan municipal. Marcar
     los propios en vez de los oficiales daría la lectura contraria: parecería
     que lo normal es lo nuestro y la excepción lo del municipio. */
  const fila = (pre) => ([t, oficial], i) =>
    `<label class="chk"><input type="checkbox" data-k="${pre}${i}"><span>${t}` +
    (oficial ? '<b class="sello-oficial">plan municipal</b>' : "") +
    "</span></label>";
  document.getElementById("lista-mochila").innerHTML =
    MOCHILA.map(fila("mo")).join("");
  document.getElementById("lista-previa").innerHTML =
    PREVIA.map(fila("pv")).join("");

  document.querySelectorAll(".chk input").forEach((cb) => {
    cb.checked = guardado.get("cc_" + cb.dataset.k) === "1";
    cb.addEventListener("change", () => {
      guardado.set("cc_" + cb.dataset.k, cb.checked ? "1" : "0");
      pintarProgreso();
      pintarRio(); // el veredicto muestra cuánto falta de la mochila
      avisarGuardado();
    });
  });
  pintarProgreso();

  ["p-punto", "p-contacto", "p-roles", "p-ayuda", "p-animales"].forEach(
    (id) => {
      const el = document.getElementById(id);
      el.value = guardado.get("cc_" + id) || "";
      el.addEventListener("input", () => {
        guardado.set("cc_" + id, el.value);
        avisarGuardado();
      });
    },
  );

  if (!guardado.ok) {
    document.getElementById("estado-guardado").innerHTML =
      '<b style="color:var(--alerta-texto)">Este navegador no deja guardar.</b> ' +
      "Descargá el plan antes de cerrar la página.";
  }
}
/* 26 casillas sin ninguna señal de avance: nadie sabía si iba por la mitad. */
function pintarProgreso() {
  // El resumen va arriba de la pestaña: los contadores por lista quedaban
  // abajo, donde no se ven al entrar.
  const res = document.getElementById("resumen-plan");
  if (res) {
    const hechos =
      MOCHILA.length -
      faltanMochila() +
      PREVIA.filter((_, i) => guardado.get("cc_pv" + i) === "1").length;
    const total = MOCHILA.length + PREVIA.length;
    res.innerHTML =
      hechos === total
        ? '<b style="color:var(--ok-texto)">Tu plan está completo.</b> Revisalo cada tanto.'
        : "Llevás <b>" +
          hechos +
          " de " +
          total +
          "</b> cosas listas. Te faltan <b>" +
          (total - hechos) +
          "</b>.";
  }
  const poner = (id, hechos, total) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = hechos + " de " + total;
    el.classList.toggle("completa", hechos === total);
  };
  poner("prog-mochila", MOCHILA.length - faltanMochila(), MOCHILA.length);
  poner(
    "prog-previa",
    PREVIA.filter((_, i) => guardado.get("cc_pv" + i) === "1").length,
    PREVIA.length,
  );
}

let tGuardado;
function avisarGuardado() {
  if (!guardado.ok) return;
  const e = document.getElementById("estado-guardado");
  e.textContent = "Guardado en este teléfono.";
  clearTimeout(tGuardado);
  tGuardado = setTimeout(() => (e.textContent = ""), 2200);
}

function textoPlan() {
  const g = (id) => document.getElementById(id).value.trim();
  let t = "PLAN FAMILIAR ANTE CRECIDA — COTA CERO\n";
  t += "Santa Fe · " + new Date().toLocaleDateString("es-AR") + "\n";
  t += "====================================\n\n";
  if (estado.cota != null) {
    t +=
      "Cota del terreno: " +
      m(estado.cota) +
      " IGN, según " +
      ((origenCota() || {}).corto || "—") +
      (estado.cotaDetalle ? " (" + estado.cotaDetalle + ")" : "") +
      "\n";
    t +=
      "Zona: " +
      ((ZONAS.find((z) => z.id === estado.zona) || {}).n || "sin elegir") +
      "\n";
    t +=
      "Umbral estimado (lectura de referencia en el puerto): " +
      mU(cotaEnHidrometro()) +
      (estado.cotaEsEstimada
        ? " (escenario pesimista: la cota interpolada menos " +
          ERROR_DEM.toFixed(2).replace(".", ",") +
          " m)"
        : "") +
      "\n" +
      "Es una estimación, no una orden: la evacuación la indica Defensa Civil (103).\n\n";
  }
  t += "Punto de encuentro: " + (g("p-punto") || "—") + "\n";
  t += "Contacto fuera de la zona: " + (g("p-contacto") || "—") + "\n";
  t += "Animales: " + (g("p-animales") || "—") + "\n\n";
  if (g("p-roles")) t += "QUIÉN HACE QUÉ\n" + g("p-roles") + "\n\n";
  if (g("p-ayuda")) t += "NECESITAN AYUDA PARA SALIR\n" + g("p-ayuda") + "\n\n";
  t += "MOCHILA — falta:\n";
  const faltan = MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1");
  t += faltan.length
    ? faltan
        .map(([x, oficial]) => "  [ ] " + x + (oficial ? "  (plan municipal)" : ""))
        .join("\n")
    : "  Completa.";
  t += "\n\nTELÉFONOS\n";
  TELEFONOS.forEach(([q, n]) => {
    t += "  " + n + "  " + q + "\n";
  });
  t += "\nNo cruzar agua en movimiento, ni a pie ni en auto.\n";
  return t;
}

function exportarPlan() {
  const b = new Blob([textoPlan()], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "plan-familiar-crecida.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function compartirPlan() {
  const t = textoPlan();
  if (navigator.share) {
    navigator
      .share({ title: "Plan familiar ante crecida", text: t })
      .catch(() => {});
  } else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
}

/* ================= MAPA ================= */
let mapa = null,
  mapaPedido = false,
  promesaPuntos = null,
  pinDe = {},
  coordsPuntos = {},
  miPos = null;

/* Geocodifica una dirección con Nominatim (OpenStreetMap). Devuelve
   [lon,lat] o null. Sólo la usa la búsqueda de dirección de la persona: los
   puntos de encuentro tienen coordenadas oficiales y no pasan por acá.
   `bounded=1` con viewbox es un filtro duro, no un sesgo: sin él el
   geocodificador se va a la calle homónima de Rosario o Santo Tomé.
   La política de uso de Nominatim pide no hacer consultas sistemáticas: acá
   va una por búsqueda que inicia la persona, y se cachea en el dispositivo. */
const VIEWBOX_SF = "-60.90,-31.35,-60.45,-31.85";

async function geocodificar(texto, cache = true) {
  // cc_geo4_: cambió el proveedor, la caché anterior no sirve.
  const clave = "cc_geo4_" + texto.replace(/\s+/g, "_").slice(0, 60);
  if (cache) {
    const g = guardado.get(clave);
    if (g) {
      try {
        return JSON.parse(g);
      } catch (e) {}
    }
  }
  try {
    const u =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: texto,
        format: "jsonv2",
        limit: "1",
        viewbox: VIEWBOX_SF,
        bounded: "1",
      });
    const r = await fetch(u, { headers: { Accept: "application/json" } });
    const j = await r.json();
    const f = j && j[0];
    if (!f) return null;
    // Un resultado de tipo "city"/"state" es el centroide de la ciudad, no la
    // dirección: como cota no dice nada. Mejor no devolver nada.
    if (["city", "state", "country", "municipality"].includes(f.addresstype))
      return null;
    const c = [parseFloat(f.lon), parseFloat(f.lat)];
    if (!isFinite(c[0]) || !isFinite(c[1])) return null;
    // Devolvemos también qué encontró y con cuánta precisión. "house"/"building"
    // es la altura exacta; "road" es un punto cualquiera de la calle, que en
    // una avenida larga puede estar a kilómetros. Eso hay que decirlo, no
    // esconderlo detrás de un número que parece firme.
    const res = {
      c,
      nombre: f.display_name || "",
      exacta: ["house", "building", "place"].includes(f.addresstype),
    };
    if (cache) guardado.set(clave, JSON.stringify(res));
    return res;
  } catch (e) {
    return null;
  }
}

/* ---------- elevación del terreno ----------
   Sale de las curvas de nivel de la Municipalidad de Santa Fe (Secretaría de
   Recursos Hídricos), cada 50 cm y en metros IGN: el mismo sistema que el
   cero del hidrómetro. Ver scripts/curvas.js.

   Antes esto consultaba un modelo satelital. Medido contra estas curvas
   sobreestimaba 2,15 m de media, porque mide techos y arbolado en vez del
   piso; y contra los puntos de nivelación del IGN tenía 7,5 m de desvío. Con
   un rango de decisión de 2 m entre la alerta y el récord de 1992, ese dato
   no informaba nada. */

let curvasCache = null;
async function curvas() {
  if (curvasCache) return curvasCache;
  const r = await fetch("/datos/curvas.json");
  if (!r.ok) throw new Error("no se pudieron cargar las curvas");
  curvasCache = await r.json();
  return curvasCache;
}

const M_POR_GRADO_LAT = 110900;
const mPorGradoLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/* Distancia de un punto a un segmento, no a sus extremos. Con la distancia al
   vértice más cercano, simplificar la geometría movía el resultado casi dos
   metros; con esto, dos centímetros. */
function distanciaASegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* Devuelve { cota, distancia } o null si el punto cae fuera de la zona
   cubierta. Preferimos no dar un número antes que dar uno inventado. */
async function elevacionDe(lat, lon) {
  let d;
  try {
    d = await curvas();
  } catch (e) {
    return null;
  }
  const [oe, os, on, ono] = [d.area[0], d.area[1], d.area[2], d.area[3]];
  if (lon < oe || lon > on || lat < os || lat > ono) return null;

  const ml = mPorGradoLon(lat);
  const px = lon * ml,
    py = lat * M_POR_GRADO_LAT;
  // Para cada cota distinta, a qué distancia está su curva más cercana.
  const cercania = new Map();
  for (const [z, p] of d.curvas) {
    let min = Infinity;
    for (let i = 0; i < p.length - 2; i += 2) {
      const q = distanciaASegmento(
        px,
        py,
        p[i] * ml,
        p[i + 1] * M_POR_GRADO_LAT,
        p[i + 2] * ml,
        p[i + 3] * M_POR_GRADO_LAT,
      );
      if (q < min) min = q;
    }
    if (!cercania.has(z) || min < cercania.get(z)) cercania.set(z, min);
  }
  const orden = [...cercania.entries()].sort((a, b) => a[1] - b[1]);
  if (!orden.length) return null;
  const [z1, d1] = orden[0];
  // Se interpola entre las dos curvas de cota DISTINTA más cercanas.
  for (const [z2, d2] of orden.slice(1)) {
    if (z2 !== z1) {
      const t = d1 + d2 === 0 ? 0 : d1 / (d1 + d2);
      return { cota: z1 + (z2 - z1) * t, distancia: d1 };
    }
  }
  return { cota: z1, distancia: d1 };
}

function abrirBuscadorDireccion() {
  document.getElementById("caja-dir").style.display = "block";
  document.getElementById("in-dir").focus();
}

async function buscarDireccion() {
  const q = document.getElementById("in-dir").value.trim();
  const e = document.getElementById("estado-cota");
  if (!q) {
    e.textContent = "Escribí una dirección.";
    return;
  }
  const liberar = ocupar('[data-accion="buscar-dir"]', "Buscando…");
  try {
    e.textContent = "Buscando la dirección…";
    aLaVista(e);
    var r = await geocodificar(q + ", Santa Fe, Argentina", false);
    if (!r) {
      e.textContent = "No se encontró esa dirección. Probá con calle y altura.";
      return;
    }
    e.textContent = "Buscando entre las curvas de nivel…";
    var res = await elevacionDe(r.c[1], r.c[0]);
    if (!res) {
      e.innerHTML =
        "<b>Encontramos la dirección, pero no la cota de ese terreno.</b> Las curvas de " +
        "nivel del municipio cubren la ciudad, no toda el área metropolitana.";
      return;
    }
    var alt = Math.round(res.cota * 100) / 100;
    estado.cotaDistancia = res.distancia;
  } finally {
    liberar();
  }
  estado.cota = alt;
  estado.cotaEsEstimada = true;
  estado.cotaOrigen = "direccion";
  // Guardamos qué encontró, no lo que la persona escribió: el geocodificador
  // puede haber entendido otra cosa, y así se puede desmentir.
  estado.cotaDetalle = r.nombre.split(",").slice(0, 4).join(",").trim();
  document.getElementById("in-cota").value = enCampo(alt);
  guardado.set("cc_cota", String(alt));
  guardado.set("cc_cota_est", "1");
  guardado.set("cc_cota_origen", "direccion");
  guardado.set("cc_cota_detalle", estado.cotaDetalle);
  pintarOrigenCota();
  if (!r.exacta)
    e.innerHTML +=
      ' <b style="color:var(--alerta-texto)">Ubicó la calle, no la altura exacta</b>, ' +
      "así que puede estar a varias cuadras. Si no es tu casa, cargá la cota a mano.";
  calcular();
  pintarRio();
}

/* Baja MapLibre bajo demanda. Una sola vez, aunque se pida de nuevo.
   Va self-hosteado en /vendor: no depende de ningún CDN, el service worker lo
   guarda y así el mapa abre sin conexión (los tiles no, pero la app degrada
   sola). Además deja la CSP con `script-src 'self'` sin excepciones. */
let promesaMapLibre = null;
function cargarMapLibre() {
  if (promesaMapLibre) return promesaMapLibre;
  promesaMapLibre = new Promise((ok, mal) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/maplibre-gl.css";
    // Antes de app.css, no después: si se agrega al final gana el cascade y
    // los popups vuelven al blanco de MapLibre en vez del tema de la app.
    const propio = document.querySelector('link[href="/app.css"]');
    if (propio) document.head.insertBefore(css, propio);
    else document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/vendor/maplibre-gl.js";
    s.onload = () => ok();
    s.onerror = () => mal(new Error("no se pudo cargar maplibre-gl"));
    document.head.appendChild(s);
  });
  return promesaMapLibre;
}

/* Basemap del IGN (Instituto Geográfico Nacional). Sin clave y sin cuota, y
   es el mismo que usa el GeoPortal de la Municipalidad de Santa Fe. El
   servicio es TMS, con la Y contada desde abajo: de ahí scheme "tms".
   Los ajustes de raster lo oscurecen para que entre en el tema de la app. */
const ESTILO_IGN = {
  version: 8,
  sources: {
    ign: {
      type: "raster",
      tiles: [
        "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/" +
          "capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png",
      ],
      scheme: "tms",
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '<a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">Instituto Geográfico Nacional</a> · ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "fondo",
      type: "background",
      paint: { "background-color": "#16292f" },
    },
    {
      id: "ign",
      type: "raster",
      source: "ign",
      // El oscurecido lo hace un filtro CSS sobre el canvas (ver app.css):
      // sobre un basemap claro da mucho mejor resultado que las propiedades
      // raster, que sólo bajan brillo y dejan todo lavado.
      paint: { "raster-saturation": -0.15 },
    },
  ],
};

/* Ubica los 29 puntos EN PARALELO. Antes era un await dentro de un for:
   29 viajes de ida y vuelta en serie en la primera carga de cada dispositivo,
   en 3G decenas de segundos. Va separado de armarMapa() porque la lista, las
   distancias y los links a la app de mapas necesitan las coordenadas aunque
   nunca se abra el mapa. */
function ubicarPuntos() {
  if (promesaPuntos) return promesaPuntos;
  // Ya no se geocodifica nada: las coordenadas son las oficiales del municipio
  // y están en PUNTOS. Sale instantáneo, anda sin red y no consume cuota de
  // ningún proveedor. Sigue siendo una promesa porque armarMapa() la espera.
  for (const [n, , c] of PUNTOS) coordsPuntos[n] = c;
  document.getElementById("estado-mapa").innerHTML =
    PUNTOS.length +
    " puntos de encuentro, ubicados con las coordenadas oficiales del municipio. " +
    "<b>Fijate el recorrido real</b>: el camino más corto puede pasar por zona baja.";
  pintarPuntos();
  promesaPuntos = Promise.resolve();
  return promesaPuntos;
}

async function armarMapa() {
  if (mapa || mapaPedido) return;
  mapaPedido = true;
  const cont = document.getElementById("mapa");
  try {
    await cargarMapLibre();
  } catch (e) {
    cont.innerHTML =
      '<div style="padding:18px"><p class="chico">No se pudo cargar el mapa. ' +
      "La lista de puntos de acá abajo funciona igual.</p></div>";
    mapaPedido = false;
    return;
  }
  mapa = new maplibregl.Map({
    container: "mapa",
    style: ESTILO_IGN,
    center: [-60.7, -31.63],
    zoom: 11,
    attributionControl: { compact: true },
  });
  mapa.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  await ubicarPuntos();
  for (const [n, d] of PUNTOS) {
    const c = coordsPuntos[n];
    if (!c) continue;
    const el = document.createElement("div");
    el.className = "pin";
    el.dataset.nombre = n;
    // MapLibre v5 no acepta `new Marker(elemento)`: hay que pasar {element}.
    // Con la firma vieja ignoraba el pin propio y dibujaba el suyo.
    new maplibregl.Marker({ element: el })
      .setLngLat(c)
      .setPopup(
        new maplibregl.Popup({ offset: 14 }).setHTML(
          `<strong>${n}</strong><br><span style="font-size: var(--t-s);color:#7E959D">${d}</span>`,
        ),
      )
      .addTo(mapa);
    pinDe[n] = el;
  }
}

function distanciaKm(a, b) {
  const R = 6371,
    dLat = ((b[1] - a[1]) * Math.PI) / 180,
    dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function ubicarmeEnMapa() {
  const e = document.getElementById("estado-mapa");
  if (!navigator.geolocation) {
    e.textContent = "Este navegador no da ubicación.";
    return;
  }
  e.textContent = "Pidiendo tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      miPos = [pos.coords.longitude, pos.coords.latitude];
      if (mapa && typeof maplibregl !== "undefined") {
        const el = document.createElement("div");
        el.className = "pin yo";
        new maplibregl.Marker({ element: el })
          .setLngLat(miPos)
          .setPopup(
            new maplibregl.Popup({ offset: 14 }).setHTML(
              "<strong>Estás acá</strong>",
            ),
          )
          .addTo(mapa);
      }
      // Sale de coordsPuntos y no de los marcadores: así funciona
      // aunque el mapa nunca se haya abierto o no haya podido cargar.
      const ubicados = PUNTOS.filter(([n]) => coordsPuntos[n]);
      if (!ubicados.length) {
        e.textContent = "Los puntos todavía no están ubicados.";
        return;
      }
      const orden = ubicados
        .map(([n, d]) => ({
          nombre: n,
          dir: d,
          coord: coordsPuntos[n],
          km: distanciaKm(miPos, coordsPuntos[n]),
        }))
        .sort((a, b) => a.km - b.km);
      const cerca = orden[0];
      Object.values(pinDe).forEach((el) => el.classList.remove("cerca"));
      if (pinDe[cerca.nombre]) pinDe[cerca.nombre].classList.add("cerca");
      if (mapa)
        // MapLibre toma un array plano [a, b] como [sw, ne] al pie de la
        // letra: si vienen al revés arma un bounds invertido y se va al mundo
        // entero (zoom -0.15). Por eso se construye con extend().
        mapa.fitBounds(
          new maplibregl.LngLatBounds(miPos, miPos).extend(cerca.coord),
          { padding: 70, maxZoom: 14 },
        );
      e.innerHTML =
        "El más cercano es <b>" +
        cerca.nombre +
        "</b>, a " +
        cerca.km.toFixed(1) +
        " km en línea recta. <b>Fijate el recorrido real</b>: el camino más " +
        "corto puede pasar por zona baja.";
      pintarPuntos(document.getElementById("buscar-punto").value, cerca.nombre);
    },
    () => {
      e.textContent = "No diste permiso de ubicación.";
    },
    { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
  );
}

/* ================= LISTA DE PUNTOS ================= */
// La lista completa medía cinco pantallas y media de scroll. Arranca corta:
// si diste ubicación, los más cercanos; si no, los primeros. El buscador
// siempre muestra todo lo que coincide.
const PUNTOS_VISIBLES = 6;
let verTodosLosPuntos = false;

function alternarTodosLosPuntos() {
  verTodosLosPuntos = !verTodosLosPuntos;
  pintarPuntos(document.getElementById("buscar-punto").value);
}

function pintarPuntos(filtro = "", destacar = null) {
  const f = filtro.toLowerCase().trim();
  const lista = PUNTOS.filter(
    ([n, d]) =>
      !f || n.toLowerCase().includes(f) || d.toLowerCase().includes(f),
  );
  // Con ubicación conocida, ordenar por distancia: antes quedaba alfabético y
  // había que cazar el resaltado entre 30 filas.
  if (miPos)
    lista.sort(
      (a, b) =>
        distanciaKm(miPos, coordsPuntos[a[0]] || [0, 0]) -
        distanciaKm(miPos, coordsPuntos[b[0]] || [0, 0]),
    );
  const cont = document.getElementById("lista-puntos");
  // Con búsqueda activa mostramos todo lo que coincide: recortar un
  // resultado de búsqueda sería desconcertante.
  const recorta = !f && !verTodosLosPuntos && lista.length > PUNTOS_VISIBLES;
  const ocultos = recorta ? lista.length - PUNTOS_VISIBLES : 0;
  const mostrar = recorta ? lista.slice(0, PUNTOS_VISIBLES) : lista;
  if (!lista.length) {
    cont.innerHTML =
      '<p class="chico">Ningún punto coincide con esa búsqueda.</p>';
    return;
  }
  cont.innerHTML = mostrar
    .map(([n, d]) => {
      const c = coordsPuntos[n];
      // geo: abre la app de mapas que la persona ya tenga en el teléfono
      const href = c
        ? `geo:${c[1]},${c[0]}?q=${c[1]},${c[0]}(${encodeURIComponent(n)})`
        : `geo:0,0?q=${encodeURIComponent(d + ", Santa Fe, Argentina")}`;
      const km =
        miPos && c ? " · " + distanciaKm(miPos, c).toFixed(1) + " km" : "";
      return `<a class="punto ${destacar === n ? "destacado" : ""}" href="${href}"
data-accion="ver-en-mapa" data-nombre="${atr(n)}">
<div class="n">${n}${destacar === n ? ' <span style="color:var(--ok-texto);font-size: var(--t-xs)">· el más cercano</span>' : ""}</div>
<div class="d">${d}${km}</div>
<span class="ir">Abrir en mapas →</span></a>`;
    })
    .join("");
  if (recorta || (!f && verTodosLosPuntos))
    cont.innerHTML +=
      '<button class="btn sec mini" style="margin:12px 0 0;display:block;width:100%" ' +
      'data-accion="ver-todos">' +
      (recorta ? "Ver los otros " + ocultos + " puntos" : "Ver menos") +
      "</button>";
}
function filtrarPuntos() {
  pintarPuntos(document.getElementById("buscar-punto").value);
}
function verEnMapa(n) {
  const c = coordsPuntos[n];
  if (c && mapa) {
    mapa.flyTo({ center: c, zoom: 15 });
  }
}

/* ================= ARRANQUE ================= */
function iniciar() {
  limpiarGuardadoViejo();
  const sel = document.getElementById("sel-zona");
  sel.innerHTML =
    '<option value="" disabled selected>Elegí dónde vivís…</option>' +
    ZONAS.map((z) => `<option value="${z.id}">${z.n}</option>`).join("");

  // Sin default: cualquiera que eligiéramos sería una suposición sobre dónde
  // vive la persona, y la más cómoda —el centro— es la más optimista.
  estado.zona = guardado.get("cc_zona") || "";
  sel.value = estado.zona;
  sel.addEventListener("change", () => {
    guardado.set("cc_zona", sel.value);
    calcular();
  });

  const c = guardado.get("cc_cota");
  if (c) {
    estado.cota = parseFloat(c);
    document.getElementById("in-cota").value = enCampo(estado.cota);
    estado.cotaEsEstimada = guardado.get("cc_cota_est") === "1";
    // Antes acá se perdía el origen: al recargar, una cota del GPS y una de
    // una dirección buscada decían exactamente lo mismo.
    estado.cotaOrigen =
      guardado.get("cc_cota_origen") ||
      (estado.cotaEsEstimada ? "gps" : "mano");
    estado.cotaDetalle = guardado.get("cc_cota_detalle") || "";
    pintarOrigenCota();
  }

  const km = guardado.get("cc_km");
  if (km) estado.kmManual = parseFloat(km);

  pintarListas();
  pintarPuntos();
  pintarRio();
  calcular();
  cargarRio();
  cargarLluvia();
  cargarTendencia();
  // Tarde y sin bloquear: la app tiene que poder decir cuánto mide el río
  // aunque este archivo nunca llegue.
  cargarHistoria();
  // Sólo las coordenadas: el mapa se arma al abrir la pestaña.
  ubicarPuntos().catch(() => {
    document.getElementById("estado-mapa").textContent =
      "No se pudieron ubicar los puntos. La lista de acá abajo funciona igual.";
  });

  pintarPie();
}

/* ---- refresco ----
   Durante una emergencia la app se deja abierta, y hasta ahora el nivel
   quedaba congelado en el momento de la carga. Al volver a primer plano
   revalidamos, con un piso para no golpear al INA de más. */
function refrescarSiHaceFalta() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - ultimoRefresco < REFRESCO_MS) return;
  cargarRio();
  cargarLluvia();
  cargarTendencia();
}
document.addEventListener("visibilitychange", refrescarSiHaceFalta);
window.addEventListener("focus", refrescarSiHaceFalta);

/* La app funciona sin conexión, pero no lo decía en ningún lado: sólo
   avisaba que el dato del río estaba vencido. navigator.onLine miente cuando
   hay wifi sin internet, pero cuando dice que NO hay red, no se equivoca. */
function pintarConexion() {
  const el = document.getElementById("sin-conexion");
  if (!el) return;
  const sinRed = navigator.onLine === false;
  el.hidden = !sinRed;
  if (sinRed)
    el.textContent =
      "SIN CONEXIÓN · estás viendo lo último que se guardó en el teléfono";
}

/* La app recomienda tener los teléfonos anotados en papel y no se podía
   imprimir nada. Imprimimos el mismo texto que exporta y comparte, que ya
   está pensado para leerse de un vistazo. */
function prepararImpresion() {
  const el = document.getElementById("plan-impreso");
  if (el) el.textContent = textoPlan();
}
function imprimirPlan() {
  prepararImpresion();
  window.print();
}

/* Un botón que dispara algo lento tiene que decirlo él mismo. Antes quedaba
   idéntico y la única señal era un renglón gris más abajo que, con el teclado
   abierto en el teléfono, ni se ve. Devuelve la función que lo libera. */
function ocupar(selector, texto) {
  const b = document.querySelector(selector);
  if (!b) return () => {};
  const original = b.textContent;
  b.disabled = true;
  b.textContent = texto;
  return () => {
    b.disabled = false;
    b.textContent = original;
  };
}

/* El renglón de estado vive debajo de los botones: en el teléfono queda tapado
   por el teclado. Lo traemos a la vista. */
function aLaVista(el) {
  try {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (e) {}
}

/* ================= SUGERENCIAS =================
   Lo único de la app que manda texto de la persona a un servidor, y el
   formulario lo dice con todas las letras. */
const SUG_MAX = 600;

function contarSugerencia() {
  const t = document.getElementById("sug-texto");
  const c = document.getElementById("sug-cuenta");
  if (!t || !c) return;
  const n = t.value.trim().length;
  c.textContent = n ? n + " de " + SUG_MAX + " caracteres" : "";
  c.style.color = n > SUG_MAX - 60 ? "var(--alerta)" : "var(--tenue)";
}

async function enviarSugerencia() {
  const est = document.getElementById("sug-estado");
  const texto = document.getElementById("sug-texto").value.trim();
  if (texto.length < 10) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Contanos un poco más</b>, con diez caracteres no se entiende.';
    document.getElementById("sug-texto").focus();
    return;
  }
  const liberar = ocupar('[data-accion="sug-enviar"]', "Enviando…");
  est.textContent = "Enviando…";
  try {
    const r = await fetch("/api/sugerencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: document.getElementById("sug-categoria").value,
        texto,
        contacto: document.getElementById("sug-contacto").value.trim(),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
    document.getElementById("sug-texto").value = "";
    document.getElementById("sug-contacto").value = "";
    contarSugerencia();
    est.innerHTML =
      '<b style="color:var(--ok-texto)">Gracias, llegó.</b> Lo va a leer una persona. ' +
      "Si dejaste contacto y hace falta, te escribimos.";
  } catch (e) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">' +
      atr(e.message) +
      "</b> Podés intentar de nuevo más tarde.";
  } finally {
    liberar();
    aLaVista(est);
  }
}

/* ================= TEMA =================
   El claro existe por legibilidad a pleno sol, no por gusto. El CSS ya sigue
   al sistema por su cuenta; acá sólo aplicamos la elección manual, que gana
   sobre el sistema. */
function temaDelSistema() {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "claro"
    : "oscuro";
}
function temaActual() {
  return document.documentElement.dataset.tema || temaDelSistema();
}
function aplicarTema(t) {
  const raiz = document.documentElement;
  if (t) raiz.dataset.tema = t;
  else delete raiz.dataset.tema;
  const claro = temaActual() === "claro";
  const b = document.getElementById("btn-tema");
  if (b) {
    b.textContent = claro ? "☾" : "☀";
    b.title = claro ? "Pasar a tema oscuro" : "Pasar a tema claro";
  }
  // La barra del sistema en el teléfono también tiene que acompañar.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute(
      "content",
      getComputedStyle(raiz).getPropertyValue("--fondo").trim() ||
        (claro ? "#f2f6f7" : "#0B1418"),
    );
}
function alternarTema() {
  const nuevo = temaActual() === "claro" ? "oscuro" : "claro";
  guardado.set("cc_tema", nuevo);
  aplicarTema(nuevo);
}

/* ================= AVISOS =================
   El servidor manda un push VACÍO: no sabe la cota de nadie ni a qué altura
   avisarle. Guarda un solo dato, el endpoint opaco del navegador. El service
   worker consulta el nivel y lo compara contra el umbral que dejamos acá, en
   el propio teléfono. Por eso cambiar la cota NO requiere avisarle a nadie:
   sólo se reescribe este registro local. */

function baseAvisos() {
  return new Promise((ok, mal) => {
    const p = indexedDB.open("cotacero", 1);
    p.onupgradeneeded = () => p.result.createObjectStore("kv");
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
}

let ultimoUmbralGuardado, ultimoCercaGuardado;
async function guardarUmbral() {
  const u = cotaEnHidrometro();
  const cerca = guardado.get("cc_avisar_cerca") === "1";
  if (u === ultimoUmbralGuardado && cerca === ultimoCercaGuardado) return;
  ultimoUmbralGuardado = u;
  ultimoCercaGuardado = cerca;
  try {
    const db = await baseAvisos();
    const st = db.transaction("kv", "readwrite").objectStore("kv");
    if (u == null) st.delete("umbral");
    else st.put(u, "umbral");
    st.put(cerca, "avisarCerca");
    db.close();
  } catch (e) {
    /* sin IndexedDB los avisos salen en genérico, la app anda igual */
  }
}

const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
const avisosPosibles = () =>
  Boolean(CONFIG.VAPID_PUBLIC_KEY) &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

function claveServidor(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
}

async function suscripcionActual() {
  if (!avisosPosibles()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

async function activarAvisos() {
  const caja = document.getElementById("avisos");
  const tarjeta = (dentro) => {
    caja.innerHTML =
      '<div class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' +
      dentro +
      "</div>";
    aLaVista(caja);
  };
  const liberar = ocupar('[data-accion="avisos-on"]', "Activando…");
  try {
    const permiso = await Notification.requestPermission();
    if (permiso === "denied") {
      tarjeta(
        '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">Bloqueaste los avisos.</b> ' +
          "Se vuelven a habilitar desde los ajustes del navegador para este sitio.</p>",
      );
      return;
    }
    if (permiso !== "granted") {
      // Descartar el cartel del navegador dejaba la tarjeta IDÉNTICA: cero
      // señal de que hubiera pasado algo.
      tarjeta(
        '<p class="chico" style="margin:0">No diste el permiso, así que no vamos ' +
          "a avisarte. Podés intentarlo cuando quieras.</p>" +
          '<button class="btn mini" style="margin-top:11px;display:block" ' +
          'data-accion="avisos-on">Probar de nuevo</button>',
      );
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveServidor(CONFIG.VAPID_PUBLIC_KEY),
      }));
    const r = await fetch("/api/suscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!r.ok) throw new Error("el servidor rechazó la suscripción");
    await guardarUmbral();
    await pintarAvisos();
    aLaVista(caja);
  } catch (e) {
    tarjeta(
      '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">No se pudieron ' +
        "activar los avisos.</b> Probá de nuevo más tarde.</p>" +
        '<button class="btn mini" style="margin-top:11px;display:block" ' +
        'data-accion="avisos-on">Reintentar</button>',
    );
  } finally {
    liberar();
  }
}

async function desactivarAvisos() {
  const sub = await suscripcionActual();
  if (sub) {
    try {
      await fetch("/api/desuscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch (e) {}
    await sub.unsubscribe();
  }
  pintarAvisos();
}

const LETRA_CHICA =
  '<p class="chico" style="margin:9px 0 0">Para avisarte, el servidor guarda ' +
  "sólo una dirección anónima de tu navegador. <b>No guarda tu umbral, la cota " +
  "de tu terreno, tu dirección ni tu plan</b>: el aviso lo arma tu teléfono.</p>";

/* Aviso anticipado: además del cruce del umbral, avisar cuando falten 50 y
   20 cm. Lo decide el service worker con lo que se espeja a IndexedDB. */
function conmutadorCerca() {
  const on = guardado.get("cc_avisar_cerca") === "1";
  return (
    '<label class="chk" style="border-bottom:none;padding-bottom:0">' +
    '<input type="checkbox" data-accion="avisar-cerca" data-on="' +
    (on ? "0" : "1") +
    '"' +
    (on ? " checked" : "") +
    ">" +
    "<span>Avisarme también cuando falte poco (50 y 20 cm)</span></label>"
  );
}

async function pintarAvisos() {
  // La tarjeta vive en dos lugares: al pie de "Mi umbral", que es donde acabás
  // de fijar tu umbral y es el momento natural para activarlos, y en Ajustes,
  // que es donde alguien los va a buscar después.
  const cajas = [
    document.getElementById("avisos"),
    document.getElementById("ajustes-avisos"),
  ].filter(Boolean);
  if (!cajas.length) return;
  const caja = {
    set innerHTML(v) {
      cajas.forEach((c) => (c.innerHTML = v));
    },
  };
  const umbral = cotaEnHidrometro();
  if (umbral == null) return (caja.innerHTML = "");
  // Sin clave VAPID los avisos no están desplegados todavía. No es culpa del
  // navegador y no tiene sentido ofrecer ni explicar nada: no mostramos nada.
  if (!CONFIG.VAPID_PUBLIC_KEY) return (caja.innerHTML = "");

  const envoltura = (dentro) =>
    '<div class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' +
    dentro +
    "</div>";

  if (!avisosPosibles()) {
    // En iOS los avisos web sólo funcionan con la app instalada en la
    // pantalla de inicio. Callarse dejaría a esa gente sin entender por qué.
    caja.innerHTML = envoltura(
      esIOS() && !estaInstalada()
        ? '<p class="chico" style="margin:0">Para recibir avisos en iPhone, ' +
            "primero <b>agregá la app a tu pantalla de inicio</b>: tocá Compartir " +
            "y después “Agregar a inicio”. Safari sólo permite avisos así.</p>"
        : '<p class="chico" style="margin:0">Este navegador no permite avisos.</p>',
    );
    return;
  }

  if (Notification.permission === "denied") {
    caja.innerHTML = envoltura(
      '<p class="chico" style="margin:0">Bloqueaste los avisos para este sitio. ' +
        "Se vuelven a habilitar desde los ajustes del navegador.</p>",
    );
    return;
  }

  const sub = await suscripcionActual();
  if (sub) {
    caja.innerHTML = envoltura(
      '<p class="chico" style="margin:0"><b style="color:var(--ok-texto)">Avisos activados.</b> ' +
        "Te avisamos cuando el río llegue a <b>" +
        m(umbral) +
        "</b>, y también si cruza los umbrales oficiales de 5,30 y 5,70 m.</p>" +
        conmutadorCerca() +
        '<button class="btn sec mini" style="margin-top:11px;display:block" ' +
        'data-accion="avisos-off">Desactivar avisos</button>',
    );
    return;
  }

  // Ojo con dar por sentado que tu umbral es más bajo que la alerta oficial:
  // en terreno alto es al revés, y la frase quedaba diciendo un disparate.
  const antesQueLaAlerta =
    umbral < ALERTA
      ? " — tu lectura crítica, que llega <b>antes</b> que la alerta general de 5,30 m"
      : " — tu lectura crítica. También te avisamos si cruza los umbrales oficiales de 5,30 y 5,70 m";
  caja.innerHTML = envoltura(
    '<p class="chico" style="margin:0">La app sólo sirve si la abrís. Podemos ' +
      "avisarte cuando el río llegue a <b>" +
      m(umbral) +
      "</b>" +
      antesQueLaAlerta +
      ".</p>" +
      '<button class="btn mini" style="margin-top:11px;display:block" ' +
      'data-accion="avisos-on">Avisarme</button>' +
      LETRA_CHICA,
  );
}

/* ================= EVENTOS =================
   Un solo delegador en vez de atributos onclick/oninput. Dos motivos: habilita
   una CSP con `script-src` estricto —sin 'unsafe-inline' no corre ni un solo
   manejador inline— y el HTML que se genera después (el campo de km, la lista
   de puntos) queda conectado sin volver a cablear nada. */
const ACCIONES = {
  "rio-manual": () => fijarRioManual(),
  "rio-auto": () => cargarRio(),
  "cota-gps": () => estimarCota(),
  "abrir-dir": () => abrirBuscadorDireccion(),
  "buscar-dir": () => buscarDireccion(),
  exportar: () => exportarPlan(),
  compartir: () => compartirPlan(),
  ubicarme: () => ubicarmeEnMapa(),
  imprimir: () => imprimirPlan(),
  tema: () => alternarTema(),
  "ver-todos": () => alternarTodosLosPuntos(),
  "sug-enviar": () => enviarSugerencia(),
  instalar: () => instalar(),
  ajustes: () => irA("ajustes"),
  "bv-calcular": () => cerrarBienvenida("cota"),
  "bv-despues": () => cerrarBienvenida(),
  "compartir-imagen": () => compartirImagen(),
  // El despachador ya pasa el elemento que se tocó: estas leen un data- suyo.
  "tema-set": (el) => {
    guardado.set("cc_tema", el.dataset.tema || "");
    aplicarTema(el.dataset.tema || "");
    pintarSegmentoTema();
  },
  "texto-set": (el) => fijarTexto(el.dataset.texto || ""),
  "avisar-cerca": (el) => fijarAvisarCerca(el.dataset.on === "1"),
  "avisos-on": () => activarAvisos(),
  "avisos-off": () => desactivarAvisos(),
  ver: (el) => ver(el.dataset.vista, el),
  // Desde un botón que no es el de la nav: irA() busca el botón correcto para
  // que el resaltado y el aria-current queden donde tienen que quedar.
  ir: (el) => irA(el.dataset.vista),
  // Sin preventDefault: el <a href="geo:..."> tiene que seguir abriendo la
  // app de mapas del teléfono.
  "ver-en-mapa": (el) => verEnMapa(el.dataset.nombre),
};

const ENTRADAS = {
  "cota-manual": () => marcarCotaManual(),
  "filtrar-puntos": () => filtrarPuntos(),
  "km-manual": (el) => fijarKmManual(el.value),
  "sug-texto": () => contarSugerencia(),
};

function conectarEventos() {
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-accion]");
    const fn = el && ACCIONES[el.dataset.accion];
    if (fn) fn(el, ev);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]");
    const fn = el && ENTRADAS[el.dataset.input];
    if (fn) fn(el, ev);
  });
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (!guardado.get("cc_tema")) aplicarTema("");
    });
  window.addEventListener("online", pintarConexion);
  window.addEventListener("offline", pintarConexion);
  // Ctrl/Cmd+P también tiene que salir bien, no sólo el botón.
  window.addEventListener("beforeprint", prepararImpresion);
  pintarConexion();
  document.getElementById("in-dir").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      buscarDireccion();
    }
  });
}

/* ================= BIENVENIDA =================
   Primera visita: se muestra el río antes de pedir nada. La app no sirve de
   nada hasta que cargás la cota de tu terreno, pero arrancar con un formulario vacío hace
   que la mayoría se vaya sin ver para qué era. */

const YA_ENTRO = "cc_bienvenida";

function mostrarBienvenida() {
  const caja = document.getElementById("bienvenida");
  if (!caja) return;
  // Si ya cargó la cota de su terreno alguna vez, esto no tiene nada que ofrecerle.
  if (guardado.get(YA_ENTRO) === "1" || guardado.get("cc_cota")) return;
  caja.hidden = false;
  document.body.classList.add("con-bienvenida");
}

function cerrarBienvenida(ir) {
  const caja = document.getElementById("bienvenida");
  guardado.set(YA_ENTRO, "1");
  if (caja) caja.hidden = true;
  document.body.classList.remove("con-bienvenida");
  if (ir) irA(ir);
}

/* El número de la bienvenida sale del mismo estado que el resto: no se pide
   el nivel dos veces. */
function pintarBienvenida() {
  const n = document.getElementById("bv-nivel");
  const pie = document.getElementById("bv-pie");
  if (!n || !pie || estado.rio == null) return;
  n.textContent = m(estado.rio);
  n.appendChild(pie);
  pie.textContent =
    estado.rio >= EVACUACION
      ? "Nivel de evacuación"
      : estado.rio >= ALERTA
        ? "Nivel de alerta"
        : "Por debajo del nivel de alerta";
}

/* ================= EN CONTEXTO =================
   Dónde está el río hoy contra las referencias que SÍ tienen fuente: los dos
   umbrales oficiales y el récord de 1992. Los máximos de otras crecidas no se
   pudieron verificar y por eso no están: un gráfico de una app de evacuación
   no es lugar para números de memoria. */

const REFERENCIAS = [
  ["Alerta", ALERTA, "alerta"],
  ["Evacuación", EVACUACION, "peligro"],
  [etiquetaRecord(), RECORD, "record"],
];

function pintarContexto() {
  const caja = document.getElementById("contexto");
  const txt = document.getElementById("contexto-texto");
  if (!caja) return;
  if (estado.rio == null) {
    caja.innerHTML = "";
    if (txt) txt.textContent = "";
    return;
  }
  const filas = [["Hoy", estado.rio, "hoy"], ...REFERENCIAS];
  const tope = Math.max(...filas.map((f) => f[1]));
  caja.innerHTML = filas
    .map(
      ([n, v, cls]) => `<div class="barra-fila">
      <span class="barra-nom">${atr(n)}</span>
      <span class="barra-pista"><i class="b-${cls}" style="width:${(v / tope) * 100}%"></i></span>
      <span class="barra-val">${m(v)}</span>
    </div>`,
    )
    .join("");

  if (!txt) return;
  /* Antes esto era una sola frase con la alerta y el récord. Faltaba la
     evacuación, que es el número con el que se decide salir de la casa, y
     faltaba la escala: "3,10 m" no le dice nada a nadie hasta que se lo pone
     al lado de un siglo de mediciones. */
  /* `nombre` llega con la preposición ya puesta: "de la alerta", "del
     récord". Armarla acá daba "por debajo de el récord". */
  const contra = (ref, nombre) => {
    const d = ref - estado.rio;
    return d > 0
      ? "<li><b>" + mCm(d) + "</b> por debajo " + nombre + "</li>"
      : '<li><b style="color:var(--peligro-texto)">' +
          mCm(d) +
          "</b> por encima " +
          nombre +
          "</li>";
  };
  let h =
    '<ul class="lista-contra">' +
    contra(ALERTA, "de la alerta (" + m(ALERTA) + ")") +
    contra(EVACUACION, "de la evacuación (" + m(EVACUACION) + ")") +
    contra(RECORD, "del récord de " + RECORD_ANIO + " (" + m(RECORD) + ")") +
    "</ul>";

  /* La posición histórica. Es un hecho sobre la serie del INA —cuántos de los
     días medidos estuvieron por debajo de hoy—, no una categoría inventada
     por nosotros: la app no dice "normal", "alto" ni "bajo", porque para eso
     haría falta una metodología oficial que no tenemos. */
  const p = percentilHistorico(estado.rio);
  if (p !== null)
    h +=
      '<p class="chico" style="margin:12px 0 0">Desde ' +
      historia.desde.slice(0, 4) +
      ", el río estuvo por debajo del nivel de hoy en el <b>" +
      p +
      " %</b> de los " +
      historia.dias.toLocaleString("es-AR") +
      ' días medidos. <a href="/historia">Ver cien años del Paraná</a></p>';
  txt.innerHTML = h;
}

/* ---- la serie histórica del INA ----
   6 KB con un renglón por año desde 1925, que genera `node scripts/historia.js`.
   Se pide una sola vez y tarde: la app tiene que poder contestar "cuánto mide
   el río" sin esperarla. Si no llega, las frases que dependen de ella
   simplemente no aparecen — ninguna pantalla queda rota por su ausencia. */
let historia = null;
async function cargarHistoria() {
  if (historia) return;
  try {
    const r = await fetch("/datos/historia.json");
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !Array.isArray(j.anios) || !j.anios.length) return;
    historia = j;
    // El récord deja de estar escrito a mano y pasa a salir de la serie.
    const top = j.anios.reduce((p, c) => (c[1] > p[1] ? c : p));
    if (typeof top[1] === "number" && top[1] > 5 && top[1] < 12) {
      RECORD = top[1];
      RECORD_ANIO = top[0];
      REFERENCIAS[2][0] = etiquetaRecord();
      REFERENCIAS[2][1] = RECORD;
    }
    pintarRio();
    pintarContexto();
  } catch (e) {
    /* sin historia, la app funciona igual */
  }
}

/* En qué porcentaje de los días medidos el río estuvo por debajo de este
   nivel. Sale de los 101 escalones que dejó el script, o sea de la serie del
   INA. Devuelve null si todavía no llegó el archivo. */
function percentilHistorico(v) {
  const q = historia && historia.cuantiles;
  if (!q || v == null) return null;
  let p = 0;
  while (p < 100 && q[p + 1] <= v) p++;
  return p;
}

/* ================= AJUSTES ================= */

/* El tamaño de texto es una clase en <html>: así escala todo junto, incluidos
   los números de la regla, sin tocar cada regla del CSS. */
function aplicarTexto(t) {
  document.documentElement.classList.toggle("texto-grande", t === "grande");
  document.querySelectorAll("#seg-texto button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.texto || "") === (t || ""));
  });
}

function fijarTexto(t) {
  guardado.set("cc_texto", t || "");
  aplicarTexto(t);
}

function pintarSegmentoTema() {
  const t = guardado.get("cc_tema") || "";
  document.querySelectorAll("#seg-tema button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.tema || "") === t);
  });
}

/* "Avisame cuando falte poco" necesita que lo sepa el service worker, que no
   puede leer localStorage: se espeja a IndexedDB junto al umbral. */
async function fijarAvisarCerca(on) {
  guardado.set("cc_avisar_cerca", on ? "1" : "0");
  await guardarUmbral();
  pintarAvisos();
}

function pintarAjustes() {
  pintarSegmentoTema();
  aplicarTexto(guardado.get("cc_texto") || "");
}

/* ================= COMPARTIR COMO IMAGEN =================
   Se dibuja en un canvas del propio teléfono y se comparte con la API del
   sistema. Nada se sube a ningún lado, que es lo que la app promete en todas
   las demás pantallas. */

const IMG_ANCHO = 1080;
const IMG_ALTO = 1920;

function colorDe(nombre) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(nombre)
    .trim();
}

async function armarImagen() {
  // Sin esperar a las fuentes, el canvas dibuja con la de sistema y la imagen
  // sale con otra tipografía que la app.
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const c = document.createElement("canvas");
  c.width = IMG_ANCHO;
  c.height = IMG_ALTO;
  const g = c.getContext("2d");
  const F = (p, t) => `${p} ${t}px "Plus Jakarta Sans", system-ui, sans-serif`;

  const fondo = "#0e1619";
  const claro = "#e9eef0";
  const tenue = "#93a6ad";
  const agua = "#2e9bc4";

  g.fillStyle = fondo;
  g.fillRect(0, 0, IMG_ANCHO, IMG_ALTO);

  // Marca
  g.strokeStyle = claro;
  g.lineWidth = 11;
  g.beginPath();
  g.arc(120, 150, 33, 0, Math.PI * 2);
  g.stroke();
  g.save();
  g.beginPath();
  g.rect(80, 155, 80, 45);
  g.clip();
  g.fillStyle = "#5fc8e8";
  g.beginPath();
  g.arc(120, 150, 33, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(76, 155);
  g.lineTo(164, 155);
  g.stroke();
  g.fillStyle = claro;
  g.font = F(800, 44);
  g.fillText("Cota Cero", 180, 166);

  // El dato
  g.fillStyle = tenue;
  g.font = F(700, 30);
  g.fillText("RÍO EN EL PUERTO DE SANTA FE", 76, 300);
  g.fillStyle = claro;
  g.font = F(800, 190);
  g.fillText(m(estado.rio ?? 0), 76, 470);

  const u = cotaEnHidrometro();
  g.font = F(600, 40);
  g.fillStyle = tenue;
  const linea2 =
    u == null
      ? "Cargá tu umbral en la app para saber qué significa"
      : estado.rio != null && estado.rio >= u
        ? "El río superó mi umbral estimado (" + mU(u) + ")"
        : "Unos " +
          Math.round(((u ?? 0) - (estado.rio ?? 0)) * 100) +
          " cm hasta mi umbral estimado (" +
          mU(u) +
          ")";
  g.fillText(linea2, 76, 540);

  // La regla, de 0 al récord de 1992
  const x = 76,
    y = 640,
    an = IMG_ANCHO - 152,
    al = 900;
  const TOPE = 7.6;
  g.fillStyle = "rgba(233,238,240,.07)";
  g.fillRect(x, y, an, al);
  const hAgua = Math.max(0, Math.min(1, (estado.rio ?? 0) / TOPE)) * al;
  g.fillStyle = agua;
  g.fillRect(x, y + al - hAgua, an, hAgua);
  g.fillStyle = "#5fc8e8";
  g.fillRect(x, y + al - hAgua - 6, an, 6);

  const marca = (v, texto, color) => {
    const yy = y + al - (v / TOPE) * al;
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, yy);
    g.lineTo(x + an, yy);
    g.stroke();
    g.fillStyle = color;
    g.font = F(700, 30);
    g.fillText(texto, x + 18, yy - 16);
  };
  marca(ALERTA, "Alerta " + m(ALERTA).replace(" m", ""), "#e8a33d");
  marca(EVACUACION, "Evacuación " + m(EVACUACION).replace(" m", ""), "#e15f49");
  marca(RECORD, etiquetaRecord() + "   " + m(RECORD).replace(" m", ""), tenue);
  if (u != null && u <= TOPE) marca(u, "MI UMBRAL   " + mU(u), claro);

  // Pie: fuente y dominio, para que la imagen se defienda sola cuando la
  // reenvían diez veces sin contexto.
  g.fillStyle = tenue;
  g.font = F(500, 27);
  const fecha = estado.rioFecha ? " · dato del " + estado.rioFecha : "";
  g.fillText(
    "Umbral estimado, no una orden de evacuación" + fecha,
    x,
    y + al + 60,
  );
  g.fillText(
    "Lectura oficial: INA. La orden la da Defensa Civil (103). cotacerosf.com",
    x,
    y + al + 104,
  );

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

async function compartirImagen() {
  const e = document.getElementById("compartir-estado");
  const liberar = ocupar('[data-accion="compartir-imagen"]', "Armando…");
  try {
    if (estado.rio == null) throw new Error("todavía no hay nivel del río");
    const blob = await armarImagen();
    if (!blob) throw new Error("no se pudo dibujar");
    const archivo = new File([blob], "cota-cero.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo] });
      if (e) e.textContent = "";
    } else {
      // Sin Web Share con archivos —escritorio, Firefox— se descarga.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cota-cero.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (e) e.textContent = "Se descargó la imagen.";
    }
  } catch (err) {
    // Cancelar el diálogo de compartir tira AbortError: no es un error.
    if (e)
      e.textContent =
        err && err.name === "AbortError" ? "" : "No se pudo crear la imagen.";
  } finally {
    liberar();
  }
}

/* ================= INSTALAR =================
   El evento beforeinstallprompt existe sólo en Chromium. En iPhone no existe
   y no va a existir: Safari deja instalar únicamente desde su menú Compartir.
   Antes el botón dependía de ese evento, así que en iOS —donde está buena
   parte de la gente— no aparecía nunca. Ahora hay dos caminos: si el
   navegador ofrece el diálogo, se usa; si no, se explican los pasos. */
let promptInstalar = null;

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  promptInstalar = ev;
  mostrarBotonInstalar();
});

window.addEventListener("appinstalled", () => {
  promptInstalar = null;
  guardado.set("cc_instalada", "1");
  quitarBarraInstalar();
  pintarEnlaceInstalar();
});

/* Ya la tiene instalada: no hay nada que ofrecerle. */
const yaLaTiene = () => estaInstalada() || guardado.get("cc_instalada") === "1";

const esMovil = () => esIOS() || window.matchMedia("(pointer: coarse)").matches;

/* Qué decirle a alguien cuando el navegador no ofrece el diálogo solo. */
function pasosInstalacion() {
  if (esIOS()) {
    // Chrome, Firefox y Edge en iPhone usan el motor de Safari y algunos
    // exponen «Agregar a inicio» en su propio menú Compartir, pero no todos.
    // Decirle "la barra de Safari" a alguien que está en Chrome es mandarlo a
    // buscar algo que no va a encontrar.
    const enSafari = !/CriOS|FxiOS|EdgiOS|OPT\//.test(navigator.userAgent);
    return {
      pasos: [
        enSafari
          ? "Tocá el botón Compartir, en la barra de abajo de Safari."
          : "Tocá el botón Compartir del navegador.",
        "Deslizá la lista y elegí «Agregar a inicio».",
        "Confirmá con «Agregar», arriba a la derecha.",
      ],
      nota: enSafari
        ? null
        : "Si no aparece esa opción, abrí cotacerosf.com en Safari: en iPhone es el único que siempre la tiene.",
    };
  }
  if (/Firefox/i.test(navigator.userAgent))
    return {
      pasos: [
        "Abrí el menú ⋮ del navegador.",
        "Elegí «Instalar» o «Agregar a la pantalla de inicio».",
      ],
    };
  return {
    pasos: [
      "Abrí el menú ⋮ del navegador, arriba a la derecha.",
      "Elegí «Instalar app» o «Agregar a la pantalla de inicio».",
    ],
  };
}

/* Un solo lugar decide qué hace el botón, lo dispare la barra o el pie. */
async function instalar() {
  if (promptInstalar) {
    promptInstalar.prompt();
    const r = await promptInstalar.userChoice;
    promptInstalar = null;
    quitarBarraInstalar();
    // Si dijo que no, no se le insiste: el pie queda como única puerta.
    if (r && r.outcome === "accepted") guardado.set("cc_instalada", "1");
    pintarEnlaceInstalar();
    return;
  }
  mostrarComoInstalar();
}

function mostrarComoInstalar() {
  const previo = document.getElementById("como-instalar");
  if (previo) previo.remove();

  const { pasos, nota } = pasosInstalacion();
  const d = document.createElement("dialog");
  d.id = "como-instalar";
  d.className = "hoja";

  const h = document.createElement("h2");
  h.textContent = "Agregar a la pantalla de inicio";
  const p = document.createElement("p");
  p.className = "chico";
  p.textContent =
    "Queda como una app más, entra sin buscarla en el navegador y funciona sin señal.";

  const ol = document.createElement("ol");
  pasos.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ol.appendChild(li);
  });

  d.append(h, p, ol);
  if (nota) {
    const n = document.createElement("p");
    n.className = "aviso";
    n.textContent = nota;
    d.appendChild(n);
  }

  const cerrar = document.createElement("button");
  cerrar.className = "btn";
  cerrar.type = "button";
  cerrar.textContent = "Listo";
  // Botón suelto y no <form method="dialog">: la CSP del sitio lleva
  // form-action 'none' y no vale la pena depender de cómo lo interpreta cada
  // navegador.
  cerrar.addEventListener("click", () => d.close());
  d.appendChild(cerrar);

  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", ""); // sin <dialog> modal, se muestra en línea
}

function mostrarBotonInstalar() {
  if (document.getElementById("barra-instalar")) return;
  if (yaLaTiene()) return;
  // Antes se borraba sola a los 20 segundos y no volvía en toda la sesión: si
  // estabas leyendo, la perdías. Ahora se queda hasta que la cierren, y si la
  // cierran no vuelve a molestar: para eso queda el enlace del pie.
  if (guardado.get("cc_no_instalar") === "1") return;

  const caja = document.createElement("div");
  caja.id = "barra-instalar";
  caja.className = "instalar";
  const b = document.createElement("button");
  b.className = "btn";
  b.type = "button";
  b.textContent = esMovil() ? "Instalar en el teléfono" : "Instalar la app";
  b.addEventListener("click", instalar);
  const x = document.createElement("button");
  x.className = "cerrar";
  x.type = "button";
  x.setAttribute("aria-label", "No instalar");
  x.textContent = "×";
  x.addEventListener("click", () => {
    guardado.set("cc_no_instalar", "1");
    quitarBarraInstalar();
  });
  caja.append(b, x);
  document.body.appendChild(caja);
  document.body.classList.add("con-instalar");
}

/* Saca la barra y devuelve al body su padding normal. */
function quitarBarraInstalar() {
  const caja = document.getElementById("barra-instalar");
  if (caja) caja.remove();
  document.body.classList.remove("con-instalar");
}

/* El pie tiene un enlace permanente. Es la red de contención de todo lo que
   puede salir mal con la barra: que la hayan cerrado, que Chrome no dispare
   el evento, que sea un navegador que no lo implementa. */
function pintarEnlaceInstalar() {
  const caja = document.getElementById("instalar-pie");
  if (!caja) return;
  caja.hidden = yaLaTiene();
}

/* Chrome dispara beforeinstallprompt cuando quiere, y a veces no lo dispara.
   Si no llegó, igual se ofrece: el botón explica los pasos en vez de abrir un
   diálogo que no existe. */
function ofrecerInstalacion() {
  pintarEnlaceInstalar();
  if (yaLaTiene() || !esMovil()) return;
  setTimeout(() => {
    if (!promptInstalar) mostrarBotonInstalar();
  }, 2500);
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
/* Deep links: /?ir=cota abre directo esa pestana */
function abrirDesdeURL() {
  const ir = new URLSearchParams(location.search).get("ir");
  // La primera entrada también necesita estado: sin esto, el primer "atrás"
  // desde otra pestaña llega con state null y no sabe adónde volver.
  history.replaceState({ vista: ir || "rio" }, "");
  if (ir) irA(ir, true);
}

document.addEventListener("DOMContentLoaded", () => {
  aplicarTema(guardado.get("cc_tema") || "");
  aplicarTexto(guardado.get("cc_texto") || "");
  conectarEventos();
  iniciar();
  abrirDesdeURL();
  contarVisita();
  ofrecerInstalacion();
  pintarAjustes();
  mostrarBienvenida();
});
