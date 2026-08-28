# Cota Cero — Santa Fe

Herramienta ciudadana para la emergencia hídrica (Ley provincial 14.477).
Traduce la altura del hidrómetro del Puerto de Santa Fe a un umbral personal:
a qué lectura del río el agua llega a tu terreno.

## Modelo

    cota del agua (IGN) = lectura del hidrómetro + 8,20
    corrección aguas arriba = 0,045 m por km

Validado contra la crecida de junio 1992: puerto 7,43 m -> 15,62 IGN;
Arroyo Leyes (24 km arriba) -> 16,70 IGN. El modelo da 15,63 y 16,71.

Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m.

## Configuración

En `index.html`, bloque `CONFIG`:

    MAPBOX_TOKEN: 'pk....'        token público de Mapbox
    NIVEL_ENDPOINT: '/api/nivel'  no tocar en Vercel

## Estructura

    index.html               la app entera
    api/nivel.js             lee el reporte diario del INA (CORS proxy)
    sw.js                    service worker
    manifest.webmanifest     PWA
    vercel.json              cabeceras
    icon-*.png               íconos

## Pendientes

- Los km río arriba de cada zona son estimaciones propias, salvo
  Arroyo Leyes (24 km, publicado). Medirlos sobre el cauce.
- Validar el modelo con la Dirección de Gestión de Riesgos del municipio.
