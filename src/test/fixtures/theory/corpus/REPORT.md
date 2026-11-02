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
| Acorde por tramo (raíz + calidad, acepta A o B; sin los tramos de calidad no determinable: power chord o una sola nota) | 75 % | 73.7 % | 68.4–78.7 % | no cumple | TAVERN, por tramo anotado |
| Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo) | 56 % | 53.3 % | 47.3–60.2 % | no cumple | TAVERN, de punta a punta |
| Inversión, dado el acorde correcto | ≥ 94 % | 94.7 % | 91.6–96.9 % | cumple | TAVERN, por tramo anotado |
| Tonalidad (tónica y modo) | 82 % | 80 % | 68.1–92.2 % | no cumple | TAVERN, por tramo anotado |
| Tónica, sin aceptar la relativa | 75 % | 70.5 % | 56.4–83.5 % | no cumple | Rock Corpus |
| Enarmonía (tramo con todas las notas bien) | 95 % | 96.7 % | 95.4–97.5 % | cumple | TAVERN, por tramo anotado |
| Modulación: canciones con cambio de tonalidad que la app informa | la mitad (50 %) | 0 % | 0–0 % | no cumple | Rock Corpus |

## Antes y después de las reglas que leen el tiempo y la melodía

«Antes» es la misma evaluación con los pasos sin el inicio y la duración de sus notas y sin las notas de la melodía, como los leía la app hasta el 2026-11-01; «después», con ellos (decisiones 8 y 11 de `THEORY.md`, y el contexto sin melodía de la decisión 12). La segmentación de la app (decisiones 9 y 10) y el costo del bajo por grado (decisión 12) son los mismos en los dos lados, así que esta tabla no mide cada etapa: las comparaciones de cada etapa, pareadas contra su base, están en `THEORY.md`. Δ en puntos, con su IC 95 % pareado: cada remuestreo toma las mismas obras en los dos lados. La regla se fijó mirando solo desarrollo; la prueba se miró una vez, al final.

| Medida | Desarrollo antes | Desarrollo después | Δ desarrollo | Prueba antes | Prueba después | Δ prueba |
|---|---|---|---|---|---|---|
| por tramo — acorde: raíz + calidad (acepta A o B) | 51.4 % | 71.2 % | 19.8 (17.2 a 22.8) | 49.4 % | 71.1 % | 21.7 (18 a 25.1) |
| por tramo — acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 52.8 % | 73.3 % | 20.5 (17.9 a 23.7) | 51.2 % | 73.7 % | 22.5 (18.4 a 25.6) |
| por tramo — acorde: nombre exacto, sin extensiones (acepta A o B) | 38.8 % | 53.3 % | 14.5 (12.2 a 17) | 35.6 % | 50.8 % | 15.2 (13.3 a 16.8) |
| por tramo — acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 97.1 % | 96.3 % | -0.8 (-1.2 a -0.5) | 95.8 % | 95.6 % | -0.2 (-1.7 a 0.8) |
| por tramo — tonalidad (tónica y modo) | 75 % | 80.6 % | 5.6 (3.5 a 7.8) | 72.4 % | 80 % | 7.6 (3.5 a 13) |
| por tramo — inversión (dado el acorde correcto) | 94.4 % | 95 % | 0.6 (-0.2 a 1.3) | 95 % | 94.7 % | -0.3 (-1.8 a 0.7) |
| por tramo — enarmonía (tramo con todas las notas bien) | 91.4 % | 96 % | 4.6 (3.5 a 5.7) | 91 % | 96.7 % | 5.7 (3 a 7.5) |
| de punta a punta — acorde: raíz + calidad (acepta A o B) | 52.6 % | 61.2 % | 8.6 (7.3 a 10) | 51.4 % | 59.5 % | 8.1 (6.3 a 9.5) |
| de punta a punta — acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 47.4 % | 55.1 % | 7.7 (6.5 a 9) | 46 % | 53.3 % | 7.3 (5.7 a 8.5) |
| de punta a punta — tonalidad (tónica y modo) | 77.7 % | 78.8 % | 1.1 (-0.1 a 2.6) | 71.7 % | 73.4 % | 1.7 (-0.3 a 3.7) |

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | 71.1 % (3970/5586), IC 95 % 67.2–76<br>71.2 % (11668/16398), IC 95 % 69.3–73 | 59.5 % (2976/5004), IC 95 % 53.4–68.2<br>61.2 % (9045/14785), IC 95 % 58.9–63.6 | excluida (circular) |
| Acorde, nombre exacto, sin extensiones (F7♭9 no cuenta como F7) | 50.8 % (2839/5586), IC 95 % 43.7–56.8<br>53.3 % (8735/16398), IC 95 % 50.2–56.1 | 49.7 % (2485/5004), IC 95 % 42.5–60.5<br>53 % (7841/14785), IC 95 % 50.2–55.9 | excluida (circular) |
| Acorde, sin los tramos de calidad no determinable (power chord o una sola nota con la raíz esperada) | 73.7 % (3970/5388), IC 95 % 68.4–78.7<br>73.3 % (11668/15909), IC 95 % 71.7–74.9 | 59.9 % (2976/4968), IC 95 % 53.6–68.7<br>62 % (9045/14579), IC 95 % 59.8–64.5 | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | 71.1 % (3970/5586), IC 95 % 67.2–76<br>71.2 % (11668/16398), IC 95 % 69.3–73 | 53.3 % (2976/5586), IC 95 % 47.3–60.2<br>55.1 % (9045/16404), IC 95 % 52.7–57.5 | excluida (circular) |
| Inversión (dado el acorde correcto) | 94.7 % (3760/3970), IC 95 % 91.6–96.9<br>95 % (11082/11668), IC 95 % 93.8–96 | 90.5 % (2693/2976), IC 95 % 86.8–94<br>90.8 % (8216/9045), IC 95 % 89.4–92.3 | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | 63 % (3518/5586), IC 95 % 52.7–77<br>68 % (11150/16398), IC 95 % 63.9–71.8 | 53.7 % (2689/5004), IC 95 % 45.3–67.7<br>60.8 % (8984/14785), IC 95 % 56.9–64.1 | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | 80 % (464/580), IC 95 % 68.1–92.2<br>80.6 % (1308/1622), IC 95 % 75.2–85.6 | 73.4 % (426/580), IC 95 % 61–86.7<br>78.8 % (1278/1622), IC 95 % 73.4–84 | solo la tónica: 70.5 % (55/78), IC 95 % 56.4–83.5<br>76.3 % (232/304), IC 95 % 69.7–82.4 |
| Enarmonía (tramo con todas las notas bien) | 96.7 % (5404/5586), IC 95 % 95.4–97.5<br>96 % (15739/16398), IC 95 % 95.2–96.7 | 97.6 % (4882/5004), IC 95 % 97.1–98.3<br>97.6 % (14428/14785), IC 95 % 96.8–98.2 | excluida (circular) |
| Cadencia | sin corpus | sin corpus | sin corpus |
| Modulación | sin dato: 5 frases con más de una tonalidad quedaron fuera | sin dato | 0 % (0/15), IC 95 % 0–0<br>0 % (0/46), IC 95 % 0–0 (la app no reporta cambios de tonalidad) |

## Cómo se midió

- **Por tramo anotado:** la app recibe las notas que suenan en cada tramo del analista (todas las que lo tocan, incluidas las de adorno) y la secuencia entera de tramos de la frase. Se mide solo la etiqueta de cada tramo.
- **De punta a punta:** la app recibe todas las notas de la frase y usa su propia segmentación (`harmonySegs`). Cada tramo del analista se compara con el acorde de la app que cubre al menos la mitad de ese tramo. Los acordes vecinos de la app con la misma lectura y el mismo bajo cuentan como uno solo, porque la app dio la misma armonía en varios ataques (definición de la medida desde el 2 nov 2026; la franja sigue mostrando cada ataque). Los tramos sin cobertura se cuentan aparte y, en la fila de la meta, como fallo.
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
| tonalidad (tónica y modo) | 2202 | 1772 | 80.5 % |
| tonalidad (solo la tónica) | 2202 | 1784 | 81 % |
| acorde: raíz (solo la lectura propia) | 21984 | 17619 | 80.1 % |
| acorde: raíz (acepta A o B) | 21984 | 17799 | 81 % |
| acorde: raíz + calidad (solo la lectura propia) | 21984 | 15248 | 69.4 % |
| acorde: raíz + calidad (acepta A o B) | 21984 | 15638 | 71.1 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 21984 | 11574 | 52.6 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 16110 | 12997 | 80.7 % |
| acorde: raíz correcta, calidad no determinable (power chord o una sola nota) | 21984 | 687 | 3.1 % |
| acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 21297 | 15638 | 73.4 % |
| inversión (cruda) | 21984 | 17336 | 78.9 % |
| inversión (dado el acorde correcto) | 15638 | 14842 | 94.9 % |
| grado (crudo) | 21984 | 14668 | 66.7 % |
| grado (dada la tonalidad correcta) | 17596 | 14439 | 82.1 % |
| enarmonía (nota a nota) | 137849 | 136748 | 99.2 % |
| enarmonía (tramo con todas las notas bien) | 21984 | 21143 | 96.2 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 7023 | 6751 | 96.1 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5874 | 2641 | 45 % |

## TAVERN, de punta a punta (todo el corpus)

La app produjo 31080 acordes para 22672 tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
| tonalidad (tónica y modo) | 2202 | 1704 | 77.4 % |
| tonalidad (solo la tónica) | 2202 | 1718 | 78 % |
| segmentación: cortes del analista que la app también corta (±48 ticks) | 20470 | 18150 | 88.7 % |
| segmentación: cortes de la app que el analista también corta (±48 ticks) | 28878 | 21144 | 73.2 % |
| tramo del analista cubierto por un acorde de la app (≥ la mitad) | 21990 | 19789 | 90 % |
| acorde: raíz (solo la lectura propia) | 19789 | 13732 | 69.4 % |
| acorde: raíz (acepta A o B) | 19789 | 13964 | 70.6 % |
| acorde: raíz + calidad (solo la lectura propia) | 19789 | 11615 | 58.7 % |
| acorde: raíz + calidad (acepta A o B) | 19789 | 12021 | 60.7 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 19789 | 10326 | 52.2 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 14499 | 9837 | 67.8 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 6898 | 5837 | 84.6 % |
| acorde: raíz correcta, calidad no determinable (power chord o una sola nota) | 19789 | 242 | 1.2 % |
| acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 19547 | 12021 | 61.5 % |
| inversión (cruda) | 19789 | 14317 | 72.3 % |
| inversión (dado el acorde correcto) | 12021 | 10909 | 90.7 % |
| grado (crudo) | 19789 | 11673 | 59 % |
| grado (dada la tonalidad correcta) | 15373 | 11208 | 72.9 % |
| enarmonía (nota a nota) | 81228 | 80531 | 99.1 % |
| enarmonía (tramo con todas las notas bien) | 19789 | 19310 | 97.6 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 21990 | 12021 | 54.7 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app, sin contar los de calidad no determinable | 21748 | 12021 | 55.3 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5290 | 2184 | 41.3 % |

## Rock Corpus (todo el corpus)

| Medida | n | aciertos | % |
|---|---|---|---|
| tónica (solo la lectura propia) | 382 | 284 | 74.3 % |
| tónica (acepta ambos analistas) | 382 | 287 | 75.1 % |
| tónica (o su relativa, suplementaria) | 382 | 308 | 80.6 % |
| tónica (o la alternativa que muestra la app, suplementaria) | 382 | 294 | 77 % |
| tónica por región de ≥ 4 acordes (la app recibe la región sola) | 589 | 444 | 75.4 % |
| modulación: de las canciones en que el corpus cambia de tonalidad, las que la app informa como cambio | 61 | 0 | 0 % |

Canciones: 198; análisis: 382; con cambio de tonalidad: 61 (60 con una región de 4 o más acordes).

## Los 10 errores más frecuentes (TAVERN, por tramo anotado, solo desarrollo)

Cada error se cuenta una sola vez, en la medida que le corresponde (acorde: raíz + calidad, inversión dado el acorde correcto, tonalidad, enarmonía nota a nota). Grado y «raíz sola» repiten errores de estas y no se listan.

1. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 393 veces. Ejemplo: `{"phrase":"B063_01_01a","mode":"por tramo","label":"Vb","key":"c","notes":"B (59) D (62) G (67) D (74) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
2. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene una sola clase de altura). 323 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (41) F (65)","expected":"F","got":"(sin acorde)"}`
3. **por tramo | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 2ª inversión. 208 veces. Ejemplo: `{"phrase":"B063_05_01a","mode":"por tramo","label":"i","key":"c","notes":"G (43) C (48) Eb (51) G (55) C (60) Eb (63) G (67) C (72) Eb (75) G (79) C (84)","expected":"Cm","got":"Cm/2ª inversión"}`
4. **por tramo | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 183 veces. Ejemplo: `{"phrase":"B063_06_03c","mode":"por tramo","key":"c","got":"G minor"}`
5. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 2 clases de altura). 176 veces. Ejemplo: `{"phrase":"B064_02_03c","mode":"por tramo","label":"Ib","key":"F","notes":"A (57) Bb (58) A (69)","expected":"F/1ª inversión","got":"(sin acorde)"}`
6. **por tramo | enarmonía (nota a nota)**: G# escrito Ab. 173 veces. Ejemplo: `{"phrase":"B065_05_02b","label":"viio/V","key":"D","note":"G# (68)","app":"Ab","appChord":"(sin acorde)"}`
7. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó 5. 165 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (53) C (60) F (65)","expected":"F","got":"F5"}`
8. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 3ª (m). 157 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"Vb","key":"F","notes":"E (52) G (67)","expected":"C/1ª inversión","got":"Em"}`
9. **por tramo | enarmonía (nota a nota)**: C# escrito Db. 155 veces. Ejemplo: `{"phrase":"B068_03_01a","label":"IV+","key":"C","note":"C# (61)","app":"Db","appChord":"C♯maj7♯5/1ª inversión"}`
10. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj9. 131 veces. Ejemplo: `{"phrase":"B065_01_01a","mode":"por tramo","label":"IVb","key":"D","notes":"B (47) D (50) F# (54) G (55) A (57) D (62) F# (66)","expected":"G/1ª inversión","got":"Gmaj9/1ª inversión"}`

## Los 10 errores más frecuentes (TAVERN, de punta a punta, solo desarrollo)

1. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 3ª (m). 411 veces. Ejemplo: `{"phrase":"B063_02_01a","mode":"de punta a punta","label":"Vb","key":"c","notes":"B (59) D (62)","expected":"G/1ª inversión","got":"Bm"}`
2. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado 7, la app leyó mayor. 366 veces. Ejemplo: `{"phrase":"B063_09_01a","mode":"de punta a punta","label":"V7","key":"C","notes":"G (43) B (47) D (50) G (55)","expected":"G7","got":"G"}`
3. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 1ª inversión. 268 veces. Ejemplo: `{"phrase":"B063_00_01a","mode":"de punta a punta","label":"V","key":"c","notes":"B (47) D (50) G (55)","expected":"G","got":"G/1ª inversión"}`
4. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 185 veces. Ejemplo: `{"phrase":"B063_06_01a","mode":"de punta a punta","label":"Vb","key":"c","notes":"B (59) D (62) G (67) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
5. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 2ª inversión. 180 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"I","key":"F","notes":"C (48) F (53) A (69)","expected":"F","got":"F/2ª inversión"}`
6. **de punta a punta | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 170 veces. Ejemplo: `{"phrase":"B063_05_03c","mode":"de punta a punta","key":"c","got":"G major"}`
7. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m). 167 veces. Ejemplo: `{"phrase":"B063_00_04d","mode":"de punta a punta","label":"V","key":"c","notes":"G (43) C (72) Eb (75)","expected":"G","got":"Cm/2ª inversión"}`
8. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado 1ª inversión, la app dio fundamental. 156 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"Vb","key":"F","notes":"C (48) E (52) F (53) C (60) F (65) G (67)","expected":"C/1ª inversión","got":"Cadd11"}`
9. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (mayor). 139 veces. Ejemplo: `{"phrase":"B063_00_02b","mode":"de punta a punta","label":"V/III","key":"c","notes":"Bb (46) Eb (75) G (79)","expected":"B♭","got":"E♭/2ª inversión"}`
10. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó 5. 132 veces. Ejemplo: `{"phrase":"B064_00_02b","mode":"de punta a punta","label":"IV/V","key":"F","notes":"F (53) C (72)","expected":"F","got":"F5"}`

## Los errores más frecuentes (Rock Corpus, tónica, solo desarrollo)

1. **tónica (acepta ambos analistas)**: la app leyó la tónica A y el corpus E (una quinta abajo). 12 veces. Ejemplo: `{"song":"bitter_sweet_symphony","analyst":"dt","got":"A major","expected":"E","chords":"I v7 IV I v7 IV I v7"}`
2. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en E, la app leyó A. 12 veces. Ejemplo: `{"song":"bitter_sweet_symphony","analyst":"dt","expected":"E","got":"A major"}`
3. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en A, la app leyó D. 11 veces. Ejemplo: `{"song":"god_save_the_queen","analyst":"dt","expected":"A","got":"D major"}`
4. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en C, la app leyó F. 9 veces. Ejemplo: `{"song":"i_only_have_eyes_for_you","analyst":"dt","expected":"C","got":"F major"}`
5. **tónica por región de ≥ 4 acordes (la app recibe la región sola)**: región en A, la app leyó G. 9 veces. Ejemplo: `{"song":"one","analyst":"dt","expected":"A","got":"G major"}`

## Cómo leer las cifras

- Las frases se cuentan una vez por anotador (A y B), así que `tonalidad` tiene dos filas por frase con el mismo material; las medidas por tramo usan la segmentación de cada anotador.
- Las medidas de punta a punta (acorde, inversión, grado, enarmonía) se calculan solo sobre los tramos del analista que la app cubre con un acorde (≥ la mitad del tramo); la fila «contando como fallo» las pone contra todos. Por eso la enarmonía de punta a punta sale más alta: los tramos sin acorde de la app, que escriben las notas por defecto, no entran.
- El grado de la app es la raíz del acorde contra la tónica que detecta: no es independiente de acorde y tonalidad.
- El control «notas exactamente las del acorde» comprueba la conversión: si falla ahí, el problema sería de las etiquetas o del conversor, no del análisis.
- Las tablas «todo el corpus» mezclan prueba y desarrollo; para decidir arreglos se usa el desarrollo, y las metas se miden en la prueba.
