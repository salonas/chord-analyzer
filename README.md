# Salonas Chord Analyzer

Piano roll y analizador armónico en el navegador. Nombra acordes de C0 a C10, analiza
progresiones, aplica expresión por sentimiento e instrumento, separa melodía, acordes y bajo,
y exporta a MIDI y a texto para FL Studio.

Publicada en https://salonas.github.io/chord-analyzer/.

## Correrla en local

```bash
npm install
```

```bash
npm run dev
```

Queda en http://localhost:5180.

- `npm run build` genera `dist/`, con rutas relativas: sirve igual en la raíz o en una subcarpeta.
- `npm run preview` sirve `dist/` en http://localhost:5181.
- `npm test` corre las pruebas (Vitest). Comparan cada módulo con salidas grabadas de la versión
  de un solo archivo, en `src/test/fixtures/`.

## Código

`src/main.js` arranca la interfaz e importa el resto de `src/`: `analysis` (acordes, tonalidad,
grados), `text` (exportar e importar texto), `midi` (`.mid`, `.zip` y pack), `expression`,
`drums`, `importer` (leer `.mid` y separar voces), `roll` (piano roll y transporte), `audio`,
`model`, `state`, `data` y `dom`. Los módulos de cálculo no tocan el DOM: reciben las
preferencias de nombres, octavas y transposición como parámetro `prefs`.

## Datos

No hay servidor ni cuentas. El proyecto, las preferencias y la biblioteca de acordes se guardan
en el `localStorage` del navegador (`pca.draft`, `pca.prefs`, `pca.lib`).
El idioma se comparte con salonas.github.io en la clave `salonas.lang`.

## Herramientas

`tools/` tiene los scripts de Python que leen la plantilla de FL Studio y sus `.sfz`
(`flp.py`, `sfzkeys.py`) y uno que valida un `.zip` de MIDI (`check_midi_zip.py`).
`samples.py` arma los samples de `public/samples/` a partir de la plantilla de FL: lee qué `.sfz` carga
cada canal y usa solo bibliotecas CC0 (usa `sfzregions.py` y necesita `ffmpeg`).
`subset-unifont.py` recorta GNU Unifont a los caracteres que usa la app (necesita `fontTools`), y
`tools/icons/make-icons.py` dibuja los íconos de 16×16 de `public/img/icons/` a partir de
`tools/icons/icons.json` (necesita `Pillow`).

## Créditos

- Fuentes: MGPixel y [Notepen](https://www.dafont.com/notepen.font), de jeti, licencia CC BY 4.0.
  Las alteraciones, flechas y claves del pentagrama usan [GNU Unifont](https://unifoundry.com/unifont/),
  licencia SIL Open Font License 1.1.
- Sonidos: samples de [Karoryfer Samples](https://www.karoryfer.com/), del Versilian Studios Chamber
  Orchestra 2 Community Edition y de la Versilian Community Sample Library, todos de dominio público
  (CC0 1.0), mezclados y recortados para la vista previa.
- Agradecimientos a quienes hicieron los soundfonts con los que suenan Coro, Lead, Campana (Iglesia) y Chiptune:
  [Musyng Kite](https://musical-artifacts.com/artifacts/1883) (WTFPL 2.0),
  [Just t4 (fixed)](https://musical-artifacts.com/artifacts/650) de Milton Paredes, MP factory studios y RolandKnight
  (Creative Commons Sampling+ 1.0) y [stgiga's Famicom Multichip Soundfont V2G](https://musical-artifacts.com/artifacts/793)
  de stgiga, hakerg, little-scale, drunkenjesus, GASHISOFT, ZandroReville, CynthiaCelestic, switchworks, DekyoOngen,
  TheEighthBit/CincoModar, LifAlien, MrSanic, ASIA LUNAR, Moetsukiro, Awpwr, 48LAC y SpookyLolbit (WTFPL 2.0).
  Detalle y licencias en [CREDITS.md](CREDITS.md).
- Cursores, texturas y paleta: los de [salonas.github.io](https://salonas.github.io).
