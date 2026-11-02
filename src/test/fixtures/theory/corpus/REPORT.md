# Línea base sobre corpus externos

Generado por `CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js` (2026-11-01). Mide; no cambia ninguna regla de análisis y no entra al ratchet (`passing.json`).
Fuentes: TAVERN (CC BY-SA 4.0) y Rock Corpus RS 200 v2.1 (CC BY 4.0); ver `README.md`.

## Conjunto de prueba y de desarrollo

Se separan obras completas (TAVERN) y canciones completas (Rock Corpus), una de cada cinco aproximadamente, por una función de la clave `chord-analyzer-corpus-v1:<nombre>` (SHA-1, primeros 32 bits módulo 5 igual a 0). La lista exacta está en `split.json`. **Las reglas se ajustan solo con el conjunto de desarrollo, y el análisis de errores de este reporte sale solo de él.** El conjunto de prueba se mira para medir, no para decidir qué arreglar. Cada celda dice **prueba** arriba y **desarrollo** abajo.

- TAVERN: prueba = 290 frases de 6 obras; desarrollo = 811 frases de 21 obras.
- Rock Corpus: prueba = 78 análisis de 40 canciones; desarrollo = 304 análisis de 158 canciones.

## Metas acordadas (medidas en el conjunto de prueba)

| Medida | Meta | Hoy (prueba) | Estado | Corpus |
|---|---|---|---|---|
| Acorde por tramo (raíz + calidad, acepta A o B) | 80 % | 49.4 % | no cumple | TAVERN, por tramo anotado |
| Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo) | 70 % | 39 % | no cumple | TAVERN, de punta a punta |
| Inversión, dado el acorde correcto | ≥ 94 % | 95 % | cumple | TAVERN, por tramo anotado |
| Tonalidad (tónica y modo) | 85 % | 72.4 % | no cumple | TAVERN, por tramo anotado |
| Tónica, sin aceptar la relativa | 82 % | 69.2 % | no cumple | Rock Corpus |
| Enarmonía (tramo con todas las notas bien) | 95 % | 91 % | no cumple | TAVERN, por tramo anotado |
| Modulación: canciones con cambio de tonalidad que la app informa | la mitad (50 %) | 0 % | no cumple | Rock Corpus |

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | 49.4 % (2760/5586)<br>51.3 % (8420/16398) | 49.2 % (1878/3816)<br>49.7 % (5614/11295) | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | 49.4 % (2760/5586)<br>51.3 % (8420/16398) | 39 % (1878/4812)<br>37.2 % (5614/15095) | excluida (circular) |
| Inversión (dado el acorde correcto) | 95 % (2621/2760)<br>94.3 % (7942/8420) | 92.2 % (1732/1878)<br>90.1 % (5061/5614) | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | 43.9 % (2454/5586)<br>50.4 % (8270/16398) | 47.8 % (1823/3816)<br>50.7 % (5724/11295) | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | 72.4 % (420/580)<br>73.4 % (1190/1622) | 69 % (352/510)<br>70.7 % (1030/1456) | solo la tónica: 69.2 % (54/78)<br>73 % (222/304) |
| Enarmonía (tramo con todas las notas bien) | 91 % (5086/5586)<br>91.5 % (15000/16398) | 99.2 % (3784/3816)<br>98.3 % (11098/11295) | excluida (circular) |
| Cadencia | sin corpus | sin corpus | sin corpus |
| Modulación | sin dato: 5 frases con más de una tonalidad quedaron fuera | sin dato | 0 % (0/15)<br>0 % (0/46) (la app no reporta cambios de tonalidad) |

## Cómo se midió

- **Por tramo anotado:** la app recibe las notas que suenan en cada tramo del analista (todas las que lo tocan, incluidas las de adorno) y la secuencia entera de tramos de la frase. Se mide solo la etiqueta de cada tramo.
- **De punta a punta:** la app recibe todas las notas de la frase y usa su propia segmentación (`harmonySegs`). Cada tramo del analista se compara con el acorde de la app que cubre al menos la mitad de ese tramo; los tramos sin cobertura se cuentan aparte.
- **Dos anotadores (A y B):** cada segmentación se evalúa por separado. «Acepta A o B» da por buena la lectura si coincide con la del propio anotador o con la del otro en el mismo tramo; «solo la lectura propia» es la versión estricta.
- **Acorde:** raíz; y raíz + calidad (mayor, menor, disminuido, aumentado, semidisminuido) + si es de séptima.
- **Inversión:** nota del bajo respecto de la raíz. «Cruda» cuenta todos los tramos; «dado el acorde correcto» solo aquellos donde la app acertó raíz y calidad.
- **Grado:** semitonos entre la raíz y la tónica que detecta la app. «Dada la tonalidad correcta» solo cuenta las frases donde la app acertó tónica y modo.
- **Enarmonía:** nombre de cada nota que escribe la app contra la ortografía del Humdrum, nota a nota y por tramo completo.
- **Tonalidad:** tónica y modo de la frase contra `*X:` del Humdrum.
- **Rock Corpus:** solo la tónica (sin modo) y la modulación. La tónica esperada es la que cubre más duración en cada análisis; se acepta la de cualquiera de los dos analistas. Los acordes se realizaron en posición fundamental desde los numerales.

## Conversión

- TAVERN: 1101 frases (cada una con las dos lecturas); 21990 tramos convertidos, de los cuales 5880 no tienen todas las notas del acorde etiquetado sonando en el tramo. Saltados: ver `tavern/skipped.json`.
- Rock Corpus: 382 análisis convertidos de 400; 169 acordes descartados. Saltados: ver `rock/skipped.json`.
- Acuerdo entre los dos anotadores de TAVERN (techo de referencia, todo el corpus):

| Comparación | n | coinciden | % |
|---|---|---|---|
| raíz + calidad | 21856 | 20118 | 92 % |
| inversión | 21856 | 20378 | 93.2 % |
| grado | 21856 | 20967 | 95.9 % |

## TAVERN, por tramo anotado (todo el corpus)

| Medida | n | aciertos | % |
|---|---|---|---|
| tonalidad (tónica y modo) | 2202 | 1610 | 73.1 % |
| tonalidad (solo la tónica) | 2202 | 1625 | 73.8 % |
| acorde: raíz (solo la lectura propia) | 21984 | 13174 | 59.9 % |
| acorde: raíz (acepta A o B) | 21984 | 13304 | 60.5 % |
| acorde: raíz + calidad (solo la lectura propia) | 21984 | 10918 | 49.7 % |
| acorde: raíz + calidad (acepta A o B) | 21984 | 11180 | 50.9 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 16110 | 8982 | 55.8 % |
| inversión (cruda) | 21984 | 12570 | 57.2 % |
| inversión (dado el acorde correcto) | 11180 | 10563 | 94.5 % |
| grado (crudo) | 21984 | 10724 | 48.8 % |
| grado (dada la tonalidad correcta) | 16266 | 10399 | 63.9 % |
| enarmonía (nota a nota) | 137849 | 135285 | 98.1 % |
| enarmonía (tramo con todas las notas bien) | 21984 | 20086 | 91.4 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 7023 | 6833 | 97.3 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5874 | 2198 | 37.4 % |

## TAVERN, de punta a punta (todo el corpus)

La app produjo 24440 acordes para 20539 tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
| tonalidad (tónica y modo) | 1966 | 1382 | 70.3 % |
| tonalidad (solo la tónica) | 1966 | 1398 | 71.1 % |
| segmentación: cortes del analista que la app también corta (±48 ticks) | 18573 | 12122 | 65.3 % |
| segmentación: cortes de la app que el analista también corta (±48 ticks) | 22474 | 15586 | 69.4 % |
| tramo del analista cubierto por un acorde de la app (≥ la mitad) | 19907 | 15111 | 75.9 % |
| acorde: raíz (solo la lectura propia) | 15111 | 9005 | 59.6 % |
| acorde: raíz (acepta A o B) | 15111 | 9142 | 60.5 % |
| acorde: raíz + calidad (solo la lectura propia) | 15111 | 7256 | 48 % |
| acorde: raíz + calidad (acepta A o B) | 15111 | 7492 | 49.6 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 11345 | 6097 | 53.7 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 5223 | 4103 | 78.6 % |
| inversión (cruda) | 15111 | 10071 | 66.6 % |
| inversión (dado el acorde correcto) | 7492 | 6793 | 90.7 % |
| grado (crudo) | 15111 | 7547 | 49.9 % |
| grado (dada la tonalidad correcta) | 10833 | 6970 | 64.3 % |
| enarmonía (nota a nota) | 48033 | 47673 | 99.3 % |
| enarmonía (tramo con todas las notas bien) | 15111 | 14882 | 98.5 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 19907 | 7492 | 37.6 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 3766 | 1395 | 37 % |

## Rock Corpus (todo el corpus)

| Medida | n | aciertos | % |
|---|---|---|---|
| tónica (solo la lectura propia) | 382 | 273 | 71.5 % |
| tónica (acepta ambos analistas) | 382 | 276 | 72.3 % |
| tónica (o su relativa, suplementaria) | 382 | 318 | 83.2 % |
| tónica (o la alternativa que muestra la app, suplementaria) | 382 | 289 | 75.7 % |
| tónica por región de ≥ 4 acordes (la app recibe la región sola) | 589 | 435 | 73.9 % |
| modulación: de las canciones en que el corpus cambia de tonalidad, las que la app informa como cambio | 61 | 0 | 0 % |

Canciones: 198; análisis: 382; con cambio de tonalidad: 61 (60 con una región de 4 o más acordes).

## Los 10 errores más frecuentes (TAVERN, por tramo anotado, solo desarrollo)

Cada error se cuenta una sola vez, en la medida que le corresponde (acorde: raíz + calidad, inversión dado el acorde correcto, tonalidad, enarmonía nota a nota). Grado y «raíz sola» repiten errores de estas y no se listan.

1. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 5 o más clases de altura). 2353 veces. Ejemplo: `{"phrase":"B063_00_03c","mode":"por tramo","label":"Vb/V","key":"c","notes":"F# (54) C (72) D (74) Eb (75) F (77)","expected":"D/1ª inversión","got":"(sin acorde)"}`
2. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 3 o 4 clases de altura). 877 veces. Ejemplo: `{"phrase":"B063_02_02b","mode":"por tramo","label":"IV/III","key":"c","notes":"Ab (56) C (60) Eb (63) Ab (80) B (83) C (84)","expected":"A♭","got":"(sin acorde)"}`
3. **por tramo | enarmonía (nota a nota)**: C# escrito Db. 565 veces. Ejemplo: `{"phrase":"B063_02_01a","label":"V7b","key":"c","note":"C# (73)","app":"Db","appChord":"(sin acorde)"}`
4. **por tramo | enarmonía (nota a nota)**: G# escrito Ab. 480 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"G# (68)","app":"Ab","appChord":"(sin acorde)"}`
5. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m11). 428 veces. Ejemplo: `{"phrase":"B064_01_03c","mode":"por tramo","label":"I","key":"F","notes":"F (53) G (55) A (57) Bb (58) C (60) D (62) F (65)","expected":"F","got":"Gm11/3ª inversión"}`
6. **por tramo | enarmonía (nota a nota)**: D# escrito Eb. 423 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"D# (75)","app":"Eb","appChord":"(sin acorde)"}`
7. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 343 veces. Ejemplo: `{"phrase":"B063_00_01a","mode":"por tramo","label":"Vb","key":"c","notes":"B (47) D (50) G (55) D (74) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
8. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene una sola clase de altura). 323 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (41) F (65)","expected":"F","got":"(sin acorde)"}`
9. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj9. 303 veces. Ejemplo: `{"phrase":"B063_00_02b","mode":"por tramo","label":"Ib/III","key":"c","notes":"G (55) Bb (58) Eb (63) D (74) Eb (75) F (77) G (79)","expected":"E♭/1ª inversión","got":"E♭maj9/1ª inversión"}`
10. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj11. 236 veces. Ejemplo: `{"phrase":"B065_01_02b","mode":"por tramo","label":"Ic","key":"D","notes":"A (45) C# (49) D (50) E (52) F# (54) G (55) C# (61) D (62) E (64) F# (66) G (67) A (69)","expected":"D/2ª inversión","got":"Dmaj11/2ª inversión"}`

## Los 10 errores más frecuentes (TAVERN, de punta a punta, solo desarrollo)

1. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 3ª (m). 535 veces. Ejemplo: `{"phrase":"B063_00_03c","mode":"de punta a punta","label":"Vb/iv","key":"c","notes":"E (52) G (55)","expected":"C/1ª inversión","got":"Em"}`
2. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó 5. 532 veces. Ejemplo: `{"phrase":"B063_00_02b","mode":"de punta a punta","label":"IV/III","key":"c","notes":"Ab (56) Eb (63)","expected":"A♭","got":"A♭5"}`
3. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 2 clases de altura). 521 veces. Ejemplo: `{"phrase":"B063_02_02b","mode":"de punta a punta","label":"V7d/III","key":"c","notes":"Ab (56) Bb (58)","expected":"B♭7/3ª inversión","got":"(sin acorde)"}`
4. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado 7, la app leyó mayor. 312 veces. Ejemplo: `{"phrase":"B064_03_02b","mode":"de punta a punta","label":"V7/iv","key":"f","notes":"F (53) A (69) C (72)","expected":"F7","got":"F"}`
5. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m). 252 veces. Ejemplo: `{"phrase":"B063_00_04d","mode":"de punta a punta","label":"V","key":"c","notes":"G (43) C (72) Eb (75)","expected":"G","got":"Cm/2ª inversión"}`
6. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (mayor). 241 veces. Ejemplo: `{"phrase":"B063_00_02b","mode":"de punta a punta","label":"V/III","key":"c","notes":"Bb (46) Eb (75) G (79)","expected":"B♭","got":"E♭/2ª inversión"}`
7. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 5ª (mayor). 231 veces. Ejemplo: `{"phrase":"B063_09_04d","mode":"de punta a punta","label":"IV","key":"C","notes":"E (52) G (55) C (60)","expected":"F","got":"C/1ª inversión"}`
8. **de punta a punta | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 230 veces. Ejemplo: `{"phrase":"B063_09_01a","mode":"de punta a punta","key":"C","got":"G major"}`
9. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 1ª inversión. 226 veces. Ejemplo: `{"phrase":"B063_00_01a","mode":"de punta a punta","label":"V","key":"c","notes":"B (47) D (50) G (55)","expected":"G","got":"G/1ª inversión"}`
10. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: m leído con raíz en su 3ª (mayor). 177 veces. Ejemplo: `{"phrase":"B063_00_04d","mode":"de punta a punta","label":"ib","key":"c","notes":"Eb (51) G (55)","expected":"Cm/1ª inversión","got":"E♭"}`

## Los errores más frecuentes (Rock Corpus, tónica, solo desarrollo)

1. **tónica (acepta ambos analistas)**: la app leyó la tónica A y el corpus E (una quinta abajo). 10 veces. Ejemplo: `{"song":"bitter_sweet_symphony","analyst":"dt","got":"A major","expected":"E","chords":"I v7 IV I v7 IV I v7"}`
2. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en E, la app leyó A. 10 veces. Ejemplo: `{"song":"bitter_sweet_symphony","analyst":"dt","expected":"E","got":"A major"}`
3. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en A, la app leyó G. 9 veces. Ejemplo: `{"song":"one","analyst":"dt","expected":"A","got":"G major"}`
4. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en B♭, la app leyó E♭. 8 veces. Ejemplo: `{"song":"good_vibrations","analyst":"dt","expected":"B♭","got":"E♭ major"}`
5. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en A, la app leyó D. 8 veces. Ejemplo: `{"song":"louie_louie","analyst":"dt","expected":"A","got":"D major"}`

## Cómo leer las cifras

- Las frases se cuentan una vez por anotador (A y B), así que `tonalidad` tiene dos filas por frase con el mismo material; las medidas por tramo usan la segmentación de cada anotador.
- Las medidas de punta a punta (acorde, inversión, grado, enarmonía) se calculan solo sobre los tramos del analista que la app cubre con un acorde (≥ la mitad del tramo); la fila «contando como fallo» las pone contra todos. Por eso la enarmonía de punta a punta sale más alta: los tramos sin acorde de la app, que escriben las notas por defecto, no entran.
- El grado de la app es la raíz del acorde contra la tónica que detecta: no es independiente de acorde y tonalidad.
- El control «notas exactamente las del acorde» comprueba la conversión: si falla ahí, el problema sería de las etiquetas o del conversor, no del análisis.
- Las tablas «todo el corpus» mezclan prueba y desarrollo; para decidir arreglos se usa el desarrollo, y las metas se miden en la prueba.
