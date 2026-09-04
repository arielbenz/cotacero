// landing.js — lo que necesita SÓLO la portada: el mockup del hidrómetro con
// la regla que se mueve, el mapa perezoso y el renglón de frescura del pie.
//
// El estado del río y la barra viven en js/rio-barra.js, que va en todas las
// páginas y se carga ANTES que éste. De ahí salen `rio`, `suscribir`, `$`,
// `m`, `minutosDesde`, `estaVencido` y las constantes de vencimiento: son dos
// <script> clásicos y comparten el ámbito global.
//
// Va en archivo aparte y no en línea porque la CSP lleva `script-src 'self'`:
// sin 'unsafe-inline' no corre un solo script embebido.
//
// Nada de lo que hace es imprescindible. Si algo falla, la página se ve igual
// y los enlaces a la app siguen funcionando.

/* 1. Quien tiene la app instalada no tiene por qué pasar por la portada.
      El manifest ya arranca en /app, pero las instalaciones viejas siguen
      apuntando a "/" hasta que el navegador relea el manifest: esto las manda
      a donde corresponde sin esperar. */
if (
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true
) {
  location.replace("/app");
}

const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const MES =
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(
    " ",
  );
/* Las fechas del archivo son AAAA-MM-DD. `new Date("1992-06-22")` las lee en
   UTC y en Argentina eso da el día anterior. Se parten a mano. */
const enPalabras = (f) => {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return p ? `${+p[3]} de ${MES[+p[2] - 1]} de ${p[1]}` : "";
};

/* La regla del mockup abarca de 0 a 8 m: por encima del récord de 1992
   (7,43 m) y con aire suficiente para que el agua no toque el techo. */
const TOPE_REGLA = 8;


const menosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   2. EL MOCKUP: el nivel de hoy, y una simulación que se puede mover
   --------------------------------------------------------------------------
   Es lo que hace que la portada sirva durante una crecida y no sea sólo
   folletería. Dos cosas conviven en la misma tarjeta y NO se confunden:

     `real` es el dato del INA. Manda en el número grande de arriba, en la
     línea punteada "hoy" y en el pie de la cabecera. No lo mueve nadie.

     `sim` es lo que dibuja la regla. Arranca en `real` y se despega sólo si
     alguien la mueve —scrolleando o con el control—. Todo lo que la muestra
     dice "simulación" con esa palabra.

   Que sean dos variables distintas es la garantía de que el número grande no
   miente nunca. Un hero que cambia la altura del hidrómetro mientras alguien
   scrollea durante una crecida sería exactamente el error que este proyecto
   evita en todas las demás pantallas.
   ========================================================================== */

let real = null; // metros, dato del INA
let alerta = 5.3; // respaldo: los publica la estación y llegan en la respuesta
let evacuacion = 5.7;
let record = null; // { valor, anio, fecha }, sale de historia.json
let anios = []; // máximos anuales, para decir cuán raro es un nivel
let sim = null; // metros, lo que dibuja la regla
/* "scroll" hasta que alguien toca el control; de ahí en más manda la mano.
   Que el scroll siga moviendo el agua después de que la movieron a propósito
   sería arrebatarle el control a quien lo tomó. */
let modo = "scroll";

/* El techo de la simulación es el récord del hidrómetro: no hay razón para
   dejar simular más alto que lo más alto que pasó, y el récord es un dato de
   la serie del INA, no un número elegido. Mientras historia.json no llegue,
   se simula hasta la evacuación. */
function techoSim() {
  const t = record ? record.valor : evacuacion;
  return t > real ? t : TOPE_REGLA;
}

/* Alto sobre la regla, en porcentaje de los 0 a 8 m. */
const pc = (v) => Math.max(0, Math.min(1, v / TOPE_REGLA)) * 100;

/* El mockup, ahora como oyente del store. Lo que antes hacía el fetch acá
   adentro lo hace `leerNivel()`; esto sólo pinta. El armado de la regla —el
   control, el scroll, la serie histórica— es de una sola vez y por eso lleva
   guarda: el store repinta cada 30 segundos. */
let armado = false;

function pintarNivel(r) {
  const num = $("nivel");
  const pie = $("nivel-pie");
  if (!num || !pie) return;

  if (r.altura === null) {
    num.textContent = "—";
    pie.textContent = "No se pudo leer el nivel. Abrí la app para reintentar.";
    const l = $("rm-lectura");
    if (l) l.textContent = "Sin el dato de hoy no hay desde dónde simular.";
    return;
  }

  alerta = r.alerta;
  evacuacion = r.evacuacion;

  /* `real` sigue al store, pero `sim` sólo cuando nadie está simulando: una
     lectura nueva que llega mientras alguien tiene el agua arriba no le puede
     mover la regla debajo del dedo. */
  const anterior = real;
  const quieto = real === null || Math.abs(sim - real) <= 0.005;
  real = r.altura;

  // textContent y no innerHTML: es dato que llega de la red y no hay razón
  // para dejarlo interpretar como marcado.
  num.textContent = m(real);
  pie.textContent =
    (real >= evacuacion
      ? "Nivel de evacuación"
      : real >= alerta
        ? "Nivel de alerta"
        : "Por debajo del nivel de alerta") +
    (r.fechaTexto ? " · dato del " + r.fechaTexto.slice(0, 10) : "");

  const d = $("nivel-delta");
  if (d) {
    const cm = r.delta === null ? 0 : Math.round(r.delta * 100);
    d.textContent = (cm > 0 ? "+" : "") + cm + " cm/día";
    d.hidden = cm === 0;
  }

  pintarUmbrales();

  if (!armado) {
    armado = true;
    habilitarControl();
    // Con transición: este primer llenado es la única animación que la portada
    // hace sola, y es la que explica de un vistazo qué es la regla.
    fijarSim(real, false);
    engancharScroll();
    cargarHistoria();
  } else if (quieto && real !== anterior) {
    fijarSim(real, false);
  }
}

/* Los umbrales del marcado traen los valores de respaldo y su posición en el
   CSS, para que la regla diga algo aunque este archivo no corra. Acá se
   reubican con los que publicó la estación. */
function pintarUmbrales() {
  for (const [id, etiqueta, valor] of [
    ["rm-alerta", "Alerta", alerta],
    ["rm-evac", "Evacuación", evacuacion],
  ]) {
    const el = $(id);
    if (!el) continue;
    el.style.bottom = pc(valor).toFixed(2) + "%";
    /* Dos decimales acá y en toda la tarjeta: son lecturas del hidrómetro,
       medidas al centímetro. El decimal único con tilde de aproximación es
       para el umbral de la app, que sale de curvas cada ~0,5 m; mezclar las
       dos convenciones en la misma regla es lo que confunde. */
    el.querySelector("b").textContent = etiqueta + " " + m(valor);
  }
}

function habilitarControl() {
  const rango = $("rm-rango");
  if (!rango) return;
  rango.disabled = false;
  rango.addEventListener("input", () => {
    modo = "manual";
    directo(true);
    fijarSim(real + (+rango.value / 1000) * (techoSim() - real), true);
  });
  const volver = $("rm-volver");
  if (volver)
    volver.addEventListener("click", () => {
      modo = "manual";
      // Sin `directo`: el regreso al dato de hoy es un salto que conviene ver.
      fijarSim(real, false);
      rango.focus();
    });
}

/* La transición de 0,7 s del agua es linda para el llenado inicial y para el
   "volver a hoy", y es un estorbo mientras alguien arrastra: el bloque azul
   llegaba casi un segundo tarde al dedo. */
function directo(si) {
  const caja = $("regla-mini");
  if (caja) caja.classList.toggle("rm-directo", !!si);
}

function fijarSim(v, esDirecto) {
  if (real === null) return;
  if (!esDirecto) directo(false);
  sim = Math.max(0, Math.min(TOPE_REGLA, v));
  pintarRegla();
  pintarLectura();
  pintarGlobo();
}

function pintarRegla() {
  const alto = pc(sim);
  const agua = $("rm-agua");
  const sup = $("rm-superficie");
  if (agua) agua.style.height = alto + "%";
  if (sup) sup.style.bottom = alto + "%";

  // La etiqueta va DENTRO del agua: es lo que convierte el bloque azul en un
  // dato y no en una decoración. Y dice "simulado" apenas deja de ser el dato.
  const simulando = sim - real > 0.005;
  const chip = $("rm-ahora");
  if (chip) {
    chip.textContent = (simulando ? "Simulado " : "Ahora ") + m(sim);
    chip.style.bottom = "calc(" + alto + "% - 26px)";
  }

  /* La marca de hoy aparece recién cuando hay 80 cm de diferencia: comparten
     el lado derecho con la etiqueta del agua, y más cerca que eso los dos
     rótulos quedan uno encima del otro y no se lee ninguno. */
  const hoy = $("rm-hoy");
  if (hoy) {
    hoy.hidden = sim - real < 0.8;
    hoy.style.bottom = pc(real).toFixed(2) + "%";
    hoy.querySelector("b").textContent = "Hoy " + m(real);
  }

  for (const [id, valor] of [
    ["rm-alerta", alerta],
    ["rm-evac", evacuacion],
    ["rm-record", record ? record.valor : Infinity],
  ]) {
    const el = $(id);
    if (el) el.classList.toggle("activo", sim >= valor);
  }

  const volver = $("rm-volver");
  if (volver) volver.hidden = !simulando;
}

/* La lectura del pie: qué es exactamente lo que se está viendo. Devuelve el
   texto en dos formas porque el <input type=range> se anuncia por
   aria-valuetext y ahí el marcado no sirve. */
function pintarLectura() {
  const caja = $("rm-lectura");
  const rango = $("rm-rango");
  if (!caja) return;

  if (sim - real <= 0.005) {
    const texto = menosMovimiento()
      ? "Es el nivel de hoy. Deslizá para simular una crecida."
      : "Es el nivel de hoy. Deslizá —o seguí bajando— para simular una crecida.";
    caja.textContent = texto;
    if (rango) rango.setAttribute("aria-valuetext", m(real) + " metros, el nivel de hoy");
    return;
  }

  let cola;
  if (record && sim >= record.valor - 0.005) {
    cola =
      "es el récord del hidrómetro, el " +
      enPalabras(record.fecha) +
      ".";
  } else {
    const ref = sim >= evacuacion ? evacuacion : alerta;
    const nombre = ref === evacuacion ? "la evacuación" : "la alerta oficial";
    const d = sim - ref;
    const dist =
      Math.abs(d) < 1 ? Math.round(Math.abs(d) * 100) + " cm" : m1(Math.abs(d)) + " m";
    cola =
      Math.abs(d) < 0.005
        ? "justo en " + nombre + "."
        : dist + (d > 0 ? " por encima de " : " por debajo de ") + nombre + ".";
  }

  caja.innerHTML = "Simulación · <b>" + m(sim) + " m</b> — " + cola;
  if (rango)
    rango.setAttribute("aria-valuetext", "Simulación: " + m(sim) + " metros, " + cola);
}

/* La pastilla flotante. Con el nivel de hoy dice cuánto falta para la alerta;
   con la simulación en marcha dice cuán raro es ese nivel, que es la única
   respuesta honesta a "¿y si sube hasta acá?". Los dos números salen de datos
   públicos: el primero de /api/nivel, el segundo de la serie del INA. */
function pintarGlobo() {
  const globo = $("globo");
  if (!globo) return;

  if (sim - real > 0.005 && anios.length) {
    const n = anios.filter((e) => e.max >= sim).length;
    globo.innerHTML =
      n === 0
        ? "En " + anios.length + " años medidos<br><b>nunca llegó tan alto</b>"
        : "<b>" +
          n +
          "</b> de los " +
          anios.length +
          " años medidos<br>" +
          (n === 1 ? "llegó" : "llegaron") +
          " al menos hasta acá";
    globo.hidden = false;
    return;
  }

  const cm = Math.round((alerta - real) * 100);
  globo.innerHTML =
    cm > 0
      ? "Hoy faltan <b>" + cm + " cm</b><br>para la alerta oficial"
      : "El río ya pasó<br><b>la alerta oficial</b>";
  globo.hidden = false;
}

/* ---------- el scroll mueve el río ----------
   No es scroll-jacking: la página baja como cualquier otra y lo único que
   sigue al scroll es el agua de la regla, que además está a la vista todo el
   tramo. Con `prefers-reduced-motion: reduce` no se engancha nada: el control
   sigue estando y quien lo quiera mover, lo mueve. */
function progreso() {
  const caja = $("regla-mini");
  if (!caja) return 0;
  const vh = window.innerHeight || 800;
  const arriba = caja.getBoundingClientRect().top + window.scrollY;
  /* Empieza a contar cuando la regla asoma por abajo de la pantalla y termina
     0,7 pantallas después, con la regla todavía a la vista. El Math.max(0)
     es lo que hace que en escritorio —donde la regla ya está arriba de todo
     al cargar— la portada abra en el nivel real y no a mitad de la
     simulación. */
  const inicio = Math.max(0, arriba - vh * 0.85);
  const largo = Math.max(240, vh * 0.7);
  return Math.max(0, Math.min(1, (window.scrollY - inicio) / largo));
}

function engancharScroll() {
  if (menosMovimiento()) return;
  let pendiente = false;
  const alScroll = () => {
    if (modo !== "scroll" || pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      if (modo !== "scroll") return;
      const p = progreso();
      directo(true);
      fijarSim(real + p * (techoSim() - real), true);
      const rango = $("rm-rango");
      if (rango) rango.value = String(Math.round(p * 1000));
    });
  };
  addEventListener("scroll", alScroll, { passive: true });
  addEventListener("resize", alScroll, { passive: true });
  /* Sólo si la página ya viene scrolleada —una recarga a media altura—. Con
     la portada arriba de todo el progreso es 0 y llamarlo igual apagaría la
     transición del primer llenado, que es justo la animación que se quiere
     ver. */
  if (progreso() > 0.001) alScroll();
}

/* El récord y los máximos anuales salen de la misma serie del INA que publica
   /historia: acá no se escribe a mano ningún número. Llega tarde y no pasa
   nada —son 6 KB y no bloquean el nivel de hoy—: hasta que llegue, la
   simulación va hasta la evacuación y la pastilla habla del día. */
async function cargarHistoria() {
  try {
    const r = await fetch("/datos-abiertos/historia.json");
    if (!r.ok) throw new Error(r.status);
    const h = await r.json();
    anios = (h.anios || []).map((f) => ({ a: f[0], max: f[1], fmax: f[2] }));
    if (!anios.length) return;
    const top = anios.reduce((p, c) => (c.max > p.max ? c : p));
    record = { valor: top.max, anio: top.a, fecha: top.fmax };

    const el = $("rm-record");
    if (el) {
      el.style.bottom = pc(record.valor).toFixed(2) + "%";
      el.querySelector("b").textContent =
        "Récord " + record.anio + " · " + m(record.valor);
      el.hidden = false;
    }
    /* El techo de la simulación acaba de cambiar: el control tiene que seguir
       apuntando al mismo nivel que ya está dibujado, no al que le tocaría por
       su posición con la escala nueva. */
    const rango = $("rm-rango");
    if (rango && techoSim() > real)
      rango.value = String(
        Math.round(((sim - real) / (techoSim() - real)) * 1000),
      );
    pintarRegla();
    pintarLectura();
    pintarGlobo();
  } catch (e) {
    /* Sin la serie, la regla no muestra el récord y la simulación llega hasta
       la evacuación. Nada más. */
  }
}

/* 3. El mapa de los puntos de encuentro. Se carga recién cuando la sección
      entra en pantalla: MapLibre pesa, y arriba de todo lo que importa es el
      nivel del río, no el mapa. */
const ESTILO_IGN = {
  version: 8,
  sources: {
    ign: {
      type: "raster",
      tiles: [
        "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/" +
          "capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png",
      ],
      // El servicio del IGN es TMS, con la Y contada desde abajo.
      scheme: "tms",
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '<a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">Instituto Geográfico Nacional</a>',
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
      paint: { "raster-saturation": -0.15 },
    },
  ],
};

function cargarMapLibre() {
  return new Promise((ok, mal) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/maplibre-gl.css";
    // Antes de app.css: si va después gana el cascade y los popups vuelven al
    // blanco de MapLibre en vez del tema del sitio.
    const propio = document.querySelector('link[href="/css/app.css"]');
    if (propio) document.head.insertBefore(css, propio);
    else document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/vendor/maplibre-gl.js";
    s.onload = () => ok();
    s.onerror = () => mal(new Error("no se pudo cargar maplibre-gl"));
    document.head.appendChild(s);
  });
}

async function dibujarMapa(caja) {
  try {
    const [, r] = await Promise.all([
      cargarMapLibre(),
      fetch("/datos-abiertos/puntos.json"),
    ]);
    if (!r.ok) throw new Error(r.status);
    const puntos = await r.json();
    const mapa = new maplibregl.Map({
      container: caja,
      style: ESTILO_IGN,
      center: [-60.7, -31.63],
      zoom: 11,
      attributionControl: { compact: true },
      // Es un mapa ilustrativo dentro de una página que se scrollea: que la
      // rueda haga zoom en vez de bajar la página es una trampa.
      scrollZoom: false,
      cooperativeGestures: true,
    });
    mapa.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    mapa.on("load", () => {
      for (const [nombre, dir, lon, lat] of puntos) {
        const el = document.createElement("div");
        el.className = "pin-landing";
        new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14 }).setText(nombre + " — " + dir),
          )
          .addTo(mapa);
      }
    });
  } catch (e) {
    // Sin mapa la sección sigue teniendo su texto y el enlace a la lista.
    caja.textContent = "";
    caja.classList.add("mapa-caido");
  }
}

const caja = document.getElementById("mapa-landing");
if (caja && "IntersectionObserver" in window) {
  const obs = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        obs.disconnect();
        dibujarMapa(caja);
      }
    },
    { rootMargin: "300px" },
  );
  obs.observe(caja);
} else if (caja) {
  dibujarMapa(caja);
}


/* ==========================================================================
   LA FRESCURA DEL PIE
   Es de la portada: su renglón lo emite `pie({ frescura: true })` y no está en
   las demás páginas. La píldora y la franja, que sí van en todas, viven en
   js/rio-barra.js.
   ========================================================================== */

/* ---------- contra la fecha de la lectura ----------
   Contra la fecha de la lectura, no contra la hora en que la pedimos: son dos
   cosas distintas y sólo la primera dice si el número sirve. */
function haceCuanto(min) {
  if (min < EN_MINUTOS) return "hace " + Math.round(min) + " min";
  if (min < VENCE_MINUTOS) return "hace " + Math.round(min / 60) + " h";
  const dias = Math.round(min / 1440);
  return "hace " + dias + (dias === 1 ? " día" : " días");
}

function pintarFrescura() {
  const caja = $("pie-frescura");
  const punto = $("frescura-punto");
  const texto = $("frescura-texto");
  if (!caja || !punto || !texto) return;

  const min = minutosDesde(rio.fecha);
  if (min === null) {
    caja.hidden = true;
    return;
  }
  const vencido = estaVencido();
  caja.hidden = false;
  punto.setAttribute("data-estado", vencido ? "alerta" : "ok");
  texto.textContent =
    "Última lectura INA: " + haceCuanto(min) + (vencido ? " — dato viejo" : "");
}

/* La lectura ya la pide rio-barra.js: acá sólo se agregan los dos oyentes que
   son de la portada. `suscribir()` pinta en el acto, así que si el dato ya
   llegó no hay que esperar al próximo cambio. */
suscribir(pintarNivel);
suscribir(pintarFrescura);
