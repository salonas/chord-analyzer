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
| Acorde por tramo (raíz + calidad, acepta A o B; sin los tramos de calidad no determinable: power chord o una sola nota) | 75 % | 73.6 % | 68.3–78.7 % | no cumple | TAVERN, por tramo anotado |
| Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo) | 60 % | 53.3 % | 47.3–60.2 % | no cumple | TAVERN, de punta a punta |
| Inversión, dado el acorde correcto | ≥ 94 % | 94.8 % | 91.8–96.9 % | cumple | TAVERN, por tramo anotado |
| Tonalidad (tónica y modo) | 85 % | 79 % | 67–91.5 % | no cumple | TAVERN, por tramo anotado |
| Tónica, sin aceptar la relativa | 82 % | 69.2 % | 55.1–82.3 % | no cumple | Rock Corpus |
| Enarmonía (tramo con todas las notas bien) | 95 % | 90.9 % | 87.9–94.5 % | no cumple | TAVERN, por tramo anotado |
| Modulación: canciones con cambio de tonalidad que la app informa | la mitad (50 %) | 0 % | 0–0 % | no cumple | Rock Corpus |

## Antes y después de las reglas que leen el tiempo y la melodía

«Antes» es la misma evaluación con los pasos sin el inicio y la duración de sus notas y sin las notas de la melodía, como los leía la app hasta el 2026-11-01; «después», con ellos (decisiones 8 y 11 de `THEORY.md`, y el contexto sin melodía de la decisión 12). La segmentación de la app (decisiones 9 y 10) y el costo del bajo por grado (decisión 12) son los mismos en los dos lados, así que esta tabla no mide cada etapa: las comparaciones de cada etapa, pareadas contra su base, están en `THEORY.md`. Δ en puntos, con su IC 95 % pareado: cada remuestreo toma las mismas obras en los dos lados. La regla se fijó mirando solo desarrollo; la prueba se miró una vez, al final.

| Medida | Desarrollo antes | Desarrollo después | Δ desarrollo | Prueba antes | Prueba después | Δ prueba |
|---|---|---|---|---|---|---|
| por tramo — acorde: raíz + calidad (acepta A o B) | 51.4 % | 71.2 % | 19.8 (17.2 a 22.9) | 49.4 % | 71 % | 21.6 (18 a 25) |
| por tramo — acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 52.8 % | 73.3 % | 20.5 (17.8 a 23.7) | 51.2 % | 73.6 % | 22.4 (18.4 a 25.5) |
| por tramo — acorde: nombre exacto, sin extensiones (acepta A o B) | 38.8 % | 53.3 % | 14.5 (12.2 a 17) | 35.6 % | 50.8 % | 15.2 (13.1 a 16.8) |
| por tramo — acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 97.1 % | 96.3 % | -0.8 (-1.2 a -0.5) | 95.8 % | 95.6 % | -0.2 (-1.7 a 0.8) |
| por tramo — tonalidad (tónica y modo) | 74.2 % | 78.4 % | 4.2 (1.9 a 6.7) | 72.6 % | 79 % | 6.4 (2.6 a 11.4) |
| por tramo — inversión (dado el acorde correcto) | 94.4 % | 95 % | 0.6 (-0.1 a 1.3) | 95 % | 94.8 % | -0.2 (-1.5 a 0.7) |
| por tramo — enarmonía (tramo con todas las notas bien) | 91.5 % | 90.9 % | -0.6 (-1 a -0.1) | 91 % | 90.9 % | -0.1 (-1.2 a 1.8) |
| de punta a punta — acorde: raíz + calidad (acepta A o B) | 52.6 % | 61.2 % | 8.6 (7.3 a 9.9) | 51.4 % | 59.5 % | 8.1 (6.3 a 9.5) |
| de punta a punta — acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 47.4 % | 55.1 % | 7.7 (6.5 a 9) | 46 % | 53.3 % | 7.3 (5.7 a 8.5) |
| de punta a punta — tonalidad (tónica y modo) | 75.3 % | 76.1 % | 0.8 (-1.3 a 2.7) | 69.3 % | 71.7 % | 2.4 (-0.3 a 5.8) |

## Resumen por categoría

| Categoría | TAVERN, por tramo anotado | TAVERN, de punta a punta | Rock Corpus |
|---|---|---|---|
| Acorde (raíz + calidad, acepta A o B) | 71 % (3966/5586), IC 95 % 67–76<br>71.2 % (11668/16398), IC 95 % 69.2–73 | 59.5 % (2976/5004), IC 95 % 53.4–68.2<br>61.2 % (9043/14785), IC 95 % 58.9–63.6 | excluida (circular) |
| Acorde, nombre exacto, sin extensiones (F7♭9 no cuenta como F7) | 50.8 % (2835/5586), IC 95 % 43.5–56.8<br>53.3 % (8737/16398), IC 95 % 50.2–56.1 | 49.7 % (2485/5004), IC 95 % 42.5–60.5<br>53 % (7839/14785), IC 95 % 50.2–55.9 | excluida (circular) |
| Acorde, sin los tramos de calidad no determinable (power chord o una sola nota con la raíz esperada) | 73.6 % (3966/5388), IC 95 % 68.3–78.7<br>73.3 % (11668/15909), IC 95 % 71.7–74.9 | 59.9 % (2976/4968), IC 95 % 53.6–68.7<br>62 % (9043/14579), IC 95 % 59.8–64.5 | excluida (circular) |
| Acorde, contando como fallo los tramos que la app no cubre | 71 % (3966/5586), IC 95 % 67–76<br>71.2 % (11668/16398), IC 95 % 69.2–73 | 53.3 % (2976/5586), IC 95 % 47.3–60.2<br>55.1 % (9043/16404), IC 95 % 52.6–57.5 | excluida (circular) |
| Inversión (dado el acorde correcto) | 94.8 % (3760/3966), IC 95 % 91.8–96.9<br>95 % (11085/11668), IC 95 % 93.8–96 | 90.5 % (2693/2976), IC 95 % 86.8–94<br>90.8 % (8214/9043), IC 95 % 89.4–92.3 | excluida (circular) |
| Grado (crudo; deriva de la raíz y la tonalidad) | 61.1 % (3414/5586), IC 95 % 51.3–74.3<br>65.8 % (10798/16398), IC 95 % 61.5–69.8 | 52.2 % (2610/5004), IC 95 % 42.4–67.5<br>58.6 % (8668/14785), IC 95 % 54.5–62.2 | excluida (circular) |
| Función | no comparable (el corpus etiqueta a nivel de frase, modelo de Laitz) | no comparable | no tiene |
| Tonalidad (tónica y modo) | 79 % (458/580), IC 95 % 67–91.5<br>78.4 % (1271/1622), IC 95 % 72.8–83.2 | 71.7 % (416/580), IC 95 % 57.9–86.6<br>76.1 % (1234/1622), IC 95 % 70.4–81.7 | solo la tónica: 69.2 % (54/78), IC 95 % 55.1–82.3<br>73 % (222/304), IC 95 % 66.4–79.4 |
| Enarmonía (tramo con todas las notas bien) | 90.9 % (5079/5586), IC 95 % 87.9–94.5<br>90.9 % (14912/16398), IC 95 % 89.2–92.5 | 96.3 % (4820/5004), IC 95 % 95.3–97.4<br>96.2 % (14224/14785), IC 95 % 95.4–96.9 | excluida (circular) |
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
| tonalidad (tónica y modo) | 2202 | 1729 | 78.5 % |
| tonalidad (solo la tónica) | 2202 | 1737 | 78.9 % |
| acorde: raíz (solo la lectura propia) | 21984 | 17617 | 80.1 % |
| acorde: raíz (acepta A o B) | 21984 | 17797 | 81 % |
| acorde: raíz + calidad (solo la lectura propia) | 21984 | 15244 | 69.3 % |
| acorde: raíz + calidad (acepta A o B) | 21984 | 15634 | 71.1 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 21984 | 11572 | 52.6 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 16110 | 12996 | 80.7 % |
| acorde: raíz correcta, calidad no determinable (power chord o una sola nota) | 21984 | 687 | 3.1 % |
| acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 21297 | 15634 | 73.4 % |
| inversión (cruda) | 21984 | 17341 | 78.9 % |
| inversión (dado el acorde correcto) | 15634 | 14845 | 95 % |
| grado (crudo) | 21984 | 14212 | 64.6 % |
| grado (dada la tonalidad correcta) | 17082 | 13985 | 81.9 % |
| enarmonía (nota a nota) | 137849 | 135275 | 98.1 % |
| enarmonía (tramo con todas las notas bien) | 21984 | 19991 | 90.9 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 7023 | 6751 | 96.1 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5874 | 2638 | 44.9 % |

## TAVERN, de punta a punta (todo el corpus)

La app produjo 31080 acordes para 22672 tramos de analista (suma sobre frases y anotadores).

| Medida | n | aciertos | % |
|---|---|---|---|
| tonalidad (tónica y modo) | 2202 | 1650 | 74.9 % |
| tonalidad (solo la tónica) | 2202 | 1662 | 75.5 % |
| segmentación: cortes del analista que la app también corta (±48 ticks) | 20470 | 18150 | 88.7 % |
| segmentación: cortes de la app que el analista también corta (±48 ticks) | 28878 | 21144 | 73.2 % |
| tramo del analista cubierto por un acorde de la app (≥ la mitad) | 21990 | 19789 | 90 % |
| acorde: raíz (solo la lectura propia) | 19789 | 13728 | 69.4 % |
| acorde: raíz (acepta A o B) | 19789 | 13960 | 70.5 % |
| acorde: raíz + calidad (solo la lectura propia) | 19789 | 11613 | 58.7 % |
| acorde: raíz + calidad (acepta A o B) | 19789 | 12019 | 60.7 % |
| acorde: nombre exacto, sin extensiones (acepta A o B) | 19789 | 10324 | 52.2 % |
| acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando | 14499 | 9835 | 67.8 % |
| acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control) | 6898 | 5837 | 84.6 % |
| acorde: raíz correcta, calidad no determinable (power chord o una sola nota) | 19789 | 242 | 1.2 % |
| acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable | 19547 | 12019 | 61.5 % |
| inversión (cruda) | 19789 | 14313 | 72.3 % |
| inversión (dado el acorde correcto) | 12019 | 10907 | 90.7 % |
| grado (crudo) | 19789 | 11278 | 57 % |
| grado (dada la tonalidad correcta) | 14854 | 10806 | 72.7 % |
| enarmonía (nota a nota) | 81228 | 80239 | 98.8 % |
| enarmonía (tramo con todas las notas bien) | 19789 | 19044 | 96.2 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app | 21990 | 12019 | 54.7 % |
| acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app, sin contar los de calidad no determinable | 21748 | 12019 | 55.3 % |
| acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde | 5290 | 2184 | 41.3 % |

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

1. **por tramo | enarmonía (nota a nota)**: G# escrito Ab. 562 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"G# (68)","app":"Ab","appChord":"C6"}`
2. **por tramo | enarmonía (nota a nota)**: C# escrito Db. 517 veces. Ejemplo: `{"phrase":"B063_02_01a","label":"V7b","key":"c","note":"C# (73)","app":"Db","appChord":"G/1ª inversión"}`
3. **por tramo | enarmonía (nota a nota)**: D# escrito Eb. 412 veces. Ejemplo: `{"phrase":"B063_09_02b","label":"IV/V","key":"C","note":"D# (75)","app":"Eb","appChord":"C6"}`
4. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 393 veces. Ejemplo: `{"phrase":"B063_01_01a","mode":"por tramo","label":"Vb","key":"c","notes":"B (59) D (62) G (67) D (74) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
5. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene una sola clase de altura). 323 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (41) F (65)","expected":"F","got":"(sin acorde)"}`
6. **por tramo | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 2ª inversión. 208 veces. Ejemplo: `{"phrase":"B063_05_01a","mode":"por tramo","label":"i","key":"c","notes":"G (43) C (48) Eb (51) G (55) C (60) Eb (63) G (67) C (72) Eb (75) G (79) C (84)","expected":"Cm","got":"Cm/2ª inversión"}`
7. **por tramo | enarmonía (nota a nota)**: A# escrito Bb. 205 veces. Ejemplo: `{"phrase":"B063_03_01a","label":"Vb","key":"c","note":"A# (58)","app":"Bb","appChord":"Gmaj7/1ª inversión"}`
8. **por tramo | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 202 veces. Ejemplo: `{"phrase":"B063_06_03c","mode":"por tramo","key":"c","got":"G minor"}`
9. **por tramo | acorde: raíz + calidad (acepta A o B)**: la app no leyó acorde (el tramo tiene 2 clases de altura). 176 veces. Ejemplo: `{"phrase":"B064_02_03c","mode":"por tramo","label":"Ib","key":"F","notes":"A (57) Bb (58) A (69)","expected":"F/1ª inversión","got":"(sin acorde)"}`
10. **por tramo | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó 5. 165 veces. Ejemplo: `{"phrase":"B064_00_01a","mode":"por tramo","label":"I","key":"F","notes":"F (53) C (60) F (65)","expected":"F","got":"F5"}`

## Los 10 errores más frecuentes (TAVERN, de punta a punta, solo desarrollo)

1. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en su 3ª (m). 413 veces. Ejemplo: `{"phrase":"B063_02_01a","mode":"de punta a punta","label":"Vb","key":"c","notes":"B (59) D (62)","expected":"G/1ª inversión","got":"Bm"}`
2. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado 7, la app leyó mayor. 366 veces. Ejemplo: `{"phrase":"B063_09_01a","mode":"de punta a punta","label":"V7","key":"C","notes":"G (43) B (47) D (50) G (55)","expected":"G7","got":"G"}`
3. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 1ª inversión. 268 veces. Ejemplo: `{"phrase":"B063_00_01a","mode":"de punta a punta","label":"V","key":"c","notes":"B (47) D (50) G (55)","expected":"G","got":"G/1ª inversión"}`
4. **de punta a punta | tonalidad (tónica y modo)**: se leyó la tonalidad de la dominante. 196 veces. Ejemplo: `{"phrase":"B063_05_03c","mode":"de punta a punta","key":"c","got":"G major"}`
5. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz bien; esperado mayor, la app leyó maj7. 185 veces. Ejemplo: `{"phrase":"B063_06_01a","mode":"de punta a punta","label":"Vb","key":"c","notes":"B (59) D (62) G (67) F# (78) G (79)","expected":"G/1ª inversión","got":"Gmaj7/1ª inversión"}`
6. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado fundamental, la app dio 2ª inversión. 180 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"I","key":"F","notes":"C (48) F (53) A (69)","expected":"F","got":"F/2ª inversión"}`
7. **de punta a punta | acorde: raíz + calidad (acepta A o B)**: raíz equivocada: mayor leído con raíz en una nota ajena al acorde (m). 167 veces. Ejemplo: `{"phrase":"B063_00_04d","mode":"de punta a punta","label":"V","key":"c","notes":"G (43) C (72) Eb (75)","expected":"G","got":"Cm/2ª inversión"}`
8. **de punta a punta | inversión (dado el acorde correcto)**: con el acorde bien: esperado 1ª inversión, la app dio fundamental. 156 veces. Ejemplo: `{"phrase":"B064_02_01a","mode":"de punta a punta","label":"Vb","key":"F","notes":"C (48) E (52) F (53) C (60) F (65) G (67)","expected":"C/1ª inversión","got":"Cadd11"}`
9. **de punta a punta | enarmonía (nota a nota)**: C# escrito Db. 151 veces. Ejemplo: `{"phrase":"B068_03_02b","label":"V7c/ii","key":"C","note":"C# (61)","app":"Db","appChord":"Am/2ª inversión"}`
10. **de punta a punta | enarmonía (nota a nota)**: G# escrito Ab. 143 veces. Ejemplo: `{"phrase":"B064_05_01a","label":"I","key":"F","note":"G# (68)","app":"Ab","appChord":"F"}`

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
