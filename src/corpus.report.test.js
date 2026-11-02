// Writes the accuracy report on the external corpus cases. It only runs on request, measures and asserts nothing:
//   CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js
import fs from 'node:fs';
import { evalRock, evalTavern, listJson } from './test/corpus-eval.js';

const OUT = new URL('./test/fixtures/theory/corpus/', import.meta.url);
const pct = (rows, name) => { const r = rows.find(x => x.cat === name); return r ? `${r.pct} % (${r.ok}/${r.n})` : 'sin datos'; };
const table = (rows, prefix) => rows.filter(r => r.cat.startsWith(prefix)).map(r => `| ${r.cat.slice(prefix.length)} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n');
const errs = list => list.map((e, i) => `${i + 1}. **${e.cat}**: ${e.sig}. ${e.n} veces. Ejemplo: \`${JSON.stringify(e.example)}\``).join('\n');

describe.skipIf(!process.env.CORPUS_REPORT)('corpus report', () => {
  it('writes REPORT.md and report.json', () => {
    const tav = evalTavern(listJson('tavern')), rock = evalRock(listJson('rock'));
    const tr = tav.T.rows(), rr = rock.T.rows();
    const tavSkipped = JSON.parse(fs.readFileSync(new URL('tavern/skipped.json', OUT), 'utf8'));
    const rockSkipped = JSON.parse(fs.readFileSync(new URL('rock/skipped.json', OUT), 'utf8'));
    const g = (mode, name) => pct(tr, `${mode} | ${name}`);
    const topAll = [...tav.T.errs.values()].filter(e => e.cat.startsWith('por tramo')).sort((a, b) => b.n - a.n).slice(0, 10);
    const topRock = [...rock.T.errs.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    const topE2E = [...tav.T.errs.values()].filter(e => e.cat.startsWith('de punta a punta')).sort((a, b) => b.n - a.n).slice(0, 10);
    const md = `# Línea base sobre corpus externos

Generado por \`CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js\` (2026-11-01). Mide; no cambia ninguna regla de análisis y no entra al ratchet (\`passing.json\`).
Fuentes: TAVERN (CC BY-SA 4.0) y Rock Corpus RS 200 v2.1 (CC BY 4.0); ver \`README.md\`.

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | ${g('por tramo', 'acorde: raíz + calidad (acepta A o B)')} | ${g('de punta a punta', 'acorde: raíz + calidad (acepta A o B)')} | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | ${g('por tramo', 'acorde: raíz + calidad (acepta A o B)')} | ${g('de punta a punta', 'acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app')} | excluida (circular) |
| Inversión (dado el acorde correcto) | ${g('por tramo', 'inversión (dado el acorde correcto)')} | ${g('de punta a punta', 'inversión (dado el acorde correcto)')} | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | ${g('por tramo', 'grado (crudo)')} | ${g('de punta a punta', 'grado (crudo)')} | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | ${g('por tramo', 'tonalidad (tónica y modo)')} | ${g('de punta a punta', 'tonalidad (tónica y modo)')} | solo la tónica: ${pct(rr, 'tónica (acepta ambos analistas)')} |
| Enarmonía (tramo con todas las notas bien) | ${g('por tramo', 'enarmonía (tramo con todas las notas bien)')} | ${g('de punta a punta', 'enarmonía (tramo con todas las notas bien)')} | excluida (circular) |
| Cadencia | sin corpus | sin corpus | sin corpus |
| Modulación | sin dato: ${tavSkipped.stats['phrase skipped: more than one key'] || 0} frases con más de una tonalidad quedaron fuera | sin dato | ${pct(rr, 'modulación: de las canciones en que el corpus cambia de tonalidad, las que la app informa como cambio')} (la app no reporta cambios de tonalidad) |

## Cómo se midió

- **Por tramo anotado:** la app recibe las notas que suenan en cada tramo del analista (todas las que lo tocan, incluidas las de adorno) y la secuencia entera de tramos de la frase. Se mide solo la etiqueta de cada tramo.
- **De punta a punta:** la app recibe todas las notas de la frase y usa su propia segmentación (\`harmonySegs\`). Cada tramo del analista se compara con el acorde de la app que cubre al menos la mitad de ese tramo; los tramos sin cobertura se cuentan aparte.
- **Dos anotadores (A y B):** cada segmentación se evalúa por separado. «Acepta A o B» da por buena la lectura si coincide con la del propio anotador o con la del otro en el mismo tramo; «solo la lectura propia» es la versión estricta.
- **Acorde:** raíz; y raíz + calidad (mayor, menor, disminuido, aumentado, semidisminuido) + si es de séptima.
- **Inversión:** nota del bajo respecto de la raíz. «Cruda» cuenta todos los tramos; «dado el acorde correcto» solo aquellos donde la app acertó raíz y calidad.
- **Grado:** semitonos entre la raíz y la tónica que detecta la app. «Dada la tonalidad correcta» solo cuenta las frases donde la app acertó tónica y modo.
- **Enarmonía:** nombre de cada nota que escribe la app contra la ortografía del Humdrum, nota a nota y por tramo completo.
- **Tonalidad:** tónica y modo de la frase contra \`*X:\` del Humdrum.
- **Rock Corpus:** solo la tónica (sin modo) y la modulación. La tónica esperada es la que cubre más duración en cada análisis; se acepta la de cualquiera de los dos analistas. Los acordes se realizaron en posición fundamental desde los numerales.

## Conversión

- TAVERN: ${tav.info.phrases} frases (cada una con las dos lecturas); ${tavSkipped.stats['segments converted']} tramos convertidos, de los cuales ${tavSkipped.stats['segments converted, chord tones missing in the notes']} no tienen todas las notas del acorde etiquetado sonando en el tramo. Saltados: ver \`tavern/skipped.json\`.
- Rock Corpus: ${rockSkipped.stats['analyses converted']} análisis convertidos de 400; ${rockSkipped.stats['chords dropped']} acordes descartados. Saltados: ver \`rock/skipped.json\`.
- Acuerdo entre los dos anotadores de TAVERN (techo de referencia):

| Comparación | n | coinciden | % |
|---|---|---|---|
${tav.info.agreement.rows().map(r => `| ${r.cat} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n')}

## TAVERN, por tramo anotado

| Medida | n | aciertos | % |
|---|---|---|---|
${table(tr, 'por tramo | ')}

## TAVERN, de punta a punta

La app produjo ${tav.info.appChordsPerAnalystSeg.reduce((s, x) => s + x[0], 0)} acordes para ${tav.info.appChordsPerAnalystSeg.reduce((s, x) => s + x[1], 0)} tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
${table(tr, 'de punta a punta | ')}

## Rock Corpus

| Medida | n | aciertos | % |
|---|---|---|---|
${rr.map(r => `| ${r.cat} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n')}

Canciones: ${rock.info.songs}; análisis: ${rock.info.analyses}; con cambio de tonalidad: ${rock.info.modulating} (${rock.info.modulatingLong} con una región de 4 o más acordes).

## Los 10 errores más frecuentes (TAVERN, por tramo anotado)

Cada error se cuenta una sola vez, en la medida que le corresponde (acorde: raíz + calidad, inversión dado el acorde correcto, tonalidad, enarmonía nota a nota). Grado y «raíz sola» repiten errores de estas y no se listan.

${errs(topAll)}

## Los 10 errores más frecuentes (TAVERN, de punta a punta)

${errs(topE2E)}

## Los errores más frecuentes (Rock Corpus, tónica)

${errs(topRock)}

## Cómo leer las cifras

- Las frases se cuentan una vez por anotador (A y B), así que \`tonalidad\` tiene dos filas por frase con el mismo material; las medidas por tramo usan la segmentación de cada anotador.
- Las medidas de punta a punta (acorde, inversión, grado, enarmonía) se calculan solo sobre los tramos del analista que la app cubre con un acorde (≥ la mitad del tramo); la fila «contando como fallo» las pone contra todos. Por eso la enarmonía de punta a punta sale más alta: los tramos sin acorde de la app, que escriben las notas por defecto, no entran.
- El grado de la app es la raíz del acorde contra la tónica que detecta: no es independiente de acorde y tonalidad.
- El control «notas exactamente las del acorde» comprueba la conversión: si falla ahí, el problema sería de las etiquetas o del conversor, no del análisis.
`;
    fs.writeFileSync(new URL('REPORT.md', OUT), md);
    fs.writeFileSync(new URL('report.json', OUT), JSON.stringify({ tavern: tr, rock: rr, agreement: tav.info.agreement.rows(), topTramo: topAll, topE2E }, null, 1) + '\n');
  }, 900000);
});
