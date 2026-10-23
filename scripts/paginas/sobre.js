// scripts/paginas/sobre.js — /sobre. La escribe emitir.js.

import { SITIO, bloque, pagina } from "./base.js";

/* ---------- /sobre ----------
   Para un sitio sobre riesgo hídrico, decir quién está detrás no es un
   trámite: es lo que separa una herramienta ciudadana de una página anónima
   que da números sobre inundaciones. Esto estaba disperso entre el pie y
   /legal, y en ningún lado se contestaba de frente "¿quiénes son ustedes?".

   Cada afirmación de acá tiene que ser cierta y verificable. Nada de
   credenciales, ni de respaldos, ni de "avalado por". */
const htmlSobre = pagina({
  clave: "sobre",
  migaja: "Sobre Cota Cero",
  h1: "Sobre Cota Cero",
  lead:
    "Un <b>proyecto ciudadano independiente</b>. No pertenece a la " +
    "Municipalidad, ni al INA, ni a la Provincia, y ninguno lo revisó.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre Cota Cero",
    inLanguage: "es-AR",
    mainEntity: {
      "@type": "WebSite",
      name: "Cota Cero",
      url: SITIO,
      description:
        "Herramienta ciudadana que relaciona el nivel del río Paraná en Santa Fe con la cota del terreno.",
      creator: { "@type": "Person", name: "Ariel Benz" },
    },
  },
  bloques: [
    {
      /* La pregunta de la que salió todo, como frase grande. Ojo con el tiempo
         verbal de lo del Niño: en pasado cuenta el origen y sigue siendo
         cierto dentro de diez años; en presente sería una afirmación sobre
         hoy que nada refresca. Y «unas charlas», no un número: decía «seis»
         y la lista ya tenía ocho. */
      oscuro: true,
      html: `        <p class="pregunta-grande">
          El nivel del río se publica todos los días. La altura de un terreno
          también. ¿Por qué nadie los pone en la misma escala?
        </p>
        <p>
          Cota Cero es esa pregunta, contestada. Hace una sola cosa: pone los
          dos datos públicos en la misma escala y explica qué significa
          compararlos, incluido todo lo que no significa.
        </p>
        <p class="chico">
          Empezó con un Niño declarado, el patrón de las crecidas de 1983, 1992
          y 2016, y con <a href="/charlas">unas charlas</a> que dicen lo mismo:
          prepararse antes cuesta mucho menos que reconstruir después.
        </p>`,
    },
  ],
  sueltos: [
    `      <div class="tarjetas-tres sobre-tres">
        <section>
          <h2>Una persona, no una institución</h2>
          <p>La hace <b>Ariel Benz</b>, por cuenta propia. Sin empresa, ONG ni organismo detrás, y sin financiamiento.</p>
        </section>
        <section>
          <h2>No predice inundaciones</h2>
          <p>Relaciona dos alturas. No sabe si entre el río y tu casa hay un terraplén o una bomba, y no ve la lluvia que cae sobre la ciudad. <a href="/datos#abiertas">Lo que está en discusión</a>.</p>
        </section>
        <section>
          <h2>Todo tiene fuente y enlace</h2>
          <ul class="fuentes-cortas">
            <li><b>El río</b> · INA</li>
            <li><b>El terreno</b> · Municipalidad, curvas de nivel</li>
            <li><b>Los puntos</b> · Gestión de Riesgos</li>
            <li><b>La historia</b> · INA, <a href="/historia">desde 1925</a></li>
          </ul>
          <p><a href="/datos">Cada una, con el dato crudo</a>.</p>
        </section>
      </div>`,
    bloque({
      borde: true,
      titulo: "Si algo está mal, avisá",
      html: `        <p>
          En una herramienta sobre riesgo hídrico, un error no es un detalle.
          Un dato equivocado, una fuente rota, algo que no se entiende.
        </p>
        <p><a class="btn" href="/contacto">Escribinos</a></p>`,
    }),
  ],
});

export {
  htmlSobre,
};
