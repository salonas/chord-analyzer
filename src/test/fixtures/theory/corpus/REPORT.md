# Línea base sobre corpus externos

Generado por `CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js` (2026-11-02). Mide; no cambia ninguna regla de análisis y no entra al ratchet (`passing.json`).
Fuentes: TAVERN (CC BY-SA 4.0) y Rock Corpus RS 200 v2.1 (CC BY 4.0); ver `README.md`.

## Conjunto de prueba y de desarrollo

Se separan obras completas (TAVERN) y canciones completas (Rock Corpus), una de cada cinco aproximadamente, por una función de la clave `chord-analyzer-corpus-v1:<nombre>` (SHA-1, primeros 32 bits módulo 5 igual a 0). La lista exacta está en `split.json`. **Las reglas se ajustan solo con el conjunto de desarrollo, y el análisis de errores de este reporte sale solo de él.** El conjunto de prueba se mira para medir, no para decidir qué arreglar. Cada celda dice **prueba** arriba y **desarrollo** abajo, con su intervalo de confianza del 95 % (IC; ver «Cómo se midió»).

- TAVERN: prueba = 290 frases de 6 obras; desarrollo = 811 frases de 21 obras.
- Rock Corpus: prueba = 78 análisis de 40 canciones; desarrollo = 304 análisis de 158 canciones.

## Metas acordadas (medidas en el conjunto de prueba)

| Medida | Meta | Hoy (prueba) | IC 95 % | Estado | Corpus |
|---|---|---|---|---|---|
| Acorde por tramo (raíz + calidad, acepta A o B) | 80 % | 67 % | 63.2–72.2 % | no cumple | TAVERN, por tramo anotado |
| Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo) | 70 % | 49 % | 41.6–55.9 % | no cumple | TAVERN, de punta a punta |
| Inversión, dado el acorde correcto | ≥ 94 % | 95.4 % | 92.7–97.2 % | cumple | TAVERN, por tramo anotado |
| Tonalidad (tónica y modo) | 85 % | 77.1 % | 66.2–88.2 % | no cumple | TAVERN, por tramo anotado |
| Tónica, sin aceptar la relativa | 82 % | 69.2 % | 55.1–82.3 % | no cumple | Rock Corpus |
| Enarmonía (tramo con todas las notas bien) | 95 % | 91 % | 88.1–94.7 % | no cumple | TAVERN, por tramo anotado |
| Modulación: canciones con cambio de tonalidad que la app informa | la mitad (50 %) | 0 % | 0–0 % | no cumple | Rock Corpus |

## Antes y después de las reglas que leen el tiempo y la melodía

«Antes» es la misma evaluación con los pasos sin el inicio y la duración de sus notas y sin las notas de la melodía, como los leía la app hasta el 2026-11-01; «después», con ellos (decisiones 8 y 11 de `THEORY.md`). La segmentación de la app (decisiones 9 y 10) es la misma en los dos lados, así que esta tabla no mide la de punta a punta de la etapa: esa comparación, contra la base corregida `965e9d6`, está en `THEORY.md`. Δ en puntos, con su IC 95 % pareado: cada remuestreo toma las mismas obras en los dos lados. La regla se fijó mirando solo desarrollo; la prueba se miró una vez, al final.

| Medida | Desarrollo antes | Desarrollo después | Δ desarrollo | Prueba antes | Prueba después | Δ prueba |
|---|---|---|---|---|---|---|
| por tramo — acorde: raíz + calidad (acepta A o B) | 51.3 % | 67.4 % | 16.1 (13.6 a 19) | 49.4 % | 67 % | 17.6 (13.9 a 21.3) |
| por tramo — acorde: nombre exacto, sin extensiones (acepta A o B) | 39 % | 52.8 % | 13.8 (11.7 a 16.2) | 35.8 % | 50.6 % | 14.8 (13.1 a 16.2) |
| por tramo — acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 97.6 % | 96.9 % | -0.7 (-1 a -0.3) | 96.5 % | 95.9 % | -0.6 (-1.7 a 0) |
| por tramo — tonalidad (tónica y modo) | 73.4 % | 78 % | 4.6 (2.5 a 7.2) | 72.4 % | 77.1 % | 4.7 (1.6 a 8.2) |
| por tramo — inversión (dado el acorde correcto) | 94.3 % | 95.1 % | 0.8 (0.1 a 1.4) | 95 % | 95.4 % | 0.4 (-0.7 a 1.3) |
| por tramo — enarmonía (tramo con todas las notas bien) | 91.5 % | 91 % | -0.5 (-1 a 0) | 91 % | 91 % | 0.0 (-1 a 2.1) |
| de punta a punta — acorde: raíz + calidad (acepta A o B) | 52 % | 60.7 % | 8.7 (7.3 a 10.2) | 50.3 % | 57.4 % | 7.1 (6.1 a 8) |
| de punta a punta — acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 45.6 % | 53.2 % | 7.6 (6.4 a 9) | 42.9 % | 49 % | 6.1 (4.8 a 6.9) |
| de punta a punta — tonalidad (tónica y modo) | 75.5 % | 76.2 % | 0.7 (-1.1 a 2.5) | 69.7 % | 72.1 % | 2.4 (0 a 5.5) |

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | 67 % (3742/5586), IC 95 % 63.2–72.2<br>67.4 % (11048/16398), IC 95 % 65.3–69.3 | 57.4 % (2735/4768), IC 95 % 50.7–65.8<br>60.7 % (8727/14380), IC 95 % 58.2–63.4 | excluida (circular) |
| Acorde, nombre exacto, sin extensiones (F7♭9 no cuenta como F7) | 50.6 % (2827/5586), IC 95 % 43.5–57<br>52.8 % (8655/16398), IC 95 % 49.6–55.6 | 48.2 % (2297/4768), IC 95 % 41.6–58.6<br>52.6 % (7565/14380), IC 95 % 49.7–55.5 | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | 67 % (3742/5586), IC 95 % 63.2–72.2<br>67.4 % (11048/16398), IC 95 % 65.3–69.3 | 49 % (2735/5586), IC 95 % 41.6–55.9<br>53.2 % (8727/16404), IC 95 % 50.1–55.9 | excluida (circular) |
| Inversión (dado el acorde correcto) | 95.4 % (3569/3742), IC 95 % 92.7–97.2<br>95.1 % (10507/11048), IC 95 % 93.9–96.1 | 89.7 % (2452/2735), IC 95 % 87.1–92.7<br>90.4 % (7887/8727), IC 95 % 89–91.9 | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | 57.1 % (3187/5586), IC 95 % 47.9–69<br>63.1 % (10355/16398), IC 95 % 58.8–66.9 | 50.5 % (2410/4768), IC 95 % 40.9–66.8<br>59.2 % (8516/14380), IC 95 % 55.3–62.7 | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | 77.1 % (447/580), IC 95 % 66.2–88.2<br>78 % (1265/1622), IC 95 % 72.9–82.6 | 72.1 % (418/580), IC 95 % 58.1–87<br>76.2 % (1236/1622), IC 95 % 70.7–81.5 | solo la tónica: 69.2 % (54/78), IC 95 % 55.1–82.3<br>73 % (222/304), IC 95 % 66.4–79.4 |
| Enarmonía (tramo con todas las notas bien) | 91 % (5086/5586), IC 95 % 88.1–94.7<br>91 % (14917/16398), IC 95 % 89.2–92.5 | 96.3 % (4592/4768), IC 95 % 95.2–97.5<br>96.5 % (13877/14380), IC 95 % 95.7–97.2 | excluida (circular) |
| Cadencia | sin corpus | sin corpus | sin corpus |
| Modulación | sin dato: 5 frases con más de una tonalidad quedaron fuera | sin dato | 0 % (0/15), IC 95 % 0–0<br>0 % (0/46), IC 95 % 0–0 (la app no reporta cambios de tonalidad) |

## Cómo se midió

- **Por tramo anotado:** la app recibe las notas que suenan en cada tramo del analista (todas las que lo tocan, incluidas las de adorno) y la secuencia entera de tramos de la frase. Se mide solo la etiqueta de cada tramo.
- **De punta a punta:** la app recibe todas las notas de la frase y usa su propia segmentación (`harmonySegs`). Cada tramo del analista se compara con el acorde de la app que cubre al menos la mitad de ese tramo; los tramos sin cobertura se cuentan aparte.
- **Dos anotadores (A y B):** cada segmentación se evalúa por separado. «Acepta A o B» da por buena la lectura si coincide con la del propio anotador o con la del otro en el mismo tramo; «solo la lectura propia» es la versión estricta.
- **Acorde:** raíz; y raíz + calidad (mayor, menor, disminuido, aumentado, semidisminuido) + si es de séptima. «Nombre exacto, sin extensiones» pide además el símbolo entero: F7♭9 o Cadd11 cuentan como F7 y C en la fila de raíz + calidad, y como fallo en esta.
- **Intervalo de confianza (IC 95 %):** bootstrap percentil con 2000 remuestreos con reposición de obras completas (TAVERN) o canciones completas (Rock Corpus), semilla fija; las frases de una obra no son independientes, por eso la unidad es la obra. Con 6 obras de prueba el intervalo es optimista: no ve la variación de obras que no conoce.
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
| tonalidad (tónica y modo) | 2202 | 1712 | 77.7 % |
| tonalidad (solo la tónica) | 2202 | 1721 | 78.2 % |
| acorde: raíz (solo la lectura propia) | 21984 | 16788 | 76.4 % |
| acorde: raíz (acepta A o B) | 21984 | 16969 | 77.2 % |
| acorde: raíz + calidad (solo la lectura propia) | 21984 | 14423 | 65.6 % |
| acorde: raíz + calidad (acepta A o B) | 21984 | 14790 | 67.3 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 21984 | 11482 | 52.2 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 16110 | 12239 | 76 % |
| inversión (cruda) | 21984 | 16487 | 75 % |
| inversión (dado el acorde correcto) | 14790 | 14076 | 95.2 % |
| grado (crudo) | 21984 | 13542 | 61.6 % |
| grado (dada la tonalidad correcta) | 16957 | 13274 | 78.3 % |
| enarmonía (nota a nota) | 137849 | 135281 | 98.1 % |
| enarmonía (tramo con todas las notas bien) | 21984 | 20003 | 91 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 7023 | 6791 | 96.7 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5874 | 2551 | 43.4 % |

## TAVERN, de punta a punta (todo el corpus)

La app produjo 34218 acordes para 22672 tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
| tonalidad (tónica y modo) | 2202 | 1654 | 75.1 % |
| tonalidad (solo la tónica) | 2202 | 1668 | 75.7 % |
| segmentación: cortes del analista que la app también corta (±48 ticks) | 20470 | 18257 | 89.2 % |
| segmentación: cortes de la app que el analista también corta (±48 ticks) | 32016 | 22224 | 69.4 % |
| tramo del analista cubierto por un acorde de la app (≥ la mitad) | 21990 | 19148 | 87.1 % |
| acorde: raíz (solo la lectura propia) | 19148 | 13167 | 68.8 % |
| acorde: raíz (acepta A o B) | 19148 | 13388 | 69.9 % |
| acorde: raíz + calidad (solo la lectura propia) | 19148 | 11066 | 57.8 % |
| acorde: raíz + calidad (acepta A o B) | 19148 | 11462 | 59.9 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 19148 | 9862 | 51.5 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 13905 | 9312 | 67 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 6556 | 5541 | 84.5 % |
| inversión (cruda) | 19148 | 13463 | 70.3 % |
| inversión (dado el acorde correcto) | 11462 | 10339 | 90.2 % |
| grado (crudo) | 19148 | 10926 | 57.1 % |
| grado (dada la tonalidad correcta) | 14470 | 10468 | 72.3 % |
| enarmonía (nota a nota) | 78989 | 78161 | 99 % |
| enarmonía (tramo con todas las notas bien) | 19148 | 18469 | 96.5 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 21990 | 11462 | 52.1 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5243 | 2150 | 41 % |

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

1. **por tramo | enarmonía (nota a nota)**: G# escrito Ab. 542 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"G# (68)","app":"Ab","appChord":"C6"}`
2. **por tramo | enarmonía (nota a nota)**: C# escrito Db. 523 veces. Ejemplo: `{"phrase":"B063_02_01a","label":"V7b","key":"c","note":"C# (73)","app":"Db","appChord":"E♭maj7♯5/2ª inversión"}`
3. **por tramo | enarmonía (nota a nota)**: D# escrito Eb. 426 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"D# (75)","app":"Eb","appChord":"C6"}`
4. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 379 veces. Ejemplo: `{"phrase":"B063_01_01a","mode":"por tramo","label":"Vb","key":"c","notes":"B (59) D (62) G (67) D (74) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
5. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene una sola clase de altura). 323 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (41) F (65)","expected":"F","got":"(sin acorde)"}`
6. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m11). 302 veces. Ejemplo: `{"phrase":"B063_04_02b","mode":"por tramo","label":"Ib/III","key":"c","notes":"G (55) Bb (58) Eb (63) Bb (70) C (72) D (74) Eb (75) F (77) G (79) Ab (80)","expected":"E♭/1ª inversión","got":"Fm11/bajo en otra nota"}`
7. **por tramo | enarmonía (nota a nota)**: A# escrito Bb. 208 veces. Ejemplo: `{"phrase":"B063_03_01a","label":"Vb","key":"c","note":"A# (58)","app":"Bb","appChord":"Gmaj7/1ª inversión"}`
8. **por tramo | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 202 veces. Ejemplo: `{"phrase":"B063_06_03c","mode":"por tramo","key":"c","got":"G minor"}`
9. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m7). 178 veces. Ejemplo: `{"phrase":"B063_00_02b","mode":"por tramo","label":"Ib/III","key":"c","notes":"G (55) Bb (58) Eb (63) A (81) Bb (82) C (84)","expected":"E♭/1ª inversión","got":"Cm7/2ª inversión"}`
10. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 2 clases de altura). 176 veces. Ejemplo: `{"phrase":"B064_02_03c","mode":"por tramo","label":"Ib","key":"F","notes":"A (57) Bb (58) A (69)","expected":"F/1ª inversión","got":"(sin acorde)"}`

## Los 10 errores más frecuentes (TAVERN, de punta a punta, solo desarrollo)

1. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 3ª (m). 384 veces. Ejemplo: `{"phrase":"B063_02_02b","mode":"de punta a punta","label":"Ib/III","key":"c","notes":"G (55) Bb (58)","expected":"E♭/1ª inversión","got":"Gm"}`
2. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado 7, la app leyó mayor. 347 veces. Ejemplo: `{"phrase":"B064_03_03c","mode":"de punta a punta","label":"V7","key":"f","notes":"C (36) E (64) G (67)","expected":"C7","got":"C"}`
3. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 1ª inversión. 248 veces. Ejemplo: `{"phrase":"B063_00_01a","mode":"de punta a punta","label":"V","key":"c","notes":"B (47) D (50) G (55)","expected":"G","got":"G/1ª inversión"}`
4. **de punta a punta | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 200 veces. Ejemplo: `{"phrase":"B063_05_03c","mode":"de punta a punta","key":"c","got":"G major"}`
5. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 189 veces. Ejemplo: `{"phrase":"B063_06_01a","mode":"de punta a punta","label":"Vb","key":"c","notes":"B (59) D (62) G (67) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
6. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 2ª inversión. 166 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"I","key":"F","notes":"C (48) F (53) A (69)","expected":"F","got":"F/2ª inversión"}`
7. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado 1ª inversión, la app dio fundamental. 150 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"Vb","key":"F","notes":"C (48) E (52) F (53) C (60) F (65) G (67)","expected":"C/1ª inversión","got":"Cadd11"}`
8. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m). 146 veces. Ejemplo: `{"phrase":"B063_00_04d","mode":"de punta a punta","label":"V","key":"c","notes":"G (43) C (72) Eb (75)","expected":"G","got":"Cm/2ª inversión"}`
9. **de punta a punta | enarmonía (nota a nota)**: C# escrito Db. 142 veces. Ejemplo: `{"phrase":"B068_03_02b","label":"V7c/ii","key":"C","note":"C# (61)","app":"Db","appChord":"Am/2ª inversión"}`
10. **de punta a punta | enarmonía (nota a nota)**: G# escrito Ab. 139 veces. Ejemplo: `{"phrase":"B064_05_01a","label":"I","key":"F","note":"G# (68)","app":"Ab","appChord":"F"}`

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
