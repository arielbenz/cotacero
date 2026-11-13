/* js/comparar.js — el gráfico de /comparar: todos los años del hidrómetro uno
   arriba del otro, el año en curso resaltado y los tres que más se le parecen
   en estas fechas.

   NO es un pronóstico, y la página lo dice al lado del gráfico. La línea del
   año en curso termina en la última lectura; las de los años parecidos siguen
   porque esos años ya terminaron. El porqué de cada decisión está en
   scripts/paginas/comparar.js.

   De dónde sale cada cosa:
   - la historia, de /datos-abiertos/serie-diaria.json (scripts/historia.js):
     366 casilleros por año, en centímetros, null = sin lectura;
   - los últimos 30 días y los umbrales de la ciudad, del objeto `rio` de
     rio-barra.js, al que este archivo se SUSCRIBE: no hace su propio pedido a
     /api/nivel (CLAUDE.md, «El estado en vivo tiene un solo dueño»).

   Ni un número está escrito acá. Clásico y envuelto: convive con
   rio-barra.js, que va en todas las páginas. Nada se mueve solo. */
(() => {
  const { nm } = self.CC_COMUN;
  const $ = (id) => document.getElementById(id);

  const lienzo = $("cmp-grafico");
  const lectura = $("cmp-lectura");
  if (!lienzo || !lectura) return;
  const selector = $("cmp-anio");
  const listaParecidos = $("cmp-parecidos");
  const textoParecidos = $("cmp-parecidos-texto");
  const fichasPar = $("cmp-fichas-par");
  const dato = $("cmp-dato");
  const fichasAlto = $("cmp-fichas-alto");
  const aviso = $("cmp-alerta");

  const MES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
  const CORTO = "ene feb mar abr may jun jul ago sep oct nov dic".split(" ");
  const INI = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
  const casillero = (d) => INI[+d.slice(5, 7) - 1] + +d.slice(8, 10) - 1;
  const fecha = (i) => {
    let m = 0;
    while (INI[m + 1] <= i) m++;
    return i - INI[m] + 1 + " de " + MES[m];
  };
  const fechaCorta = (i) => {
    let m = 0;
    while (INI[m + 1] <= i) m++;
    return i - INI[m] + 1 + " " + CORTO[m];
  };
  /* Centímetros → «5,54 m», con el menos tipográfico de las bajantes. */
  const m2 = (cm) => (cm < 0 ? "−" : "") + nm(Math.abs(cm) / 100, 2) + " m";

  /* Cuántos días se comparan y cuántos tienen que tener lectura en los dos
     años para que la comparación valga. Con menos de 20 de 30, un año con la
     libreta incompleta saldría «parecido» por dos semanas sueltas. */
  const VENTANA = 30;
  const MINIMO = 20;
  const CUANTOS = 3;
  /* El piso baja de cero: en 2022 el río estuvo por debajo del cero del
     hidrómetro. El techo es el de la regla de la app. */
  const PISO = -50;
  const TECHO = 800;
  const TRAZOS = [[], [9, 5], [2, 4]];

  let S = null; // serie-diaria.json
  let anios = []; // «1925» … en orden
  let actual = null; // el año en curso, como texto
  let hoy = -1; // casillero de la última lectura del año en curso
  let parecidos = []; // [{ a, dif, n }]
  /* Los años en que, esta misma fecha, el río estaba más alto que ahora: la
     respuesta literal a «¿esto ya pasó?». Los cinco más altos. */
  let altos = []; // [{ a, v }]
  const MAS_ALTOS = 5;
  let fijo = null; // el año elegido en la lista o en un botón
  let cursor = null; // { i, a, v }: el día y el año bajo el cursor
  let umbrales = { alerta: null, evacuacion: null };
  let geo = null; // la escala del último dibujo, para el cursor
  /* «anio»: enero a diciembre con la escala fija de 0 a 8 m. «cerca»: unos
     dos meses y medio antes de hoy y uno y medio después, con la escala
     ajustada a lo que se ve: en el teléfono el año entero son 300 px y una
     semana no se distingue. */
  let vista = "anio";
  const ANTES = 75;
  const DESPUES = 45;

  const valor = (a, i) => (S && S.anios[a] ? S.anios[a][i] : null);

  /* ¿La última lectura es de hoy, o casi? El INA publica una por día,
     sellada a las 00:00, y el sitio la da por vencida a las VENCE_HORAS
     (48 h). Si /api/nivel no contesta, la última lectura es la de
     serie-diaria.json, que se regenera a mano y puede tener semanas: entonces
     la página no dice «hoy» ni «ahora», dice la fecha (crítica del
     13/11/2026). */
  function fresco() {
    if (!S || hoy < 0) return false;
    let m = 0;
    while (INI[m + 1] <= hoy) m++;
    const dia = new Date(+actual, m, hoy - INI[m] + 1).getTime();
    const horas = (Date.now() - dia) / 36e5;
    return horas <= (self.CC_COMUN.VENCE_HORAS || 48);
  }
  /* «ahora», o la fecha de la última lectura si no es reciente. */
  const ahoraEs = () => (fresco() ? "ahora" : "en la última lectura que tenemos (" + m2(valor(actual, hoy)) + ")");

  /* Los últimos 30 días llegan de `rio`. Se suman a la serie con el mismo
     criterio que scripts/historia.js: si un día tiene dos lecturas, la más
     alta. Devuelve si cambió algo. */
  function sumarReciente(serie) {
    let cambio = false;
    for (const par of serie || []) {
      const d = par[0];
      const v = par[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || typeof v !== "number" || !isFinite(v)) continue;
      const a = d.slice(0, 4);
      if (!S.anios[a]) S.anios[a] = new Array(366).fill(null);
      const i = casillero(d);
      const cm = Math.round(v * 100);
      if (S.anios[a][i] == null || cm > S.anios[a][i]) {
        S.anios[a][i] = cm;
        cambio = true;
      }
    }
    return cambio;
  }

  function ubicarHoy() {
    anios = Object.keys(S.anios).sort();
    actual = anios[anios.length - 1];
    hoy = 365;
    while (hoy > 0 && valor(actual, hoy) == null) hoy--;
  }

  /* Los años que más se parecen. Para cada año anterior se miran los mismos
     30 días del calendario que acaban de pasar y se promedia, día por día, a
     cuántos centímetros estuvo del río de ahora. Si la ventana cruza el 1 de
     enero, se sigue en diciembre del año anterior de cada lado. Es una resta,
     no un modelo: dice qué años estuvieron cerca, no qué va a pasar. */
  function buscarParecidos() {
    const n0 = +actual;
    const lista = [];
    for (const c of anios) {
      if (c === actual) continue;
      let suma = 0;
      let n = 0;
      for (let k = 0; k < VENTANA; k++) {
        let i = hoy - k;
        let atras = 0;
        if (i < 0) {
          i += 366;
          atras = 1;
        }
        const va = valor(String(n0 - atras), i);
        const vc = valor(String(+c - atras), i);
        if (va == null || vc == null) continue;
        suma += Math.abs(va - vc);
        n++;
      }
      if (n >= MINIMO) lista.push({ a: c, dif: suma / n, n });
    }
    lista.sort((x, y) => x.dif - y.dif);
    parecidos = lista.slice(0, CUANTOS);
  }

  const maximoDe = (a) => {
    let mx = null;
    let en = -1;
    const s = S.anios[a];
    for (let i = 0; i < 366; i++)
      if (s[i] != null && (mx == null || s[i] > mx)) {
        mx = s[i];
        en = i;
      }
    return { mx, en };
  };

  /* ---------- el dibujo ---------- */

  function pintar() {
    if (!S) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const texto = c("--texto");
    const tenue = c("--tenue");
    const acento = c("--acento");
    const panel = c("--panel");
    const sans = c("--sans") || "system-ui, sans-serif";

    const ancho = lienzo.clientWidth;
    if (!ancho) return;
    /* El alto lo fija estilos/app.css (.cmp-grafico): reservado desde antes
       de que llegue la serie, la página no salta al cargar. */
    const alto = lienzo.clientHeight;
    if (!alto) return;
    /* La letra del gráfico sigue a la del navegador: con la letra al 200 %
       los rótulos del canvas quedaban en 12 px y los meses se pisaban. */
    /* Con tope según el ancho: en un teléfono con la letra al 200 %, rótulos
       y márgenes al doble dejaban 200 px de gráfico y los nombres de la alerta
       y la evacuación se salían. */
    const f = Math.min((parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16, Math.max(1, ancho / 300));
    const px12 = 12 * f + "px ";
    const px11 = 11 * f;
    const dpr = window.devicePixelRatio || 1;
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    const x = lienzo.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* La parte del año que se ve. */
    let i0 = 0;
    let i1 = 365;
    if (vista === "cerca") {
      i0 = Math.max(0, hoy - ANTES);
      i1 = Math.min(365, hoy + DESPUES);
      if (i1 - i0 < ANTES + DESPUES) {
        if (i0 === 0) i1 = Math.min(365, ANTES + DESPUES);
        else i0 = Math.max(0, 365 - ANTES - DESPUES);
      }
    }
    const marcado = (cursor && cursor.a) || fijo;

    /* La escala: fija con el año entero, para que dos años se puedan comparar
       de una mirada a otra; ajustada a las líneas que importan si se mira
       cerca de hoy. */
    let piso = PISO;
    let techo = TECHO;
    let paso = 100;
    if (vista === "cerca") {
      let lo = Infinity;
      let hi = -Infinity;
      const mirar = (a) => {
        const s = S.anios[a];
        if (!s) return;
        for (let i = i0; i <= i1; i++)
          if (s[i] != null) {
            lo = Math.min(lo, s[i]);
            hi = Math.max(hi, s[i]);
          }
      };
      mirar(actual);
      parecidos.forEach((p) => mirar(p.a));
      /* El elegido sí; el que está bajo el cursor no, o la escala saltaría
         con cada movimiento. */
      if (fijo) mirar(fijo);
      /* Y los que estaban más alto que ahora en esta fecha: si no, la escala
         los cortaba justo a ellos, y el dibujo decía que nadie pasó por acá. */
      altos.forEach((h) => mirar(h.a));
      for (const u of [umbrales.alerta, umbrales.evacuacion])
        if (u != null) {
          lo = Math.min(lo, u * 100);
          hi = Math.max(hi, u * 100);
        }
      if (isFinite(lo)) {
        piso = Math.floor((lo - 30) / 50) * 50;
        techo = Math.ceil((hi + 30) / 50) * 50;
        paso = techo - piso > 400 ? 100 : 50;
      }
    }

    /* El margen derecho es de los rótulos: el año de cada línea resaltada se
       escribe donde la línea termina. */
    /* El margen derecho ya no lleva nombres: alcanza con que el último
       renglón de la grilla no toque el borde. */
    const M = { l: 38 * f, r: 14 * f, t: 24 * f, b: 26 * f };
    const W = ancho - M.l - M.r;
    const X = (i) => M.l + ((i - i0) / (i1 - i0)) * W;
    const Y = (cm) => alto - M.b - ((cm - piso) / (techo - piso)) * (alto - M.t - M.b);
    geo = { M, ancho, Y, i0, i1, W };

    x.clearRect(0, 0, ancho, alto);
    x.textBaseline = "middle";
    x.font = px12 + sans;

    /* Los 30 días que se comparan, de fondo: por qué esos años y no otros. */
    if (parecidos.length) {
      x.fillStyle = acento;
      x.globalAlpha = 0.12;
      const desde = Math.max(i0, hoy - VENTANA + 1);
      x.fillRect(X(desde), M.t, X(hoy) - X(desde), alto - M.t - M.b);
      x.globalAlpha = 1;
    }

    /* La grilla: un renglón por metro, o por medio metro de cerca. */
    for (let v = Math.ceil(piso / paso) * paso; v <= techo; v += paso) {
      x.strokeStyle = tenue;
      x.globalAlpha = v === 0 ? 0.45 : 0.14;
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(M.l, Y(v));
      x.lineTo(ancho - M.r, Y(v));
      x.stroke();
      x.globalAlpha = 1;
      x.fillStyle = tenue;
      x.textAlign = "right";
      x.fillText(nm(v / 100, v % 100 ? 1 : 0) + " m", M.l - 6 * f, Y(v));
    }
    x.textAlign = "center";
    if (vista === "anio") {
      /* Se saltean meses según lo que entra, medido: no por el ancho de la
         pantalla, que con la letra grande no alcanza. */
      const anchoMes = Math.max(...CORTO.map((t) => x.measureText(t).width)) + 8 * f;
      const salto = Math.max(1, Math.ceil(anchoMes / (W / 12)));
      for (let m = 0; m < 12; m += salto) x.fillText(CORTO[m], X((INI[m] + INI[m + 1]) / 2), alto - 10 * f);
    }
    else
      /* De cerca, el primero de cada mes con su raya: «1 nov». */
      for (let m = 0; m < 12; m++) {
        if (INI[m] <= i0 || INI[m] > i1) continue;
        x.strokeStyle = tenue;
        x.globalAlpha = 0.3;
        x.beginPath();
        x.moveTo(X(INI[m]), M.t);
        x.lineTo(X(INI[m]), alto - M.b);
        x.stroke();
        x.globalAlpha = 1;
        x.fillText("1 " + CORTO[m], X(INI[m]), alto - 10 * f);
      }

    /* Las líneas no salen del área del gráfico: de cerca, la escala deja
       afuera a los años que andaban lejos. */
    x.save();
    x.beginPath();
    x.rect(M.l, M.t - 4, W, alto - M.t - M.b + 8);
    x.clip();

    const linea = (a, color, grosor, alfa, trazo, hasta, desde) => {
      const s = S.anios[a];
      if (!s) return;
      x.strokeStyle = color;
      x.lineWidth = grosor;
      x.globalAlpha = alfa;
      x.lineJoin = "round";
      x.lineCap = "round";
      x.setLineDash(trazo || []);
      x.beginPath();
      let abierta = false;
      const fin = Math.min(i1, hasta == null ? 365 : hasta);
      for (let i = Math.max(i0, desde == null ? i0 : desde); i <= fin; i++) {
        if (s[i] == null) {
          /* El 29/2 de un año que no lo tuvo no corta la línea. */
          if (i !== 59) abierta = false;
          continue;
        }
        if (abierta) x.lineTo(X(i), Y(s[i]));
        else {
          x.moveTo(X(i), Y(s[i]));
          abierta = true;
        }
      }
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
    };
    /* Devuelve la caja que ocupó, para que otro rótulo no se le escriba
       encima. Con `chapa` lleva un fondo liso en vez del borde: es para los
       que caen sobre la maraña de líneas. */
    const rotulo = (t, px, py, color, alinear, peso, chapa, tam) => {
      x.font = (peso || "600") + " " + (tam || 12 * f) + "px " + sans;
      x.textAlign = alinear;
      const w = x.measureText(t).width;
      const x1 = alinear === "left" ? px : alinear === "right" ? px - w : px - w / 2;
      if (chapa) {
        x.fillStyle = panel;
        x.globalAlpha = 0.86;
        x.fillRect(x1 - 4, py - 9 * f, w + 8, 18 * f);
        x.globalAlpha = 1;
      } else {
        x.lineWidth = 4;
        x.lineJoin = "round";
        x.strokeStyle = panel;
        x.strokeText(t, px, py);
      }
      x.fillStyle = color;
      x.fillText(t, px, py);
      return { x1, x2: x1 + w, y1: py - 9 * f, y2: py + 9 * f };
    };
    const ocupadas = [];
    const pendientes = [];

    /* Los otros años son el fondo: finos y claros, para que se vea por dónde
       anduvo el río sin tapar a los que se están mirando. */
    /* Cuantos más años, más claro cada uno: con cien, a 0,2 el fondo era una
       mancha gris. */
    const alfaFondo = Math.max(0.1, Math.min(0.22, 14 / anios.length));
    for (const a of anios) if (a !== actual) linea(a, tenue, 1, alfaFondo);

    /* Los umbrales de la ciudad, con su nombre entero: «alerta» a secas suena
       a la de uno (CLAUDE.md, «Tres conceptos, tres nombres»). */
    const umbral = (v, variable, nombre, dy, trazo) => {
      if (v == null) return;
      const color = c(variable);
      const y = Y(v * 100);
      if (y < M.t || y > alto - M.b) return;
      x.setLineDash(trazo);
      x.lineCap = "round";
      x.strokeStyle = color;
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(M.l, y);
      x.lineTo(ancho - M.r, y);
      x.stroke();
      x.setLineDash([]);
      /* Se mide ahora y se escribe después de las líneas resaltadas, que si
         no le pasan por encima. */
      x.font = "600 " + px11 + "px " + sans;
      const w = x.measureText(nombre).width;
      /* Con aire: un rótulo pegado al nombre de la evacuación se leía como
         un solo renglón con él. */
      ocupadas.push({ x1: M.l + 8, x2: M.l + 8 + w, y1: y + dy - 14 * f, y2: y + dy + 14 * f });
      pendientes.push(() => rotulo(nombre, M.l + 8, y + dy, color, "left", "600", true, px11));
      /* La línea entera cuenta como ocupada: el rótulo del año en curso no
         se escribe cruzado por ella. */
      ocupadas.push({ x1: M.l, x2: ancho - M.r, y1: y - 6 * f, y2: y + 6 * f });
    };
    umbral(umbrales.alerta, "--linea-alerta", "alerta de la ciudad", 12 * f, [7, 5]);
    /* Otro trazo que la alerta, no sólo otro color: con daltonismo
       rojo-verde las dos rayas eran iguales. */
    umbral(umbrales.evacuacion, "--linea-evac", "evacuación de la ciudad", -12 * f, [0.5, 4.5]);

    /* Los parecidos: el mismo color y un trazo distinto cada uno —el mismo
       que lleva su botón en la lista de abajo—. */
    const resaltados = [];
    /* Hasta hoy, con todo su peso; después de hoy, finos y tenues. Esos
       años ya terminaron y por eso su línea sigue, pero dibujada igual se
       leía como «así va a seguir este»: el dibujo pronosticaba lo que el
       texto niega. */
    const historica = (a, color, grosor, alfa, trazo) => {
      linea(a, color, grosor, alfa, trazo, hoy);
      linea(a, color, 1, Math.min(alfa, 0.35), trazo, null, hoy);
    };
    parecidos.forEach((p, k) => {
      const es = marcado === p.a;
      historica(p.a, acento, es ? 3 : 1.75, marcado && !es && marcado !== actual ? 0.55 : 1, TRAZOS[k]);
      resaltados.push({ a: p.a, fuerte: es });
    });
    /* El año elegido queda aunque el cursor esté leyendo otro, y el que está
       bajo el cursor se suma. */
    for (const a of new Set([fijo, marcado]))
      if (a && a !== actual && !parecidos.some((p) => p.a === a)) {
        historica(a, acento, a === marcado ? 2.6 : 2, 1);
        resaltados.push({ a, fuerte: a === marcado });
      }

    x.restore();

    for (const escribir of pendientes) escribir();

    /* Los nombres de los años, todos junto a la raya de hoy y a la altura que
       tenía cada año ese día: los parecidos y el elegido (en acento) y los
       que estaban más alto que ahora (en el color del texto, con un círculo
       hueco). Antes los parecidos iban en el margen derecho, donde termina
       diciembre: a la altura correcta pero al lado de la punta de otra
       línea, y «1996» se leía como 1972 (tercera crítica, 13/11/2026). Van
       apilados de un mismo lado, con una guía fina hasta su punto cuando se
       corren. Del lado derecho si entran; si no, del izquierdo. */
    {
      const px = X(hoy);
      const enHoy = (a) => {
        let i = Math.min(hoy, i1);
        while (i > hoy - 10 && valor(a, i) == null) i--;
        return valor(a, i);
      };
      const nombres = [];
      for (const r of resaltados) {
        const v = enHoy(r.a);
        if (v != null) nombres.push({ a: r.a, y: Y(v), color: acento, peso: r.fuerte ? "800" : "600", circulo: false });
      }
      for (const h of altos)
        if (!nombres.some((n) => n.a === h.a)) nombres.push({ a: h.a, y: Y(h.v), color: texto, peso: "600", circulo: true });
      const visibles = nombres.filter((n) => n.y >= M.t && n.y <= alto - M.b).sort((p, q) => p.y - q.y);
      const der = px + 70 * f <= ancho - M.r;
      const lado = der ? 1 : -1;
      let ultimo = -Infinity;
      for (const n of visibles) {
        const cx = px + lado * 9 * f;
        if (n.circulo) {
          x.strokeStyle = n.color;
          x.lineWidth = 1.5;
          x.beginPath();
          x.arc(cx, n.y, 3.5 * f, 0, 7);
          x.stroke();
        }
        const ly = Math.max(n.y, ultimo + 14 * f);
        ultimo = ly;
        const lx = cx + lado * 8 * f;
        if (ly - n.y > 4 * f) {
          x.strokeStyle = n.color;
          x.globalAlpha = 0.6;
          x.lineWidth = 1;
          x.beginPath();
          x.moveTo(px + lado * (n.circulo ? 12 : 3) * f, n.y);
          x.lineTo(lx - lado * 2, ly);
          x.stroke();
          x.globalAlpha = 1;
        }
        ocupadas.push(rotulo(n.a, lx, ly, n.color, der ? "left" : "right", n.peso, true, px11));
      }
    }

    /* La raya de hoy: lo que está a su derecha ya pasó en otros años, no en
       éste. */
    {
      const px = X(hoy);
      x.strokeStyle = texto;
      x.globalAlpha = 0.35;
      x.lineWidth = 1;
      x.setLineDash([2, 3]);
      x.beginPath();
      x.moveTo(px, M.t);
      x.lineTo(px, alto - M.b);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
      const caja = rotulo(fresco() ? "hoy" : fechaCorta(hoy), px, M.t - 12 * f, texto, "center", "700");
      ocupadas.push(caja);
    }

    /* El año en curso, encima de todo y hasta la última lectura. */
    x.save();
    x.beginPath();
    x.rect(M.l, M.t - 4, W, alto - M.t - M.b + 8);
    x.clip();
    /* Con el dato vencido, la línea de este año y su punto van en gris, como
       todo dato vencido del sitio (DESIGN.md): negra y gruesa decía «esto es
       ahora» aunque el texto pusiera la fecha. */
    const tinta = fresco() ? texto : tenue;
    linea(actual, tinta, 3, 1, null, hoy);
    x.restore();
    const v = valor(actual, hoy);
    if (v != null) {
      const px = X(hoy);
      const py = Y(v);
      x.fillStyle = tinta;
      x.beginPath();
      x.arc(px, py, 5 * f, 0, 7);
      x.fill();
      x.strokeStyle = panel;
      x.lineWidth = 2;
      x.stroke();
      /* El primer lugar libre alrededor del punto: la línea viene de abajo a
         la izquierda, así que se prueba primero arriba. */
      const t = actual + " · " + m2(v);
      x.font = "700 " + px12 + sans;
      const w = x.measureText(t).width;
      /* Sólo pegado al punto: lejos, se leía como parte de otro rótulo. */
      const lugares = [
        [px - 10 - w, py - 14 * f],
        [px + 10, py - 14 * f],
        [px - 10 - w, py + 16 * f],
        [px + 10, py + 16 * f],
      ];
      const libre = ([x1, y]) =>
        x1 >= M.l + 2 &&
        x1 + w <= ancho - M.r - 2 &&
        y - 9 * f >= M.t - 6 &&
        !ocupadas.some((o) => x1 < o.x2 + 4 && x1 + w > o.x1 - 4 && y - 9 * f < o.y2 && y + 9 * f > o.y1);
      /* Si no hay lugar libre, no se escribe: tapaba el nombre de la alerta o
         de la evacuación, y el renglón de arriba del gráfico ya lo dice. */
      const lugar = lugares.find(libre);
      if (lugar) rotulo(t, lugar[0], lugar[1], tinta, "left", "700");
    }

    /* El cursor: una guía en el día, y el punto con su valor sobre la línea
       que se está leyendo. El renglón de arriba dice lo mismo con la fecha. */
    if (cursor) {
      const px = X(cursor.i);
      x.strokeStyle = tenue;
      x.globalAlpha = 0.5;
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px, M.t);
      x.lineTo(px, alto - M.b);
      x.stroke();
      x.globalAlpha = 1;
      if (cursor.v != null) {
        const color = cursor.a === actual ? texto : acento;
        const py = Y(cursor.v);
        x.fillStyle = color;
        x.beginPath();
        x.arc(px, py, 4.5, 0, 7);
        x.fill();
        x.strokeStyle = panel;
        x.lineWidth = 2;
        x.stroke();
        const izq = px > ancho * 0.6;
        rotulo(
          cursor.a + " · " + m2(cursor.v),
          izq ? px - 10 : px + 10,
          py < M.t + 30 * f ? py + 16 * f : py - 14 * f,
          color,
          izq ? "right" : "left",
          "700",
          true,
        );
      }
    }
  }

  /* ---------- lo que se lee ---------- */

  const quieto = () => {
    const v = valor(actual, hoy);
    if (v == null) return "";
    return (
      "Última lectura: " +
      fecha(hoy) +
      " de " +
      actual +
      ", " +
      m2(v) +
      "." +
      (fresco() ? "" : " Es la última que tenemos: el nivel de hoy puede ser otro.")
    );
  };

  function decirAnio(a) {
    if (!a) {
      lectura.textContent = quieto();
      return;
    }
    const { mx, en } = maximoDe(a);
    const v = valor(a, hoy);
    lectura.textContent =
      a +
      (a === actual ? " (en curso)" : "") +
      ": máximo " +
      m2(mx) +
      " el " +
      fecha(en) +
      (a !== actual ? ". Un " + fecha(hoy) + (v == null ? " no hay lectura." : " estaba en " + m2(v) + ".") : ".");
  }

  /* Una ficha de año parecido: el botón lleva la muestra del trazo con que
     el gráfico dibuja ese año. */
  const fichaParecido = (p, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmp-ficha";
    b.dataset.anio = p.a;
    b.setAttribute("aria-pressed", String(fijo === p.a));
    const trazo = document.createElement("i");
    trazo.className = "cmp-trazo cmp-t" + k;
    trazo.setAttribute("aria-hidden", "true");
    b.append(trazo, p.a);
    return b;
  };

  function pintarParecidos() {
    if (fichasPar) {
      fichasPar.textContent = "";
      parecidos.forEach((p, k) => fichasPar.appendChild(fichaParecido(p, k)));
    }
    if (!listaParecidos) return;
    listaParecidos.textContent = "";
    if (!parecidos.length) {
      textoParecidos.textContent =
        "No hay años con lecturas suficientes en estas fechas para comparar.";
      return;
    }
    textoParecidos.textContent =
      "Comparados los " + VENTANA + " días que terminan el " + fecha(hoy) + " de " + actual + ":";
    const ahora = valor(actual, hoy);
    parecidos.forEach((p, k) => {
      const { mx, en } = maximoDe(p.a);
      const v = valor(p.a, hoy);
      const li = document.createElement("li");
      const t = document.createElement("span");
      /* La resta la hace la página, no quien lee: el promedio de 30 días y
         la diferencia de hoy son números distintos y juntos confundían. Y si
         ese año nunca llegó a donde está el río ahora, se dice. */
      /* Contra qué: «ahora» sólo si la última lectura es reciente. */
      const ref = fresco() ? "ahora" : "la última lectura";
      let hoyEra = "";
      if (v != null && ahora != null) {
        const d = v - ahora;
        hoyEra =
          " Un " +
          fecha(hoy) +
          " estaba en " +
          m2(v) +
          (Math.abs(d) < 1 ? ", lo mismo que " + ref + "." : ", " + Math.abs(d) + " cm más " + (d > 0 ? "alto" : "bajo") + " que " + ref + ".");
      }
      /* El promedio es contra la línea de este año esos 30 días, no contra
         el nivel de hoy: decía «a 16 cm del río de ahora» al lado de «38 cm
         más bajo que ahora», dos números distintos contra lo mismo. */
      t.textContent =
        (fresco() ? "En estos 30 días" : "En los 30 días hasta la última lectura") +
        " anduvo, en promedio, a " +
        Math.round(p.dif) +
        " cm de lo que marcó este año esos mismos días." +
        hoyEra +
        " Su máximo fue " +
        m2(mx) +
        ", el " +
        fecha(en) +
        (ahora != null && mx < ahora ? ": en todo ese año no llegó a " + m2(ahora) + "." : ".");
      li.append(fichaParecido(p, k), t);
      listaParecidos.appendChild(li);
    });
  }

  /* El dato del día: en cuántos años, esta misma fecha, el río estaba más
     alto que ahora. Es un hecho sobre la serie, no una categoría: no dice
     «alto» ni «normal» (README, «Cien años del Paraná»). */
  function pintarDato() {
    if (!dato) return;
    const ahora = valor(actual, hoy);
    if (ahora == null) {
      dato.textContent = "";
      return;
    }
    let con = 0;
    let mas = 0;
    let mejor = null;
    const arriba = [];
    for (const a of anios) {
      if (a === actual) continue;
      const v = valor(a, hoy);
      if (v == null) continue;
      con++;
      if (v > ahora) {
        mas++;
        arriba.push({ a, v });
      }
      if (!mejor || v > mejor.v) mejor = { a, v };
    }
    altos = arriba.sort((p, q) => q.v - p.v).slice(0, MAS_ALTOS);
    pintarAltos(ahora);
    if (!con) {
      dato.textContent = "";
      return;
    }
    /* La respuesta a «¿esto ya pasó?» es la pieza principal de la página:
       la cifra grande y el resto en apoyo. */
    const dia = "un " + fecha(hoy);
    dato.textContent = "";
    const cifra = document.createElement("span");
    cifra.className = "cmp-cifra";
    cifra.textContent = mas ? mas + " de " + con : "Ninguno de " + con;
    /* Al lado de la cifra, el récord en cualquier fecha: «2 de 101» con el
       río subiendo se leía como «casi nunca pasó», y eso vale sólo para esta
       fecha. Sale de la serie, no escrito a mano. */
    let rec = null;
    for (const a of anios) {
      if (a === actual) continue;
      const { mx, en } = maximoDe(a);
      if (mx != null && (!rec || mx > rec.v)) rec = { a, v: mx, en };
    }
    const record = document.createElement("span");
    record.className = "cmp-record";
    if (rec) record.textContent = "En cualquier fecha, el máximo medido es " + m2(rec.v) + ", el " + fecha(rec.en) + " de " + rec.a + ".";
    dato.append(
      cifra,
      (mas
        ? " años anteriores con lectura: " + dia + " el río estaba más alto que " + ahoraEs() + "."
        : " años anteriores con lectura tuvo el río tan alto " + dia + ".") +
        " El más alto en esa fecha: " +
        m2(mejor.v) +
        ", en " +
        mejor.a +
        ".",
      record,
    );
  }

  /* Las fichas de los años que esta fecha estaban más alto que ahora. El
     grupo sólo se muestra si hay alguno. */
  function pintarAltos(ahora) {
    if (!fichasAlto) return;
    const grupo = fichasAlto.closest(".cmp-grupo");
    fichasAlto.textContent = "";
    if (grupo) grupo.hidden = !altos.length;
    for (const h of altos) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cmp-ficha";
      b.dataset.anio = h.a;
      b.setAttribute("aria-pressed", String(fijo === h.a));
      b.setAttribute("aria-label", h.a + ", " + m2(h.v) + " un " + fecha(hoy));
      b.textContent = h.a;
      fichasAlto.appendChild(b);
    }
    const t = grupo && grupo.querySelector(".cmp-grupo-t");
    if (t && ahora != null) t.textContent = "Más alto que " + m2(ahora) + " un " + fecha(hoy);
  }

  /* Con el río arriba de la alerta de la ciudad, un renglón arriba del
     gráfico que dice que lo de abajo es el pasado. NO lleva verbo propio: la
     franja de la barra, en todas las páginas, ya empieza con el verbo de la
     ciudad («Armá la mochila…»), y dos primeras acciones distintas en la
     misma pantalla confundían (crítica del 13/11/2026). Ofrece el nivel de
     aviso como enlace, con su glosa, y lleva el 103. Con el dato vencido no
     sale: una alerta de hace tres días con cara de hoy es peor que nada. */
  function pintarAviso(rio) {
    if (!aviso) return;
    const n = rio.altura;
    const vencido = self.CC && self.CC.estaVencido && self.CC.estaVencido();
    if (n == null || vencido || rio.alerta == null || n < rio.alerta) {
      aviso.hidden = true;
      return;
    }
    const evacua = rio.evacuacion != null && n >= rio.evacuacion;
    aviso.className = "aviso neutro cmp-aviso";
    aviso.textContent = "";
    /* Corto: la franja y la píldora de la barra ya dicen el nivel y que pasó
       la alerta, y repetirlo acá empujaba la respuesta y el gráfico una
       pantalla abajo en el teléfono (tercera crítica). La glosa del nivel de
       aviso se queda: es su primera aparición en la pantalla (CLAUDE.md). */
    const b = document.createElement("b");
    b.textContent = "Esto es el pasado: no dice cómo sigue.";
    const tel = document.createElement("a");
    tel.href = "tel:103";
    tel.textContent = "103";
    if (evacua) aviso.append(b, " Ayuda para salir: ", tel, ".");
    else {
      const ir = document.createElement("a");
      ir.href = "/app?ir=cota";
      ir.textContent = "tu nivel de aviso";
      aviso.append(
        b,
        " Para tu casa importa ",
        ir,
        ", el nivel del río a partir del cual el agua puede llegar a tu terreno (un cálculo aproximado). Dudas: ",
        tel,
        ".",
      );
    }
    aviso.hidden = false;
  }

  /* El año elegido y la vista van en la URL: un enlace compartido abre lo
     mismo que se estaba mirando. */
  function anotarEnUrl() {
    try {
      const u = new URL(location.href);
      if (fijo) u.searchParams.set("anio", fijo);
      else u.searchParams.delete("anio");
      if (vista === "cerca") u.searchParams.set("vista", "cerca");
      else u.searchParams.delete("vista");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) {
      /* sin history (un iframe raro): no pasa nada */
    }
  }

  /* En el teléfono las fichas quedan debajo del gráfico: elegir un año
     cambiaba algo que no se veía. Si el gráfico no está entero a la vista,
     se va a él (sin animación si la persona pidió menos movimiento). */
  function llevarAlGrafico() {
    const caja = lienzo.closest(".cmp-caja") || lienzo;
    const r = caja.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    caja.scrollIntoView({ block: "center", behavior: quieto ? "auto" : "smooth" });
  }

  function fijar(a, llevar) {
    /* Antes de que llegue la serie las fichas están desactivadas; esto es
       por si algo llama igual: sin serie no hay qué resaltar. */
    if (!S) return;
    fijo = a && S.anios[a] ? a : null;
    cursor = null;
    if (selector) selector.value = fijo || "";
    /* Hay fichas del mismo año en dos lugares: arriba y en la lista. */
    for (const b of document.querySelectorAll("button[data-anio]"))
      b.setAttribute("aria-pressed", String(b.dataset.anio === fijo));
    decirAnio(fijo);
    anotarEnUrl();
    pintar();
    if (llevar && fijo) llevarAlGrafico();
  }

  function ponerVista(v) {
    vista = v === "cerca" ? "cerca" : "anio";
    cursor = null;
    for (const b of document.querySelectorAll("button[data-vista]"))
      b.setAttribute("aria-pressed", String(b.dataset.vista === vista));
    anotarEnUrl();
    pintar();
  }

  function rehacer() {
    ubicarHoy();
    buscarParecidos();
    if (selector && selector.options.length <= 1) {
      for (let k = anios.length - 1; k >= 0; k--) {
        const o = document.createElement("option");
        o.value = o.textContent = anios[k];
        selector.appendChild(o);
      }
      selector.disabled = false;
    }
    pintarParecidos();
    pintarDato();
    decirAnio(fijo);
    /* Con la serie, los controles se activan. */
    for (const b of document.querySelectorAll("#cmp-seccion button[disabled]")) b.disabled = false;
    /* El deslizador arranca en la última lectura, no en «1». */
    lienzo.setAttribute("aria-valuenow", String(hoy + 1));
    lienzo.setAttribute("aria-valuetext", quieto());
    pintar();
  }

  /* ---------- lo que se toca ---------- */

  /* Un repintado por cuadro, no por evento: el dedo manda decenas por segundo. */
  let cuadro = 0;
  const repintar = () => {
    if (cuadro) return;
    cuadro = requestAnimationFrame(() => {
      cuadro = 0;
      pintar();
    });
  };

  /* Lo mismo para el mouse, el dedo y el teclado: un día y un año. El
     renglón de arriba lo dice en palabras y el control lo anuncia. */
  function ponerCursor(i, a) {
    const v = a ? valor(a, i) : null;
    const t = a ? a + " · " + fecha(i) + " · " + (v == null ? "sin lectura" : m2(v)) : quieto();
    lectura.textContent = t;
    lienzo.setAttribute("aria-valuenow", String(i + 1));
    lienzo.setAttribute("aria-valuetext", t);
    cursor = a ? { i, a, v } : null;
    repintar();
  }

  /* El año cuya línea pasa más cerca de una altura, ese día. */
  function masCercano(i, py) {
    let cerca = null;
    let dist = Infinity;
    for (const a of anios) {
      const v = valor(a, i);
      if (v == null) continue;
      const d = Math.abs(geo.Y(v) - py);
      if (d < dist) {
        dist = d;
        cerca = a;
      }
    }
    return cerca;
  }

  const desdePuntero = (e) => {
    if (!S || !geo) return;
    const r = lienzo.getBoundingClientRect();
    const f = (e.clientX - r.left - geo.M.l) / geo.W;
    const i = Math.max(geo.i0, Math.min(geo.i1, Math.round(geo.i0 + f * (geo.i1 - geo.i0))));
    ponerCursor(i, fijo || masCercano(i, e.clientY - r.top));
  };
  lienzo.addEventListener("pointermove", desdePuntero);
  /* Con el dedo, un toque marca el día y queda: no hay «pasar por encima». */
  lienzo.addEventListener("pointerdown", desdePuntero);

  const soltar = () => {
    cursor = null;
    decirAnio(fijo);
    /* El control vuelve a la última lectura: después de Escape seguía
       anunciando el último año leído. */
    if (S) {
      lienzo.setAttribute("aria-valuenow", String(hoy + 1));
      lienzo.setAttribute("aria-valuetext", quieto());
    }
    repintar();
  };
  /* El mouse se va y el cursor se va con él; el dedo que se levanta no. */
  lienzo.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") soltar();
  });
  /* Con el foco en el gráfico, el renglón de lectura deja de ser región
     viva: el control ya anuncia cada paso, y se escuchaba dos veces. */
  lienzo.addEventListener("focus", () => lectura.setAttribute("aria-live", "off"));
  lienzo.addEventListener("blur", () => {
    lectura.removeAttribute("aria-live");
    soltar();
  });

  /* El teclado. Es un deslizador de días (← →, Inicio, Fin, Re Pág y Av Pág
     de a un mes) y ↑ ↓ pasan a la línea que está justo arriba o abajo ese
     día. */
  lienzo.addEventListener("keydown", (e) => {
    if (!S || !geo) return;
    const c = cursor || { i: Math.max(geo.i0, Math.min(geo.i1, hoy)), a: fijo || actual };
    let i = c.i;
    let a = c.a;
    /* La primera tecla aterriza en hoy, con el año de hoy: antes la primera
       → saltaba a mañana, sin lectura. */
    if (!cursor && /^Arrow(Left|Right)$|^Page/.test(e.key)) {
      e.preventDefault();
      ponerCursor(c.i, a);
      return;
    }
    switch (e.key) {
      case "ArrowLeft":
        i--;
        break;
      case "ArrowRight":
        i++;
        break;
      case "PageDown":
        i -= 30;
        break;
      case "PageUp":
        i += 30;
        break;
      case "Home":
        i = geo.i0;
        break;
      case "End":
        i = geo.i1;
        break;
      case "ArrowUp":
      case "ArrowDown": {
        const ref = valor(a, i);
        const con = anios.filter((y) => valor(y, i) != null).sort((p, q) => valor(p, i) - valor(q, i));
        if (!con.length) return e.preventDefault();
        let k = con.indexOf(a);
        if (k < 0)
          k = ref == null ? con.length - 1 : con.findIndex((y) => valor(y, i) >= ref);
        else k += e.key === "ArrowUp" ? 1 : -1;
        a = con[Math.max(0, Math.min(con.length - 1, k))];
        break;
      }
      case "Escape":
        if (!cursor) return;
        e.preventDefault();
        soltar();
        return;
      default:
        return;
    }
    e.preventDefault();
    ponerCursor(Math.max(geo.i0, Math.min(geo.i1, i)), a);
  });

  if (selector) selector.addEventListener("change", () => fijar(selector.value, true));
  /* Las fichas de años, arriba y en la lista de parecidos: tocar la que ya
     está elegida la suelta. */
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button[data-anio], button[data-vista]");
    if (!b) return;
    if (b.dataset.vista) ponerVista(b.dataset.vista);
    else fijar(fijo === b.dataset.anio ? null : b.dataset.anio, true);
  });

  let espera = 0;
  addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(pintar, 120);
  });
  /* El tema puede cambiar con la página abierta: los colores se leen al pintar. */
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", pintar);

  /* ---------- arranque ---------- */

  let ultimaSerie = null;
  let ultimoRio = null;
  function conRio(rio) {
    ultimoRio = rio;
    umbrales = { alerta: rio.alerta, evacuacion: rio.evacuacion };
    pintarAviso(rio);
    if (!S) return;
    if (rio.serie && rio.serie !== ultimaSerie) {
      ultimaSerie = rio.serie;
      if (sumarReciente(rio.serie)) {
        rehacer();
        return;
      }
    }
    pintar();
  }

  /* Lo que trae la URL se aplica cuando llega la serie: antes no se sabe si
     el año existe. */
  const pedido = new URLSearchParams(location.search);

  /* Lo pone el JS: escrito en el HTML quedaba para siempre sin JavaScript. */
  lectura.textContent = "Cargando la serie…";

  /* Desde ya, no cuando llega la serie: el renglón de la alerta tiene que
     salir aunque la serie no cargue. */
  if (self.CC && self.CC.suscribir) self.CC.suscribir(conRio);

  fetch("/datos-abiertos/serie-diaria.json")
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((j) => {
      S = j;
      if (pedido.get("vista") === "cerca") vista = "cerca";
      rehacer();
      if (ultimoRio) conRio(ultimoRio);
      ponerVista(vista);
      if (pedido.get("anio")) fijar(pedido.get("anio"));
    })
    .catch(() => {
      /* Sin la serie no queda un gráfico vacío con su leyenda y sus botones:
         la sección se reduce al mensaje y a la tabla, que está en el HTML y
         se abre sola. El renglón de la alerta sigue (sale de CC). */
      const seccion = $("cmp-seccion");
      if (seccion) seccion.classList.add("cmp-sin-serie");
      lienzo.removeAttribute("tabindex");
      lienzo.removeAttribute("role");
      const tabla = $("cmp-tabla");
      if (tabla) tabla.open = true;
      lectura.textContent = "No se pudo cargar la serie para dibujar el gráfico. Los mismos datos, mes a mes, están en ";
      const ir = document.createElement("a");
      ir.href = "#cmp-tabla";
      ir.textContent = "la tabla";
      lectura.append(ir, ".");
      /* La sección de parecidos entera, con su método, para decir que no se
         puede comparar: se va. */
      const par = $("parecidos");
      if (par) par.hidden = true;
    });
})();
