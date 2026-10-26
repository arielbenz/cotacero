# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Principal:** vecinas y vecinos de Santa Fe capital, San José del Rincón y Arroyo Leyes que viven cerca del río Paraná. La usan desde el celular, muchas veces de pie en la vereda, con poca señal, mirando el nivel del río y decidiendo si se preparan o si salen. La app se comparte por WhatsApp durante una crecida, así que quien llega no la conoce de antes.

**Segundo público, confirmado:** medios de comunicación que embeben el widget del nivel del río (`/widget`, `/para-medios`). Lo que sus lectores ven no es de este proyecto: de ahí las promesas de «sin cookies, sin rastreo».

Quien llega a las páginas de contenido (`/datos`, `/historia`, `/preguntas`) desde un buscador suele tener una pregunta informativa, no una herramienta en la mano.

## Product Purpose

Traducir la lectura del hidrómetro del Puerto de Santa Fe a **tu nivel de aviso**: el nivel del río a partir del cual el agua puede llegar a tu terreno. Cruza el dato del INA con la altura del terreno de cada persona.

Éxito: que alguien sepa con tiempo a qué nivel le toca prepararse, tenga a mano el plan y los puntos de encuentro, y entienda que el número es un cálculo aproximado y no una predicción. Contexto legal: emergencia hídrica provincial, Ley 14.477.

## Positioning

Proyecto ciudadano independiente, sin vínculo con el municipio ni con ningún organismo. Lo que un vecino no podría copiar fácilmente: un nivel de aviso **personal**, calculado con la altura del propio terreno, con cada número auditable (`AUDITORIA.md`, `/datos`, datos abiertos), y que además sigue andando sin conexión.

Su rasgo central es decir qué no sabe: cuando falta un dato lo dice, y no lo rellena con un número que parezca firme.

## Operating Context

- Se usa en crecidas y en la previa: sin señal, con el teléfono en la mano, a pleno sol, bajo estrés.
- El INA publica una sola lectura por día, sellada a las 00:00, y el dato vence a las 48 h.
- El teléfono puede ser un Android viejo; el proyecto los sostiene a propósito.
- Ninguna dependencia externa (INA, Georef, IGN, Open-Meteo) pide clave ni tiene cuota: un proveedor con cuota se cae justo en el pico de una crecida.
- Hay una hoja de la guía de emergencia para imprimir y repartir en centros vecinales; tiene que entrar en una carilla.
- Las órdenes de evacuación las da Defensa Civil (103). El proyecto nunca las reemplaza.

## Capabilities and Constraints

**Qué hace:** nivel del río en vivo; nivel de aviso por dirección, esquina, ubicación o punto marcado en el mapa; zonas de Santa Fe, San José del Rincón y Arroyo Leyes; los 30 puntos de encuentro del Plan de Contingencia municipal; plan y mochila; historia desde 1925; avisos por push sin contenido; widget para medios; guía imprimible; datos abiertos.

**Restricciones técnicas y de proyecto:**
- Sin `package.json`, dependencias, build, framework de tests ni linter; agregarlos es una decisión del proyecto.
- Todo el proyecto, la interfaz incluida, está en español rioplatense.
- `CERO_IGN`, `PENDIENTE`, `ERROR_DEM` y `ERROR_PUNTOS` están en discusión técnica abierta y no se cambian sin leer `AUDITORIA.md`.
- CSP estricta: nada de manejadores inline.
- Lo único que sale del dispositivo son las sugerencias del formulario y un endpoint opaco para el push.

**Terminología (tres conceptos, tres nombres):** *nivel* (lectura del hidrómetro), *cota* (altura del terreno) y *umbral* (lectura a partir de la cual el agua alcanzaría esa cota). En pantalla el umbral se dice «tu nivel de aviso», siempre aproximado. Prohibido en la interfaz: «umbral», «cuándo llega el agua», «te llega», «se inunda», «tu alerta», «tu evacuación». La alerta y la evacuación oficiales se dicen «de la ciudad».

**Sin definir:** validación del cálculo por organismos competentes (Gestión de Riesgos del municipio, INA, FICH-UNL); los centros de evacuados de San José del Rincón; Santo Tomé, que hoy no tiene datos de altura.

## Brand Commitments

- Nombre: **Cota Cero**. Hecho por Ariel Benz, firmado en el pie.
- Voz: español rioplatense, voseo, directa. En los estados graves el texto empieza con el verbo de lo que hay que hacer y lleva el 103.
- Vocabulario y reglas de falsa precisión en `CLAUDE.md`: son compromisos de producto, no solo de estilo.
- Promesas escritas que no se rompen: «sin cookies, sin rastreo» en el widget, y que nada de lo que escribe la persona sale del teléfono salvo las sugerencias.

## Evidence on Hand

- Datos reales: serie del INA desde 1925, curvas de nivel del municipio, puntos con cota de la Provincia (Rincón y Arroyo Leyes), callejero de Georef, los 30 puntos de encuentro oficiales.
- Medición propia del error de las curvas contra 330 puntos fijos municipales: el margen de 0,5 m alcanza en 98 de cada 100 (`lib/mediciones.json`, `/datos`).
- Sugerencias de usuarios reales por el formulario. **No se citan**: no hay permiso.
- **Ausencias que no se deben fabricar:** no hay testimonios, prensa, ni validación o respaldo de ningún organismo. No inventar clientes, métricas de uso ni cifras de impacto.

## Product Principles

1. **Decir lo que no se sabe.** Un dato faltante se muestra como faltante; el escenario pesimista es el que se calcula, y el nivel de aviso nunca se presenta como predicción.
2. **El número tiene dueño y fuente.** Cada cifra de la pantalla se puede rastrear hasta su origen en `AUDITORIA.md` o `/datos`.
3. **Funciona cuando todo falla.** Sin señal, con un Android viejo, sin cuenta ni clave: una dependencia con cuota o una promesa de tracking rompen el propósito.
4. **Una persona en una emergencia lee una sola cosa por vez.** Primero qué hacer, después por qué.
5. **Independiente, no oficial.** Nunca reemplaza a Defensa Civil, y lo dice donde importa.

## Accessibility & Inclusion

- Se usa a pleno sol, con poca señal y con teléfonos viejos: el contraste, la legibilidad y el funcionamiento sin conexión son requisitos de producto, no extras.
- Lectores de pantalla: se sostienen roles, foco y avisos en vivo (por ejemplo el combobox del buscador y los renglones de estado).
- Sin estándar formal declarado; el piso que el proyecto ya se impuso es contraste AA en los colores semánticos.
