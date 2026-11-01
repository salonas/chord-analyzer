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

   Los grados siguen relativos a la mayor, con ♭. Se hace después de C3. Casos: F08, F09, F10, uno lidio (D–E) y un ii–V–I en Do que debe seguir siendo Do mayor, no Re dórico.
4. **Funciones de iii y vi: ambos tónica.** El ♭VI en menor queda como subdominante (`harmonicFunction`, grado 8 en menor).
5. **G12 (C – D7 – G) es ambiguo.** Se acepta Sol mayor con cadencia auténtica o Do mayor con semicadencia; la app muestra la otra lectura como alternativa.

Sin decidir y sin cambios: la notación de inversiones con extensiones y la tensión, que sigue rotulada "estimación".

## Estado

Rama `fix/theory-spelling-and-keys` (C1 deletreo por letras, C2 nombre de tonalidad, C3 detección de tonalidad): 392 de 424 comprobaciones (92 %), contra 360 de 418 al inicio; las 6 nuevas son el caso J19. Ninguna comprobación que pasaba dejó de pasar. Pendiente: C4 y C8, C7 y C11, C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-chromatic-and-functions`, sobre la anterior (C4 y C8: dominantes y sensibles secundarias con destino diatónico, sextas aumentadas, dim7 de nota común, I7 del blues, 6/4 cadencial, sustituto tritonal): 406 de 424 (96 %). Pendiente: C7 y C11, C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-cadences-and-alt`, sobre la anterior (C7 y C11: la cadencia escribe los grados como son los acordes, V → i en menor; v → i es modal y no auténtica; el texto exportado da la tonalidad alternativa, «Sol mayor (o Do mayor)»): 409 de 424 (96 %). Pendiente: C6 y C5, modos, C9, C12 y modulación (F11).

Rama `fix/theory-melody-roles`, desde `main` con #12–#14 fusionados (C5 y C6): 429 de 437 (98 %). Reglas nuevas en `src/text.js` y `src/harmony.js`:

- Roles de melodía: la anticipación se lee antes que la escapada (J05); la doble bordadura marca sus dos notas (J08); el retardo se agrega al rol en la misma columna, «nota del acorde · retardo 4–3 → E4» (J07). Casos en contra: J20 (nota retenida que es del acorde nuevo) y J21 (disonancia retenida que sube).
- Melodía en bloque con la decisión 2 (J11). J12 es un solo bloque y queda «Cadd9» sin melodía. Casos en contra: J22 (pad abierto C2 G2 E4), J23 (A24, C2 E5 G6) y J24 (voz aguda a una octava justa).
- Arpegios: una sola voz sin notas simultáneas se agrupa por medio compás o por compás; cada grupo debe moverse solo por saltos y formar acorde de 3 o más clases de altura (J13, J28). Casos en contra: J25 y J26 (escalas) y J27 (melodía sola). J13 acepta ahora «G/B», porque B3 es el bajo del segundo compás.

### Retomar desde main

Punto de partida: `fix/theory-melody-roles` fusionado en `main`; en ese estado la sonda da 429 de 437 y quedan 8 fallos:

- C9, diccionario: A36 (maj9♯11) y A43 (dominante alterado 7♯5♯9).
- C12, parseo: I10 (𝄪), I11 (𝄫), I13 (minúsculas) e I19 (H alemana descartada sin aviso).
- C10: F11 (modulación como una sola tonalidad) y F18 (royal road, patrones con la tonalidad alternativa).
- Aparte, sin caso: los modos como etiqueta (decisión 3). Siguiente en el orden acordado, antes de C9.

No empezar lo siguiente hasta que el PR de C5/C6 esté en `main`. Para los modos aplica la decisión 3.

Regenerar la línea base a propósito, tras revisar cada diferencia: `UPDATE_THEORY=1 npx vitest run src/theory.test.js`.
