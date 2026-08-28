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
   Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m.
   ========================================================================== */

/* ==========  CONFIGURACIÓN  ==========
   Lo único que tenés que tocar para poner esto en marcha. */
const CONFIG = {
  // Clave pública VAPID para los avisos. Se genera con `node scripts/vapid.js`
  // y la privada va SÓLO en las variables de entorno de Vercel.
  // Vacía = avisos apagados; la app funciona igual.
  VAPID_PUBLIC_KEY:
    "BDvA4gsUx-S1tEyYZ-BeaXubLuO-qvY1sdME3-vpyYULbzb-UVkOB17nw2bYQsfvVsGvN6r-p_sgFg4byZoEKto",

  // La funcion serverless que lee el nivel del INA.
  // En local con `vercel dev`: '/api/nivel' funciona igual.
  NIVEL_ENDPOINT: "/api/nivel",
};

const CERO_IGN = 8.2;
const PENDIENTE = 0.045;
const ALERTA = 5.3;
const EVACUACION = 5.7;
const ESCALA_MIN = 0;
const ESCALA_MAX = 8;
const ERROR_DEM = 3.0; // incertidumbre del modelo satelital, en metros
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

const MOCHILA = [
  "Documentos de todos, en bolsa de nylon cerrada",
  "Medicación habitual y recetas",
  "Botiquín de primeros auxilios",
  "Agua potable para tres días",
  "Alimentos que no necesiten cocción ni frío",
  "Linterna y pilas de repuesto",
  "Radio a pilas (para cuando no haya luz ni datos)",
  "Cargador y batería portátil cargada",
  "Mantas y ropa de abrigo",
  "Muda de ropa por persona",
  "Pañales, mamadera y leche si hay bebés",
  "Comida y correa de los animales",
  "Efectivo en billetes chicos",
  "Copia de llaves",
  "Anotado: teléfonos en papel, por si se apaga el celular",
];

const PREVIA = [
  "Saber la cota de mi terreno",
  "Elegir el punto de encuentro y probar el recorrido",
  "Acordar quién hace qué el día que haya que salir",
  "Guardar los documentos importantes en alto",
  "Levantar del piso lo que se arruina con el agua",
  "Fijarme dónde se corta la luz y el gas, y que otro más lo sepa",
  "Limpiar la cuneta y el desagüe de la vereda",
  "No dejar escombros ni ramas en la calle",
  "Hablar con los vecinos: quién necesita ayuda para salir",
  "Cargar el celular y la batería portátil cuando anuncian tormenta",
  "Tener a mano el número del contacto fuera de la zona",
];

/* Los 30 puntos de encuentro del Plan de Contingencia, con las coordenadas
   OFICIALES del municipio: capa `puntos_de_encuentro` del GeoServer público
   de la Municipalidad de Santa Fe (geoservicios.santafeciudad.gov.ar,
   workspace `publico`), la misma que dibuja el GeoPortal.
   Van hardcodeadas y no se geocodifica nada: el dato es fijo, andan sin red
   y no dependen de la cuota de ningún proveedor.
   Para actualizarlas:
     https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows
       ?service=WFS&version=1.0.0&request=GetFeature
       &typeName=publico:puntos_de_encuentro&outputFormat=application/json */
const PUNTOS = [
  ["Asoc. Vecinal Sarmiento", "Vieytes 5047", [-60.72546604, -31.5965]],
  ["ASOEM Camping", "RP Nº 1 - km 2.5", [-60.60681828, -31.6270493]],
  ["Boca del Tigre", "J.J. Paso y Zavalla", [-60.72517614, -31.66131579]],
  ["Bochas Club Mitre", "Gral. López 3815", [-60.72595784, -31.65460239]],
  [
    "Bomberos Voluntarios Las Flores",
    "Av. Blas Parera 8700",
    [-60.72689011, -31.58001751],
  ],
  [
    "Capilla Nuestra Señora de la Guardia",
    "A. de Petre y H. Serafina",
    [-60.63433982, -31.64234205],
  ],
  [
    "Cementerio Municipal",
    "Av. Blas Parera 5401",
    [-60.71863653, -31.61379472],
  ],
  [
    "Centro Comunitario Noreste",
    "Defensa y French",
    [-60.66612462, -31.5977847],
  ],
  [
    "CIC Facundo Zuviría",
    "Av. Facundo Zuviría 8002 / Azcuénaga",
    [-60.6988815, -31.59267741],
  ],
  ["CIC Roca", "Pasaje Roca y República de Siria", [-60.68433875, -31.5785339]],
  ["Cilsa", "Mar Argentino y R11", [-60.73261501, -31.66508848]],
  [
    "Club Banco Provincia",
    "Av. Aristóbulo del Valle 9958",
    [-60.68928171, -31.57358485],
  ],
  ["Club Cabal", "Servando Bayo 6730", [-60.72944315, -31.59893853]],
  ["Distrito La Costa", "RP Nº 1 - km 2.7", [-60.60493224, -31.62688844]],
  [
    "Estación Colastiné Norte",
    "Las Macluras y Orquídeas",
    [-60.60814703, -31.62364809],
  ],
  [
    "Estación Mitre (Andenes)",
    "Gral. López y San Juan",
    [-60.72427681, -31.65484814],
  ],
  ["Estación San Lorenzo", "Entre Ríos 4080", [-60.72986264, -31.65645015]],
  [
    "Jardín Botánico Ing. Lorenzo Parodi",
    "Av. Gorriti 3902",
    [-60.70727912, -31.58704761],
  ],
  ["La Virgencita", "RN 168 y calle Principal", [-60.63365832, -31.63972864]],
  ["Mediateca", "Pje. Mitre y Tucumán", [-60.72916015, -31.64108094]],
  [
    "Parada de ómnibus (La Guardia/Colastiné)",
    "Ruta 1 y Favaloro",
    [-60.62654115, -31.6381007],
  ],
  [
    "Polideportivo La Tablada",
    "Teniente Loza 6970",
    [-60.74551756, -31.56381964],
  ],
  ["Talleres Municipales", "Pte. Perón 3575", [-60.71754382, -31.63212773]],
  ["Vecinal Centenario", "Zavalía 711", [-60.72236452, -31.66487521]],
  ["Vecinal Facundo Quiroga", "Almafuerte 7739", [-60.69540016, -31.59617794]],
  ["Vecinal Guadalupe Oeste", "Risso 1745", [-60.68367933, -31.60310257]],
  [
    "Vecinal Juan de Garay",
    "Salvador Caputto 3955",
    [-60.72253068, -31.636429],
  ],
  [
    "Vecinal Las Delicias",
    "Alfonsina Storni 3100",
    [-60.69534873, -31.58298864],
  ],
  [
    "Vecinal Pro Mejoras Alto Verde",
    "Manzana 1, M. Gómez e I. Monzón",
    [-60.70076676, -31.66521436],
  ],
  ["Vecinal Santa Marta", "Chubut 6291", [-60.73289024, -31.57099227]],
];

const TELEFONOS = [
  ["Emergencias (centraliza Bomberos, Defensa Civil, Policía)", "911"],
  ["Bomberos", "100"],
  ["Defensa Civil", "103"],
  ["Emergencias náuticas — Prefectura", "106"],
  ["Prefectura Santa Fe", "342 456-2400"],
  ["Atención Ciudadana — Municipalidad", "0800-777-5000"],
  ["Gobierno de la Provincia", "0800-777-0801"],
];

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

let estado = {
  rio: null, // altura del hidrómetro en metros
  rioOrigen: "",
  delta: null, // variación contra la medición anterior, en metros
  rioFecha: "", // fecha de la medición, tal como la publica el INA
  rioVencido: false, // el dato guardado ya no se puede presentar como vigente
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
  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.remove("on");
    b.removeAttribute("aria-current");
  });
  btn.classList.add("on");
  btn.setAttribute("aria-current", "true");
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
  const i = { rio: 0, cota: 1, plan: 2, donde: 3 }[id];
  if (i === undefined) return false;
  const b = document.querySelectorAll("nav button")[i];
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
async function cargarRio() {
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
        origen = "INA · Alerta Hidrológico Cuenca del Plata";
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
      '<b style="color:var(--alerta)">Sin dato automático.</b> Cargá la altura a mano acá abajo. ' +
      "La publican el INA, Prefectura y la FICH-UNL todos los días.";
    document.getElementById("det-manual").open = true;
  } else {
    estado.rio = valor;
    estado.rioOrigen = origen;
    document.getElementById("origen-dato").innerHTML =
      (estado.rioVencido
        ? '<b style="color:var(--alerta)">Dato vencido.</b> '
        : "") +
      "Fuente: " +
      origen +
      "." +
      extra;
    if (estado.rioVencido) document.getElementById("det-manual").open = true;
  }
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
    <div style="font-family:var(--display);font-weight:700;font-size:20px;
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
    <polyline points="${futuro}" fill="none" stroke="var(--agua-claro)"
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
      '<b style="color:var(--alerta)">Escribí un número</b>, por ejemplo 3,40.';
    campo.focus();
    return;
  }
  if (v < -1 || v > 10) {
    est.innerHTML =
      '<b style="color:var(--alerta)">Ese valor está fuera de la escala del hidrómetro</b> ' +
      "(−1 a 10 m). El récord de 1992 fue 7,43 m.";
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
  let html = "";

  for (let t = ESCALA_MIN; t <= ESCALA_MAX; t += 0.5) {
    const mayor = Number.isInteger(t);
    html += `<div class="tic ${mayor ? "mayor" : ""}" style="bottom:${pct(t)}%"></div>`;
    if (mayor)
      html += `<div class="tic-num" style="bottom:${pct(t)}%">${t}</div>`;
  }

  const r = estado.rio;
  html += `<div class="agua" style="height:${r == null ? 0 : Math.max(0, Math.min(100, pct(r)))}%"></div>`;
  html += `<div class="marca-linea" style="bottom:${pct(ALERTA)}%;color:var(--alerta)"><b style="color:var(--alerta)">5,30</b></div>`;
  html += `<div class="marca-linea" style="bottom:${pct(EVACUACION)}%;color:var(--peligro)"><b style="color:var(--peligro)">5,70</b></div>`;

  // tu cota, traducida a lectura de hidrómetro
  const critico = cotaEnHidrometro();
  if (critico !== null && critico >= ESCALA_MIN && critico <= ESCALA_MAX) {
    html += `<div class="marca-linea" style="bottom:${pct(critico)}%;color:var(--tierra)">
       <b style="color:var(--tierra)">vos</b></div>`;
  }
  regla.innerHTML = html;

  document.getElementById("lg-actual").textContent =
    r == null ? "sin dato" : m(r);
  const wrap = document.getElementById("lg-cota-wrap");
  if (critico !== null) {
    wrap.style.display = "block";
    document.getElementById("lg-cota").textContent = m(critico);
    document.getElementById("lg-cota-k").textContent = estado.cotaEsEstimada
      ? "Tu cota, traducida a lectura de hidrómetro, con el margen de error satelital ya descontado"
      : "Tu cota, traducida a lectura de hidrómetro";
  } else wrap.style.display = "none";

  pintarVeredictoRio();
  pintarPie();
  pintarCtaCota();
  guardarUmbral();
  pintarAvisos();
}

/* Sin cota, la app no puede responder su propia pregunta — y en la pestaña
   Río eso no se decía en ningún lado: el renglón "tu cota" simplemente no
   aparecía. */
function pintarCtaCota() {
  const cta = document.getElementById("cta-cota");
  if (!cta) return;
  if (estado.cota != null && estado.zona) {
    cta.innerHTML = "";
    return;
  }
  cta.innerHTML =
    '<div class="aviso" style="margin-bottom:14px"><b>Todavía no sé dónde vivís.</b> ' +
    "Con tu zona y la cota de tu terreno, la app te dice a qué altura del " +
    "hidrómetro el agua llega a tu casa — que puede ser bastante antes que la " +
    "alerta general de 5,30 m." +
    '<button class="btn mini" style="margin-top:11px;display:block" data-accion="ir" data-vista="cota">' +
    "Cargar mi cota</button></div>";
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
    c.className = "veredicto v-neutro";
    c.innerHTML =
      '<div class="titu">Falta el nivel del río</div>' +
      '<p class="chico" style="margin:0">Cargalo a mano abajo para que el resto de la app funcione.</p>';
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
      '<b style="color:var(--alerta)">Se esperan ' +
      Math.round(pico) +
      " mm en un solo día.</b> Con el río alto, las bombas tardan más en desagotar.";
  else res.textContent = Math.round(total) + " mm acumulados en la semana.";
}

/* ================= CÁLCULO DE COTA ================= */
/* Traduce una cota IGN a lectura de hidrómetro.
   Por defecto devuelve el escenario PESIMISTA: si la cota vino del modelo
   satelital le descuenta el margen de error, porque ése es el número con el
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
      ? '<b style="color:var(--alerta)">' + o.corto + "</b>"
      : "<b>" + o.corto + "</b>") +
    "." +
    (o.largo ? " " + o.largo : "");
}

function marcarCotaManual() {
  const campo = document.getElementById("in-cota");
  const v = aNumero(campo.value);
  const est = document.getElementById("estado-cota");
  if (campo.value.trim() && isNaN(v)) {
    est.innerHTML =
      '<b style="color:var(--alerta)">No entiendo ese número.</b> Escribilo así: 16,40.';
    return;
  }
  if (!isNaN(v) && (v < 0 || v > 40)) {
    est.innerHTML =
      '<b style="color:var(--alerta)">Esa cota está fuera de rango</b> (0 a 40 m sobre el nivel del mar).';
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
            '<b style="color:var(--alerta)">La ubicación llegó con ±' +
            Math.round(prec) +
            " m de error.</b> A esa distancia el modelo mide otro terreno. " +
            "Probá al aire libre, buscá la dirección, o cargá la cota a mano.";
          return;
        }
        e.textContent = "Consultando el modelo de elevación…";
        try {
          const alt = await elevacionDe(la, lo);
          if (typeof alt !== "number") throw new Error("sin dato");
          estado.cota = alt;
          estado.cotaEsEstimada = true;
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
          e.textContent =
            "No se pudo obtener la elevación. Cargá la cota a mano.";
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
      '<span style="color:var(--alerta)">Elegí tu zona</span>: la distancia ' +
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
        : ' <span style="color:var(--alerta)">Esa distancia es una estimación ' +
          "propia, no una medición sobre el cauce.</span>");
  }

  const cont = document.getElementById("resultado");
  if (estado.cota == null) {
    cont.innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta tu cota</div>' +
      '<p class="chico" style="margin:0">Cargala arriba y calculo el resto.</p></div>';
    pintarRio();
    return;
  }

  const km = kmDeZona();

  // Con estimación satelital razonamos siempre con el escenario
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
    titu = "El agua ya está en tu cota";
    txt =
      "Con el río en " +
      m(r) +
      ", el nivel en tu zona alcanza o supera la cota que cargaste.";
  } else if (ref <= ALERTA) {
    cls = "v-peligro";
    titu = "Te alcanza antes del nivel de alerta";
    txt =
      "El agua llega a tu cota con el hidrómetro en " +
      m(ref) +
      ", o sea <b>antes</b> de los 5,30 m " +
      "que disparan el aviso general. No esperes la alerta oficial para moverte.";
  } else if (ref <= EVACUACION) {
    cls = "v-alerta";
    titu = "Te alcanza en zona de evacuación";
    txt = "El agua llega a tu cota con el hidrómetro entre 5,30 y 5,70 m.";
  } else if (ref <= 6.5) {
    cls = "v-alerta";
    titu = "Margen ajustado";
    txt =
      "El agua llega a tu cota con el hidrómetro en " +
      m(ref) +
      ". Está por encima del nivel de " +
      "evacuación, pero dentro del escenario que el municipio dice estar planificando.";
  } else {
    cls = "v-ok";
    titu = "Margen amplio";
    txt =
      "El agua llegaría a tu cota recién con el hidrómetro en " +
      m(ref) +
      ". Para dimensionar: el récord de 1992 fue 7,43 m.";
  }

  html += `<div class="veredicto ${cls}"><div class="titu">${titu}</div>
    <p style="margin:0 0 12px;font-size:14px">${txt}</p>
    <span class="eti">El agua llega a tu cota cuando el hidrómetro marque</span>
    <div class="dato">${m(ref)}</div></div>`;

  // desglose
  html += `<div class="tarjeta"><h3 style="margin-top:0">Cómo sale ese número</h3>
    <table style="width:100%;font-family:var(--data);font-size:13px;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota de tu terreno<br>
        <span style="font-size:11px">según ${(origenCota() || {}).corto || "—"}</span></td>
  <td style="text-align:right;font-weight:700">${m(estado.cota)} IGN</td></tr>
    ${
      estado.cotaEsEstimada
        ? `<tr><td style="padding:6px 0;color:var(--alerta)">Margen de error satelital</td>
  <td style="text-align:right;color:var(--alerta)">− ${ERROR_DEM.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota usada (la pesimista)</td>
  <td style="text-align:right;font-weight:700">${m(cotaPeor)} IGN</td></tr>`
        : ""
    }
    <tr><td style="padding:6px 0;color:var(--tenue)">Cero del hidrómetro</td>
  <td style="text-align:right">− ${CERO_IGN.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Pendiente del río (${km} km × 4,5 cm)${
      KM_PUBLICADO.has(estado.zona)
        ? ""
        : '<br><span style="color:var(--alerta);font-size:11px">distancia estimada, no medida</span>'
    }</td>
  <td style="text-align:right">− ${(PENDIENTE * km).toFixed(2).replace(".", ",")} m</td></tr>
    <tr style="border-top:1px solid var(--linea)">
  <td style="padding:9px 0;font-weight:700">Lectura crítica</td>
  <td style="text-align:right;font-weight:700;color:var(--agua-claro)">${m(ref)}</td></tr>
    </table>`;

  if (r != null) {
    const falta = ref - r;
    html += `<p class="chico" style="margin:12px 0 0">Hoy el río está en ${m(r)}.
${
  falta > 0
    ? "Faltan <b>" + m(falta) + "</b> para llegar a tu cota."
    : '<b style="color:var(--peligro)">Ya lo superó.</b>'
}</p>`;
  }
  html += "</div>";

  if (estado.cotaEsEstimada) {
    html +=
      '<div class="aviso"><b>Estás usando una estimación satelital.</b> ' +
      "El cálculo se hizo con el escenario pesimista (" +
      ERROR_DEM.toFixed(0) +
      " m menos que lo medido) " +
      "justamente porque el dato no es confiable a este nivel de detalle. " +
      "Conseguí la cota real y volvé a calcular: puede cambiar todo el resultado.</div>";
  }

  html +=
    '<div class="aviso grave"><b>Esto es una estimación, no una orden.</b> ' +
    "El modelo asume terreno parejo y no contempla el anillo de defensas, las bombas, " +
    "el viento sur que empuja el agua, ni las lluvias que se acumulan del lado de adentro. " +
    "Si el municipio o Defensa Civil indican evacuar, evacuá aunque acá diga que tenés margen.</div>";

  cont.innerHTML = html;
  pintarRio();
}

/* ================= PLAN ================= */
function pintarListas() {
  const l1 = document.getElementById("lista-mochila");
  l1.innerHTML = MOCHILA.map(
    (t, i) =>
      `<label class="chk"><input type="checkbox" data-k="mo${i}"><span>${t}</span></label>`,
  ).join("");
  const l2 = document.getElementById("lista-previa");
  l2.innerHTML = PREVIA.map(
    (t, i) =>
      `<label class="chk"><input type="checkbox" data-k="pv${i}"><span>${t}</span></label>`,
  ).join("");

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
      '<b style="color:var(--alerta)">Este navegador no deja guardar.</b> ' +
      "Descargá el plan antes de cerrar la página.";
  }
}
/* 26 casillas sin ninguna señal de avance: nadie sabía si iba por la mitad. */
function pintarProgreso() {
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
      "El agua llega a esta cota con el hidrómetro en: " +
      m(cotaEnHidrometro()) +
      (estado.cotaEsEstimada
        ? " (escenario pesimista: la cota estimada menos " +
          ERROR_DEM.toFixed(0) +
          " m de error satelital)"
        : "") +
      "\n\n";
  }
  t += "Punto de encuentro: " + (g("p-punto") || "—") + "\n";
  t += "Contacto fuera de la zona: " + (g("p-contacto") || "—") + "\n";
  t += "Animales: " + (g("p-animales") || "—") + "\n\n";
  if (g("p-roles")) t += "QUIÉN HACE QUÉ\n" + g("p-roles") + "\n\n";
  if (g("p-ayuda")) t += "NECESITAN AYUDA PARA SALIR\n" + g("p-ayuda") + "\n\n";
  t += "MOCHILA — falta:\n";
  const faltan = MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1");
  t += faltan.length
    ? faltan.map((x) => "  [ ] " + x).join("\n")
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

async function elevacionDe(lat, lon) {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
    );
    const j = await r.json();
    const a = Array.isArray(j.elevation) ? j.elevation[0] : j.elevation;
    return typeof a === "number" ? a : null;
  } catch (e) {
    return null;
  }
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
    e.textContent = "Consultando la elevación…";
    var alt = await elevacionDe(r.c[1], r.c[0]);
    if (alt === null) {
      e.textContent = "Se encontró la dirección pero no la elevación.";
      return;
    }
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
      ' <b style="color:var(--alerta)">Ubicó la calle, no la altura exacta</b>, ' +
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
          `<strong>${n}</strong><br><span style="font-size:13px;color:#7E959D">${d}</span>`,
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
        // Con un array plano [a, b] MapLibre lo toma como [sw, ne] al pie de la
        // letra: si vienen al revés arma un bounds invertido y se va al mundo
        // entero (zoom -0.15). Mapbox lo normalizaba solo; MapLibre no.
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
  if (!lista.length) {
    cont.innerHTML =
      '<p class="chico">Ningún punto coincide con esa búsqueda.</p>';
    return;
  }
  cont.innerHTML = lista
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
<div class="n">${n}${destacar === n ? ' <span style="color:var(--ok);font-size:12px">· el más cercano</span>' : ""}</div>
<div class="d">${d}${km}</div>
<span class="ir">Abrir en mapas →</span></a>`;
    })
    .join("");
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

function pintarTelefonos() {
  document.getElementById("lista-tel").innerHTML = TELEFONOS.map(
    ([q, n]) =>
      `<a class="tel" href="tel:${n.replace(/[^0-9+]/g, "")}"><span class="q">${q}</span><span class="n">${n}</span></a>`,
  ).join("");
}

/* ================= ARRANQUE ================= */
function iniciar() {
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
  pintarTelefonos();
  pintarRio();
  calcular();
  cargarRio();
  cargarLluvia();
  cargarTendencia();
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

let ultimoUmbralGuardado;
async function guardarUmbral() {
  const u = cotaEnHidrometro();
  if (u === ultimoUmbralGuardado) return;
  ultimoUmbralGuardado = u;
  try {
    const db = await baseAvisos();
    const st = db.transaction("kv", "readwrite").objectStore("kv");
    if (u == null) st.delete("umbral");
    else st.put(u, "umbral");
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
        '<p class="chico" style="margin:0"><b style="color:var(--alerta)">Bloqueaste los avisos.</b> ' +
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
      '<p class="chico" style="margin:0"><b style="color:var(--alerta)">No se pudieron ' +
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
  "sólo una dirección anónima de tu navegador. <b>No guarda tu cota, tu " +
  "dirección ni tu plan</b>: el aviso lo arma tu teléfono.</p>";

async function pintarAvisos() {
  const caja = document.getElementById("avisos");
  if (!caja) return;
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
      '<p class="chico" style="margin:0"><b style="color:var(--ok)">Avisos activados.</b> ' +
        "Te avisamos cuando el río llegue a <b>" +
        m(umbral) +
        "</b>, y también si cruza los umbrales oficiales de 5,30 y 5,70 m.</p>" +
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

/* ================= PWA ================= */
let promptInstalar = null;
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  promptInstalar = ev;
  mostrarBotonInstalar();
});
function mostrarBotonInstalar() {
  if (document.getElementById("barra-instalar")) return;
  // Antes se borraba sola a los 20 segundos y no volvía en toda la sesión: si
  // estabas leyendo, la perdías. Ahora se queda hasta que la cierren, y si la
  // cierran no vuelve a molestar.
  if (guardado.get("cc_no_instalar") === "1") return;
  const caja = document.createElement("div");
  caja.id = "barra-instalar";
  caja.className = "instalar";
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = "Instalar en el teléfono";
  b.addEventListener("click", async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    await promptInstalar.userChoice;
    promptInstalar = null;
    caja.remove();
  });
  const x = document.createElement("button");
  x.className = "cerrar";
  x.type = "button";
  x.setAttribute("aria-label", "No instalar");
  x.textContent = "×";
  x.addEventListener("click", () => {
    guardado.set("cc_no_instalar", "1");
    caja.remove();
  });
  caja.append(b, x);
  document.body.appendChild(caja);
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
  conectarEventos();
  iniciar();
  abrirDesdeURL();
});
