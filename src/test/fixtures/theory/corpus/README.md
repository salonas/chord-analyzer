# Corpus externos de análisis armónico: búsqueda y recomendación

Fecha: 2026-11-01. Sesión A de «corpus externo y línea base real». Solo investigación: no hay conversor ni casos todavía.
Estado de `main` al empezar: `60130db`, sonda 562/563 (el único fallo es F11).

Cómo se leyó cada licencia: en el archivo o la página del propio corpus, y los términos en el texto legal de Creative Commons
(enlaces abajo). Donde no se pudo llegar a la fuente se dice. No es asesoría legal.

## Criterio de licencia

- El repo es público y el conversor **transforma** los datos: hace falta que la licencia permita redistribuir y obras derivadas.
- «Compartir igual» (SA) no descarta si sus obligaciones se cumplen con un `LICENSE` y avisos dentro de la carpeta del corpus.
- No comercial (NC), ambigua o ausente = **zona gris** = descartado.
- El proyecto no tiene `LICENSE` propio en la raíz (solo `README.md` y `CREDITS.md`). Una carpeta con licencia SA tendría que declarar
  que ese alcance es solo la carpeta de casos convertidos, no el código de la app.

## Resumen de licencias (texto legal leído)

| Licencia | Redistribuir y derivadas | Obligaciones | Texto |
|---|---|---|---|
| CC0 1.0 | Sí, sin condiciones. «any purpose whatsoever, including without limitation commercial» | Ninguna legal. Los autores piden citar. | https://creativecommons.org/publicdomain/zero/1.0/legalcode |
| CC BY 4.0 | Sí, incluye Adapted Material, sin restricción comercial (§2(a)(1)) | Atribución: creador, aviso de licencia, enlace, indicar que se modificó (§3(a)) | https://creativecommons.org/licenses/by/4.0/legalcode.en |
| CC BY 3.0 | Sí, adaptaciones permitidas si se rotulan como modificadas (§3(b)) | Crédito al autor y a la obra, y crédito de que se usó en una adaptación (§4(b)) | https://creativecommons.org/licenses/by/3.0/legalcode |
| CC BY-SA 4.0 | Sí, incluye Adapted Material, sin restricción comercial (§2(a)(1)) | Lo de BY, más: el material adaptado se comparte bajo BY-SA de la misma versión o posterior, o una licencia compatible (§3(b)) | https://creativecommons.org/licenses/by-sa/4.0/legalcode.en |
| CC BY-NC-SA 4.0 | No para uso comercial | — | https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode |

Cómo se cumpliría en la carpeta de cada corpus: un `LICENSE` con el texto (o el enlace oficial y el nombre exacto), un `NOTICE.md` con
creador, título, URL de origen, versión y «convertido por chord-analyzer, 2026», y en cada archivo de casos un encabezado con
`source`, `license` y `modified: true`. Para SA, el `LICENSE` de la carpeta declara que los casos convertidos van bajo CC BY-SA 4.0.
Pendiente de comprobar en la sesión B: que `vite build` no incluya los fixtures en el sitio publicado (no los importa la app).

## Tabla de corpus

Leyenda de categorías: ✓ = confirmado en la fuente; ? = no se pudo confirmar; ✗ = el corpus no lo trae.
Categorías: acorde, inversión, grado, función, tonalidad, enarmonía, cadencia, modulación.

| Corpus | Autor / institución | Licencia exacta (fuente) | Formato | Repertorio | Tamaño | Categorías | Redistribuir + derivadas | Obligaciones y cómo cumplirlas | Veredicto |
|---|---|---|---|---|---|---|---|---|---|
| **TAVERN** | Devaney, Arthur, Condit-Schultz y Nisula (ISMIR 2015); repo `jcdevaney/TAVERN` | CC BY-SA 4.0. Título del archivo `LICENSE`: «Attribution-ShareAlike 4.0 International Public License» ([LICENSE](https://github.com/jcdevaney/TAVERN/blob/master/LICENSE)). El README no repite la licencia. | Humdrum `**kern` (notas, dos manos) + `**harm` (cifrado romano) + `**function` (T/P/D); un archivo por frase y por anotador (A y B) | Variaciones para piano: 17 de Beethoven, 10 de Mozart | 27 conjuntos, 281 variaciones, 1060 frases (939 mayores, 121 menores) | acorde ✓, inversión ✓ (`Ib`, `iib`), grado ✓, función ✓ (T/P/D por evento), tonalidad ✓ (`*C:`), enarmonía ? (solo por la grafía de las notas), cadencia ✗ (no hay marca; se infiere de P→D→T), modulación ? (hay una clave por variación en `var_info`; no se comprobó si cambia dentro de una frase) | Sí | BY-SA: atribución + los casos convertidos bajo CC BY-SA 4.0, con `LICENSE`, `NOTICE.md` y encabezado por archivo. Cumplible. | **Recomendado (principal)** |
| **Rock Corpus (RS 200)** | Trevor de Clercq y David Temperley, con Ethan Lustig e Ivan Tan | CC BY 4.0. El sitio dice que «all work (including all data, transcriptions, scripts, and programs)» se puede usar bajo CC BY 4.0, «in academic or commercial projects, without our permission, as long as appropriate credit is given» ([sitio](https://rockcorpus.midside.com/)) | Texto plano `.har`: reglas con `$`, claves entre corchetes `[C]`, numerales `V7/IV`; v2.x añade transcripciones de melodía y tiempos | Rock (Rolling Stone 500) | 200 canciones, cada una analizada por ambos autores | acorde ✓, inversión ✓ (`6`, `64`, `65`, `43`, `42`), grado ✓, función ✗, tonalidad ✓ (solo la tónica; no distingue mayor/menor), enarmonía ✗, cadencia ✗, modulación ✓ (símbolo de clave a mitad de regla) | Sí | BY: atribución y aviso de modificación en `NOTICE.md` y en cada archivo. Cumplible. | **Recomendado (secundario)** |
| Haydn Op. 20 (harm) | Néstor Nápoles López (tesis de máster; Zenodo) | Zenodo: «Creative Commons Attribution 4.0 International» ([registro](https://zenodo.org/records/1095630)). El repo en GitHub (`napulen/haydn_op20_harm`) muestra Apache-2.0, y no pude leer su `LICENSE.md`. Las dos son permisivas. | Humdrum `**kern` + spines `**harm` (`.hrm`, manual) | Cuartetos de cuerda de Haydn | 24 movimientos (4 por cuarteto, 6 cuartetos) | No verificado: el registro y el README no describen los campos; habría que abrir el ZIP (381,8 kB) | Sí (en ambas licencias) | BY y Apache-2.0: atribución, conservar el texto de licencia y marcar los cambios. Cumplible. | Viable; categorías sin confirmar. Reserva. |
| McGill Billboard | McGill DDMAL (J. A. Burgoyne, J. Wild, I. Fujinaga) | CC0. **No leí la página oficial** (404 y conexión rechazada). Lo leí en el espejo `boomerr1/The-McGill-Billboard-Project`, que cita al sitio oficial («we have made them available legally under a CC0 license»), y en `mirdata` | Texto (`salami_chords.txt`, `.lab`) con acordes en notación Harte (nombres absolutos, p. ej. `C:maj`) | Pop/rock de las listas Billboard | 740 canciones, 890 posiciones de lista | acorde ✓, enarmonía (grafía del nombre) ?, tonalidad ?, inversión ?, grado ✗, función ✗, cadencia ✗, modulación ? | Sí | Ninguna legal. Citar el artículo de ISMIR 2011 por cortesía. | Licencia sin zona gris, pero fuente oficial no leída. Reserva. |
| Schubert Winterreise (SWD) | Registro de Zenodo 5139893 (autores no leídos) | CC BY 3.0 Unported ([registro](https://zenodo.org/records/5139893)) | Partituras (MusicXML, MIDI, PDF, PNG), anotaciones de acordes y de tonalidad local (3 conjuntos) y global (CSV). Formato de las de acordes no descrito en la página; el repo en GitHub dio 404. | Lied, un ciclo | 24 canciones, 9 grabaciones (2 incluidas) | acorde ✓, tonalidad ✓ (global y local), modulación ✓ (vía tonalidad local), grado ✗, función ✗, inversión ?, cadencia ✗, enarmonía ? | Sí | BY 3.0: crédito y aviso de adaptación. Cumplible. | Viable; formato sin confirmar. Reserva. |
| When in Rome | Mark Gotham, Micchi, Nápoles López, Sailor | Contenido propio y conversiones: CC BY-SA. Lo originado en otro lado: «please refer to the original source for licence ... These external licences vary» ([README](https://github.com/MarkGotham/When-in-Rome)). El `LICENSE` raíz dio 404. | RomanText (`analysis.txt`) | Metacorpus: cuartetos, sonatas, corales, lieder, libros de texto | ~2000 análisis, ~1500 obras | Según el subcorpus | Depende de cada subcorpus | Hay que mirar cada origen. Corales de Bach (Tymoczko), madrigales y «Textbooks» no declaran licencia. | **Zona gris** como conjunto. Se usan los originales, no el agregado. |
| ChoCo | Agregador de la comunidad `smashub` | «dual licence scheme»: CC BY 4.0 salvo tres subconjuntos en CC BY-NC-SA 4.0 (Chordify Annotator Subjectivity, Mozart Piano Sonata, JAAH) ([repo](https://github.com/smashub/choco)). El README no nombra la licencia de los demás. | JAMS, RDF | 17 803 simbólicos y 2283 de audio | 20 080 archivos, 60 263 anotaciones | Acordes (Harte), tonalidad y modulación | Mixto | Cada subconjunto mantiene su origen | **Zona gris** como conjunto. |
| Annotated Beethoven Corpus (DCML) | DCML (repo `DCMLab/ABC`) | CC BY-NC-SA 4.0 ([repo](https://github.com/DCMLab/ABC); título del `LICENSE`: «Attribution-NonCommercial-ShareAlike 4.0 International»). Un catálogo de terceros dice CC BY: contradice al repo. | MuseScore (`.mscx`) + TSV (`harmonies.tsv`) | Cuartetos de Beethoven | 70 movimientos, ~28 089 etiquetas | Las 8 categorías incluida cadencia (es el único con cadencias etiquetadas) | No comercial | — | **Zona gris, descartado** (NC). |
| BPS-FH | Tsung-Ping Chen y Li Su | Repo con GPL-3.0 (`LICENSE.txt`) | Texto: notas, tiempos, acordes con tonalidad, grado, calidad, inversión | Primeros movimientos de las 32 sonatas de Beethoven | 32 movimientos | acorde, inversión, grado, tonalidad ✓ (columnas del README) | La GPL está pensada para software: no está claro qué alcanza a los datos ni a una carpeta de casos derivados | Ambigua | **Zona gris, descartado** (ambigua). |
| JAAH | MTG | El repo no muestra licencia. ChoCo lo lista como CC BY-NC-SA. | JSON y `.lab` | Jazz | No verificado | Acordes | — | — | **Zona gris, descartado** (ausente / NC). |

### No evaluados

Isophonics (Beatles), Weimar Jazz Database y los demás corpus de DCML (Mozart, Chopin, etc.; ChoCo lista el de Mozart como NC-SA).
No leí su licencia en la fuente, así que no entran ni como candidatos ni como descartes razonados.

## Lo que no se pudo confirmar

- McGill: la página oficial no respondió; la licencia CC0 está leída a través de un espejo que la cita.
- Haydn Op. 20: licencia en dos sitios (CC BY 4.0 en Zenodo, Apache-2.0 en GitHub); campos de la anotación sin ver.
- Winterreise: formato de los archivos de acordes y de tonalidad sin ver.
- TAVERN: se leyó un archivo completo (`Mozart/K265/Joined/M265_00_01a_a.krn`); no se sabe si las claves cambian dentro de una frase
  ni qué hacen los archivos de los anotadores A y B cuando discrepan.
- Rock Corpus: la sintaxis sale de su página de notación; no se abrió ningún `.har` real (hay que descargar un ZIP).
- Ninguna fuente permisiva etiqueta cadencias. La categoría **cadencia** solo se puede medir con ABC (descartado) o con casos propios.

## Recomendación

1. **TAVERN (principal).** Trae notas reales, cifrado romano con inversión, función T/P/D por evento, tonalidad y dos anotadores por
   frase. Eso permite que cada caso acepte las dos lecturas. Licencia BY-SA 4.0, cumplible con `LICENSE` + `NOTICE.md` en su carpeta.
   Cubre seis de las ocho categorías (acorde, inversión, grado, función, tonalidad y, solo por la grafía, enarmonía). Es música
   clásica de tonalidad única casi siempre: modulación y cadencia quedan flojas.
2. **Rock Corpus (secundario).** Licencia CC BY 4.0, la más simple. Aporta modulación (cambios de clave a mitad de canción),
   repertorio popular y dos analistas por canción. Costo: no trae notas, solo cifrado romano y tónica. Para dar notas a la
   entrada hay que realizar cada numeral en la tonalidad (tónica + numeral dan las clases de altura sin ambigüedad, pero la
   disposición de las voces la elegiría yo) y el modo de la tonalidad no viene. Decisión tuya: aceptar esa realización
   (posición fundamental, y con el bajo dado cuando hay inversión) o saltar las canciones donde haga falta más.

Ninguno cubre cadencia ni enarmonía de forma directa. Si quieres medirlas, hace falta otra fuente o casos propios.

## Decisiones (visto bueno del 2026-11-01)

Se eligen **TAVERN** (principal) y **Rock Corpus** (secundario), con estas condiciones:

1. **TAVERN** mide acorde, inversión, grado, tonalidad y enarmonía (con la ortografía del Humdrum). La **función no se compara**:
   su README dice que sigue el phrase model de Laitz, a nivel de frase y no por acorde; se reporta como «no comparable».
   Se aceptan las lecturas de los anotadores A y B.
2. **Rock Corpus**: los numerales se realizan en posición fundamental (con el bajo dado si hay inversión), pero de este corpus
   solo se miden la **tónica (sin modo)** y la **modulación**. Acorde, inversión, grado y enarmonía quedan excluidos por circulares:
   los acordes se construyen desde el numeral.
3. **TAVERN se reporta de dos formas**: por tramo anotado (la app recibe las notas de cada tramo del analista y se miden solo
   las etiquetas) y con la segmentación propia de la app (de punta a punta).
4. **Cadencia queda «sin corpus»** en el reporte; se sigue cubriendo con los casos propios de la sonda.

Los casos del corpus no entran al ratchet de la sonda (`passing.json`) hasta fijar metas. El reporte está en [REPORT.md](REPORT.md).

## Archivos de esta carpeta

| Ruta | Qué es |
|---|---|
| `tavern/*.json` | Casos de TAVERN, uno por obra (`Beethoven_B063.json`, `Mozart_K265.json`…). Cada archivo lleva `source`, `license` y `modified`. |
| `tavern/LICENSE`, `tavern/NOTICE.md` | Texto de CC BY-SA 4.0 y aviso de atribución. Los casos convertidos van bajo esa licencia. |
| `rock/*.json` | Casos del Rock Corpus, uno por canción (dos análisis: `dt` y `tdc`). |
| `rock/LICENSE`, `rock/NOTICE.md` | Texto de CC BY 4.0 y aviso de atribución. |
| `*/skipped.json` | Lo que el conversor no convirtió y por qué, con conteos. |
| `REPORT.md`, `report.json` | Línea base de acierto por categoría, metas y los errores más frecuentes. |
| `split.json` | Conjunto de prueba: obras de TAVERN y canciones del Rock Corpus que nunca se usan para ajustar reglas (hash fijo del nombre, una de cada cinco). El análisis de errores sale solo del resto. |

Regenerar los casos (necesita los datos originales, que no se versionan):

```bash
python -I tools/corpus_tavern.py <checkout de TAVERN> src/test/fixtures/theory/corpus/tavern
python -I tools/corpus_rock.py <rs200_harmony de rock_corpus_v2-1> src/test/fixtures/theory/corpus/rock
```

Regenerar el reporte (no corre en `npm test`):

```bash
CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js
```

Fuentes usadas: TAVERN en el commit `7cc65dc5365603a92376af50ac71491bea7a16ae` (clon parcial, solo los archivos `Joined`); Rock Corpus v2.1
(`https://rockcorpus.midside.com/versions/rock_corpus_v2-1.zip`, 656,9 kB, solo `rs200_harmony`).

## Qué se convirtió y qué no

**TAVERN.** Un tramo es un grupo de líneas consecutivas con la misma etiqueta `**harm`. Se convierten las etiquetas con numeral
diatónico o cromático simple (`I`, `V7`, `ii7b`, `viioD7`, `viiom7`…), con inversión (`b`, `c`, `d`) y acordes aplicados de un nivel
(`V7/V`). El `Cc` (6/4 cadencial) entra como tríada de tónica en 2ª inversión y acepta como grado tanto I como V, solo si esa tríada
suena en el tramo. Se saltan, y se cuentan en `tavern/skipped.json`: numerales alterados en modo menor, aplicados anidados o con
corchetes, `vii` sin `o`, séptimas mayúsculas que no son `V7` (ambiguas: no dice si es mayor o de dominante), etiquetas fuera del
conjunto (`Gn`, `Lt`, `Fr`, `N`, `Cto7`, `V7m9`…) y frases sin tonalidad o con más de una. Las notas son las de las dos manos
(`**kern`), con ligaduras unidas y sin notas de adorno (`q`).

**Rock Corpus.** Las reglas `.har` se expanden a una lista de acordes con su tónica (cada `[X]` rige hasta el final de su regla). Los
numerales se realizan en posición fundamental. Se descartan los acordes con novenas, oncenas, suspensiones u otras cifras fuera del
conjunto (169 acordes de 38 939); un análisis que pierde más de una décima de sus acordes se salta (18 de 400).

Detalle por etiqueta y por motivo: `tavern/skipped.json` y `rock/skipped.json`.
