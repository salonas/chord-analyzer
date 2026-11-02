# Aviso: Rock Corpus

Los archivos `*.json` de esta carpeta son **material adaptado** del Rock Corpus y se publican bajo la licencia del original:
**Creative Commons Attribution 4.0 International (CC BY 4.0)**. El texto completo está en [LICENSE](LICENSE) y en
https://creativecommons.org/licenses/by/4.0/legalcode.en

## Obra original

- Nombre: Rock Corpus, conjunto RS 200, versión 2.1 (análisis armónicos).
- Autores: Trevor de Clercq y David Temperley, con Ethan Lustig e Ivan Tan, según el sitio del corpus. Los archivos `_dt` son del análisis de
  Temperley y los `_tdc` del de de Clercq.
- Origen: https://rockcorpus.midside.com/ (archivo `versions/rock_corpus_v2-1.zip`).
- Licencia del original: el sitio dice que todo el trabajo publicado allí (datos, transcripciones, scripts y programas) puede usarse bajo
  CC BY 4.0, con el crédito apropiado.

## Qué se cambió

Los archivos `.har` (reglas con numerales romanos y tonalidades) se expandieron a una lista de acordes con su tónica. Como el corpus no trae
notas, cada numeral se realizó como acordes en posición fundamental (con el bajo dado cuando lleva figura de inversión). Los acordes con
cifras fuera del conjunto convertido se descartaron y están contados en [skipped.json](skipped.json). Conversor: [tools/corpus_rock.py](../../../../../../tools/corpus_rock.py).
Los archivos de esta carpeta no son los originales.

## Para reutilizar estos archivos

Conserva este aviso, enlaza la licencia, nombra a los autores del original e indica que son una adaptación.
