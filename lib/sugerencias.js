// lib/sugerencias.js — las categorías del formulario, escritas UNA sola vez.
//
// Estaban duplicadas en api/sugerencias.js y api/metricas.js, y ya habían
// divergido: la misma clave `falta` era "Falta algo que me serviría" en el
// formulario y "Falta algo" en el tablero. Con dos formularios —el de la app
// y el de /contacto— eran cuatro lugares.
//
// Quién lo consume:
//   api/sugerencias.js       valida la categoría que llega
//   api/metricas.js          la muestra en el tablero
//   js/contacto.js           dibuja las opciones de /contacto
//   js/app/sugerencias.js    dibuja el desplegable de la app
//
// LAS CLAVES NO SE CAMBIAN. Las sugerencias ya guardadas en Redis llevan la
// suya escrita: renombrar `dato` dejaría huérfanas a las viejas. Se pueden
// agregar al final y se puede cambiar la etiqueta; la clave, no.

export const CATEGORIAS = {
  dato: "Error en un dato",
  falta: "Idea o mejora",
  zona: "Mi barrio o mi zona",
  confuso: "No se entiende algo",
  prensa: "Prensa u organismos",
  otro: "Otro",
};

export const CATEGORIA_POR_DEFECTO = "dato";

/* Los mismos topes de un lado y del otro: si el navegador deja escribir más
   de lo que el servidor acepta, la persona escribe un texto largo y recibe un
   error después de mandarlo. */
export const MAX_TEXTO = 600;
export const MAX_CONTACTO = 120;

/* Cuántos envíos por hora desde la misma IP. La IP no se guarda: se hashea
   con el CRON_SECRET de sal y sirve para contar, no para rastrear. */
export const POR_HORA = 3;

export const esCategoria = (c) =>
  Object.prototype.hasOwnProperty.call(CATEGORIAS, c);
