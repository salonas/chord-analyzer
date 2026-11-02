# Trazabilidad de las etiquetas

Cierre del proyecto, 2 nov 2026 (sesión B). Cada etiqueta teórica de la interfaz y del texto exportado, con la prueba que la fija; la regla de cada una está en `THEORY.md` (decisiones y «Etiquetas fijadas al cierre»). Las filas son las 24 de la auditoría de `inversiones-tension-ui.md` (el documento no está en el repositorio). Las rutas van desde la raíz del repositorio.

| Fila | Etiqueta | Prueba |
|---|---|---|
| 1 | Nombre del acorde activo | sonda A; `src/audit.test.js` «labels fixed at the close» (descripción, `chordDesc`; C9sus4 y C13 sin 9) |
| 2 | Nombre de cada tipo | `src/audit.test.js` «row 2» |
| 3 | Intervalo de dos notas | `src/audit.test.js` «row 3» |
| 4 | Deletreo del acorde activo | `src/audit.test.js` «row 4» |
| 5 | Por qué un nombre va primero (puntos, regla) | `src/why.test.js` «row 5» (dos bloques) |
| 6 | Etiquetas de «Posibles nombres» | `src/audit.test.js` «row 6» (dos bloques) |
| 7 y 8 | Avisos y sus umbrales | `src/audit.test.js` «rows 7 and 8» |
| 9 | «No se reconoce el acorde» | sonda A25; `src/audit.test.js` «rows 7 and 8» (aviso `unknown`) |
| 10 | Por qué la tonalidad | `src/why.test.js` «row 10»; línea del texto, «closing trace» |
| 11 | Final (cadencia) | sonda G; «sin cadencia final» y cadencia modal en `src/audit.test.js` |
| 12 | Patrones | sonda H; `src/gaps.test.js`; «(continúa en … al repetir)» en `src/audit.test.js` |
| 13 | Grado | sonda D y V |
| 14 | Función | sonda E |
| 15 | Tensión 0–1 | sonda T; `src/analysis.test.js` «tension with context» |
| 16 | Ayuda «su tensión estimada (0 a 1)» | `src/audit.test.js` (`sheetHint`) |
| 17 | Franja: nombre y grado · función | sonda; `src/english.test.js` «writes the inversion in words and keeps the strip short» |
| 18 | Hoja vacía | `src/audit.test.js` «row 18» |
| 19 | Intervalo de la melodía | `src/audit.test.js` «row 19»; sonda J31, J32 |
| 20 | Tensión de la melodía, «estimada» | sonda J30; `src/audit.test.js` «closing trace» |
| 21 | Rol de la melodía | sonda J; retardo en `src/audit.test.js` «closing trace»; «libre» y tensión en «labels fixed at the close» |
| 22 | Pesos de Expresión en su ayuda | `src/audit.test.js` «row 22» |
| 23 | Apoyaturas en Expresión | `src/expression.test.js` «expressPattern roles» |
| 24 | Pie de página: lo que es estimación | `src/audit.test.js` «closing trace» |

Además: adornos y melodía que completa el acorde (`src/why.test.js`), semicadencia en el porqué (`src/why.test.js`), modos (sonda F), regiones y pivote (`src/regions.test.js`, sonda J42), «(doblada)», «sin 5», los grados que se omiten y el rol «libre» (`src/audit.test.js`). La sesión B agregó 15 pruebas; la suite queda en 1093 + 2 saltadas.
