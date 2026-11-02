// Writes the accuracy report on the external corpus cases. It only runs on request, measures and asserts nothing:
//   CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js
import fs from 'node:fs';
import { evalRock, evalTavern, isTest, listJson } from './test/corpus-eval.js';

const OUT = new URL('./test/fixtures/theory/corpus/', import.meta.url);
const cell = (rows, name) => { const r = rows.find(x => x.cat === name); return r ? `${r.pct} % (${r.ok}/${r.n})` : 'sin datos'; };
const num = (rows, name) => { const r = rows.find(x => x.cat === name); return r ? r.pct : null; };
const table = (rows, prefix) => rows.filter(r => r.cat.startsWith(prefix)).map(r => `| ${r.cat.slice(prefix.length)} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n');
const errs = list => list.map((e, i) => `${i + 1}. **${e.cat}**: ${e.sig}. ${e.n} veces. Ejemplo: \`${JSON.stringify(e.example)}\``).join('\n');

describe.skipIf(!process.env.CORPUS_REPORT)('corpus report', () => {
  it('writes REPORT.md, report.json and split.json', () => {
    const pieces = listJson('tavern'), songs = listJson('rock');
    const tavTest = evalTavern(pieces.filter(p => isTest(p.piece))), tavDev = evalTavern(pieces.filter(p => !isTest(p.piece)));
    const rockTest = evalRock(songs.filter(s => isTest(s.song))), rockDev = evalRock(songs.filter(s => !isTest(s.song)));
    const tav = evalTavern(pieces), rock = evalRock(songs);
    const tT = tavTest.T.rows(), tD = tavDev.T.rows(), tA = tav.T.rows(), rT = rockTest.T.rows(), rD = rockDev.T.rows(), rA = rock.T.rows();
    const tavSkipped = JSON.parse(fs.readFileSync(new URL('tavern/skipped.json', OUT), 'utf8'));
    const rockSkipped = JSON.parse(fs.readFileSync(new URL('rock/skipped.json', OUT), 'utf8'));
    const both = (rows1, rows2, mode, name) => `${cell(rows1, `${mode} | ${name}`)}<br>${cell(rows2, `${mode} | ${name}`)}`;
    const pair = (a, b, name) => `${cell(a, name)}<br>${cell(b, name)}`;
    // the error analysis is read from the development set only
    const topAll = [...tavDev.T.errs.values()].filter(e => e.cat.startsWith('por tramo')).sort((a, b) => b.n - a.n).slice(0, 10);
    const topE2E = [...tavDev.T.errs.values()].filter(e => e.cat.startsWith('de punta a punta')).sort((a, b) => b.n - a.n).slice(0, 10);
    const topRock = [...rockDev.T.errs.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    const ok = (v, goal) => (v === null ? 'sin datos' : v >= goal ? 'cumple' : 'no cumple');
    const G = [
      ['Acorde por tramo (raíz + calidad, acepta A o B)', '80 %', num(tT, 'por tramo | acorde: raíz + calidad (acepta A o B)'), 80, 'TAVERN, por tramo anotado'],
      ['Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo)', '70 %', num(tT, 'de punta a punta | acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app'), 70, 'TAVERN, de punta a punta'],
      ['Inversión, dado el acorde correcto', '≥ 94 %', num(tT, 'por tramo | inversión (dado el acorde correcto)'), 94, 'TAVERN, por tramo anotado'],
      ['Tonalidad (tónica y modo)', '85 %', num(tT, 'por tramo | tonalidad (tónica y modo)'), 85, 'TAVERN, por tramo anotado'],
      ['Tónica, sin aceptar la relativa', '82 %', num(rT, 'tónica (acepta ambos analistas)'), 82, 'Rock Corpus'],
      ['Enarmonía (tramo con todas las notas bien)', '95 %', num(tT, 'por tramo | enarmonía (tramo con todas las notas bien)'), 95, 'TAVERN, por tramo anotado'],
      ['Modulación: canciones con cambio de tonalidad que la app informa', 'la mitad (50 %)', num(rT, 'modulación: de las canciones en que el corpus cambia de tonalidad, las que la app informa como cambio'), 50, 'Rock Corpus'],
    ];
    const md = `# Línea base sobre corpus externos

Generado por \`CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js\` (2026-11-01). Mide; no cambia ninguna regla de análisis y no entra al ratchet (\`passing.json\`).
Fuentes: TAVERN (CC BY-SA 4.0) y Rock Corpus RS 200 v2.1 (CC BY 4.0); ver \`README.md\`.

## Conjunto de prueba y de desarrollo

Se separan obras completas (TAVERN) y canciones completas (Rock Corpus), una de cada cinco aproximadamente, por una función de la clave \`chord-analyzer-corpus-v1:<nombre>\` (SHA-1, primeros 32 bits módulo 5 igual a 0). La lista exacta está en \`split.json\`. **Las reglas se ajustan solo con el conjunto de desarrollo, y el análisis de errores de este reporte sale solo de él.** El conjunto de prueba se mira para medir, no para decidir qué arreglar. Cada celda dice **prueba** arriba y **desarrollo** abajo.

- TAVERN: prueba = ${tavTest.info.phrases} frases de ${pieces.filter(p => isTest(p.piece)).length} obras; desarrollo = ${tavDev.info.phrases} frases de ${pieces.filter(p => !isTest(p.piece)).length} obras.
- Rock Corpus: prueba = ${rockTest.info.analyses} análisis de ${songs.filter(s => isTest(s.song)).length} canciones; desarrollo = ${rockDev.info.analyses} análisis de ${songs.filter(s => !isTest(s.song)).length} canciones.

## Metas acordadas (medidas en el conjunto de prueba)

| Medida | Meta | Hoy (prueba) | Estado | Corpus |
|---|---|---|---|---|
${G.map(([n, m, v, goal, c]) => `| ${n} | ${m} | ${v === null ? 'sin datos' : v + ' %'} | ${ok(v, goal)} | ${c} |`).join('\n')}

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | ${both(tT, tD, 'por tramo', 'acorde: raíz + calidad (acepta A o B)')} | ${both(tT, tD, 'de punta a punta', 'acorde: raíz + calidad (acepta A o B)')} | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | ${both(tT, tD, 'por tramo', 'acorde: raíz + calidad (acepta A o B)')} | ${both(tT, tD, 'de punta a punta', 'acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app')} | excluida (circular) |
| Inversión (dado el acorde correcto) | ${both(tT, tD, 'por tramo', 'inversión (dado el acorde correcto)')} | ${both(tT, tD, 'de punta a punta', 'inversión (dado el acorde correcto)')} | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | ${both(tT, tD, 'por tramo', 'grado (crudo)')} | ${both(tT, tD, 'de punta a punta', 'grado (crudo)')} | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | ${both(tT, tD, 'por tramo', 'tonalidad (tónica y modo)')} | ${both(tT, tD, 'de punta a punta', 'tonalidad (tónica y modo)')} | solo la tónica: ${pair(rT, rD, 'tónica (acepta ambos analistas)')} |
| Enarmonía (tramo con todas las notas bien) | ${both(tT, tD, 'por tramo', 'enarmonía (tramo con todas las notas bien)')} | ${both(tT, tD, 'de punta a punta', 'enarmonía (tramo con todas las notas bien)')} | excluida (circular) |
| Cadencia | sin corpus | sin corpus | sin corpus |
| Modulación | sin dato: ${tavSkipped.stats['phrase skipped: more than one key'] || 0} frases con más de una tonalidad quedaron fuera | sin dato | ${pair(rT, rD, 'modulación: de las canciones en que el corpus cambia de tonalidad, las que la app informa como cambio')} (la app no reporta cambios de tonalidad) |

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
- Acuerdo entre los dos anotadores de TAVERN (techo de referencia, todo el corpus):

| Comparación | n | coinciden | % |
|---|---|---|---|
${tav.info.agreement.rows().map(r => `| ${r.cat} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n')}

## TAVERN, por tramo anotado (todo el corpus)

| Medida | n | aciertos | % |
|---|---|---|---|
${table(tA, 'por tramo | ')}

## TAVERN, de punta a punta (todo el corpus)

La app produjo ${tav.info.appChordsPerAnalystSeg.reduce((s, x) => s + x[0], 0)} acordes para ${tav.info.appChordsPerAnalystSeg.reduce((s, x) => s + x[1], 0)} tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
${table(tA, 'de punta a punta | ')}

## Rock Corpus (todo el corpus)

| Medida | n | aciertos | % |
|---|---|---|---|
${rA.map(r => `| ${r.cat} | ${r.n} | ${r.ok} | ${r.pct} % |`).join('\n')}

Canciones: ${rock.info.songs}; análisis: ${rock.info.analyses}; con cambio de tonalidad: ${rock.info.modulating} (${rock.info.modulatingLong} con una región de 4 o más acordes).

## Los 10 errores más frecuentes (TAVERN, por tramo anotado, solo desarrollo)

Cada error se cuenta una sola vez, en la medida que le corresponde (acorde: raíz + calidad, inversión dado el acorde correcto, tonalidad, enarmonía nota a nota). Grado y «raíz sola» repiten errores de estas y no se listan.

${errs(topAll)}

## Los 10 errores más frecuentes (TAVERN, de punta a punta, solo desarrollo)

${errs(topE2E)}

## Los errores más frecuentes (Rock Corpus, tónica, solo desarrollo)

${errs(topRock)}

## Cómo leer las cifras

- Las frases se cuentan una vez por anotador (A y B), así que \`tonalidad\` tiene dos filas por frase con el mismo material; las medidas por tramo usan la segmentación de cada anotador.
- Las medidas de punta a punta (acorde, inversión, grado, enarmonía) se calculan solo sobre los tramos del analista que la app cubre con un acorde (≥ la mitad del tramo); la fila «contando como fallo» las pone contra todos. Por eso la enarmonía de punta a punta sale más alta: los tramos sin acorde de la app, que escriben las notas por defecto, no entran.
- El grado de la app es la raíz del acorde contra la tónica que detecta: no es independiente de acorde y tonalidad.
- El control «notas exactamente las del acorde» comprueba la conversión: si falla ahí, el problema sería de las etiquetas o del conversor, no del análisis.
- Las tablas «todo el corpus» mezclan prueba y desarrollo; para decidir arreglos se usa el desarrollo, y las metas se miden en la prueba.
`;
    fs.writeFileSync(new URL('REPORT.md', OUT), md);
    fs.writeFileSync(new URL('report.json', OUT), JSON.stringify({ test: { tavern: tT, rock: rT }, development: { tavern: tD, rock: rD }, all: { tavern: tA, rock: rA }, agreement: tav.info.agreement.rows(), goals: G.map(([n, m, v]) => ({ measure: n, goal: m, test: v })), topTramoDev: topAll, topE2EDev: topE2E, topRockDev: topRock }, null, 1) + '\n');
    fs.writeFileSync(new URL('split.json', OUT), JSON.stringify({
      rule: "test if parseInt(sha1('chord-analyzer-corpus-v1:' + name).hex.slice(0, 8), 16) % 5 === 0; name = work file (TAVERN) or song (Rock Corpus)",
      tavernTestWorks: pieces.filter(p => isTest(p.piece)).map(p => p.piece), rockTestSongs: songs.filter(s => isTest(s.song)).map(s => s.song),
    }, null, 1) + '\n');
  }, 900000);
});
