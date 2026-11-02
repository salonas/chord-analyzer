# Teoría armónica: decisiones y estado

El informe completo de fallos (`teoria-fallos.md`, revisión del 1 nov 2026 sobre `988d673`) no está en el repositorio. Este archivo guarda solo lo que se decidió y el estado del trabajo. La sonda que mide los casos es `src/test/theory-cases.js`; su regresión, `src/theory.test.js`.

## Decisiones

Resueltas por el usuario el 1 nov 2026. Cada una fija una regla; si un caso de prueba la contradice, se avisa, no se cambia en silencio.

1. **Grados en menor: con ♭.** ♭III, ♭VI y ♭VII (relativo a la mayor). Los casos siguen aceptando ambas escrituras.
2. **Melodía en un bloque.** La voz más aguda de un bloque es melodía solo si se cumplen las tres condiciones:
   - está a más de una octava de la siguiente voz;
   - debajo quedan al menos 3 notas que forman acorde;
   - el pattern tiene 2 o más bloques donde la voz aguda cambia de nota.

   Casos que deben seguir leyéndose como acorde: pad abierto (C2 G2 E4) y A24 (C2 E5 G6).
3. **Modos: etiqueta sobre mayor o menor, no tonalidad nueva.** `detectKey` sigue eligiendo tónica y mayor o menor. Para progresiones sin dominante con sensible, la tónica es el acorde que empieza, termina o más dura. Con la tónica fijada, el modo se etiqueta por su nota característica:
   - dórico: 6ª mayor en menor;
   - frigio: 2ª menor;
   - lidio: 4ª aumentada;
   - mixolidio: 7ª menor.

   Los grados siguen relativos a la mayor, con ♭. Hecho (ver Estado). Casos: F08, F09, F10, uno lidio (D–E) y un ii–V–I en Do que debe seguir siendo Do mayor, no Re dórico.
4. **Funciones de iii y vi: ambos tónica.** El ♭VI en menor queda como subdominante (`harmonicFunction`, grado 8 en menor).
5. **G12 (C – D7 – G) es ambiguo.** Se acepta Sol mayor con cadencia auténtica o Do mayor con semicadencia; la app muestra la otra lectura como alternativa.

6. **Inversiones con extensiones: palabras, no barra.** Decidido el 1 nov 2026 (`inversiones-tension-ui.md`, sección 1). El cifrado de bajo cifrado (⁶, ⁶₄, ⁶₅, ⁴₃, ⁴₂) queda para tríadas y séptimas. Los acordes con extensiones, add, sus, 6 o power chord llevan el grado y las palabras de `inversionText`: «V9 en 1ª inversión», «Imaj9 con bajo en la 9». La barra «/» se reserva a las funciones secundarias, que combinan las dos cosas: V⁶/V, V⁶₅/vi, vii°⁶₅/V. La hoja y el texto exportado muestran la forma completa (`text`); la franja de acordes, solo el grado (`short`). La raíz de un dim7 la fija la resolución: la nota un semitono bajo la raíz del acorde siguiente.

7. **Tensión: base + contexto, sigue como estimación.** Decidido el 1 nov 2026 (`inversiones-tension-ui.md`, sección 2). La base no cambia (mitad función, mitad disonancia). Se suma un ajuste que depende del acorde anterior, siguiendo a Meyer (1956): **llegada** −0,15 (el anterior es D y este es su destino esperado y no es D), **sorpresa** +0,15 (el anterior es D y este ni es su destino ni es D) y **espera** +0,05 por cada D seguido, hasta +0,10. Las tres reglas solo aplican a dominantes con sensible: V, V7, vii°, las secundarias (V/x, vii°/x), el 6/4 cadencial y el sustituto tritonal. El ♭VII de la menor natural y el v menor mantienen su función D, pero no reciben ajuste de contexto ni lo dan a lo que les sigue (decisión del 1 nov 2026). El total se recorta a 0–1. Los pesos son una elección razonada, no una medición: la tensión sigue rotulada «estimada» en todas partes.

8. **Notas de adorno por duración.** Decidido el 1 nov 2026 y ajustado el 2 nov 2026, mirando solo el desarrollo de TAVERN. Un paso que trae el inicio y la duración de sus notas (`a`, `evs`) puede dejar fuera del nombre hasta 5 clases de altura, nunca el bajo. Cada clase pesa su parte del tiempo que suenan las notas del paso. Una lectura cuesta los puntos de su tipo, 3 por cada décima de peso que deja fuera y 2 por cada extensión (7ª o más) que pesa menos de 15 %; gana la de menor costo. Sin `evs`, el paso se lee como antes, y un acorde que el usuario nombró conserva su nombre. Pasan `evs` la franja de acordes (`segStep`), el texto exportado y los roles de melodía (`stepTiming`); el panel del acorde activo y la hoja de análisis dicen «Adorno: B3 (dura poco; no cambia el nombre del acorde)». En «Posibles nombres», la lectura de la regla va primero, con la etiqueta «Adorno: B3», y las lecturas con todas las notas (Cmaj7) siguen debajo como alternativas: la regla ordena, no quita nombres. Los pesos extra por tiempo (×1,5) y por bajo (×2) se probaron y se quitaron el 2 nov 2026: mismo total en desarrollo (67,4 % contra 67,6 %) y mejor control con notas exactas (96,9 % contra 94,8 %). Casos: O01–O05, J33 y J34 en la sonda; la lista de nombres, en `src/audit.test.js`.

9. **Acompañamiento quebrado bajo la melodía.** Decidido el 2 nov 2026, mirando solo el desarrollo de TAVERN. Donde la app no tiene acorde (antes del primero, o en todo el pattern), después del arpegio de una sola voz (`arpeggioChords`) y de los acordes atacados, `splitHarmony` lee el tramo tiempo a tiempo con todas las notas que suenan; la duración de las notas separa adornos de notas del acorde (decisión 8). Un tramo forma acorde solo si tiene 3 o más clases de altura y una nota suena dentro de otra de distinta clase (una voz sostiene mientras otra se mueve, o las dos empiezan y terminan juntas): una melodía o una escala solas, también ligadas, y dos notas cortas siguen siendo notas. Un tiempo que no llega se suma al acorde anterior si sus notas son de ese acorde (la otra mitad de una figura Alberti); si no, junta los tiempos siguientes, hasta un compás. Los vecinos con la misma lectura se juntan. Las notas conservan su rol de melodía; los `ids` del acorde (borrar, reemplazar, mover) son las notas bajo la voz superior, así que borrar el acorde deja la melodía. `gridChords` en `src/harmony.js`; casos J35 (Alberti con melodía) y J36 (bajo en octavas con melodía en corcheas). Un bajo en octavas con una sola nota de melodía por tiempo (2 clases de altura) sigue sin acorde.

Sin decidir y sin cambios: nada de lo de `inversiones-tension-ui.md` queda sin decidir; los pesos de la tensión se medirán cuando exista el corpus externo.

## Estado

Rama `fix/theory-spelling-and-keys` (C1 deletreo por letras, C2 nombre de tonalidad, C3 detección de tonalidad): 392 de 424 comprobaciones (92 %), contra 360 de 418 al inicio; las 6 nuevas son el caso J19. Ninguna comprobación que pasaba dejó de pasar. Pendiente: C4 y C8, C7 y C11, C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-chromatic-and-functions`, sobre la anterior (C4 y C8: dominantes y sensibles secundarias con destino diatónico, sextas aumentadas, dim7 de nota común, I7 del blues, 6/4 cadencial, sustituto tritonal): 406 de 424 (96 %). Pendiente: C7 y C11, C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-cadences-and-alt`, sobre la anterior (C7 y C11: la cadencia escribe los grados como son los acordes, V → i en menor; v → i es modal y no auténtica; el texto exportado da la tonalidad alternativa, «Sol mayor (o Do mayor)»): 409 de 424 (96 %). Pendiente: C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-melody-roles`, desde `main` con #12–#14 fusionados (C5 y C6): 429 de 437 (98 %). Reglas nuevas en `src/text.js` y `src/harmony.js`:

- Roles de melodía: la anticipación se lee antes que la escapada (J05); la doble bordadura marca sus dos notas (J08); el retardo se agrega al rol en la misma columna, «nota del acorde · retardo 4–3 → E4» (J07). Casos en contra: J20 (nota retenida que es del acorde nuevo) y J21 (disonancia retenida que sube).
- Melodía en bloque con la decisión 2 (J11). J12 es un solo bloque y queda «Cadd9» sin melodía. Casos en contra: J22 (pad abierto C2 G2 E4), J23 (A24, C2 E5 G6) y J24 (voz aguda a una octava justa).
- Arpegios: una sola voz sin notas simultáneas se agrupa por medio compás o por compás; cada grupo debe moverse solo por saltos y formar acorde de 3 o más clases de altura (J13, J28). Casos en contra: J25 y J26 (escalas) y J27 (melodía sola). J13 acepta ahora «G/B», porque B3 es el bajo del segundo compás.

Rama `feat/mode-labels`, desde `main` con #16 fusionado (decisión 3, modos como etiqueta): 459 de 467 (98 %); las 30 comprobaciones nuevas pasan y no cae ninguna. Reglas en `src/analysis.js`:

- Tónica sin dominante que resuelva (`plainTonic`): si ningún V o vii° va seguido de su destino, el acorde que abre y cierra, si no el que más dura, si no el primero, suma 3 puntos a su tonalidad. Es un desempate, no un veredicto: como veredicto rompía H05, F18 y D22 (G Am F C acababa en Sol). `detectKey` no cambia y su ranking tampoco; el peso se aplica en `analyzeProgression`, y la alternativa sigue saliendo de los puntajes medidos. La duración llega en `dur` desde `segStep` y desde `harmonyLines`; sin ella, todos los acordes duran lo mismo. Efecto visible: en dos acordes sin dominante (C → G) gana el primero, «Do mayor (o Sol mayor)» y semicadencia en vez de «Sol mayor» y plagal (K02, J05, J18 y los J que usan C → G).
- Etiqueta de modo (`modeOf`), solo con la tónica fijada: dórico (6ª mayor, sin 6ª menor), frigio (2ª menor, sin 2ª mayor), lidio (4ª aumentada, sin 4ª justa), mixolidio (7ª menor, sin sensible), y además todas las notas dentro de la escala del modo (filtro añadido a la decisión 3 el 1 nov 2026, a petición del usuario, por D16). Si coinciden dos, ninguna. No se etiqueta si un V o vii° resuelve a la tónica: ahí el ♯4 o el ♭7 son de una dominante secundaria (C D G C no es lidio).
- Con modo, `expFor` cambia los grados diatónicos de `romanFor` y de `chromaticReading` (Dm G C Dm: i IV ♭VII i), y `keySpell` da a la nota del modo su letra (B♭ frigio en La).
- Formato: `keyText` da «D menor (dórico)» y «D menor (dórico; o C mayor)». La sonda lee la tonalidad hasta «(» y comprueba la etiqueta aparte (`modo:*`).
- Casos nuevos: F19 (lidio), F20 (grados), F21–F25 y F29 (en contra), F26–F28 (tónica sin dominante), J29 (texto exportado) y los checks `modo` de F08–F10.

Con el filtro de escala, D16 (C – A♭ – B♭ – C) y el blues K03 (tiene E♭) quedan sin etiqueta (F29 lo fija). El caso «abre y cierra» no tiene caso propio que dependa de la regla, porque la puntuación de `detectKey` ya lo resuelve.

Rama `feat/inversion-notation`, desde `main` con #17 fusionado (decisión 6, paso 1 de `inversiones-tension-ui.md`): 502 de 510 (98 %); las 42 comprobaciones nuevas (V01–V13 y el chequeo `V-barra`) pasan, y no cae ninguna. Reglas en `src/analysis.js`:

- `romanFor` devuelve `text` (completo), `short` (solo el grado), `fig`, `kind` y `words`. `invWords` arma las palabras: «en 1ª inversión» si el bajo es la 3ª, 5ª o 7ª, «con bajo en la 9» en cualquier otro caso.
- `chromaticReading` conserva la inversión en las secundarias: la cifra reemplaza el 7 de una dominante séptima (V⁶₅/vi); con extensiones va en palabras después del destino (V9/V en 1ª inversión).
- Dim7 sin raíz clara: si ninguna nota propia resuelve un semitono arriba pero otra de las cuatro sí, esa es la raíz (vii°⁶₅/V para A C E♭ F♯ antes de G). El acorde se deletrea desde esa raíz con `respell`; su etiqueta de acorde («Adim7») no cambia.
- Chequeo `V-barra`: ningún grado de la sonda ni de los textos lleva «/» salvo una función secundaria. `analysis.test.js` cambia `V7♭9/3` por `V7♭9 en 1ª inversión`; J17 cambia `V11/11` por «V11 con bajo en la 11» (el texto de la sonda).
- La franja usa `short` (`main.js`); el marcador de grado del `.mid` (`midi.js`) sigue usando `text`.

Rama `feat/appoggiatura-roles`, sobre la anterior (fila 23 de la auditoría): la pestaña Expresión deja su detección propia de apoyaturas (`nct`) y usa los roles del texto exportado. La clasificación vive ahora en `src/roles.js` (`melodyKind`, `melodyKinds`, `against`); `text.js` la escribe con palabras y `expression.js` la convierte en velocity:

- apoyatura: +1 × el control «Apoyaturas», y su resolución −0,5; paso, bordadura (simple o doble), escapada y anticipación: −0,3. Antes bastaba cualquier nota fuera del acorde que cayera en un tiempo (`n.s%T===0`); la ayuda decía «en tiempo fuerte» y no era cierto.
- Efecto visible: J01 (E4 F4 G4 sobre C). El texto dice «paso» para F4; Expresión lo contaba como apoyatura (+1 en F4, −0,5 en G4, 2 notas). Ahora F4 baja 30 % y G4 no cambia (1 nota). Los fixtures de `expression.json` no se mueven (ninguno tiene notas fuera del acorde en la melodía); los casos nuevos están en `expression.test.js`.
- Solo las notas que `splitHarmony` lee como melodía reciben rol; antes lo recibía la voz más aguda de cada ataque.
- La ayuda de Apoyaturas (`index.html`, `src/i18n.js`) describe la regla nueva. Sin cambios en la sonda: 502 de 510.

Rama `feat/tension-context`, desde `main` con los pasos 1 y 2 fusionados (decisión 7, paso 3): 534 de 542 (98 %); las 32 comprobaciones nuevas (T01–T05, T09–T11, T06, T08 y la tonalidad de sus progresiones) pasan y no cae ninguna. Reglas en `src/analysis.js`:

- `analyzeProgression` devuelve `tenBase` (la base de siempre), `tenCtx` (`{rule, val}` por acorde, o `null`) y `ten` (el total). `contextTension` aplica las tres reglas, y `leadingD` decide qué acordes D llevan sensible (el ♭VII de la menor y el v menor no); `expectedStep` da el destino de un acorde D: V y V/x una 4ª arriba, vii° un semitono arriba, el 6/4 cadencial a V (+7), el sustituto tritonal un semitono abajo. La raíz de un dim7 secundario es la de su resolución (`ro.rootPc`), no el bajo (T09).
- Las constantes (`FN_TENSION`, `DISS`, `CTX`) alimentan el cálculo y el párrafo «Tensión armónica» de la pestaña Expresión (`tensionHelp`, escrito desde `fillEx`), así que no se desincronizan.
- Hoja: el tooltip muestra «base 0,13 + sorpresa 0,15 = 0,28» solo cuando hay contexto, y la ayuda dice «tensión estimada». Texto exportado: la cabecera de la columna de grado pasa a «tensión estimada 0–1: base (función y disonancia) + contexto (llegada, sorpresa, espera)».
- T07 (cadena de dominantes ≤ +0,10) y el desglose del tooltip están en `analysis.test.js`.
- Fixtures regenerados revisando cada diferencia. `analysis.json`: 8 tensiones, todas de acordes que siguen a una D con sensible (blues: F7 tras G7; iiVminor: Cm; popG: Em; secondary: Dm y C), en los dos juegos de preferencias. `expression.json`: 6 de 72 corridas (todas `melody`), solo notas de acordes que siguen a una D (C tras G7, o G7 tras G7). `text.json`, `midi.json` (solo el `.txt` de cada paquete; los `.mid` son idénticos) y `theory/texts.json`: solo cambia la cabecera.
- La andaluza (Am G F E) no cambia: el ♭VII es D pero no lleva sensible, así que el F no recibe sorpresa (T10). T11: el v menor tampoco da llegada al i.

Rama `feat/ui-audit`, sobre `feat/tension-context` (paso 4: filas ✗ y ⚠ de la sección 3 de `inversiones-tension-ui.md`, salvo las filas 5 y 10): 541 de 549 (98 %); las 7 comprobaciones nuevas (J30–J32) pasan y no cae ninguna. La lógica del inspector salió de `main.js` a `src/panel.js` (funciones puras), y cada fila tiene su prueba en `src/audit.test.js`:

- **Fila 18 (hoja vacía).** El texto ahora menciona el arpegio. Al probarlo salió que la regla de dos notas ya era inexacta: exige que *las dos* duren un tiempo o más, no una. Texto y regla comprobados con patterns reales (`emptySheetText`).
- **Fila 19 (intervalo de la melodía).** `against` nombra el intervalo por letras: E♭ sobre C7 es ♭3 (antes ♯9), D♯ es ♯9, F♯ es ♯11, G♭ es ♭5. Casos J31 y J32; el texto exportado del blues K03 cambia de ♯9 a ♭3.
- **Fila 2.** Tabla de los 44 tipos con su nombre en español e inglés.
- **Fila 3.** `intervalText` nombra el intervalo de dos notas por letras: C–D♯ 2ª aumentada, C–E♭ 3ª menor, F–B 4ª aumentada, B–F 5ª disminuida (ya no «tritono»).
- **Fila 4.** `spellActive` es la función pura que deletrea el acorde activo; prueba: G♯7 en Do♯ menor lleva B♯.
- **Fila 6.** `candTags` con casos para C, Am7/C, C9 sin 5 y C-7.
- **Fila 7.** `chordWarnings` y `LIMITS`: umbrales del piano, MIDI, oído y dedos, en una tabla con prueba en cada borde.
- **Fila 8.** No hay tabla por intervalo: no tengo una fuente verificada de los límites graves y no los invento. El aviso se rotula «Regla práctica» y dice que el límite exacto depende del intervalo (`MUDDY`).
- **Fila 20.** La columna de la tensión de la melodía dice «estimada»; casos J30 (baja, media y alta).
- **Fila 22.** Los pesos de la fórmula de Expresión viven en `RULES` (`expression.js`) y una prueba comprueba que la ayuda (español e inglés) cita las mismas cifras.
- **Fila 24.** El pie de página nombra la tensión entre las estimaciones.
- Filas 5 y 10 (el «por qué» de la elección de acorde y de tonalidad) quedan para el paso 5, con los textos aprobados antes.

Rama `feat/why-labels`, desde `main` con los pasos 1 a 4 fusionados (paso 5, filas 5 y 10 de la auditoría; textos aprobados el 1 nov 2026): 549 de 557 (98 %); las 8 comprobaciones nuevas pasan y no cae ninguna. Reglas en `src/analysis.js`:

- **Fila 5, nombre de acorde.** `analyze` guarda en cada candidato sus `parts` (tipo, omisiones, inversión, 6ª sin 5, raíz elegida) con las constantes de `RANK` (+3 el bajo que no es la fundamental, +2 por nota omitida, −10 la raíz elegida; el tipo suma su rango, de 0 a 0,9, elegido a mano). `scoreDetail` los escribe en el tooltip de cada nombre («3 inversión + 0,2 tipo = 3,2») y `rankHelp`, desde las mismas constantes, escribe la línea fija bajo «Posibles nombres». No se agregan etiquetas de «tipo frecuente»: los rangos no son frecuencias medidas. Sí queda la etiqueta «bajo = fundamental».
- **Fila 10, tonalidad.** `keyWhy` cita los motivos de `detectKey` que aplican a la elegida, por peso, máximo tres y sin repetir: un V resuelve a la tónica, empieza y termina (o solo empieza, o solo termina), el acorde que más dura (solo si dura estrictamente más que los otros), todos los acordes (o notas) son de la escala (solo si es literalmente cierto: sin préstamos ni cromáticos) y, si hay modo, su motivo («dórico: aparece B natural (6ª mayor) y todas las notas están en la escala»). Con alternativa: «C mayor, casi empatada con G mayor: …». Los puntos van solo en el tooltip. Se muestra bajo la placa de la hoja y como línea `# Por qué la tonalidad:` del texto exportado. `bookends` y `resolvesToTonic` son ahora los predicados de `detectKey` y de `keyWhy`, así que no se desincronizan; el ranking de `detectKey` no cambió (el fixture `analysis.json` lo confirma).
- Pruebas: `src/why.test.js` (una por regla) y los checks `why` de F08, F09, F10, F19, F28 y D21 en la sonda. `text.json`, `midi.json` (solo el `.txt` de cada paquete) y `theory/texts.json` cambian únicamente por la línea nueva.

Rama `feat/close-gaps`, desde `main` con los cinco pasos fusionados (C9, C12, F18 y la cadencia ♭VII → i; F11 queda fuera): 562 de 563 (99 %); las 7 comprobaciones que fallaban (A36, A43, F18, I10, I11, I13, I19) pasan, las 6 nuevas también (A46–A49 y G14 ×2) y no cae ninguna.

- **F18, patrones en la otra tonalidad.** Además de la tonalidad elegida, `analyzeProgression` busca los patrones en la alternativa (si hay) y siempre en la relativa; los hallazgos dicen en qué tonalidad: «Royal road (J-pop) (en C mayor)». La alternativa se muestra solo a menos de 2 puntos, y en F18 el Do mayor queda a 3,49 de La menor, por eso se agregó la relativa. No se repite un patrón que la tonalidad principal ya encontró, y la otra lectura solo se muestra si abarca más acordes que el patrón más largo de la principal (decisión del 1 nov 2026): G D Em C y C Am F G no muestran su lectura en la relativa; F18 sí muestra «Royal road (J-pop) (en C mayor)» (4 acordes contra 3). `detectKey` no cambia.
- **C12, lectura de notas.** `NOTE_RE` acepta 𝄪 y 𝄫, letras en minúscula (c4, ab4, fx4, sol4) y la H alemana (= B natural). La letra no puede ser el final de una palabra: la d9 de Cadd9 no es una nota. `parseText` devuelve `unread`: las palabras con forma de nota que no se pudieron leer (fuera de rango como C-1, o notaciones desconocidas como J4 o Es3); la importación las nombra en el aviso («sin leer: J4, C-1»). No adivina Es, As ni His.
- **C9, diccionario.** Seis tipos nuevos: maj9♯11, 7♯5♯9, 7♭5♭9, 7♯5♭9, 7♭9♯11 y 13♭9, con rangos de 0,8 a 0,85 (el máximo de la regla del orden sigue siendo 0,9).
- **Cadencia ♭VII → i.** En menor dice «Cadencia ♭VII → i» (EN «♭VII → i cadence»); en mayor sigue «backdoor / mixolidia». Caso G14: Dm G C Dm.
- Pruebas: `src/gaps.test.js` (una por regla) y los casos A46–A49 y G14 de la sonda; la fila de tipos de `audit.test.js` incluye los seis nombres nuevos. `analysis.json` no cambia respecto a `main`; `text.json` solo recibe `unread: []` en lo leído; `theory/texts.json` no cambia respecto a `main`.

Rama `feat/ornament-tones`, desde `main` (`d9cd779`): 569 de 570; las 7 comprobaciones nuevas (O01–O05, J33 y J34) pasan y no cae ninguna. La regla de la decisión 8 está en `src/analysis.js` (`readOrnaments`, `ornamentText`) y `stepTiming` en `src/model.js`. El reporte del corpus agrega intervalos de confianza del 95 % por bootstrap de obras o canciones, la fila «nombre exacto, sin extensiones» y la tabla antes y después de la regla. `tools/ornament-sim.test.js` guarda la simulación de desarrollo (corre solo con `ORNAMENT_SIM`).

Rama `feat/broken-accompaniment`, desde `main` (`52a2eea`): 572 de 573; las 3 comprobaciones nuevas (J35 y J36) pasan y no cae ninguna, y ningún texto de la sonda ni fixture de la suite cambia. Dos cambios:

- **Error del evaluador, corregido.** `evalTavern` dejaba fuera de las filas de punta a punta las frases en las que la app no lee ningún acorde (1309 tramos de 16 404 en desarrollo), aunque el reporte decía que los tramos sin acorde cuentan como fallo. Con la cuenta corregida, `main` da en desarrollo una cobertura de 68,9 % (no 74,8 %) y un acorde de punta a punta de 34,3 % (30,5–37,9), no 37,3 %. La base corregida de prueba se calcula solo en la mirada final, junto al después.
- **Regla de la decisión 9.** Desarrollo, antes → después (Δ pareado por obra): acorde de punta a punta, contando como fallo los tramos sin acorde, 34,3 % → 45,1 % (Δ +10,8; 7,9 a 14,3); cobertura 68,9 % → 89,1 % (Δ 15,7 a 25,4); cortes del analista que la app también corta 58,7 % → 78,0 %; cortes de la app que el analista también corta, sin cambio (71,2 %). Sobre los tramos cubiertos, que ahora son más, el nombre exacto baja de 46,6 % a 44,6 % (Δ −3,5 a −0,5) y la enarmonía del tramo completo de 98,3 % a 97,0 % (Δ −1,8 a −0,8). Las filas por tramo anotado no cambian.
- El desglose y la simulación que llevaron a la regla están en `tools/segment-breakdown.mjs` y `tools/segment-sim.mjs` (fuera de la suite). Medida y pendiente: la rejilla pura, sin la segmentación por ataques, da 50,2 % en desarrollo; falta medirla contra la sonda.
- Texto de la hoja vacía (`emptySheetText`, aprobado el 2 nov 2026): ahora es una lista, «Solo melodía: no hay acordes. La app arma un acorde cuando hay:» tres notas a la vez · dos notas a la vez que duran un tiempo o más · un arpegio: una sola voz que salta entre tres o más notas de un acorde · un acompañamiento: tres o más notas distintas en un tiempo mientras otra voz se sostiene. Prueba en la fila 18 de `src/audit.test.js`, en los dos idiomas.

### Retomar desde main

Punto de partida: `feat/ornament-tones` fusionada en `main`; la sonda da 569 de 570 y queda un solo fallo:

- C10: F11 (una modulación se lee como una sola tonalidad; hay que decidir cómo se parte la progresión en regiones). Es de otro tamaño: no es un ajuste de pesos.

Corpus externos (detalle, método, intervalos y errores más frecuentes en `src/test/fixtures/theory/corpus/REPORT.md`). Fuentes: TAVERN (CC BY-SA 4.0; 27 obras, 1101 frases, dos anotadores) y Rock Corpus RS 200 (CC BY 4.0; 382 análisis). Los casos no entran al ratchet (`passing.json`).

Cifras del 2 nov 2026, antes → después de la regla de notas de adorno. Desarrollo = 21 obras de TAVERN; prueba = 6 obras, mirada una sola vez, al final. Entre paréntesis, el intervalo de confianza del 95 % (bootstrap por obra); Δ en puntos, pareado por obra.

- Acorde por tramo anotado (raíz + calidad, acepta A o B): desarrollo 51,3 % → 67,4 % (Δ +16,1; 13,6 a 19,0); prueba 49,4 % → 67,0 % (63,2–72,2; Δ +17,6; 13,9 a 21,3).
- Acorde por tramo, nombre exacto sin extensiones: desarrollo 39,0 % → 52,8 %; prueba 35,8 % → 50,6 %.
- Control (tramos cuyas notas son exactamente las del acorde): desarrollo 97,6 % → 96,9 %; prueba 96,5 % → 95,9 %.
- **Para revisar la próxima vez que se toque la regla, solo con desarrollo:** sin los pesos de tiempo y bajo, el nombre exacto por tramo baja (52,8 % contra 55,4 % con ellos, en desarrollo).
- Acorde de punta a punta, contando como fallo los tramos sin acorde de la app: desarrollo 37,2 % → 37,3 %; prueba 39,0 % → 39,0 % (31,8–45,5). **No cambió:** la app ya separa la melodía (`splitHarmony`), así que cada acorde de `harmonySegs` trae solo las notas que suenan al empezar y la regla casi no encuentra adornos que descartar (en desarrollo acierta 10 tramos más de 15 095). La app cubre con un acorde el 68,9 % de los tramos del analista (desarrollo). El 74,8 % que figuraba aquí salía de un error del evaluador, que dejaba fuera las frases sin ningún acorde de la app; con la cuenta corregida, el acorde de punta a punta de `main` en desarrollo es 34,3 %, no 37,3 % (ver la rama `feat/broken-accompaniment`).
- Inversión, dado el acorde correcto (por tramo): desarrollo 94,3 % → 95,1 %; prueba 95,0 % → 95,4 %.
- Tonalidad de TAVERN (tónica y modo, por tramo): desarrollo 73,4 % → 78,0 %; prueba 72,4 % → 77,1 % (66,2–88,2). Rock Corpus, solo la tónica: 69,2 % en prueba (55,1–82,3), sin cambio.
- Enarmonía (tramo con todas las notas bien, por tramo): desarrollo 91,5 % → 91,0 %; prueba 91,0 % → 91,0 %.
- Función: no comparable (TAVERN la etiqueta por frase). Cadencia: sin corpus. Modulación: 0 de 61 canciones del Rock Corpus; la app no informa cambios de tonalidad.
- Lo que más falla ahora (desarrollo, por tramo): la enarmonía de notas alteradas (G♯ escrito A♭, 542 veces; C♯ escrito D♭, 523), maj7 donde el corpus tiene una tríada mayor (379), tramos de una sola clase de altura sin acorde (323) y raíz equivocada con una nota ajena al acorde (302 y 178).

Conjunto de prueba: nunca se usa para ajustar reglas. Se separan obras completas de TAVERN (6 de 27: B066, B075, B080, Opus76, K354 y K573; 290 de 1101 frases) y canciones completas del Rock Corpus (40 de 198; 78 de 382 análisis) por un hash fijo de su nombre (`split.json`, regla en `src/test/corpus-eval.js`). Las reglas se ajustan y los errores se analizan solo con el desarrollo; las metas se miden en la prueba. Con 6 obras, el intervalo del acorde por tramo en la prueba abarca unos 9 puntos y el de la tonalidad unos 22; aun así es optimista, porque no ve la variación de obras que no conoce.

Metas acordadas con Joaquín (2026-11-01), medidas en el conjunto de prueba, con lo que da hoy:

| Medida | Meta | Hoy (prueba, IC 95 %) |
|---|---|---|
| Acorde por tramo anotado (raíz + calidad, acepta A o B) | 80 % | 67,0 % (63,2–72,2) |
| Acorde de punta a punta (los tramos sin acorde de la app cuentan como fallo) | 70 % | 39,0 % (31,8–45,5) |
| Inversión, dado el acorde correcto | ≥ 94 % | 95,4 % (92,7–97,2; ya cumple) |
| Tonalidad de TAVERN (tónica y modo) | 85 % | 77,1 % (66,2–88,2) |
| Tónica del Rock Corpus, sin aceptar la relativa | 82 % | 69,2 % (55,1–82,3) |
| Enarmonía (tramo con todas las notas bien) | 95 % | 91,0 % (88,1–94,7) |
| Modulación: canciones del Rock Corpus con cambio de tonalidad que la app informa | la mitad | 0 de 15 |

La fila de punta a punta (39,0 %) se calculó con el evaluador que dejaba fuera las frases sin ningún acorde de la app; la cobertura de esa fila es 68,9 % en desarrollo, no 74,8 %. La base corregida de prueba se calcula en la mirada final, junto al después.

Cómo se leyeron las metas ambiguas: «acorde de punta a punta» es la versión que cuenta como fallo los tramos sin acorde de la app; «enarmonía» es por tramo completo, no nota a nota; «inversión» se mide por tramo anotado; la modulación cuenta las canciones donde el corpus cambia de tonalidad. Función y cadencia no tienen meta: sin corpus comparable.

Lo siguiente para el acorde: la **segmentación** de punta a punta (cobertura del 68,9 % en desarrollo, con la cuenta corregida) y la **raíz por contexto** (los fallos de raíz equivocada y las notas sueltas piden mirar los acordes vecinos). La regla de notas de adorno sola llega a ~67 % por tramo. Queda medida, y fuera de esta rama, la variante en que el análisis de la app ve todas las notas que suenan durante el acorde, melodía incluida: con los pesos anteriores daba +3,0 puntos de punta a punta en desarrollo (49,7 % → 52,7 %), pero cambia qué notas forman el acorde en la app y bajaba la enarmonía de punta a punta de 98,3 % a 84,7 %.

Límite conocido de la regla de acompañamiento (decisión 9), para la próxima etapa: un bajo en octavas con una sola nota de melodía por tiempo deja 2 clases de altura por tiempo y sigue sin acorde. Leerlo pide decidir cuándo un bajo y una nota bastan para nombrar un acorde (C y E pueden ser C o Am sin quinta); medirlo solo con desarrollo.

Después de eso y de F11 siguen comparar al oído el volumen GM con las muestras de la plantilla (`LEVEL` en `src/audio.js`).

Regenerar los casos y el reporte: `README.md` de la carpeta `corpus` (`python -I tools/corpus_tavern.py` y `tools/corpus_rock.py`; `CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js`). El reporte imprime las cifras de prueba: regenerarlo es mirarlas.

Regenerar la línea base a propósito, tras revisar cada diferencia: `UPDATE_THEORY=1 npx vitest run src/theory.test.js`.
