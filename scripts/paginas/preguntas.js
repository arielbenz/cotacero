// scripts/paginas/preguntas.js — /preguntas. La escribe emitir.js.

import { MEDICION, bloque, esc, pagina } from "./base.js";

/* ---------- /preguntas ----------
   Cada respuesta arranca con una línea corta en negrita: la que contesta.
   Después va la explicación. Quien abre la pregunta en la vereda lee la
   primera línea y ya sabe; el resto es para quien quiere el porqué.
   [pregunta, respuesta corta, explicación] */
const PREGUNTAS = [
  [
    "¿Por qué mi nivel de aviso no es el 5,30 de la alerta?",
    "Porque tu terreno está a otra altura que el resto de la ciudad.",
    "La alerta de la ciudad es un solo número para toda Santa Fe: con ella se activa el plan de contingencia. Si tu terreno es bajo o está río arriba, tu número es más chico que los 5,30 m; si es alto, más grande. Los dos conviven: el tuyo sirve para prepararte antes, no para decidir en lugar de Defensa Civil.",
  ],
  /* Segunda a propósito: es la duda que más se cruza con la primera, y la
     app no la contestaba en ningún lado (feedback de un vecino). Usa sólo
     números que ya publica el municipio. */
  [
    "¿Y si llueve mucho?",
    "Tu nivel de aviso no lo mira: sólo mide el río.",
    "Mucha lluvia en poco tiempo, o varios días seguidos, puede anegar calles y casas aunque el Paraná esté bajo. Y con el río alto es peor: las bombas no alcanzan a sacar el agua de la ciudad. El municipio planifica para río en 6 m más lluvia de 200 a 300 mm.",
  ],
  [
    "¿El agua entra justo cuando el río llega a mi nivel de aviso?",
    "No: es un cálculo aproximado.",
    "No sabe del terraplén (el anillo de defensas), de las bombas ni de la lluvia. El agua puede llegar antes por los desagües, o no llegar. Sirve para saber cuándo prepararte, no para adivinar el minuto. Por eso el número va redondeado: la altura del terreno sale de un plano con líneas cada medio metro.",
  ],
  [
    "¿La app avisa sola cuando el río sube?",
    "Sí, si activás los avisos.",
    "Llega una notificación cuando el nivel sube 15 cm desde el último aviso o cuando pasa la alerta o la evacuación de la ciudad. El aviso se arma en tu teléfono: el servidor no conoce tu nivel de aviso ni tu zona, sólo despierta a la app, que compara contra el número guardado en tu dispositivo.",
  ],
  [
    "¿De dónde sale la altura de mi terreno?",
    "De las curvas de nivel de la Municipalidad de Santa Fe.",
    `Están trazadas cada 50 cm, en metros IGN: por eso el margen de ±0,5 m, que medido contra ${MEDICION.n} puntos del municipio alcanza en ${MEDICION.alcanza} de cada 100. También podés escribirla vos, que figura en planos de mensura y escrituras. No se usa elevación satelital: se midió contra puntos de campo del IGN y su error superaba la escala entera de la decisión.`,
  ],
  [
    "¿Qué hago si mi dirección queda fuera de la zona con curvas?",
    "Escribí la altura a mano.",
    "La app te lo dice y te la pide, en vez de usar una fuente peor. Las curvas municipales cubren la ciudad, y los puntos medidos por la Provincia, San José del Rincón y Arroyo Leyes; más allá no tenemos con qué calcularla.",
  ],
  [
    "¿Funciona sin conexión?",
    "Sí, una vez cargada.",
    "La app guarda lo esencial: tu nivel de aviso, tu plan familiar, los 30 puntos de encuentro y la última lectura del río con su fecha. Sin conexión ves esa última lectura, nunca un número inventado.",
  ],
  [
    "¿Quién ve mi plan familiar y mis datos?",
    "Nadie: se guardan sólo en tu teléfono.",
    "El plan, tu nivel de aviso y tu zona no salen de ahí. Lo único que viaja a un servidor es el texto que mandes por el formulario de sugerencias, y el formulario lo dice. Aparte, la app cuenta cuánta gente la usa con un número al azar que no identifica a nadie.",
  ],
  [
    "¿Esto reemplaza a la alerta de Defensa Civil?",
    "No. La orden de evacuación la da Defensa Civil.",
    "Es un cálculo aproximado para prepararte antes, hecho por un vecino y sin vínculo con el municipio. Si el río llega a tu nivel de aviso, armá el plan y llamá al 103 si tenés dudas.",
  ],
  [
    "¿Cada cuánto se actualiza el nivel?",
    "Una vez por día.",
    "El INA publica una lectura por día del hidrómetro del Puerto. La app la toma de ese reporte y muestra siempre la fecha del dato, así sabés qué tan fresco es.",
  ],
  /* «¿Qué es la cota del río?» estaba acá y se mudó a /hidrometro (octubre de
     2026): con las dos respuestas, las dos páginas competían por la misma
     búsqueda. */
];

const htmlPreguntas = pagina({
  clave: "preguntas",
  migaja: "Preguntas frecuentes",
  h1: "Preguntas sobre el río, tu terreno y las inundaciones",
  lead: "Las dudas que más aparecen, contestadas sin vueltas. Primero la respuesta corta.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map(([q, corta, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: corta + " " + a },
    })),
  },
  bloques: [],
  sueltos: [
    `      <div class="faq-y-corto">
        <section class="bloque faq-lista">
${PREGUNTAS.map(
  ([q, corta, a]) => `          <details class="faq">
            <summary>${esc(q)}</summary>
            <p><b class="corta">${esc(corta)}</b> ${esc(a)}</p>
          </details>`,
).join("\n")}
        </section>
        ${
          /* Las cuatro ideas que hay que llevarse aunque no se abra ninguna
             pregunta. Al costado en pantalla ancha, debajo en el teléfono. */ ""
        }<aside class="bloque en-corto" aria-labelledby="en-corto-t">
          <h2 id="en-corto-t">En corto</h2>
          <ul class="flechas">
            <li>Mide el río, no la lluvia.</li>
            <li>Es aproximado: sirve para prepararte, no para adivinar el minuto.</li>
            <li>Tus datos no salen de tu teléfono.</li>
            <li>La orden de salir la da Defensa Civil.</li>
          </ul>
          <a class="btn-emergencia fila-103" href="tel:103"><span>Defensa Civil</span><b>103</b></a>
        </aside>
      </div>`,
    bloque({
      oscuro: true,
      titulo: "¿Tu pregunta no está?",
      html: `        <p>
          Mandala por el formulario. No es una vía de auxilio: ante una
          emergencia, llamá al <b>103</b>.
        </p>
        <p><a href="/contacto">Escribinos →</a></p>`,
    }),
  ],
});

export {
  PREGUNTAS,
  htmlPreguntas,
};
