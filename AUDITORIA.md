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

| Número                         | Dónde vive                     | Fuente                   | ¿Oficial? | ¿Puede cambiar?           | ¿Viene de una API?     |
| ------------------------------ | ------------------------------ | ------------------------ | --------- | ------------------------- | ---------------------- |
| Nivel del río                  | `lib/ina.js`                   | INA, serie 30            | sí        | todos los días            | **sí, ahora**          |
| Alerta 5,30 m                  | estación INA                   | INA                      | sí        | si el INA la corrige      | **sí, ahora**          |
| Evacuación 5,70 m              | estación INA                   | INA                      | sí        | idem                      | **sí, ahora**          |
| Récord 7,43 m (1992)           | `datos-abiertos/historia.json` | INA, serie 30            | sí        | si hay una crecida mayor  | sí, al generar         |
| Aguas bajas 2,00 m             | `public/lib/fuentes.js`               | INA                      | sí        | idem                      | sí (no se usa todavía) |
| **Cero del hidrómetro 8,20 m** | `js/app/config.js`             | prensa + normativa local | **no**    | **discutido — ver abajo** | no                     |
| **Pendiente 0,045 m/km**       | `js/app/config.js`             | derivada de un caso      | **no**    | **discutido — ver abajo** | no                     |
| Margen de cota ±0,5 m          | `js/app/config.js`             | convención cartográfica  | no        | sí                        | no                     |
| Km río arriba por zona         | `js/app/config.js`             | 1 publicado, 9 propios   | parcial   | sí                        | no                     |
| Niveles observados por zona    | `js/app/config.js` (`ZONAS`)   | municipio en prensa, 2016 | **no**   | sí — ver §9               | no                     |
| Umbral de lluvia 40 mm/día     | `js/app/lluvia.js`             | criterio propio          | no        | sí                        | no                     |
| Escenario 6 m + 200-300 mm     | HTML de la app                 | municipio                | sí        | sí                        | no                     |
| 30 cm / 60 cm de corriente     | HTML de la app                 | seguridad vial estándar  | sí        | no                        | no                     |
| Escala 0 a 8 m                 | `js/app/config.js`             | decisión de diseño       | n/a       | —                         | no                     |
| GPS máx. ±100 m                | `js/app/config.js`             | criterio propio          | n/a       | —                         | no                     |
| Dato vencido a 48 h            | `js/app/config.js`             | criterio propio          | n/a       | —                         | no                     |
| Aviso a +15 cm                 | `api/cron/avisar.js`           | criterio propio          | n/a       | —                         | no                     |

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
El informe _Campaña de relevamiento de ceros hidrométricos_ (Sabarots Gerbec
et al., INA, proyecto Delta) documenta una campaña conjunta **INA-IGN del 6 al
18 de diciembre de 2016** que remidió los ceros de las escalas de quince
puertos del Paraná. Su Tabla 1 da, para **SANTA FE**, con el bulón BUHH en el
muelle público:

    Escala 1 ......... 8,38
    Escala 2 ......... 8,37
    nota: "Las dos escalas están muy próximas una de la otra."

El informe explica además por qué se hizo: _"La determinación de los ceros de
las escalas fue realizada por la Subsecretaría de Puertos y Vías Navegables en
el momento de instalación de las escalas (con posteriores tareas de
nivelación), pero el paso del tiempo amerita a contar con un relevamiento
actualizado."_
→ https://www.ina.gob.ar/delta/pdf/03_02_INA-DELTA_Info04_CerosHidrometricos.pdf

**A favor de 8,20 — es el número que se usa en Santa Fe.**

1. **Normativa.** El Reglamento de Edificaciones y Procedimientos de la Comuna
   de San José del Rincón fija la cota de edificación en
   `16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)`. La diferencia entre esos dos
   números es **8,20 exacto**. Nótese "I.G.M.": Instituto Geográfico _Militar_,
   el nombre anterior del IGN, o sea el sistema viejo.
   → https://capsf.org.ar/modulos/ejercicio_prof./archivos/rincon.pdf
2. **Especialista.** Carlos Paoli, ingeniero hidrólogo y docente de posgrado de
   la FICH-UNL: _"La cota de Santa Fe está a 8,20 metros, por encima del 0 de
   referencia"_, en El Litoral. Es prensa, pero cita a un especialista
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
datum de 1969. Sistema _vertical_: no se declara.

Si las curvas están en el sistema viejo —lo que sugieren tanto el datum
horizontal como que la normativa local siga usando 8,20— entonces poner 8,378
metería un sesgo sistemático de 18 cm en **todos** los umbrales, hacia el lado
optimista, y nadie se enteraría.

**Decisión: se mantiene 8,20. Queda marcado como dato pendiente de validación
técnica.** La app muestra los dos números y explica la discrepancia en
`/datos`; el valor del INA se guarda en `estado.ceroINA` (`js/app/estado.js`) y viaja en
`/api/nivel` como `cero_ign`, pero no entra en ninguna cuenta.

### Una hipótesis que se probó y NO explica la diferencia

En la API del INA conviven dos juegos de estaciones para los mismos puertos, y
sus ceros no coinciden:

| Puerto       | Escala hidrométrica | Mareógrafo (red PVNyMM) | Dif.  |
| ------------ | ------------------- | ----------------------- | ----- |
| Paraná       | 9,432 (est. 29)     | 9,565 (est. 1724)       | 13 cm |
| Rosario      | 2,923 (est. 34)     | 3,032 (est. 1722)       | 11 cm |
| Diamante     | 6,747 (est. 31)     | 6,763 (est. 1725)       | 2 cm  |
| **Santa Fe** | **8,378 (est. 30)** | **no hay**              | —     |

Tentaba leerlo como "8,20 es el valor viejo y 8,378 el nuevo", igual que
9,565 → 9,432. **No es eso.** Las estaciones 1722-1725 son _mareógrafos_ de la
red de Puertos y Vías Navegables y Marina Mercante: instrumentos distintos, en
el mismo puerto, con su propio cero. No son una versión anterior de la misma
escala. Y para Santa Fe no hay mareógrafo en ese juego, así que la hipótesis ni
siquiera se puede aplicar acá.

Lo que sí deja: **"el cero" no es único por ciudad, es por instrumento.**
Cualquier pregunta a un organismo tiene que nombrar la escala, no el puerto.

(De paso: el `/mi-cota` de la app citaba 9,57 para Paraná y 3,03 para Rosario.
Son los ceros de los _mareógrafos_, no los de las escalas. Corregido.)

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

**Actualización del 16/10/2026: no hay registro que conseguir.** La nota que
publica el 16,70 (Nicolás Loyarte, El Litoral y Mirador Provincial, 13-14 de
julio de 2026, con el ingeniero civil Agustín Botterón como fuente técnica)
dice textual que «se estima» ese valor, y lo deriva así: 7,43 + 8,19 ≈ 15,62
IGN en el Puerto, más «unos 24 km» por «unos 4,5 cm por km, según hidrólogos»
≈ 16,70. **Es la misma cuenta que hace la app.** La comprobación de 1992 es
circular en los dos sentidos: la pendiente se despejó de un número que se
calculó con esa pendiente. Lo que vale de la nota es otra cosa: que el 4,5
cm/km lo atribuye a «hidrólogos» —es decir, no lo inventamos nosotros, pero
nadie firmó— y que la defensa de Arroyo Leyes está a cota 17 IGN. Lo que
cambia: `/datos` y el README ya no presentan 1992 como validación. Lo que
falta: **una** cota medida en 1992 o 2016 en cualquier punto río arriba del
Puerto. Con una sola, la pendiente deja de ser un número sin respaldo.

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

- `datosDia?seriesId=30` → _"Missing parameters: either var_id or series_id"_
- `datos?...&timeStart=...` → _"Argumento timeStart faltante"_
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
    *16/10/2026: confirmado en negativo.* Ninguna de las 62 capas de
    `geoservicios.santafeciudad.gov.ar/geoserver/publico` ni las de `sitmax`
    es de defensas. Sí existe `publico:reservorios` (32 polígonos), que no
    teníamos anotada.

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

### Lo que agregó la corrida del 8/9/2026

Todo lo de abajo salió de bajar datos de las APIs, no de leer documentos. Los
crudos y los scripts están en `datos-crudos/`, con la fecha en el nombre.

**La más importante, al INA — y toca el modelo, no una constante:**

15. **¿Sobre qué cuerpo de agua está el hidrómetro del Puerto de Santa Fe?**
    Cruzando 13.357 días de las series 30 (Santa Fe) y 29 (Paraná ciudad),
    convertidas a cota IGN con el `cero_ign` que declara cada una, la
    superficie en Paraná da **0,72 m MÁS ALTA** que en Santa Fe. Paraná está
    aguas abajo: eso no puede ser un gradiente. O los dos ceros no están en el
    mismo sistema vertical, o el hidrómetro del Puerto no está sobre el cauce
    principal del Paraná sino sobre el riacho. Si es lo segundo, «la pendiente
    del Paraná» no es lo que traduce cota a lectura del Puerto, y el modelo
    entero se apoya en eso.

16. ¿Los `cero_ign` de las series 26, 27, 28, 29, 30 y 31 están todos en el
    mismo sistema de alturas? El catálogo los publica sin declarar el sistema.

17. Medido sobre 13.196 días, el desnivel Hernandarias − Santa Fe **se achata
    cuando el río crece**: 5,271 m en aguas bajas contra 5,124 m con el Puerto
    por encima de 5,70 (−3,6 cm por cada metro de altura, r = −0,17). ¿Hay una
    curva publicada de pendiente contra caudal para el tramo?

**Al IGN:**

18. Las capas `ign:nivelacion_alta_precision`, `ign:nivelacion_precision` y
    `ign:nivelacion_topografica`, **¿en qué sistema de alturas están?** El
    `GetCapabilities` del WFS (475 KB) trae los tres `Abstract` vacíos y no
    menciona SRVN en ningún lado.
19. De los 16 puntos que caen dentro de la ciudad, 15 son «Chapa pilar» y 1
    «Chapa exterior»: placas sobre pilares y estructuras. **¿Hay puntos de la
    red con marca a nivel del terreno en el ejido de Santa Fe?** Sin eso, la
    comparación contra las curvas no mide la misma superficie y por eso no
    puede resolver los 18 cm.

**A la Municipalidad:**

20. **¿Cuál es la leyenda de `sitmax:zona_seguridad_hidrica`?** La capa publica
    19 polígonos con un único atributo, `id`. Sin saber qué significa cada zona
    no se puede usar ni citar.
    *16/10/2026: respondida en parte, y no es lo que parecía.* Es el distrito
    **ZSH («zona de seguridad hídrica») del Reglamento de Ordenamiento Urbano
    (Ord. 11748/11)**: suelo donde «sólo admite usos agrícolas, recreativos o
    deportivos con autorización del DEM». Es zonificación de uso del suelo,
    no un mapa de riesgo ni de defensas. Fuente: nota técnica «Riesgo y
    vulnerabilidad hídrica en Santa Fe» (Encuentro, 2025, a partir del
    trabajo de María Andrea Zorzón). El estilo SLD publicado es una sola
    regla, «Linea azul»: no hay leyenda por polígono. Queda la pregunta de
    qué distingue a los 19.
21. ¿Existe un límite oficial —o al menos un punto— para **La Vuelta del
    Paraguayo**? No está en las 86 vecinales de `ac_reclamosxvecinal` ni en
    BAHRA, y es una de las doce zonas de la app.
22. Entre el 7 y el 8 de septiembre de 2026 el GeoServer estuvo devolviendo
    **403 detrás de Cloudflare**, con y sin `User-Agent` de navegador. ¿Hay una
    forma estable de consumir el WFS, o conviene coordinar una descarga
    periódica? Es la fuente de las curvas: si se cae, no hay cómo regenerarlas.
    *16/10/2026: los dos GeoServer contestaron 200 al `GetCapabilities` y al
    `GetFeature` con un `User-Agent` de navegador. El 403 fue transitorio.*

**A quien tenga la traza del río (IGN, Prefectura, Hidrovía):**

23. ¿Existe publicada la **línea de eje del Paraná** en el tramo, o los
    **kilómetros oficiales de la vía navegable**? Con las capas del IGN la
    distancia sobre el cauce no se puede medir de forma estable: cerca de Santa
    Fe el río está mapeado como polígono y no como línea, y al armar la red con
    los bordes la distancia a Arroyo Leyes va de **20,6 a 31,8 km** según la
    tolerancia con que se cosen las confluencias. Sin un eje, los km de cada
    zona no se pueden cerrar — y a 4,5 cm/km, ese rango son 50 cm de umbral.

---

## 8. Lo que NO se cambió, a propósito

- **`CERO_IGN` sigue en 8,20.** Sin saber el datum de las curvas, mover esto es
  meter un sesgo invisible.
- **`PENDIENTE` sigue en 0,045.** No hay evidencia para otro valor, y menos
  para valores distintos por tramo.
- **`ERROR_DEM` sigue en 0,5.** No hay una medición limpia del error real.
  Lo que sí se midió el 8/9/2026 es que **no debería ser una constante**: el
  salto entre las dos curvas que la app usa para interpolar va de 0,10 a 6,20 m
  según el lugar (mediana 0,50, p75 1,20, p90 2,20, en 2.025 puntos de malla
  sobre la cobertura). En el 25,4 % del área el intervalo real es el doble o
  más del nominal. Falta decidir la convención antes de tocarlo: con el
  intervalo entero el aviso llegaría antes en el 38 % del área, y con medio
  intervalo llegaría **después** en el 72 %.
- **No se agregó ninguna capa nueva al mapa.** Las de la IDESF y las
  municipales de reservorios y desagües existen, pero ninguna contesta una
  pregunta que la gente se esté haciendo hoy en la app.
- **No se reconstruyó la crecida de 1905** ni ningún evento anterior a 1925: el
  INA no los publica en esta serie y la prensa no es fuente para un número que
  la app dibuje en una regla.

---

## 9. Defensas y niveles observados por zona (búsqueda del 16/10/2026)

Disparador: un vecino de Colastiné Norte cargó su casa, la app le dio ≈ 5,4 y
lo leyó como «a 5,4 me tengo que ir». En enero de 2016 el río llegó a 6,61 y
no se mojó. Tenía razón en la causa: el terraplén Garello. La cuenta de la app
estaba bien —agua libre contra terreno, con el margen pesimista— y lo que
faltaba era decir qué hay entre el río y la casa.

**Lo que se agregó a la app:** `defensa` y `observado` por zona en
`js/app/config.js`, mostrados en «Mi casa» al lado del cálculo y en el plan
impreso. **Lo que NO se hizo:** usar la cota de coronamiento como umbral.

### Por qué la coronación no sirve de umbral

| Defensa | Coronación | En la regla del Puerto | Fuente |
| --- | --- | --- | --- |
| Anillo oeste de la ciudad (tramos 1 y 2, 1994-98) | 17,50 m IGM | ≈ 9,3 m | IAI, «La crecida extraordinaria del río Salado…» (PDF, p. 12) |
| Costa este (Colastiné, Rincón, Arroyo Leyes) | 17 IGN | ≈ 8,8 m + pendiente | Botterón en El Litoral, 13/7/2026 |
| Defensa oeste de Rincón Norte y Arroyo Leyes | 17 IGN + muro 0,50 | — | **no construida**: licitada dos veces, nunca adjudicada; sept. 2026 no es prioridad provincial |

El récord es 7,43. Ninguna defensa de la ciudad fue sobrepasada; en 2003 el
agua entró por un tramo no construido de la defensa oeste. Lo que sí está
documentado es que el agua entra **por abajo**: Silvina Serra (Gestión del
Riesgo Hídrico municipal, El Litoral, nov. 2023) dijo que los umbrales de la
costa no deberían subir porque «el ascenso de las napas freáticas tras
crecidas prolongadas iguala los niveles dentro y fuera de la defensa». Un
umbral «hasta la coronación» le daría margen a un barrio que se encharca a 6.

### La tabla, con fuente por renglón

Fuente principal: AIRE de Santa Fe, 30/12/2023, «Qué zonas de Santa Fe son
vulnerables cuando el río alcanza los seis metros», con Felipe Franco
(secretario de Recursos Hídricos municipal) como fuente y un «estudio del INA»
sin fecha para Colastiné Sur. Lo de 2016: El Litoral (1/1/2016, 6,38 m; nota
de la filtración en Colastiné Sur, 6,40 m), Pausa (4/1/2016, 6,59 m) y el parte
provincial del 4/1/2016 (6,53 m). Máximo de 2016: 6,61 m (Prefectura).

| Zona | Nivel | Qué pasó / qué dice el municipio | Fuente |
| --- | --- | --- | --- |
| Colastiné Sur, casas junto al club Caza y Pesca (afuera de la defensa) | 4,70 | entra agua | AIRE 2023 |
| La Vuelta del Paraguayo | 5,30 | empieza la evacuación; escuela e iglesia aguantan hasta 5,70; a 6,00 completa | AIRE 2023 |
| Alto Verde → La Boca | 5,30 | se corta el camino; en 2023 se defendió hasta 5,60 | AIRE 2023 |
| Rincón, Los Espinillos | 5,30 | filtraciones bajo el terraplén | AIRE 2023 |
| Colastiné Sur, todo el barrio | 5,70 | el INA recomendó evacuar | estudio INA vía AIRE 2023 |
| Colastiné Sur | ≈ 6,00 | «el terraplén y la napa filtran agua y todo el barrio se encharca» | El Litoral, «puntos vulnerables», sin fecha |
| Colastiné Norte y Rincón, bajo cota 14,50 IGN | 6,00 + lluvia | riesgo por napa alta | AIRE 2023 |
| Colastiné Sur | 6,38–6,40 | 130 familias evacuadas; filtró en el ex camping | El Litoral, ene. 2016 |
| La Vuelta del Paraguayo | 6,38 | 38 familias en refugios | El Litoral, 1/1/2016 |
| Frente del riacho Santa Fe (Alto Verde) | 6,38 | 24 familias en refugios | El Litoral, 1/1/2016 |
| Arroyo Leyes, barrios del oeste | 6,53 | 125–200 evacuados | Provincia / Pausa, 4/1/2016 |
| Santa Rosa de Calchines | 6,53 | 350–412 evacuados | Provincia / Pausa, 4/1/2016 |
| Colastiné Norte, La Guardia | 6,61 | no figuran entre los evacuados; el Garello aguantó | El Litoral, Pausa, ene. 2016 |

**Chequeo contra el modelo.** Una casa a cota 14,50 IGN en Colastiné Norte
(11 km) recibe de la app ≈ 5,3 (14,50 − 8,20 − 0,495 − 0,5); el municipio dice
riesgo a 6,00 con lluvia. En Rincón (16 km) la app da ≈ 5,1 para la misma
cota; las filtraciones empiezan a 5,30 en lo más bajo. Pesimista por 0,2 a
0,7 m, que es el diseño. No hay ningún caso en que la app dé margen donde el
municipio dice riesgo.

### Lo que todavía no se sabe

- **Dónde estuvo el agua en 2016, en cota.** Ni una sola cota medida de la
  superficie del agua río arriba del Puerto, ni de 1992 ni de 2016. Es lo que
  resolvería la pendiente (§2, §3).
- **El estado de cada defensa hoy.** El Garello está en su última etapa (85 %
  en septiembre de 2026); la Provincia dio por terminado el mantenimiento del
  sistema en agosto de 2025 y dice haber recuperado la cota en 27 km de
  terraplén; Rincón tiene unos 3 km de margen oeste sin defensa. Nada de eso
  está en un dato abierto: la app dice que no lo sabe.
- **Un umbral oficial por sector.** El plan de contingencia municipal
  (página oficial, PDF de septiembre de 2026) no publica fases numéricas por
  sector. El INA y el municipio dijeron en noviembre de 2023 que evaluarían
  rever 5,30 / 5,70 para la ciudad defendida; no hay decisión. Si la hubiera,
  la app la adopta sola: los umbrales vienen de la estación del INA.
- **Las 1.300 familias.** El relevamiento municipal (Eduardo Rudi, junio de
  2026) las ubica en Vuelta del Paraguayo, Bajada Distéfano, Los Alisos,
  Colastiné Sur bajo, RN 168 y La Boca; no publica la cifra por sector.

### Las dos zonas que se agregaron, y con qué

Regla: ningún número nuevo. Lo que no tenía fuente, no entró.

- **La Boca (Alto Verde)**, zona propia. La capa municipal de vecinales
  (`datos-crudos/muni-vecinales-2026-09-08.json`) trae «LA BOCA - ALTO VERDE»
  con centro en −60,683 / −31,688: **4,0 km al sur del hidrómetro** (la
  estación 30 del INA está en −60,7002 / −31,6515). Está río abajo, y el
  modelo no corrige hacia abajo: va con **0 km**, que no es una estimación
  sino la ausencia de corrección, y por eso entra en `KM_PUBLICADO` para que
  la pantalla no diga «estimación propia». Curva más cercana a 298 m (cota
  15,9). **Defensa: no confirmada** (`null`): la vecinal de Alto Verde habla
  de un anillo de los dos lados del barrio y de vecinos «fuera del anillo»
  sin nombrar el paraje. Lo único con fuente es el camino que se corta a 5,30
  y se defendió hasta 5,60 (AIRE 2023), y que el municipio lo lista con
  «riesgo de aislamiento» (El Litoral, 24/6/2026).
- **El Pozo / Los Alisos**, sumado a la zona Guadalupe. «BARRIO EL POZO» tiene
  centro en −60,661 / −31,636, 1,7 km al norte del hidrómetro en línea recta,
  sin distancia medida sobre el agua. En vez de inventarle un km se usa el de
  Guadalupe (4, estimación que ya existía): es más pesimista que la línea
  recta, misma costa de la Setúbal, mismo anillo. Curva más cercana a 197 m
  (cota 16,76). Los Alisos figura «fuera del anillo» en el relevamiento
  municipal de junio de 2026; AIRE 2023 dice que se inunda, sin nivel, así que
  va en la nota y no en la tabla. 2016: 4 familias de El Pozo en refugios
  (El Litoral, 1/1/2016, con el río en 6,38).
