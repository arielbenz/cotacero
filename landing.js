// landing.js — lo poco que necesita la portada.
//
// Va en archivo aparte y no en línea porque la CSP del sitio lleva
// `script-src 'self'`: sin 'unsafe-inline' no corre un solo script embebido.
//
// Hace dos cosas y ninguna es imprescindible: si falla, la página se ve igual.

/* 1. Quien tiene la app instalada no tiene por qué pasar por la portada.
      El manifest ya arranca en /app, pero las instalaciones viejas siguen
      apuntando a "/" hasta que el navegador relea el manifest. Esto las
      manda a donde corresponde sin esperar. */
if (
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true
) {
  location.replace("/app");
}

/* 2. El nivel del río, arriba de todo. Es lo que hace que la portada sirva
      durante una crecida y no sea sólo folletería. */
const m = (v) => v.toFixed(2).replace(".", ",");

async function pintarNivel() {
  const caja = document.getElementById("nivel");
  const pie = document.getElementById("nivel-pie");
  if (!caja || !pie) return;
  try {
    const r = await fetch("/api/nivel");
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (typeof j.altura !== "number") throw new Error("sin altura");

    // El texto se arma con textContent y no con innerHTML: es dato que llega
    // de la red y no hay razón para dejarlo interpretar como marcado.
    caja.textContent = m(j.altura) + " m";
    caja.appendChild(pie);
    const cuando = j.fecha_dato
      ? " · dato del " + j.fecha_dato.slice(0, 10)
      : "";
    pie.textContent =
      (j.altura >= 5.7
        ? "Nivel de evacuación"
        : j.altura >= 5.3
          ? "Nivel de alerta"
          : "Por debajo del nivel de alerta") + cuando;
  } catch (e) {
    // Sin dato no se miente ni se deja un guión sin explicar.
    caja.textContent = "—";
    caja.appendChild(pie);
    pie.textContent = "No se pudo leer el nivel. Abrí la app para reintentar.";
  }
}

pintarNivel();
