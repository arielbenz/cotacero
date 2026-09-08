/* lib/charlas.js — las charlas TED y TEDx que explican por qué existe la app.
 *
 * Vive en lib/ y no adentro del generador porque la leen dos: `scripts/paginas.js`,
 * que arma la página, y `scripts/charlas.js`, que baja de ted.com la duración y
 * la miniatura de cada una. Una sola lista, sin copia que se desincronice.
 *
 * `duracion` está en SEGUNDOS, tal como la publica TED. La página la escribe en
 * minutos. `scripts/charlas.js` la vuelve a consultar y avisa si TED dice otra
 * cosa: es un dato de un tercero y no queremos enterarnos por un lector.
 *
 * `tono` ordena la lista en un arco, de la urgencia a los datos abiertos:
 * peligro -> alerta -> agua -> ok. No es decoración: es el recorrido.
 */
export const CHARLAS = [
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: 543,
    titulo: "Cómo dar un paso al frente ante un desastre",
    ficha: "Caitria y Morgan O'Neill · TEDxBoston, 2012",
    original: "How to step up in the face of disaster",
    url: "https://www.ted.com/talks/caitria_morgan_o_neill_how_to_step_up_in_the_face_of_disaster",
    texto:
      "Dos hermanas de 20 y 24 años organizaron la recuperación de su pueblo tras un tornado y convirtieron lo aprendido en un sistema para cualquier comunidad. Es la charla más cercana al espíritu de Cota Cero: los vecinos no reemplazan a las autoridades — se preparan para ayudarlas mejor.",
  },
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: 871,
    titulo: "Sabemos cómo salvar vidas en un desastre: ¿por qué no lo hacemos?",
    ficha: "Sarah Tuneberg · TEDxMileHigh, 2019",
    original: "We know how to save lives in disasters - why don't we?",
    url: "https://www.ted.com/talks/sarah_tuneberg_why_we_need_to_invest_in_data_driven_disaster_mitigation",
    texto:
      "Llamar «naturales» a las inundaciones, los incendios y las olas de calor tapa la responsabilidad humana y nos deja a todos libres de culpa. Su punto es incómodo y es el correcto: lo que falta no es saber cómo evitar muertes, sino decidir invertir en evitarlas. De toda la lista, es la que queda más cerca de 2003.",
  },
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: 660,
    titulo: "Cambio climático y resiliencia ante la inundación",
    ficha: "Matthew Littell · TEDxBostonCollege, 2019",
    original: "Climate change and flood resilience",
    url: "https://www.ted.com/talks/matthew_littell_climate_change_and_flood_resilience",
    texto:
      "Es arquitecto y su tesis incomoda a su propio oficio: contra la inundación las soluciones técnicas ya existen —muros, compuertas, bombeo— y el problema de fondo no es técnico, es social. Lo que falta es que la gente sepa a qué está expuesta y qué hacer. Es el argumento de por qué esto es una herramienta de información y no una obra.",
  },
  {
    tono: "alerta",
    sello: "TED",
    duracion: 618,
    titulo: "Preparémonos para nuestro nuevo clima",
    ficha: "Vicki Arroyo · TEDGlobal, 2012",
    original: "Let's prepare for our new climate",
    url: "https://www.ted.com/talks/vicki_arroyo_let_s_prepare_for_our_new_climate",
    texto:
      "Adaptación en serio: casas y ciudades preparadas para más inundaciones y más incertidumbre, con ejemplos concretos de todo el mundo — incluida Nueva Orleans, su ciudad. El argumento de fondo es el de esta app: prepararse antes cuesta mucho menos que reconstruir después.",
  },
  {
    tono: "agua",
    sello: "TEDx",
    duracion: 805,
    titulo: "Ciudades esponja, planeta esponja",
    ficha: "Kongjian Yu · TEDxBoston, 2022",
    original: "Sponge City and Sponge Planet",
    url: "https://www.ted.com/talks/kongjian_yu_sponge_city_and_sponge_planet",
    texto:
      "El paisajista que convenció a más de 200 ciudades de dejar de pelear contra el agua y absorberla con parques, humedales y suelo permeable. Ilumina justo lo que el modelo de Cota Cero declara no saber: el drenaje urbano y las defensas deciden tanto como el nivel del río.",
  },
  {
    tono: "agua",
    sello: "TED",
    duracion: 737,
    titulo:
      "Cómo convertir ciudades que se hunden en paisajes contra la inundación",
    ficha: "Kotchakorn Voraakhom · TEDWomen, 2018",
    original:
      "How to transform sinking cities into landscapes that fight floods",
    url: "https://www.ted.com/talks/kotchakorn_voraakhom_how_to_transform_sinking_cities_into_landscapes_that_fight_floods",
    texto:
      "Bangkok se hunde en su propio delta y esta paisajista construyó ahí un parque que retiene un millón de galones de lluvia. Misma idea que la de Yu, pero desde una ciudad de delta del sur global: terreno blando, río grande y presupuesto real.",
  },
  {
    tono: "ok",
    sello: "TEDx",
    duracion: 636,
    titulo: "Cómo los celulares mueven la ayuda humanitaria",
    ficha: "Paul Conneally · TEDxRC2, 2011",
    original: "How mobile phones power disaster relief",
    url: "https://www.ted.com/talks/paul_conneally_how_mobile_phones_power_disaster_relief",
    texto:
      "Cómo el teléfono y las redes pasaron a ser centrales en la ayuda humanitaria: la gente afectada dejó de ser sólo destinataria y pasó a ser también fuente de información. Es la razón de que Cota Cero sea una app en el teléfono y no un folleto.",
  },
  {
    tono: "ok",
    sello: "TED",
    duracion: 313,
    titulo: "El año en que los datos abiertos se hicieron globales",
    ficha: "Tim Berners-Lee · TED University, 2010",
    original: "The year open data went worldwide",
    url: "https://www.ted.com/talks/tim_berners_lee_the_year_open_data_went_worldwide",
    texto:
      "El inventor de la web muestra qué pasa cuando gobiernos e instituciones liberan sus datos crudos — incluido el mapeo voluntario de Haití en OpenStreetMap tras el terremoto. Cota Cero existe exactamente por eso: el INA, el IGN y el municipio publican; nosotros sólo conectamos.",
  },
];
