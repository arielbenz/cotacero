import crypto from "node:crypto";

// lib/metricas.js — lo que comparten el contador y el tablero.
//
// Se cuenta con HyperLogLog: una estructura que responde "cuántos distintos"
// gastando 12 KB fijos, sin guardar ni uno solo de los identificadores. No es
// una decisión de ahorro, es la razón por la que se puede contar sin tener
// una lista de quién entró.
//
// El identificador es un número al azar que genera el teléfono y guarda en su
// propio almacenamiento. No viaja con él ninguna IP, ni la cota, ni la zona.
// Sirve para distinguir "500 aperturas de 30 personas" de "500 personas", y
// para nada más.

/* Argentina no tiene horario de verano desde 2009: el desfase es fijo. Si el
   día se cortara en UTC, todo lo que pasa entre las 21 y la medianoche caería
   en el día siguiente y "los activos de hoy" no coincidirían con el día que
   uno vivió. */
const DESFASE_AR = -3 * 3600 * 1000;

export function diaAR(cuando = Date.now()) {
  return new Date(cuando + DESFASE_AR).toISOString().slice(0, 10);
}

/* Los últimos n días, del más reciente al más viejo. */
export function ultimosDias(n, cuando = Date.now()) {
  const dias = [];
  for (let i = 0; i < n; i++) dias.push(diaAR(cuando - i * 86400000));
  return dias;
}

export const claveDia = (dia) => "cc:activos:" + dia;

/* Se guardan 40 días: alcanza para la ventana de 30 y deja margen, sin que
   las claves se acumulen para siempre. */
export const DIAS_QUE_VIVEN = 40;

/* Un identificador de instalación válido: 24 caracteres hexadecimales.
   Se valida para que nadie pueda inflar la cuenta mandando basura larga. */
export function idValido(v) {
  return typeof v === "string" && /^[0-9a-f]{24}$/.test(v);
}

/* La lista de sugerencias la escribe api/sugerencias.js y la lee el tablero:
   el nombre de la clave vive acá para que no se separen. */
export const CLAVE_SUGERENCIAS = "cc:sugerencias";

/* Comparación de tiempo constante: un === corta en el primer carácter
   distinto y con eso se puede adivinar la clave de a una letra. */
export function claveCorrecta(dada) {
  const real = process.env.METRICAS_CLAVE || "";
  if (!real || typeof dada !== "string") return false;
  const a = Buffer.from(dada);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
