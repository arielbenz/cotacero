// scripts/paginas/legal.js — /legal. La escribe emitir.js.

import { FUENTES } from "../../public/lib/fuentes.js";
import { esc, pagina } from "./base.js";

/* ---------- /legal ---------- */
const LICENCIAS = [
  [
    "MapLibre GL JS",
    "Motor del mapa. Licencia BSD de 3 cláusulas — © contribuidores de MapLibre. El texto completo acompaña a la copia distribuida con la app.",
  ],
  [
    "Georef",
    'Búsqueda de direcciones con altura y la lista de calles que sugiere el buscador: la API de direcciones del Estado nacional, sobre el callejero del INDEC. Datos abiertos de <a href="https://datos.gob.ar/" target="_blank" rel="noopener">datos.gob.ar</a>; la API está documentada en <a href="https://datosgobar.github.io/georef-ar-api/" target="_blank" rel="noopener">georef-ar-api</a>.',
  ],
  [
    "OpenStreetMap / Nominatim",
    'Búsqueda de direcciones cuando Georef no la encuentra, y de barrios y parajes. Datos © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, bajo licencia ODbL.',
  ],
  [
    "OpenFreeMap / OpenMapTiles",
    'El fondo del mapa: tiles vectoriales de <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> con el esquema de <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> (© OpenMapTiles), dibujados con los colores de la app. Datos © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, bajo licencia ODbL.',
  ],
  [
    "Instituto Geográfico Nacional",
    'La foto aérea con la que marcás tu casa (vuelos fotogramétricos de 2013 y 2014) y red de nivelación usada para validar las fuentes de elevación. <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">ign.gob.ar</a>.',
  ],
  [
    "Open-Meteo",
    'El pronóstico de lluvia y la tendencia del caudal del Paraná, de <a href="https://open-meteo.com/" target="_blank" rel="noopener">open-meteo.com</a>, bajo licencia CC BY 4.0. El caudal sale del modelo GloFAS del servicio Copernicus de la Unión Europea.',
  ],
  [
    "Municipalidad de Santa Fe",
    'Curvas de nivel (Secretaría de Recursos Hídricos) y capa de puntos de encuentro, de sus geoservicios públicos vía el <a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">GeoPortal</a>.',
  ],
  /* La capa no declara licencia. Se atribuye y se enlaza la ficha, igual que
     con la serie del INA: declarar una sería inventar un dato. */
  [
    "Provincia de Santa Fe — IDESF",
    'Puntos con cota de San José del Rincón, Colastiné y La Guardia (Secretaría de Aguas, relevamiento de 2005), con los que la app calcula la altura en Rincón y Arroyo Leyes. Del servicio de mapas público de la <a href="https://www.santafe.gov.ar/idesf/" target="_blank" rel="noopener">IDESF</a>; la ficha no declara licencia.',
  ],
  /* Ordenanza pública, sin licencia declarada: se atribuye y se enlaza. */
  [
    "Comuna de Arroyo Leyes",
    'Los nombres nuevos de las calles de Arroyo Leyes y los números que tenían antes, de la <a href="https://www.arroyoleyes.gob.ar/ordenanzas.php" target="_blank" rel="noopener">Ordenanza 47/2021</a> (Anexos I y II). Con eso la búsqueda entiende «Curupíes 3006» como la antigua calle 18.',
  ],
  [
    "INA",
    'Alturas hidrométricas diarias del Paraná, del <a href="' +
      FUENTES.nivelRio.url +
      '" target="_blank" rel="noopener">reporte público del Instituto Nacional del Agua</a>.',
  ],
  [
    "Plus Jakarta Sans y JetBrains Mono",
    "Tipografías, bajo SIL Open Font License. Van self-hosteadas: no se consulta ningún servicio de fuentes.",
  ],
];

/* Qué sale del teléfono, como tabla: qué, si sale, y el detalle. Era una
   grilla de tarjetas y había que leerlas todas para contestar «¿qué se
   manda?». Las dos promesas que más importan van acá y en ningún otro lado:
   adónde va lo que escribís en el buscador (CLAUDE.md, «tocar un proveedor
   toca cuatro archivos») y que la analítica no corre ni en la app ni en el
   widget (CLAUDE.md, «Privacidad»). */
const PRIVACIDAD = [
  [
    "Tu casa, tu nivel de aviso, tu plan",
    "Nunca",
    "Se guardan sólo en el dispositivo. Si borrás la app, se borran.",
  ],
  [
    "Avisos",
    "Un dato opaco",
    "La dirección técnica que asigna tu navegador. El servidor no sabe la altura de tu terreno ni tu nivel de aviso: el aviso se arma en tu teléfono. Al desuscribirte, se borra.",
  ],
  [
    "Sugerencias",
    "Tu texto",
    "Lo único que manda texto tuyo, y el formulario lo dice. La IP no se guarda: se transforma de modo irreversible para limitar envíos.",
  ],
  [
    "Cuánta gente la usa",
    "Un número al azar",
    "Lo genera el teléfono, para contar personas distintas por día. El servidor sabe cuántos distintos vio, pero no guarda ninguno.",
  ],
  [
    "Buscar una dirección",
    "Al tocar Buscar",
    "Va a Georef (la API de direcciones del Estado nacional) y, si no la encuentra, a Nominatim (OpenStreetMap). Las calles que te sugiere mientras escribís salen de una lista guardada en la app: escribir no manda nada.",
  ],
  /* El fondo y la foto aérea piden la zona que se mira: quien los sirve
     puede saber más o menos dónde buscaste tu casa; dónde tocaste, no. El
     fondo era del IGN hasta octubre de 2026 y pasó a OpenFreeMap. */
  [
    "Ver el mapa",
    "Al abrirlo",
    "El fondo del mapa lo pide tu teléfono a OpenFreeMap, y la foto aérea con la que marcás tu casa, al Instituto Geográfico Nacional. Los dos reciben tu IP y la zona que mirás. Dónde tocaste y la altura que salió no se mandan: se calculan en el teléfono.",
  ],
  /* Faltaba, desde que existen el pronóstico y la tendencia: la app le
     pide los dos a Open-Meteo y /legal no lo nombraba. Lo encontró la
     verificación de lib/proveedores.js. Las coordenadas son las del centro,
     fijas: no la ubicación de nadie. */
  [
    "Lluvia y caudal",
    "Al abrir la app",
    "El pronóstico de lluvia y la tendencia del caudal del Paraná los pide tu teléfono a Open-Meteo, para el centro de Santa Fe, con coordenadas fijas: no manda tu ubicación ni tu casa, sólo tu IP, como cualquier pedido web.",
  ],
  [
    "Estadísticas del sitio",
    "Sólo en el sitio",
    "Vercel Analytics, agregado y sin cookies, y Google Analytics, que sí deja cookies y manda los datos de tu visita a Google. Ninguno corre dentro de la app ni dentro del widget: a los lectores de un medio que lo embebe no los mide nadie.",
  ],
];

const DESCARGO = [
  [
    "Ayuda a interpretar información pública",
    "No es un sistema oficial de alerta ni tiene vínculo con la Municipalidad de Santa Fe, la Provincia, Defensa Civil, el INA ni ningún otro organismo. Usa sus datos públicos y los cita.",
  ],
  [
    "Los niveles de aviso son aproximados",
    "Salen de un modelo simple, que descuenta medio metro a la altura del terreno en la ciudad y un metro en Rincón y Arroyo Leyes. No conoce defensas, bombeo, desagües ni lluvia: el agua puede llegar antes o después de lo estimado. La altura del terreno se contrastó con puntos medidos por la Municipalidad; la relación entre el río y el terreno no se pudo contrastar con ninguna medición, y no lo validaron especialistas ni organismos competentes.",
  ],
  [
    "Nada de esto es una orden",
    "Las decisiones de evacuación corresponden a Defensa Civil (103). Nada de lo que muestra la app es una orden, una recomendación oficial ni un sustituto de las comunicaciones de las autoridades. Ante cualquier contradicción, vale la indicación oficial.",
  ],
  [
    "Los datos pueden quedar viejos",
    "El nivel se publica una vez por día. Los puntos de encuentro reflejan la capa municipal de la última actualización de la app; su activación la confirma sólo Defensa Civil.",
  ],
  [
    "Sin garantías",
    "La app depende de que el INA publique y de servicios de terceros que pueden fallar, cambiar o discontinuarse. Se ofrece tal cual, gratis y sin garantía de ningún tipo.",
  ],
];

const htmlLegal = pagina({
  clave: "legal",
  migaja: "Legal y privacidad",
  h1: "Legal y privacidad",
  lead:
    "Escrito para leerse, no para esconderse. Si algo no se entiende, es un " +
    'defecto: <a href="/contacto">avisanos</a>.',
  acciones: `        <p class="chico">Última actualización: agosto de 2026.</p>
        <div class="tarjetas-tres">
          <div><b>No es oficial</b><p>Interpreta datos públicos. La orden de evacuación la da Defensa Civil, al 103.</p></div>
          <div><b>Tus datos, en tu teléfono</b><p>Tu casa, tu nivel de aviso y tu plan no salen de ahí. Sin registro, sin publicidad.</p></div>
          <div><b>Sin garantías</b><p>Gratis y tal cual. Depende de que el INA publique y de servicios que pueden fallar.</p></div>
        </div>`,
  jsonld: null,
  bloques: [
    {
      id: "descargo",
      titulo: "Qué es esta herramienta, y qué no",
      html: `        <dl class="filas-descargo">
${DESCARGO.map(
  ([t, d]) => `          <div>
            <dt>${esc(t)}</dt>
            <dd>${esc(d)}</dd>
          </div>`,
).join("\n")}
        </dl>`,
    },
    {
      id: "privacidad",
      titulo: "Qué sale de tu teléfono",
      html: `        ${
        /* En el teléfono cada renglón se vuelve una ficha —qué y si sale
           arriba, el detalle abajo— en vez de scrollear de costado: con
           scroll, la columna que importa quedaba afuera de la pantalla. Los
           roles van explícitos porque al cambiarle el display a una tabla
           algunos navegadores le sacan la semántica. */ ""
      }<table class="tabla-privacidad" role="table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Qué</th><th scope="col" role="columnheader">Sale</th><th scope="col" role="columnheader">Detalle</th></tr></thead>
          <tbody role="rowgroup">
${PRIVACIDAD.map(
  ([q, sale, d]) =>
    `            <tr role="row"><th scope="row" role="rowheader">${esc(q)}</th><td role="cell" class="tp-sale${sale === "Nunca" ? " tp-nunca" : ""}">${esc(sale)}</td><td role="cell">${esc(d)}</td></tr>`,
).join("\n")}
          </tbody>
        </table>
        <p class="chico">
          No pedimos nombre, correo, teléfono ni registro. No hay publicidad ni
          venta de datos. Lo que dice esta tabla sobre el widget es la promesa
          que le hacemos a cada <a href="/para-medios">medio que lo embebe</a>.
        </p>`,
    },
    {
      id: "licencias",
      titulo: "Sobre hombros de otros",
      html: `        <p>${LICENCIAS.map(([n]) => esc(n)).join(" · ")}.</p>
        <details class="h-detalle">
          <summary>Licencias y atribuciones completas</summary>
          <div class="filas-licencia">
${LICENCIAS.map(
  ([n, d]) => `            <div>
              <b>${esc(n)}</b>
              <p>${d}</p>
            </div>`,
).join("\n")}
          </div>
        </details>`,
    },
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          Este texto lo redactó quien hizo la app, con la intención de ser claro
          y honesto. No es asesoramiento legal ni lo revisó un profesional del
          derecho. Si encontrás un error, o algo que debería decir y no dice,
          <a href="/contacto">escribinos</a>.
        </p>`,
    },
  ],
  sueltos: [],
});

export {
  DESCARGO,
  LICENCIAS,
  PRIVACIDAD,
  htmlLegal,
};
