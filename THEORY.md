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

### Retomar desde main

Punto de partida: los cinco pasos de `inversiones-tension-ui.md` y `feat/close-gaps` fusionados en `main`; la sonda da 562 de 563 y queda un solo fallo:

- C10: F11 (una modulación se lee como una sola tonalidad; hay que decidir cómo se parte la progresión en regiones). Es de otro tamaño: no es un ajuste de pesos.

Después de F11 siguen los pendientes del traspaso: metas por categoría con un corpus externo de licencia verificada (todos los casos son propios) y comparar al oído el volumen GM con las muestras de la plantilla (`LEVEL` en `src/audio.js`).

Regenerar la línea base a propósito, tras revisar cada diferencia: `UPDATE_THEORY=1 npx vitest run src/theory.test.js`.
