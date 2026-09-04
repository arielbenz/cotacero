/* lib/listas.js — las dos listas del plan familiar.
   Viven en lib/ y no en js/app/config.js porque las leen los DOS lados: la app
   (a través de config.js, que las re-exporta) y scripts/paginas.js, que arma
   con ellas la hoja imprimible de /guia. config.js importa de estado.js, que
   toca el DOM al cargarse, así que Node no puede leerlo: si estas listas se
   quedaban ahí, la hoja impresa habría tenido su propia copia. Dos copias de
   la mochila es una que un día dice otra cosa que la app. */

/* Las dos listas del plan, con una marca por renglón: `true` = está en el
   Plan de Contingencia de la Municipalidad; `false` = lo agregamos nosotros.
   La distinción importa. Una app que mezcla las recomendaciones del municipio
   con las propias, sin decir cuál es cuál, se atribuye un respaldo que no
   tiene; y esconder lo agregado sería fingir que el plan oficial dice más de
   lo que dice.

   Los cinco puntos de la "Mochila de Emergencia", textuales del plan:
     · Documentos importantes en bolsa de plástico (DNI y todo otro documento
       familiar de importancia).
     · Botiquín de primeros auxilios y medicinas habituales.
     · Manta ligera y ropa de abrigo.
     · Linterna y baterías extra.
     · Radio y pilas para mantenerse informados si se corta la luz.
   Lo demás es sentido común de crecida, no doctrina municipal.

   NO REORDENAR ESTAS LISTAS. Cada casilla se guarda por su posición
   (`cc_mo3`, `cc_pv5`...), así que mover un renglón le cambia el tilde de
   lugar a todo el que ya venía llenando el plan: alguien que tenía la mochila
   a medias abriría la app y vería marcadas otras cosas. Se agrega al final. */
export const MOCHILA = [
  ["Documentos de todos, en bolsa de nylon cerrada", true],
  ["Medicación habitual y recetas", true],
  ["Botiquín de primeros auxilios", true],
  ["Agua potable para tres días", false],
  ["Alimentos que no necesiten cocción ni frío", false],
  ["Linterna y pilas de repuesto", true],
  ["Radio a pilas (para cuando no haya luz ni datos)", true],
  ["Cargador y batería portátil cargada", false],
  ["Mantas y ropa de abrigo", true],
  ["Muda de ropa por persona", false],
  ["Pañales, mamadera y leche si hay bebés", false],
  ["Comida y correa de los animales", false],
  ["Efectivo en billetes chicos", false],
  ["Copia de llaves", false],
  ["Anotado: teléfonos en papel, por si se apaga el celular", false],
];

/* Del plan municipal, para la preparación previa: identificar el punto de
   encuentro más cercano y el recorrido hasta él, asignar roles a cada
   integrante de la familia, y saber cortar la energía eléctrica y cerrar las
   llaves de gas. El resto lo agregamos nosotros. */
export const PREVIA = [
  ["Saber la cota de mi terreno", false],
  ["Elegir el punto de encuentro y probar el recorrido", true],
  ["Acordar quién hace qué el día que haya que salir", true],
  ["Guardar los documentos importantes en alto", false],
  ["Levantar del piso lo que se arruina con el agua", false],
  ["Fijarme dónde se corta la luz y el gas, y que otro más lo sepa", true],
  ["Limpiar la cuneta y el desagüe de la vereda", false],
  ["No dejar escombros ni ramas en la calle", false],
  ["Hablar con los vecinos: quién necesita ayuda para salir", false],
  ["Cargar el celular y la batería portátil cuando anuncian tormenta", false],
  ["Tener a mano el número del contacto fuera de la zona", false],
];

