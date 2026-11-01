# Créditos de sonido

Las muestras de vista previa de `public/samples/` son notas cortas que `tools/samples.py` renderiza a partir de los
instrumentos de la plantilla de FL Studio del autor. Fuentes:

## Soundfonts (convertidos a `.sfz` con ARIA)

Se usan en los canales Coro (Aahs, Oohs), Lead, Campana (Iglesia) y Chiptune.

- **Musyng Kite** (antes Evanessence, Musica 7): Do What The F*ck You Want To Public License 2.0.
  https://musical-artifacts.com/artifacts/1883. La captura de la página que guardó el autor no muestra el nombre de quien lo hizo.
- **Just t4 (fixed)**: de Milton Paredes, MP factory studios y RolandKnight. Creative Commons Sampling+ 1.0.
  https://musical-artifacts.com/artifacts/650
- **stgiga's Famicom Multichip Soundfont V2G (normalized)**: de stgiga, hakerg, little-scale, drunkenjesus, GASHISOFT,
  ZandroReville, CynthiaCelestic, switchworks, DekyoOngen, TheEighthBit/CincoModar, LifAlien, MrSanic, ASIA LUNAR,
  Moetsukiro, Awpwr, 48LAC y SpookyLolbit. Do What The F*ck You Want To Public License 2.0 con consideraciones
  adicionales: dar crédito en la sección de créditos con un enlace a una descarga, y mantener bajo los mismos términos
  los bancos derivados.
  https://musical-artifacts.com/artifacts/793

Las muestras de `public/samples/` renderizadas desde estos bancos se distribuyen bajo los mismos términos que el banco
de origen (WTFPL 2.0 para Musyng Kite y Famicom; Creative Commons Sampling+ 1.0 para Just t4).

## Soundfont General MIDI (modo GM)

Una pista de un .mid que fija un programa (program change) suena con este soundfont. No está en el repositorio: cada
programa se descarga la primera vez que suena, desde jsDelivr, fijado al commit `044fab8e1456bfafc5776e86dfd6bb8697149aef`.

- **FluidR3 GM**: Copyright © 2000-2002, 2008 Frank Wen. Licencia MIT.
  Verificada en el archivo de copyright del paquete de Debian: https://people.debian.org/~tg/sf/FluidR3Mono_GM/copyright
- **Render nota por nota**: Benjamin Gleitzman, https://github.com/gleitz/midi-js-soundfonts. El repositorio es MIT
  (`LICENSE.txt`) y su README publica los renders de FluidR3_GM bajo Creative Commons Attribution 3.0.
  Las dos licencias son libres; las dos piden mantener el aviso de autoría, y eso hace esta sección.

## Bibliotecas CC0

Todo lo demás: Karoryfer Samples (batería y guitarras), VSCO 2 Community Edition y Versilian Community Sample Library (VCSL).

## Notas

- Las páginas de Musical Artifacts bloquean el acceso automatizado, así que las licencias de arriba se copiaron de capturas
  que tomó el autor de esas páginas, no de las páginas directamente.
- El crédito también aparece en la pestaña Ajustes de la página.
