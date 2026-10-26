---
name: Cota Cero
description: Un instrumento de medición para el río: un número grande, una regla y etiquetas en mono, sobre superficies planas y tintadas.
colors:
  papel: "#fafbfc"
  panel: "#ffffff"
  tinta: "#1b262c"
  tenue: "#5f6c72"
  agua: "#5fc8e8"
  tinta-de-agua: "#127296"
  tinta-sobre-agua: "#0e1619"
  boton-solido: "#0e1619"
  boton-solido-texto: "#e9eef0"
  alerta-texto: "#bf3d05"
  alerta-solido: "#cf440d"
  evacuacion-solido: "#a5271a"
  peligro-texto: "#bc3e2a"
  ok-texto: "#33765c"
  tierra: "#7a5f0d"
  agua-tinte: "#e8f3f8"
  alerta-tinte: "#ffefe3"
  peligro-tinte: "#fbe9e5"
  ok-tinte: "#e6f2ec"
  superficie-invertida: "#0e1619"
  campo: "rgba(27, 38, 44, 0.055)"
  linea: "rgba(27, 38, 44, 0.09)"
  noche: "#0e1619"
  noche-panel: "#17232a"
  noche-texto: "#e9eef0"
  noche-tenue: "#93a6ad"
  noche-alerta-texto: "#e8a33d"
  noche-peligro-texto: "#ef7e6b"
typography:
  numero-hero:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "4rem"
    fontWeight: 800
    lineHeight: 0.9
  titular-estado:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  seccion:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  titulo:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  boton:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  cuerpo:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.55
  apoyo:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.55
  etiqueta:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.09em"
rounded:
  s: "8px"
  m: "16px"
  l: "24px"
  xl: "28px"
  full: "99px"
spacing:
  e-1: "4px"
  e-2: "8px"
  e-3: "12px"
  e-4: "16px"
  e-5: "20px"
  e-6: "24px"
  e-7: "32px"
components:
  boton-principal:
    backgroundColor: "{colors.boton-solido}"
    textColor: "{colors.boton-solido-texto}"
    typography: "{typography.boton}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "48px"
  boton-secundario:
    backgroundColor: "{colors.agua}"
    textColor: "{colors.tinta-sobre-agua}"
    typography: "{typography.boton}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "48px"
  tarjeta:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.l}"
    padding: "20px"
  campo:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.tinta}"
    typography: "{typography.cuerpo}"
    rounded: "{rounded.m}"
    padding: "12px 16px"
    height: "52px"
  aviso:
    backgroundColor: "{colors.alerta-tinte}"
    textColor: "{colors.tinta}"
    typography: "{typography.apoyo}"
    rounded: "{rounded.m}"
    padding: "16px 20px"
  estado-ok:
    backgroundColor: "{colors.ok-tinte}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.m}"
    padding: "12px 16px"
  barra-inferior:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tenue}"
    rounded: "{rounded.xl}"
---

# Design System: Cota Cero

## Overview

**Creative North Star: "El instrumento de medición"**

La interfaz se lee como un instrumento: un número grande que se entiende de un vistazo, una regla vertical con sus líneas, y etiquetas en monoespaciada que nombran cosas que existen. El diseño se hace a un lado para que el dato —el nivel del río, el nivel de aviso— sea lo único que compite por la atención. Sirve de pie en la vereda, a pleno sol, con el teléfono en una mano.

La densidad es baja y el ritmo es de una sola columna. Las superficies son planas y tintadas: el color casi siempre significa un estado (agua, alerta, peligro, ok) y no decora. Los objetivos táctiles son grandes y la jerarquía es corta: **una** acción sólida por pantalla.

El sistema rechaza dos cosas, y las dos son confirmadas: el **alarmismo** —la urgencia se dice con el verbo del texto, no con rojo teatral ni dramatismo— y el **aspecto oficial** —Cota Cero es independiente, y nada debe parecer un sitio del municipio ni de Defensa Civil—. También rechaza la plantilla genérica: los renglones decorativos en mayúsculas sobre un titular y las bandas de métricas ya se sacaron de la portada y no vuelven.

**Key Characteristics:**
- Un número como protagonista y una regla vertical como firma.
- Superficies planas, tintadas por estado, con una sombra ambiente casi imperceptible.
- Botones píldora de 48 px, campos de 52 px, tarjetas de 24 px: pensado para un dedo apurado.
- Dos tipografías con roles estrictos: Plus Jakarta Sans para todo el texto, JetBrains Mono solo para datos y etiquetas.
- Dos temas, claro y oscuro, con el mismo azul de marca; el claro es el que se usa a pleno sol y se mide para contraste AA.
- Todo en rem y todo en español rioplatense.

## Colors

Paleta fría y sobria de papel claro, tinta azul-grisácea y un único azul agua de marca, con un trío de estados (alerta naranja, peligro rojo, ok verde) calibrados para texto y no como fondos.

### Primary
- **Agua** (#5fc8e8): el azul de la marca, el mismo en los dos temas. Es *relleno*: el agua del símbolo, el agua de la regla y el botón secundario. Nunca va como tinta de texto sobre fondo claro (da 1,86:1).
- **Tinta de agua** (#127296): la tinta de los enlaces y del foco en tema claro. Es el acento legible; existe porque el azul de marca no pasa AA como texto. Sobre superficies oscuras vuelve al celeste.

### Secondary
- **Tierra** (#7a5f0d): el «vos» de la regla, la línea punteada que marca tu propio nivel de aviso. Distingue lo tuyo de lo oficial.

### Tertiary
- **Alerta** (#bf3d05 texto, #cf440d sólido): naranja hondo. El texto y el relleno son dos valores distintos a propósito: el sólido va con texto blanco (4,67:1), el de texto va sobre el fondo.
- **Evacuación** (#a5271a sólido, #bc3e2a texto): el rojo profundo de la línea de evacuación y de la franja de estado.
- **Ok** (#33765c): verde de confirmación, solo para un resultado ya resuelto.

### Neutral
- **Papel** (#fafbfc): el fondo de la página en claro.
- **Panel** (#ffffff): tarjetas y la barra inferior.
- **Tinta** (#1b262c): el texto. Azul-grisáceo muy oscuro, no negro puro.
- **Tenue** (#5f6c72): texto de apoyo y etiquetas.
- **Línea** (rgba 27 38 44 / 9 %) y **campo** (rgba 27 38 44 / 5,5 %): filetes y relleno de inputs.
- **Noche** (#0e1619, panel #17232a, texto #e9eef0, tenue #93a6ad): el tema oscuro. Se remapea todo menos el azul de marca. Los textos de alerta y peligro suben a #e8a33d y #ef7e6b.
- **Tintes** (agua #e8f3f8, alerta #ffefe3, peligro #fbe9e5, ok #e6f2ec): los fondos de cada estado.

### Named Rules
**La regla de los dos azules.** El azul de marca (`agua`) es relleno y nunca tinta; la tinta es `tinta-de-agua`. Confundirlos deja ilegibles los enlaces o apaga la marca.

**La regla del texto y el fondo.** Un color calibrado para texto no sirve de fondo ni al revés. Alerta y peligro tienen un valor para texto y otro sólido para relleno; no se intercambian.

**La regla de los fondos medidos.** Un color de texto se mide contra *todos* los fondos donde cae —papel, panel, campo y los cuatro tintes de estado—, no solo contra el papel. `scripts/comprobar.js` lo verifica en los dos temas (peor caso hoy: 4,60:1).

**La regla del tinte que significa.** Un tinte de fondo es un estado: agua = buscando o informativo, alerta = atención, peligro = grave, ok = resuelto. No se usa como decoración ni se pone tinte sobre tinte.

## Typography

**Display / Body Font:** Plus Jakarta Sans (con system-ui como respaldo), variable, pesos 500 a 800.
**Label / Mono Font:** JetBrains Mono, variable, pesos 500 a 700, solo para datos y etiquetas.

**Character:** una sans geométrica y firme, de cuerpo medio, que no se achica en pantalla chica, junto a una mono que le da el aire de lectura de un aparato. La mono es deliberada: la app quiere leerse como un instrumento.

### Hierarchy
- **Número hero** (800, 4rem/64 px, line-height 0,9): la lectura del hidrómetro y el nivel de aviso. El único elemento que puede gritar.
- **Titular de estado** (800, 1,5rem/24 px, 1,1, tracking −0,02em): el veredicto de la tarjeta («Tenés poco margen»).
- **Sección** (800, 1,25rem/20 px, 1,2, tracking −0,015em): `h2` de cada vista. En el sitio los `h2` crecen; en la app no, para no competir con el número.
- **Título** (700, 1,0625rem/17 px, tracking −0,01em): `h3`.
- **Botón** (700, 0,9375rem/15 px, tracking −0,01em): el texto de todos los botones.
- **Cuerpo** (500, 0,9375rem/15 px, 1,55): texto corrido.
- **Apoyo** (500, 0,8125rem/13 px): aclaraciones, glosas, pistas.
- **Etiqueta** (mono 500–700, 0,6875rem/11 px, tracking 0,09em, mayúsculas): nombra algo que existe —la cara del hidrómetro, el rótulo de un control, un descargo—.

### Named Rules
**La regla del mono que nombra.** La mono en mayúsculas etiqueta una cosa real. No es un renglón decorativo arriba de un titular: si se puede borrar sin perder información, no era un rótulo.

**La regla del rem.** Toda medida de texto y de espaciado va en rem, nunca en px, para que el ajuste de tamaño de letra de Android funcione. `html` no lleva `font-size`.

## Layout

Una sola columna, centrada, de 640 px como máximo en la app (`.vista`), con 16 px de aire a los costados. El sitio usa un ancho de 1100 px, y la cabecera y el pie lo comparten en todas las páginas para que la marca arranque en la misma vertical. Las páginas de contenido usan un cuerpo de lectura más angosto que el de sitio.

El espaciado es una escala en rem de 4, 8, 12, 16, 20, 24 y 32 px. El ritmo vertical es generoso entre bloques (24–32 px) y apretado dentro de ellos (4–12 px). La navegación de la app es una barra fija abajo con cuatro pestañas, a una mano. El `body` reserva el alto de esa barra y respeta `env(safe-area-inset-*)`.

Los cortes responsivos son 560, 640, 700 y 900 px. El diseño parte del teléfono. Lo que llega por red reserva su alto con `min-height`, para que la pantalla no salte bajo el dedo de quien lee el nivel.

## Elevation & Depth

Un sistema plano con una única sombra ambiente. En reposo las tarjetas son blancas sobre papel y se separan por una sombra de dos capas, casi imperceptible. La profundidad real la da el tinte de estado, no la sombra.

### Shadow Vocabulary
- **Ambiente claro** (`0 1px 2px rgba(23,36,42,.05), 0 10px 28px rgba(23,36,42,.07)`): tarjetas y veredicto en tema claro.
- **Ambiente noche** (`0 1px 2px rgba(0,0,0,.25), 0 10px 28px rgba(0,0,0,.3)`): lo mismo en oscuro.
- **Barra inferior** (`0 -6px 24px` al 6 % en claro, 35 % en oscuro): separa la nav del contenido.

### Named Rules
**La regla del filete en oscuro.** Una sombra oscura sobre fondo oscuro no se ve. Las superficies invertidas que se fundirían con el fondo llevan un filete de 1 px (`rgba(233,238,240,.08)`) y ninguna sombra.

## Shapes

Lenguaje de formas suave y táctil: píldora completa (99 px) para botones y el botón de tema, 24 px para tarjetas y veredicto, 16 px para campos, avisos y estados, 28 px solo en el borde superior de la barra inferior, 8 px para el foco y los elementos chicos. La regla del río es la excepción técnica: un tanque de 12 px de radio con líneas rectas de 2 px.

La marca es un cero con agua adentro: un anillo con una línea de nivel que lo corta y el agua rellenando solo por debajo.

## Components

### Buttons
- **Shape:** píldora completa (99 px), 48 px de alto mínimo, ancho completo de la columna.
- **Principal (`.btn`):** el sólido de máximo contraste con la superficie —tinta casi negra (#0e1619) con texto claro en tema claro, y a la inversa en oscuro—. **Uno por pantalla.** Sobre superficies invertidas se invierte solo, redefiniendo `--btn-fuerte`.
- **Secundario (`.btn.sec`):** relleno azul agua con tinta oscura (#0e1619, 9,51:1). Se distingue por relleno y no por contorno.
- **Press / Disabled:** al presionar baja 1 px; deshabilitado, 55 % de opacidad.
- **Excepción:** `.btn-emergencia`, el 103, es un teléfono y no una acción de la interfaz.
- **No hay un tercer estilo.** Un botón que pide otro color suele estar pidiendo ser un enlace.

### Cards / Containers
- **Corner Style:** 24 px.
- **Background:** panel blanco (oscuro: #17232a), sin borde.
- **Shadow Strategy:** ambiente de dos capas.
- **Internal Padding:** 20 px.
- **Veredicto:** una tarjeta del mismo radio, tintada por el estado, con el número hero y la regla del río.

### Inputs / Fields
- **Style:** relleno translúcido, sin borde visible, 16 px de radio, 52 px de alto.
- **Focus:** contorno de 2 px en la tinta de agua con 2 px de separación, siempre visible para teclado y oculto para ratón, en dos reglas separadas para no perder el foco en navegadores viejos.
- **Número:** los campos numéricos van en mono.
- **Estado de la respuesta (`.estado-casa`):** un renglón con ícono redondo de 22 px y relleno tintado (ok, aviso, buscando), 16 px de radio.

### Navigation
- **Barra inferior fija:** cuatro pestañas, panel con esquinas superiores de 28 px y sombra hacia arriba. La activa tiñe el ícono con una píldora agua-tinte y pasa a negrita.
- **Cabecera:** logo + nombre a la izquierda y el botón de tema (44 px, círculo) a la derecha, en flujo y no absoluto.

### La regla del río (componente firma)
La regla vertical del hidrómetro: un tanque de 44 px de ancho, el agua azul subiendo desde abajo con una transición de 0,7 s, una escala de marcas a la izquierda y, a lo ancho, una línea de 2 px por cada nivel con su etiqueta pegada. Alerta (naranja), evacuación (rojo), récord (rayada) y «vos» (punteada, en tierra). Vencido, el agua y la línea del río se vuelven gris: un dato viejo no se pinta con la cara de uno actual.

### Avisos
Fondo tintado de alerta (o de peligro si es grave), 16 px de radio, texto de apoyo de 13 px, y los énfasis en negrita con el color del estado. Nada de borde lateral de color.

## Do's and Don'ts

### Do:
- **Do** poner un solo botón sólido por pantalla y dejar el azul agua para lo secundario.
- **Do** escribir toda medida de texto y de espaciado en rem.
- **Do** usar el valor de color correcto para su rol: texto o fondo, tinta o relleno.
- **Do** reservar el alto (`min-height`) de todo lo que llega por red.
- **Do** mantener los objetivos táctiles en 44 px o más: lo que está dentro de una frase se agranda con un pseudoelemento invisible, y lo que está en una lista, de verdad.
- **Do** pintar los estados graves con el verbo de lo que hay que hacer al principio del texto, no con un color más fuerte.
- **Do** probar cada color nuevo contra AA y escribir al lado el motivo del valor elegido.

### Don't:
- **Don't** usar rojo teatral, sirenas, íconos de alarma ni dramatismo: la urgencia va en el texto.
- **Don't** darle a nada el aspecto de un sitio oficial del municipio o de Defensa Civil.
- **Don't** agregar un renglón decorativo en mono y mayúsculas arriba de un titular, ni una banda de métricas de vanidad, ni degradés genéricos.
- **Don't** usar `agua` (#5fc8e8) como color de texto sobre fondo claro.
- **Don't** poner un tinte sobre otro tinte.
- **Don't** agregar un tercer estilo de botón.
- **Don't** mostrar el nivel de aviso con dos decimales ni sin el ≈.
- **Don't** reutilizar el nombre de una clase de otro componente: antes de estrenar uno, buscar en `estilos/app.css`.
- **Don't** escribir `public/css/app.css` a mano: se genera desde `estilos/app.css`.
