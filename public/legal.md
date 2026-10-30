> Versión en Markdown de https://cotacerosf.com/legal, para agentes de IA.
> Cota Cero no es un sitio oficial: la orden de evacuación la da Defensa Civil (103).
> El nivel del río de hoy no está en este archivo: se lee en https://cotacerosf.com/api/nivel.

# Legal y privacidad

Escrito para leerse, no para esconderse. Si algo no se entiende, es un defecto: [avisanos](https://cotacerosf.com/contacto).

Última actualización: agosto de 2026.

**No es oficial**

Interpreta datos públicos. La orden de evacuación la da Defensa Civil, al 103.

**Tus datos, en tu teléfono**

Tu casa, tu nivel de aviso y tu plan no salen de ahí. Sin registro, sin publicidad.

**Sin garantías**

Gratis y tal cual. Depende de que el INA publique y de servicios que pueden fallar.

## Qué es esta herramienta, y qué no

**Ayuda a interpretar información pública**

No es un sistema oficial de alerta ni tiene vínculo con la Municipalidad de Santa Fe, la Provincia, Defensa Civil, el INA ni ningún otro organismo. Usa sus datos públicos y los cita.

**Los niveles de aviso son aproximados**

Salen de un modelo simple, que descuenta medio metro a la altura del terreno en la ciudad y un metro en Rincón y Arroyo Leyes. No conoce defensas, bombeo, desagües ni lluvia: el agua puede llegar antes o después de lo estimado. La altura del terreno se contrastó con puntos medidos por la Municipalidad; la relación entre el río y el terreno no se pudo contrastar con ninguna medición, y no lo validaron especialistas ni organismos competentes.

**Nada de esto es una orden**

Las decisiones de evacuación corresponden a Defensa Civil (103). Nada de lo que muestra la app es una orden, una recomendación oficial ni un sustituto de las comunicaciones de las autoridades. Ante cualquier contradicción, vale la indicación oficial.

**Los datos pueden quedar viejos**

El nivel se publica una vez por día. Los puntos de encuentro reflejan la capa municipal de la última actualización de la app; su activación la confirma sólo Defensa Civil.

**Sin garantías**

La app depende de que el INA publique y de servicios de terceros que pueden fallar, cambiar o discontinuarse. Se ofrece tal cual, gratis y sin garantía de ningún tipo.

## Qué sale de tu teléfono

| Qué | Sale | Detalle |
| --- | --- | --- |
| Tu casa, tu nivel de aviso, tu plan | Nunca | Se guardan sólo en el dispositivo. Si borrás la app, se borran. |
| Avisos | Un dato opaco | La dirección técnica que asigna tu navegador. El servidor no sabe la altura de tu terreno ni tu nivel de aviso: el aviso se arma en tu teléfono. Al desuscribirte, se borra. |
| Sugerencias | Tu texto | Lo único que manda texto tuyo, y el formulario lo dice. La IP no se guarda: se transforma de modo irreversible para limitar envíos. |
| Cuánta gente la usa | Un número al azar | Lo genera el teléfono, para contar personas distintas por día. El servidor sabe cuántos distintos vio, pero no guarda ninguno. |
| Buscar una dirección | Al tocar Buscar | Va a Georef (la API de direcciones del Estado nacional) y, si no la encuentra, a Nominatim (OpenStreetMap). Las calles que te sugiere mientras escribís salen de una lista guardada en la app: escribir no manda nada. |
| Ver el mapa | Al abrirlo | El fondo del mapa lo pide tu teléfono a OpenFreeMap, y la foto aérea con la que marcás tu casa, al Instituto Geográfico Nacional. Los dos reciben tu IP y la zona que mirás. Dónde tocaste y la altura que salió no se mandan: se calculan en el teléfono. |
| Lluvia y caudal | Al abrir la app | El pronóstico de lluvia y la tendencia del caudal del Paraná los pide tu teléfono a Open-Meteo, para el centro de Santa Fe, con coordenadas fijas: no manda tu ubicación ni tu casa, sólo tu IP, como cualquier pedido web. |
| Estadísticas del sitio | Sólo en el sitio | Google Analytics, que deja cookies y manda los datos de tu visita a Google. No corre dentro de la app ni dentro del widget: a los lectores de un medio que lo embebe no los mide nadie. |

No pedimos nombre, correo, teléfono ni registro. No hay publicidad ni venta de datos. Lo que dice esta tabla sobre el widget es la promesa que le hacemos a cada [medio que lo embebe](https://cotacerosf.com/para-medios).

## Sobre hombros de otros

MapLibre GL JS · Georef · OpenStreetMap / Nominatim · OpenFreeMap / OpenMapTiles · Instituto Geográfico Nacional · Open-Meteo · Municipalidad de Santa Fe · Provincia de Santa Fe — IDESF · Comuna de Arroyo Leyes · INA · Plus Jakarta Sans y JetBrains Mono.

**Licencias y atribuciones completas**

**MapLibre GL JS**

Motor del mapa. Licencia BSD de 3 cláusulas — © contribuidores de MapLibre. El texto completo acompaña a la copia distribuida con la app.

**Georef**

Búsqueda de direcciones con altura y la lista de calles que sugiere el buscador: la API de direcciones del Estado nacional, sobre el callejero del INDEC. Datos abiertos de [datos.gob.ar](https://datos.gob.ar/); la API está documentada en [georef-ar-api](https://datosgobar.github.io/georef-ar-api/).

**OpenStreetMap / Nominatim**

Búsqueda de direcciones cuando Georef no la encuentra, y de barrios y parajes. Datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), bajo licencia ODbL.

**OpenFreeMap / OpenMapTiles**

El fondo del mapa: tiles vectoriales de [OpenFreeMap](https://openfreemap.org/) con el esquema de [OpenMapTiles](https://www.openmaptiles.org/) (© OpenMapTiles), dibujados con los colores de la app. Datos © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), bajo licencia ODbL.

**Instituto Geográfico Nacional**

La foto aérea con la que marcás tu casa (vuelos fotogramétricos de 2013 y 2014) y red de nivelación usada para validar las fuentes de elevación. [ign.gob.ar](https://www.ign.gob.ar/).

**Open-Meteo**

El pronóstico de lluvia y la tendencia del caudal del Paraná, de [open-meteo.com](https://open-meteo.com/), bajo licencia CC BY 4.0. El caudal sale del modelo GloFAS del servicio Copernicus de la Unión Europea.

**Municipalidad de Santa Fe**

Curvas de nivel (Secretaría de Recursos Hídricos) y capa de puntos de encuentro, de sus geoservicios públicos vía el [GeoPortal](https://geoportal.santafeciudad.gov.ar/).

**Provincia de Santa Fe — IDESF**

Puntos con cota de San José del Rincón, Colastiné y La Guardia (Secretaría de Aguas, relevamiento de 2005), con los que la app calcula la altura en Rincón y Arroyo Leyes. Del servicio de mapas público de la [IDESF](https://www.santafe.gov.ar/idesf/); la ficha no declara licencia.

**Comuna de Arroyo Leyes**

Los nombres nuevos de las calles de Arroyo Leyes y los números que tenían antes, de la [Ordenanza 47/2021](https://www.arroyoleyes.gob.ar/ordenanzas.php) (Anexos I y II). Con eso la búsqueda entiende «Curupíes 3006» como la antigua calle 18.

**INA**

Alturas hidrométricas diarias del Paraná, del [reporte público del Instituto Nacional del Agua](https://alerta.ina.gob.ar/a5/diario/reporte_diario).

**Plus Jakarta Sans y JetBrains Mono**

Tipografías, bajo SIL Open Font License. Van self-hosteadas: no se consulta ningún servicio de fuentes.

Este texto lo redactó quien hizo la app, con la intención de ser claro y honesto. No es asesoramiento legal ni lo revisó un profesional del derecho. Si encontrás un error, o algo que debería decir y no dice, [escribinos](https://cotacerosf.com/contacto).

[Abrir Cota Cero](https://cotacerosf.com/app)
