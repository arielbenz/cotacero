// landing.js — lo que necesita la portada.
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

const m = (v) => v.toFixed(2).replace(".", ",");

/* La regla del mockup abarca de 0 a 8 m: por encima del récord de 1992
   (7,43 m) y con aire suficiente para que el agua no toque el techo. */
const TOPE_REGLA = 8;

/* 2. El nivel del río, arriba de todo. Es lo que hace que la portada sirva
      durante una crecida y no sea sólo folletería. */
async function pintarNivel() {
  const num = document.getElementById("nivel");
  const pie = document.getElementById("nivel-pie");
  if (!num || !pie) return;
  try {
    const r = await fetch("/api/nivel");
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (typeof j.altura !== "number") throw new Error("sin altura");

    /* Los umbrales oficiales los publica la estación del INA y vienen en la
       respuesta. Los de acá son el respaldo para cuando contesta el reporte
       diario, que no los trae. Antes estaban escritos a mano en tres lugares
       de este archivo. */
    const alerta = typeof j.alerta === "number" ? j.alerta : 5.3;
    const evacuacion = typeof j.evacuacion === "number" ? j.evacuacion : 5.7;

    // textContent y no innerHTML: es dato que llega de la red y no hay razón
    // para dejarlo interpretar como marcado.
    num.textContent = m(j.altura);
    pie.textContent =
      (j.altura >= evacuacion
        ? "Nivel de evacuación"
        : j.altura >= alerta
          ? "Nivel de alerta"
          : "Por debajo del nivel de alerta") +
      (j.fecha_dato ? " · dato del " + j.fecha_dato.slice(0, 10) : "");

    if (typeof j.delta === "number" && j.delta !== 0) {
      const d = document.getElementById("nivel-delta");
      if (d) {
        const cm = Math.round(j.delta * 100);
        d.textContent = (cm > 0 ? "+" : "") + cm + " cm/día";
        d.hidden = false;
      }
    }

    // La pastilla flotante del diseño decía "18 cm antes de la alerta", que
    // depende de una cota que acá nadie cargó. Con el dato del día se puede
    // decir algo igual de concreto y que además es cierto.
    const globo = document.getElementById("globo");
    if (globo) {
      const cm = Math.round((alerta - j.altura) * 100);
      globo.innerHTML =
        cm > 0
          ? "Hoy faltan <b>" + cm + " cm</b><br>para la alerta oficial"
          : "El río ya pasó<br><b>la alerta oficial</b>";
      globo.hidden = false;
    }

    const alto = Math.max(0, Math.min(1, j.altura / TOPE_REGLA)) * 100;
    const agua = document.getElementById("rm-agua");
    const sup = document.getElementById("rm-superficie");
    if (agua) agua.style.height = alto + "%";
    if (sup) sup.style.bottom = alto + "%";
    // La etiqueta va DENTRO del agua, como en el diseño: es lo que convierte
    // el bloque azul en un dato y no en una decoración.
    const ahora = document.getElementById("rm-ahora");
    if (ahora) {
      ahora.textContent = "Ahora " + m(j.altura);
      ahora.style.bottom = "calc(" + alto + "% - 26px)";
    }
  } catch (e) {
    num.textContent = "—";
    pie.textContent = "No se pudo leer el nivel. Abrí la app para reintentar.";
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
    const propio = document.querySelector('link[href="/app.css"]');
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
      fetch("/datos/puntos.json"),
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

pintarNivel();
