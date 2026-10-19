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
 *
 * `porque` es UNA línea: por qué esta charla está en la lista. Era un párrafo
 * de tres o cuatro frases por charla, y ocho párrafos juntos no los leía
 * nadie; la línea es lo que había que llevarse de cada uno.
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
    porque: "Los vecinos no reemplazan a las autoridades: se preparan para ayudarlas mejor.",
  },
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: 871,
    titulo: "Sabemos cómo salvar vidas en un desastre: ¿por qué no lo hacemos?",
    ficha: "Sarah Tuneberg · TEDxMileHigh, 2019",
    original: "We know how to save lives in disasters - why don't we?",
    url: "https://www.ted.com/talks/sarah_tuneberg_why_we_need_to_invest_in_data_driven_disaster_mitigation",
    porque: "Lo que falta no es saber cómo evitar muertes, sino decidir invertir en evitarlas.",
  },
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: 660,
    titulo: "Cambio climático y resiliencia ante la inundación",
    ficha: "Matthew Littell · TEDxBostonCollege, 2019",
    original: "Climate change and flood resilience",
    url: "https://www.ted.com/talks/matthew_littell_climate_change_and_flood_resilience",
    porque: "Las obras ya existen: lo que falta es que la gente sepa a qué está expuesta.",
  },
  {
    tono: "alerta",
    sello: "TED",
    duracion: 618,
    titulo: "Preparémonos para nuestro nuevo clima",
    ficha: "Vicki Arroyo · TEDGlobal, 2012",
    original: "Let's prepare for our new climate",
    url: "https://www.ted.com/talks/vicki_arroyo_let_s_prepare_for_our_new_climate",
    porque: "Prepararse antes cuesta mucho menos que reconstruir después.",
  },
  {
    tono: "agua",
    sello: "TEDx",
    duracion: 805,
    titulo: "Ciudades esponja, planeta esponja",
    ficha: "Kongjian Yu · TEDxBoston, 2022",
    original: "Sponge City and Sponge Planet",
    url: "https://www.ted.com/talks/kongjian_yu_sponge_city_and_sponge_planet",
    porque: "El drenaje de la ciudad decide tanto como el nivel del río.",
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
    porque: "Un parque que retiene la lluvia, en una ciudad de delta con río grande.",
  },
  {
    tono: "ok",
    sello: "TEDx",
    duracion: 636,
    titulo: "Cómo los celulares mueven la ayuda humanitaria",
    ficha: "Paul Conneally · TEDxRC2, 2011",
    original: "How mobile phones power disaster relief",
    url: "https://www.ted.com/talks/paul_conneally_how_mobile_phones_power_disaster_relief",
    porque: "La gente afectada también es fuente de información. Por eso es una app y no un folleto.",
  },
  {
    tono: "ok",
    sello: "TED",
    duracion: 313,
    titulo: "El año en que los datos abiertos se hicieron globales",
    ficha: "Tim Berners-Lee · TED University, 2010",
    original: "The year open data went worldwide",
    url: "https://www.ted.com/talks/tim_berners_lee_the_year_open_data_went_worldwide",
    porque: "El INA, el IGN y el municipio publican; Cota Cero sólo conecta.",
  },
];
