> Versión en Markdown de https://cotacerosf.com/datos, para agentes de IA.
> Cota Cero no es un sitio oficial: la orden de evacuación la da Defensa Civil (103).
> El nivel del río de hoy no está en este archivo: se lee en https://cotacerosf.com/api/nivel.

# ¿Cuál es la cota de tu terreno en Santa Fe, y de dónde sale?

Tres datos —**la altura de tu terreno**, **el cero de la regla del puerto** y **tu distancia al puerto**— dan tu umbral estimado: la lectura del hidrómetro a la que el agua alcanzaría la cota de tu terreno. En la app se llama «tu nivel de aviso».

## La cuenta, entera

cota del terreno **− 0,50** **−** cero del hidrómetro **(8,42)** **−** km río arriba **× 0,045** **=** tu nivel de aviso

Una referencia para prepararte, no el minuto en que entra el agua. Cota Cero **no genera información hidrológica propia**: toma datos públicos, los combina y los cita.

1 · El nivel del río

## Lo mide el Estado, no nosotros

El número grande de la app es la lectura del **hidrómetro del Puerto**: la lee Prefectura y la publica el INA. Cota Cero la muestra; no la mide, no la corrige y no la promedia.

Estación: Santa Fe · SAFE

Río: Paraná

Serie del INA: n.º 30 — altura hidrométrica

Quién la lee: Prefectura Naval Argentina

Alerta: 5,30 m

Evacuación: 5,70 m

Los umbrales los publica la propia estación en la API del sistema de alerta del INA; si la API falla, la app cae sola al reporte diario. Si tampoco contesta, muestra la última lectura con su fecha, y a las 48 horas deja de darla por vigente. **Nunca inventa un valor.**

Fuente: INA · serie 30, altura hidrométrica [ver](https://alerta.ina.gob.ar/a5/diario/reporte_diario)

2 · La altura de tu terreno

## La cota sale de las curvas de nivel del municipio

La **cota** es la altura de un terreno sobre el mar, en el sistema oficial argentino (IGN). La Municipalidad publica **169 curvas de nivel**, cada 50 cm: si caminás sobre una, no subís ni bajás.

Si tu casa cae entre dos, la app estima su altura y **descuenta medio metro**, por las dudas.

Las curvas terminan en el límite de la ciudad. En **San José del Rincón y Arroyo Leyes** la altura sale de los **puntos con cota** que midió la Provincia en 2005, en la misma campaña de la que salieron las curvas: la app toma los cuatro más cercanos a tu casa. Ahí el terreno cambia mucho de un lugar a otro —terraplenes, cunetas, rellenos—, así que descuenta **un metro** en vez de medio. Donde no hay ni curvas ni puntos te pide la cota a mano, en vez de caer a una fuente peor.

Es una estimación, no una medición de tu terreno: la curva pasa cerca, no por tu puerta.

### Cuánto se equivocan las curvas

Las comparamos con **330 puntos que la Municipalidad midió en la calle**. La mitad cae a menos de 42 cm de lo medido, y 9 de cada 10 a menos de 1,10 m. Casi siempre del lado seguro: las curvas dan el terreno **más bajo** de lo que es, y entonces la app avisa antes.

Para el otro lado fallan en puntos sueltos —una bajada, el ingreso a un barrio, un anfiteatro—: en 6 de los 330 el terreno quedó más bajo que lo que dicen las curvas, aun descontando el medio metro. Las curvas son de 2005 y se trazaron a mano sobre un relevamiento de 1992.

### Por qué no un satélite

Los modelos satelitales miden **techos y copas de árboles**, no el piso. Contra **36 puntos medidos en campo por el IGN**, el que usaba la app tenía un **desvío estándar de 7,46 m**, con casos de hasta 23 m.

Error del satélite (desvío estándar): 7,46 m

De la alerta (5,30) al récord (7,43): 2,13 m

**El error de la fuente era más grande que toda la escala de la decisión.**

Ni la mejor curva reemplaza un relevamiento de tu terreno: no sabe si está elevado sobre la vereda ni si la casa tiene escalones. **El número que vale es el de un relevamiento, la escritura o el plano de mensura.** Si lo conseguís, cargalo a mano en la app.

Fuente: Municipalidad · curvas de nivel de la ciudad [ver](https://geo.santafeciudad.gov.ar/)

3 · Cómo se relacionan

## Dos alturas, una resta

El hidrómetro no mide altura sobre el mar: mide cuánto sube el agua sobre el **cero de su escala**, que está a una altura conocida. Sumando las dos se obtiene la superficie del agua en la misma escala que tu terreno.

Lectura del hidrómetro: 5,00 m

Cero del hidrómetro: 8,42 m IGN

Corrección río arriba (11 km): 0,50 m

Superficie de agua equivalente: 13,92 m IGN

Lo que a una persona le sirve no es «cuánta agua hay hoy» sino **«¿qué tendría que marcar el hidrómetro para que el agua llegue a la altura de mi terreno?»**. Es la misma cuenta despejada.

Ejemplo · Colastiné Norte 11 km río arriba

1. ### La altura de tu terreno, en metros IGN

   Entre dos curvas, medio metro por debajo, por las dudas: es el **escenario pesimista**, el número con el que hay que decidir.

   15,80 → 15,30

2. ### Restar el cero del hidrómetro: 8,42 m

   Pasa tu terreno a la escala del hidrómetro. El INA midió 8,378: son 4 cm de diferencia entre fuentes oficiales. [De dónde sale el 8,42](https://cotacerosf.com/datos#abiertas).

   − 8,42 = 6,88

3. ### Restar el desnivel río arriba: 0,045 m por km

   El río no es una pileta: río arriba el agua está más alta. 11 × 0,045 = 0,495, que redondeamos a 0,50.

   − 0,50 = 6,38

Resultado del ejemplo

≈ 6,4 m

15,30 − 8,42 − 0,50 = 6,38

Cuando el hidrómetro del Puerto se acerque a **6,38 m**, el nivel de agua equivalente alcanza la cota de ese terreno según el modelo. **No significa que el terreno se inunde exactamente a ese nivel**: lo que pase depende de las defensas, del bombeo, del viento y de la lluvia, y nada de eso está en la cuenta.

4 · Qué tan firme es esto

## Lo que se comprobó, lo que está en discusión y lo que falta

Preferimos publicar nuestros supuestos antes de que los encuentre otro.

Se comprobó

### La altura del terreno

| Puntos medidos por la Municipalidad | 330 |
| --- | --- |
| La mitad, a menos de | 42 cm |
| 9 de cada 10, a menos de | 1,10 m |
| El margen de medio metro alcanza en | 98 de 100 |

Casi siempre del lado seguro: las curvas dan el terreno más bajo de lo que es. Es la altura del **terreno**; la del **agua** río arriba del Puerto no se pudo comprobar con ninguna medición.

En discusión

### Dos números sin cerrar

**El cero: 8,42, con una duda.** Sale de la nota de Vías Navegables (8,9524 en el sistema del ex MOP) pasada al sistema del IGN; el INA midió 8,378 en 2016. Falta saber en qué sistema de alturas están las curvas del municipio.

**La pendiente: 0,045 m/km.** No hay una medición que la respalde, y usamos un solo valor para todas las zonas. La cifra de 1992 que circula para Arroyo Leyes se calculó con esta misma pendiente: coincidir con ella no prueba nada.

**De dónde sale cada uno**

**El cero.** Hasta el 26 de octubre de 2026 usábamos 8,20: la diferencia que sale del Reglamento de Edificaciones de San José del Rincón (16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)), que repite la prensa. Ningún organismo lo respalda: en la nota del 23/7/2018 (expediente 01801-0049664-3, Ministerio de Infraestructura y Transporte de Santa Fe) la Subsecretaría de Puertos y Vías Navegables, que mantiene la escala, aclara que el 8,19 «no es un valor brindado por este organismo» y da el cero de la escala: +8,9524 en el sistema del ex Ministerio de Obras Públicas. El IGN publica que el pasaje de ese sistema al suyo es HIGN = HMOP − 0,531 m: 8,9524 − 0,531 = **8,4214**. El INA midió 8,378 con el IGN en diciembre de 2016, y la propia nota usa un desnivel de 0,556 que da 8,3964: los tres valores quedan a 4 cm. Lo que sigue abierto es que las curvas del municipio no declaran su sistema de alturas, y el 0,531 está medido en el Riachuelo, no en Santa Fe. Si las curvas estuvieran en un sistema anterior, 8,42 haría avisar hasta unos 20 cm antes: queda del lado seguro.

**La pendiente.** El reglamento de Rincón, 16 km río arriba, convierte cota a hidrómetro sin ninguna corrección por distancia; con la pendiente de la app serían 72 cm más. O el reglamento simplifica, o la pendiente real en ese tramo es otra: depende del tramo, del caudal y de la condición hidráulica del momento.

**Y por qué 1992 no la confirma.** La nota de prensa que publica la cota de Arroyo Leyes en 1992 —16,70 IGN— dice que «se estima», y la saca de 7,43 m en el Puerto más 24 km a 4,5 cm por km. Es la misma cuenta que hace la app. Para cerrarla hace falta una sola cota del agua **medida** río arriba del Puerto, en 1992 o en 2016.

Falta

### Que lo revisen especialistas

Ningún organismo ni universidad revisó este modelo. Nadie lo aprobó.

Hasta que lo revisen —Gestión de Riesgos, INA, FICH-UNL, Recursos Hídricos— lo que la app publica son **niveles de referencia estimados**, y así están nombrados en toda la interfaz. Cota Cero no tiene vínculo con esos organismos ni cuenta con su aval.

Fuente: IGN · ceros de escala y sistema de alturas [ver](https://www.ign.gob.ar/NuestrasActividades/Geodesia/Nivelacion/Escalas)

## Hay dos maneras de inundarse. Cota Cero mira una sola.

Un barrio puede tener margen amplio contra el Paraná y entrar en emergencia igual, por lluvia. El modelo tampoco sabe si entre el río y tu casa hay un terraplén, ni en qué estado está.

Fluvial · lo que mira

### Crece el río

El Paraná sube durante semanas y se ve venir en el hidrómetro. Es lo que traduce tu nivel de aviso.

Pluvial · lo que no

### Llueve sobre la ciudad

Mucha lluvia en pocas horas, o varios días seguidos, anegan calles y casas por los desagües, sola o combinada con el Salado. Puede pasar con el río bajo.

Cuando se juntan

### Río alto + lluvia

Con el río alto las bombas no pueden desagotar contra el agua de afuera. El municipio planifica para **río en 6 m más lluvia de 200 a 300 mm**.

Y una defensa protege mientras funciona: en 2003 el agua entró por un tramo abierto de una defensa existente. Que haya obra no es garantía. Más dudas de este tipo, contestadas cortas, en [preguntas frecuentes](https://cotacerosf.com/preguntas).

Fuente: Gestión de Riesgos · Plan de Contingencia [ver](https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/plan-de-contingencia/)

## Lo que todavía no sabe

- **En qué sistema de alturas están las curvas.** Los metadatos no lo declaran, y de eso depende si el cero de 8,42 corresponde a ellas o hay que corregirlo.
- **Si la pendiente vale en todos los tramos.** Está contrastada en un punto de una crecida.
- **Cuánto se equivoca la cota en tu cuadra.** Medido contra 330 puntos del municipio, el medio metro alcanza en 98 de cada 100. En un pozo o una bajada que la curva no dibuja puede no alcanzar.
- **Los km río arriba de cada zona.** Sólo Arroyo Leyes (24 km) está publicado. Equivocarse 5 km son 22 cm.
- **En qué estado está la defensa de tu zona.** Cambia el resultado más que cualquiera de las constantes.
- **Nada sobre la lluvia sobre tu barrio.** El agua puede llegar antes por el desagüe que por el río.

Cuando no sabemos algo con precisión suficiente, preferimos decirlo antes que rellenar el hueco con un número que parezca firme.

5 · Las fuentes

## Cada dato, con su enlace

Todo lo que muestra la app sale de acá. Cada ficha lleva la página del organismo y el dato crudo, tal como lo pide la app.

El nivel del río

Instituto Nacional del Agua

Altura, alerta y evacuación del hidrómetro del Puerto.

[Ver fuente](https://alerta.ina.gob.ar/a5/diario/reporte_diario) [Ver el dato crudo](https://alerta.ina.gob.ar/a5/obs/puntual/series/30?timestart=2026-01-01&timeend=2100-01-01)

La altura de tu terreno

Municipalidad de Santa Fe

Curvas de nivel de la ciudad, Secretaría de Recursos Hídricos (Departamento de Relevamientos Planialtimétricos).

[Ver fuente](https://geo.santafeciudad.gov.ar/) [Ver el dato crudo](https://geoserver.santafeciudad.gov.ar/geoserver/sitmax/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=sitmax:curvas_nivel&outputFormat=application/json&srsName=EPSG:4326)

La altura de tu terreno en Rincón y Arroyo Leyes

Infraestructura de Datos Espaciales de Santa Fe

Puntos con cota de San José del Rincón, Colastiné y La Guardia, relevamiento de 2005 (Secretaría de Aguas, convenio CFI-INA).

[Ver fuente](https://www.santafe.gov.ar/idesf/catalogo/srv/spa/metadata.show?id=552&currTab=simple) [Ver el dato crudo](https://aswe.santafe.gov.ar/idesf/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=MACotas&QUERY_LAYERS=MACotas&STYLES=&SRS=EPSG:4326&BBOX=-60.572,-31.610,-60.564,-31.602&WIDTH=5&HEIGHT=5&X=2&Y=2&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=50)

Puntos de encuentro y qué hacer

Dirección de Gestión de Riesgos

Plan de contingencia y los 30 puntos de encuentro oficiales.

[Ver fuente](https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/plan-de-contingencia/) [Ver el dato crudo](https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=publico:puntos_de_encuentro&outputFormat=application/json)

El sistema de alturas

Instituto Geográfico Nacional

Red de nivelación y cero de las escalas hidrométricas (SRVN16).

[Ver fuente](https://www.ign.gob.ar/NuestrasActividades/Geodesia/Nivelacion/Escalas) [Ver el dato crudo](https://www.ina.gob.ar/delta/pdf/03_02_INA-DELTA_Info04_CerosHidrometricos.pdf)

Cien años de mediciones

Instituto Nacional del Agua

Serie diaria del hidrómetro del Puerto de Santa Fe desde 1925, medición directa.

[Ver fuente](https://alerta.ina.gob.ar/a5/obs/puntual/series/30) [Ver el dato crudo](https://alerta.ina.gob.ar/a5/obs/puntual/series/30/observaciones?timestart=1925-01-01&timeend=2100-01-01)

Cartografía provincial

Infraestructura de Datos Espaciales de Santa Fe

Servicios OGC de la Provincia de Santa Fe.

[Ver fuente](https://www.santafe.gov.ar/idesf/geoportal/paginas/servicios-OGC)

**Investigación, antecedentes y normativa**

No aportan ningún número al cálculo: explican el contexto.

- **Facultad de Ingeniería y Ciencias Hídricas — UNL** — Investigación en hidrología del Paraná y el Salado. Es la institución natural para revisar este modelo. [Ver](https://www.fich.unl.edu.ar/cim/)
- **Ley provincial 11.730** — Uso de las áreas inundables. La Provincia distingue legalmente zonas según el riesgo hídrico. [Ver](https://www.santafe.gov.ar/index.php/web/content/view/full/128300)
- **Ley provincial 14.477** — Emergencia hídrica provincial. Es el marco institucional del que nace esta herramienta; no respalda el modelo. [Ver](https://www.santafe.gov.ar/normativa/)
- **Reglamento de Edificaciones — Comuna de San José del Rincón** — Fija la cota de edificación en "16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)". La diferencia entre esos dos números es exactamente 8,20, el cero que usó esta app hasta octubre de 2026; Vías Navegables, que mantiene la escala, aclaró que ese valor no lo brinda. [Ver](https://capsf.org.ar/modulos/ejercicio_prof./archivos/rincon.pdf)

La prensa se usa para contexto histórico o para llegar a una fuente primaria, nunca para un número del cálculo: si una nota cita a un especialista o a un documento, buscamos el original.

[Abrir Cota Cero](https://cotacerosf.com/app)
