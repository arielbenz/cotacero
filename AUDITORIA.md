# Auditoría de los números de Cota Cero

Qué número usa la app, de dónde salió, qué tan firme es y qué habría que
preguntarle a quién para cerrarlo. Es documentación interna: lo que de acá va
a la interfaz está en `/datos`, escrito para cualquiera.

Última revisión: **2 de septiembre de 2026**.

Regla de jerarquía, en este orden: **organismo oficial → universidad →
normativa → prensa**. Ningún número que entre en el cálculo puede tener a la
prensa como mejor fuente sin que acá diga que es así.

---

## Resumen: el estado de cada número

| Número | Dónde vive | Fuente | ¿Oficial? | ¿Puede cambiar? | ¿Viene de una API? |
|---|---|---|---|---|---|
| Nivel del río | `lib/ina.js` | INA, serie 30 | sí | todos los días | **sí, ahora** |
| Alerta 5,30 m | estación INA | INA | sí | si el INA la corrige | **sí, ahora** |
| Evacuación 5,70 m | estación INA | INA | sí | idem | **sí, ahora** |
| Récord 7,43 m (1992) | `datos/historia.json` | INA, serie 30 | sí | si hay una crecida mayor | sí, al generar |
| Aguas bajas 2,00 m | `lib/fuentes.js` | INA | sí | idem | sí (no se usa todavía) |
| **Cero del hidrómetro 8,20 m** | `app.js` `CERO_IGN` | prensa + normativa local | **no** | **discutido — ver abajo** | no |
| **Pendiente 0,045 m/km** | `app.js` `PENDIENTE` | derivada de un caso | **no** | **discutido — ver abajo** | no |
| Margen de cota ±0,5 m | `app.js` `ERROR_DEM` | convención cartográfica | no | sí | no |
| Km río arriba por zona | `app.js` `ZONAS` | 1 publicado, 9 propios | parcial | sí | no |
| Umbral de lluvia 40 mm/día | `app.js` `MM_UMBRAL` | criterio propio | no | sí | no |
| Escenario 6 m + 200-300 mm | HTML de la app | municipio | sí | sí | no |
| 30 cm / 60 cm de corriente | HTML de la app | seguridad vial estándar | sí | no | no |
| Escala 0 a 8 m | `app.js` `ESCALA_MAX` | decisión de diseño | n/a | — | no |
| GPS máx. ±100 m | `app.js` `PRECISION_MAX` | criterio propio | n/a | — | no |
| Dato vencido a 48 h | `app.js` `VENCE_HORAS` | criterio propio | n/a | — | no |
| Aviso a +15 cm | `api/cron/avisar.js` | criterio propio | n/a | — | no |

Lo que cambió en esta iteración: **cuatro números dejaron de estar escritos a
mano.** Alerta, evacuación y aguas bajas los publica ahora la estación del INA
en cada consulta; el récord sale de la serie histórica. Los dos que siguen
hardcodeados son justamente los dos que están en discusión.

---

## 1. El cero del hidrómetro: 8,20 contra 8,378

**Qué usa la app:** `CERO_IGN = 8.2`.

**El conflicto.** El propio INA publica, para la estación Santa Fe (serie 30),
`cero_ign: 8.378`. Son **17,8 cm** de diferencia, y el umbral personal de cada
persona se mueve exactamente eso.

### Lo que dice cada lado

**A favor de 8,378 — fuente primaria, y es la mejor documentada.**
El informe *Campaña de relevamiento de ceros hidrométricos* (Sabarots Gerbec
et al., INA, proyecto Delta) documenta una campaña conjunta **INA-IGN del 6 al
18 de diciembre de 2016** que remidió los ceros de las escalas de quince
puertos del Paraná. Su Tabla 1 da, para **SANTA FE**, con el bulón BUHH en el
muelle público:

    Escala 1 ......... 8,38
    Escala 2 ......... 8,37
    nota: "Las dos escalas están muy próximas una de la otra."

El informe explica además por qué se hizo: *"La determinación de los ceros de
las escalas fue realizada por la Subsecretaría de Puertos y Vías Navegables en
el momento de instalación de las escalas (con posteriores tareas de
nivelación), pero el paso del tiempo amerita a contar con un relevamiento
actualizado."*
→ https://www.ina.gob.ar/delta/pdf/03_02_INA-DELTA_Info04_CerosHidrometricos.pdf

**A favor de 8,20 — es el número que se usa en Santa Fe.**

1. **Normativa.** El Reglamento de Edificaciones y Procedimientos de la Comuna
   de San José del Rincón fija la cota de edificación en
   `16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)`. La diferencia entre esos dos
   números es **8,20 exacto**. Nótese "I.G.M.": Instituto Geográfico *Militar*,
   el nombre anterior del IGN, o sea el sistema viejo.
   → https://capsf.org.ar/modulos/ejercicio_prof./archivos/rincon.pdf
2. **Especialista.** Carlos Paoli, ingeniero hidrólogo y docente de posgrado de
   la FICH-UNL: *"La cota de Santa Fe está a 8,20 metros, por encima del 0 de
   referencia"*, en El Litoral. Es prensa, pero cita a un especialista
   identificable de la institución que corresponde.
3. **Coherencia interna.** Es el número con el que cierra la comprobación de
   1992 (§3), que es la única validación independiente que tiene el modelo.

### Por qué la diferencia no es un error de nadie

En **enero de 2017** —un mes después de esa campaña— la Disposición 2/2017 del
IGN oficializó el **SRVN16**, que reemplazó al **SRVN71** como sistema de
alturas del país. El propio IGN, al anunciar la nueva referencia altimétrica de
escalas hidrométricas y mareógrafos, dice que hasta entonces convivían
referencias del **ex Ministerio de Obras Públicas, de Obras Sanitarias, del
sistema de 1971 y de sistemas municipales**.

Es decir: **8,20 y 8,378 pueden ser el mismo punto físico medido en dos
sistemas de alturas distintos.** La escala no se movió; cambió la regla con la
que se mide su altura.

### Por qué NO cambiamos la constante

Lo que tiene que estar bien no es "cuál número es más nuevo". Es que **el cero
del hidrómetro y las curvas de nivel del municipio estén en el mismo sistema de
alturas**, porque la app los resta.

Y las curvas no declaran el suyo. Los metadatos de la capa `sitmax:curvas_nivel`
dicen sólo esto:

    Capa subida al repositorio en: F:\...\Sec_Recursos_Hidricos\
    Dep_Relevamientos_Planialtimetricos\COTAS PARA MDT\Curvas de Nivel

Sistema horizontal declarado: **EPSG:22185 (Campo Inchauspe / Argentina 5)**, un
datum de 1969. Sistema *vertical*: no se declara.

Si las curvas están en el sistema viejo —lo que sugieren tanto el datum
horizontal como que la normativa local siga usando 8,20— entonces poner 8,378
metería un sesgo sistemático de 18 cm en **todos** los umbrales, hacia el lado
optimista, y nadie se enteraría.

**Decisión: se mantiene 8,20. Queda marcado como dato pendiente de validación
técnica.** La app muestra los dos números y explica la discrepancia en
`/datos`; el valor del INA se guarda en `estado.ceroINA` y viaja en
`/api/nivel` como `cero_ign`, pero no entra en ninguna cuenta.

### Una hipótesis que se probó y NO explica la diferencia

En la API del INA conviven dos juegos de estaciones para los mismos puertos, y
sus ceros no coinciden:

| Puerto | Escala hidrométrica | Mareógrafo (red PVNyMM) | Dif. |
|---|---|---|---|
| Paraná | 9,432 (est. 29) | 9,565 (est. 1724) | 13 cm |
| Rosario | 2,923 (est. 34) | 3,032 (est. 1722) | 11 cm |
| Diamante | 6,747 (est. 31) | 6,763 (est. 1725) | 2 cm |
| **Santa Fe** | **8,378 (est. 30)** | **no hay** | — |

Tentaba leerlo como "8,20 es el valor viejo y 8,378 el nuevo", igual que
9,565 → 9,432. **No es eso.** Las estaciones 1722-1725 son *mareógrafos* de la
red de Puertos y Vías Navegables y Marina Mercante: instrumentos distintos, en
el mismo puerto, con su propio cero. No son una versión anterior de la misma
escala. Y para Santa Fe no hay mareógrafo en ese juego, así que la hipótesis ni
siquiera se puede aplicar acá.

Lo que sí deja: **"el cero" no es único por ciudad, es por instrumento.**
Cualquier pregunta a un organismo tiene que nombrar la escala, no el puerto.

(De paso: el `/mi-cota` de la app citaba 9,57 para Paraná y 3,03 para Rosario.
Son los ceros de los *mareógrafos*, no los de las escalas. Corregido.)

### Intento de resolverlo empíricamente (no alcanzó)

Se comparó la cota que la app interpola de las curvas municipales contra los
**puntos de la Red de Nivelación del IGN** (capas `ign:nivelacion_alta_precision`
y `ign:nivelacion_precision`, que sí están en SRVN16), en los 16 puntos que
caen dentro de la cobertura de las curvas:

    n                          16
    sesgo medio            +0,045 m
    mediana                −0,283 m
    desvío estándar         1,327 m
    error estándar de la media  0,332 m

**El test no puede distinguir 18 cm**: el error estándar de la media es casi el
doble de la diferencia que se quería medir. Y hay un sesgo conocido en contra:
las 16 marcas son "chapa pilar", o sea placas sobre pilares y estructuras, no
sobre el piso, así que la comparación no mide exactamente lo mismo.

Sirvió igual para saber qué haría falta: **una comparación capaz de resolver
18 cm necesita puntos al nivel del terreno y del orden de 200**, o directamente
la respuesta de quien produjo las curvas.

---

## 2. La pendiente: 0,045 m/km

**Qué usa la app:** `PENDIENTE = 0.045`, un solo valor para todas las zonas.

**De dónde salió.** No de una publicación sobre la pendiente del Paraná, sino
de despejarla del caso de 1992 (§3): con el puerto en 7,43 m y Arroyo Leyes
—24 km aguas arriba— en 16,70 IGN, la pendiente que hace cerrar la cuenta es
4,5 cm/km. Es decir: **la pendiente y la validación salen del mismo dato.** Que
el modelo reproduzca 1992 con un centímetro no es sorprendente; es casi
circular. Vale como control de consistencia, no como validación independiente.

**La señal de que no es universal.** El reglamento de San José del Rincón,
**16 km río arriba**, convierte cota a hidrómetro con 8,20 y **sin ninguna
corrección por distancia**. Con la pendiente de la app, a 16 km le
corresponderían 72 cm más. O el reglamento usa una simplificación para fijar un
mínimo de obra, o la pendiente real en ese tramo es muy distinta. No lo sabemos.

> Nota sobre el planteo original de esta revisión: se buscó una normativa de
> Rincón que usara ~0,03 m/km y **no se encontró**. Lo que sí está documentado
> es lo de arriba, que implica pendiente cero en ese tramo. Se anota la
> diferencia para que nadie dé por buena la cifra de 0,03 leyéndola acá.

**Por qué importa tanto.** La pendiente de la superficie del agua no es una
constante del río: depende del tramo, del caudal, de la condición hidráulica
del momento y de si el tramo está o no en remanso. Usar un único valor para
zonas que van de 0 a 40 km es la simplificación más fuerte del modelo. En la
zona más lejana (Santa Rosa de Calchines, 40 km) la corrección es de 1,80 m
—casi todo el rango de decisión de la app— y descansa entera sobre un
coeficiente ajustado a una sola crecida.

**Decisión: se mantiene 0,045 y se declara como limitación mayor** en `/datos`
y en la propia pantalla del cálculo.

---

## 3. La comprobación de 1992

    Puerto de Santa Fe, 22 de junio de 1992 ....... 7,43 m   (INA, serie 30) ✔
    Arroyo Leyes, 24 km río arriba ............... 16,70 IGN  (prensa)      ✖
    Lo que da el modelo .......................... 16,71 IGN

El **7,43 quedó confirmado contra fuente primaria** en esta iteración: es el
máximo de toda la serie del INA 1925-2026, el 22 de junio de 1992.

El **16,70 de Arroyo Leyes sigue sin fuente primaria**. Viene de un ingeniero
civil citado en prensa. Es el único dato independiente que tiene el modelo y
además —ver §2— es del que se despejó la pendiente. Conseguir el registro
original de esa cota es la tarea de mayor rendimiento pendiente.

---

## 4. El margen de la cota: ±0,5 m

**Qué usa la app:** `ERROR_DEM = 0.5`, descontado siempre del lado pesimista.

**De dónde salió:** la convención de tomar medio intervalo entre curvas cuando
se interpola. No es un error medido.

**Un problema concreto que apareció al revisar.** Las 169 curvas **no están
todas cada 50 cm**:

    tramos en la malla de 0,5 m ....... 148
    tramos fuera de la malla .......... 21
    cotas fuera de malla: 15,9 · 16,2 · 16,4 · 16,6 · 16,76 · 16,9 · 17,1
                          17,2 · 17,3 · 17,4 · 17,53 · 18,8 · 19,2 · 20,7
    separaciones presentes: 0,03 a 1,8 m
    rango: 12,5 a 22,5 m IGN

Entre 20,7 y 22,5 hay **1,8 m sin ninguna curva**: ahí "medio intervalo" serían
90 cm, no 50. Y donde hay curvas cada 3 cm, ±0,5 m es exageradamente
conservador. El margen no debería ser una constante: debería salir de la
separación local entre las dos curvas que se usaron para interpolar.

La comparación contra el IGN (§1) da un desvío de 1,33 m, bastante peor que
±0,5, pero está contaminada por el tipo de marca. **No hay todavía una medición
limpia del error real.**

**Decisión: se mantiene 0,5 y se declara en `/datos` que es una convención y no
una medición.** No se sube: subirlo sin medirlo sería cambiar la fórmula para
que parezca más segura, que es exactamente lo que no hay que hacer.

---

## 5. Los kilómetros río arriba

Sólo **Arroyo Leyes (24 km)** está publicado. Los otros nueve son estimaciones
propias sobre el mapa. A 4,5 cm/km, equivocarse 5 km son 22 cm — el mismo orden
que los márgenes con los que se decide. La app ya lo dice en pantalla en cada
zona sin km publicado.

Pendiente: medirlos sobre el eje del cauce, no en línea recta.

---

## 6. Lo que cambió de fuente en esta iteración

**`/api/nivel` ahora lee la API REST del SIyAH del INA**, con el reporte diario
en HTML como respaldo automático:

    API a5 del INA  →  si falla  →  reporte diario (raspado)  →  si falla  →  último guardado

- Endpoint: `https://alerta.ina.gob.ar/a5/obs/puntual/series/30`
- Estación 30 · `SAFE` · id externo 240 · propietario Prefectura Naval
- Variable: altura hidrométrica (varId 2), medición directa, en metros
- Cobertura: **2 de enero de 1925 → hoy**, 39.115 observaciones
- Actualización: diaria, alrededor de las 12 UTC
- La respuesta trae `nivel_alerta`, `nivel_evacuacion`, `nivel_aguas_bajas` y
  `cero_ign` de la propia estación
- Sin clave, sin registro, sin cuota. Es la API que consume el visor del INA.

**Comprobación de que las dos fuentes dicen lo mismo:** el 1/9/2026 la API
devolvió 2,95 m y el reporte diario 2,95 m, con la misma fecha y el mismo
delta. El campo `origen` de la respuesta dice cuál contestó, y `degradado`
aparece cuando hubo que usar el respaldo.

### Sobre el envoltorio documentado (`/pub/datos`)

`argentina.gob.ar` documenta `https://alerta.ina.gob.ar/pub/datos/` como la
Web API pública, y **sería la primera opción**. No se pudo usar:

- `datosDia?seriesId=30` → *"Missing parameters: either var_id or series_id"*
- `datos?...&timeStart=...` → *"Argumento timeStart faltante"*
- `percentiles?seriesId=30` → error de Perl (`Net/HTTP/Methods.pm line 391`)
- `/pub/mapa` y `/pub/gui/series` → tres intentos seguidos con timeout de 30 s

Conviene reintentar más adelante: si `/pub/` se estabiliza, es la ruta correcta
por ser la documentada. Mientras tanto, `/a5` es la que el INA usa en
producción y la que responde.

---

## 7. Preguntas concretas, por organismo

Nada de esto se puede cerrar desde afuera. Lo que sigue está redactado para
poder copiarse y mandarse.

### Al INA — Centro Regional Litoral / SIyAH

1. El `cero_ign = 8,378` de la estación Santa Fe (serie 30), ¿está referido al
   SRVN16? ¿Corresponde a la Escala 1 o a la Escala 2 de la Tabla 1 del informe
   de ceros hidrométricos de 2016, o es un promedio?
2. ¿Cuál era el cero publicado para esa escala **antes** de la campaña de 2016,
   y en qué sistema estaba?
3. ¿La serie 30 es homogénea a lo largo de todo el período 1925-2026, o hubo
   cambios de instrumento o de referencia que convenga conocer?
4. ¿Existe algún valor publicado de pendiente de la superficie del agua para el
   tramo Santa Fe – Arroyo Leyes?

### Al IGN — Dirección de Geodesia

5. Para el punto fijo **BUHH** (Puerto de Santa Fe, campaña INA-IGN de
   diciembre de 2016), ¿cuál es la diferencia entre su cota en SRVN71 y en
   SRVN16?
6. ¿Existe un valor de conversión SRVN71 → SRVN16 aplicable al ejido de la
   ciudad de Santa Fe?

### A la Municipalidad — Secretaría de Recursos Hídricos, Departamento de Relevamientos Planialtimétricos

7. Las curvas de nivel publicadas como `sitmax:curvas_nivel`, **¿en qué sistema
   de alturas están?** ¿IGN antiguo (SRVN71 / IGM), SRVN16, o una referencia
   municipal propia?
8. ¿De qué año es el relevamiento y con qué equidistancia se trazaron? Hay 21
   de 169 tramos fuera de la malla de 50 cm.
9. ¿Está disponible la **Red de Puntos Fijos Planialtimétricos**? No aparece en
   el GeoServer público y es el dato que permitiría medir el error real de la
   cota interpolada.
10. ¿Se publica la traza de defensas, terraplenes, compuertas y estaciones de
    bombeo? Es lo que más cambia el resultado y la app hoy no lo sabe.

### A la FICH-UNL

11. ¿Hay trabajos publicados sobre la relación cota-hidrómetro en el tramo
    Santa Fe – Arroyo Leyes, y sobre la pendiente de la superficie del agua en
    crecida?
12. ¿Existe registro académico de la cota alcanzada en Arroyo Leyes en la
    crecida de junio de 1992? Hoy el único respaldo es una nota de prensa.

### A la Dirección de Gestión de Riesgos

13. ¿Le encuentran utilidad a esta herramienta, y hay algo que consideren que
    no debería mostrar?
14. ¿El escenario de planificación sigue siendo río en 6 m más lluvia de 200 a
    300 mm?

---

## 8. Lo que NO se cambió, a propósito

- **`CERO_IGN` sigue en 8,20.** Sin saber el datum de las curvas, mover esto es
  meter un sesgo invisible.
- **`PENDIENTE` sigue en 0,045.** No hay evidencia para otro valor, y menos
  para valores distintos por tramo.
- **`ERROR_DEM` sigue en 0,5.** No hay una medición limpia del error real.
- **No se agregó ninguna capa nueva al mapa.** Las de la IDESF y las
  municipales de reservorios y desagües existen, pero ninguna contesta una
  pregunta que la gente se esté haciendo hoy en la app.
- **No se reconstruyó la crecida de 1905** ni ningún evento anterior a 1925: el
  INA no los publica en esta serie y la prensa no es fuente para un número que
  la app dibuje en una regla.
