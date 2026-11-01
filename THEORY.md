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

Rama `fix/theory-spelling-and-keys` (C1 deletreo por letras, C2 nombre de tonalidad, C3 detección de tonalidad): 386 de 418 comprobaciones (92 %), contra 360 al inicio. Ninguna comprobación que pasaba dejó de pasar. Pendiente: C4 y C8, C7 y C11, C6 y C5, modos, C9, C12 y modulación (F11).

Regenerar la línea base a propósito, tras revisar cada diferencia: `UPDATE_THEORY=1 npx vitest run src/theory.test.js`.
