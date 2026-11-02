# Aviso: TAVERN

Los archivos `*.json` de esta carpeta son **material adaptado** del corpus TAVERN y se publican bajo la misma licencia que el original:
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**. El texto completo está en [LICENSE](LICENSE) y en
https://creativecommons.org/licenses/by-sa/4.0/legalcode.en

Esta licencia cubre solo esta carpeta (los casos convertidos). No se extiende al código de la aplicación ni al resto del repositorio.

## Obra original

- Nombre: TAVERN, «Theme And Variation Encodings with Roman Numerals» (nombre tal como aparece en su README).
- Autores: Johanna Devaney, Claire Arthur, Nathaniel Condit-Schultz y Kirsten Nisula.
- Cita: Devaney, J., Arthur, C., Condit-Schultz, N. y Nisula, K. (2015). «Theme And Variation Encodings with Roman Numerals (TAVERN):
  A New Data Set for Symbolic Music Analysis». *Proceedings of the 16th International Society for Music Information Retrieval
  Conference (ISMIR)*, pp. 728–734. (Autores y cita dados por Joaquín; el README del repositorio no los nombra.)
- Origen: https://github.com/jcdevaney/TAVERN, commit `7cc65dc5365603a92376af50ac71491bea7a16ae`.
- Contenido: 27 temas con variaciones para piano de Mozart y Beethoven, codificados en Humdrum, con análisis en numerales romanos
  de dos anotadores (A y B).
- Licencia del original: CC BY-SA 4.0, según el archivo `LICENSE` del repositorio.

## Qué se cambió

Los archivos `Joined` de Humdrum (`**kern`, `**harm`, `**function`) se convirtieron en listas de notas (altura MIDI, inicio y duración en
ticks, y la ortografía original) y en tramos con los datos esperados del acorde (raíz, calidad, inversión y grado). Se unieron las
ligaduras, se ignoraron las notas de adorno y se fusionaron las etiquetas `**harm` consecutivas iguales. La etiqueta `**function` no se
usa. Lo que no se pudo convertir sin interpretarlo se saltó y está contado en [skipped.json](skipped.json). Conversor:
[tools/corpus_tavern.py](../../../../../../tools/corpus_tavern.py). Los archivos de esta carpeta no son los originales.

## Para reutilizar estos archivos

Conserva este aviso y el `LICENSE`, indica que son una adaptación de TAVERN, enlaza la licencia y compártelos bajo CC BY-SA 4.0 o una licencia compatible.
