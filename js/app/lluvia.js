/* js/app/lluvia.js — el pronóstico de lluvia de los próximos días.
   Es riesgo pluvial, no fluvial: son dos mecanismos distintos y la app mira
   sobre todo el segundo. Ver /datos. */

import { estado } from "./estado.js";
import { m } from "./formato.js";

/* ================= LLUVIA ================= */
export async function cargarLluvia() {
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
