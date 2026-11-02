# Trazabilidad de las etiquetas

Cierre del proyecto, 2 nov 2026 (sesión B). Cada etiqueta teórica de la interfaz y del texto exportado, con la regla que la fija en `THEORY.md` y la prueba que la comprueba. Las filas son las 24 de la auditoría de `inversiones-tension-ui.md` (el documento no está en el repositorio). «Dec.» es una decisión de «Decisiones»; «Reglas: …», un punto de «Reglas de las etiquetas»; «Cierre: …», uno de «Etiquetas fijadas al cierre». Las rutas van desde la raíz del repositorio.

| Fila | Etiqueta | Regla | Prueba |
|---|---|---|---|
| 1 | Nombre del acorde activo | Reglas: Escritura de notas; Cierre: «sin 5»; dec. 8 y 11 (descripción) | sonda A; `src/audit.test.js` «labels fixed at the close» (`chordDesc`; C9sus4 y C13 sin 9) |
| 2 | Nombre de cada tipo | Reglas: Inspector | `src/audit.test.js` «row 2» |
| 3 | Intervalo de dos notas | Reglas: Inspector | `src/audit.test.js` «row 3» |
| 4 | Deletreo del acorde activo | Reglas: Escritura de notas | `src/audit.test.js` «row 4» |
| 5 | Por qué un nombre va primero (puntos, regla) | Reglas: Por qué un nombre va primero; dec. 11 y 12 | `src/why.test.js` «row 5» (dos bloques) |
| 6 | Etiquetas de «Posibles nombres» | Reglas: Por qué un nombre va primero; dec. 8 y 11 | `src/audit.test.js` «row 6» (dos bloques) |
| 7 y 8 | Avisos y sus umbrales | Reglas: Inspector | `src/audit.test.js` «rows 7 and 8» |
| 9 | «No se reconoce el acorde» | Reglas: Inspector | sonda A25; `src/audit.test.js` «rows 7 and 8» (aviso `unknown`) |
| 10 | Por qué la tonalidad | Reglas: Por qué la tonalidad; dec. 13 y 15 | `src/why.test.js` «row 10»; línea del texto en `src/audit.test.js` «closing trace» |
| 11 | Final (cadencia) | Reglas: Cadencias; Cierre: «sin cadencia final» | sonda G; `src/audit.test.js` (cadencia modal, «sin cadencia final») |
| 12 | Patrones | Reglas: Patrones en la otra tonalidad; Cierre: «(continúa en … al repetir)»; dec. 15 | sonda H; `src/gaps.test.js`; `src/audit.test.js` «labels fixed at the close» |
| 13 | Grado | dec. 1 y 6; Reglas: Grados cromáticos, Modo | sonda D y V |
| 14 | Función | dec. 4 | sonda E |
| 15 | Tensión 0–1 | dec. 7; Reglas: Tensión | sonda T; `src/analysis.test.js` «tension with context» |
| 16 | Ayuda «su tensión estimada (0 a 1)» | dec. 7; Reglas: Tensión | `src/audit.test.js` (`sheetHint`) |
| 17 | Franja: nombre y grado · función | dec. 6 (la franja muestra solo el grado) | sonda; `src/english.test.js` «writes the inversion in words and keeps the strip short» |
| 18 | Hoja vacía | Reglas: Inspector; dec. 9 | `src/audit.test.js` «row 18» |
| 19 | Intervalo de la melodía | Reglas: Inspector | `src/audit.test.js` «row 19»; sonda J31, J32 |
| 20 | Tensión de la melodía, «estimada» | Reglas: Tensión (los niveles, sin regla escrita: ver abajo) | sonda J30; `src/audit.test.js` «closing trace» |
| 21 | Rol de la melodía | Reglas: Roles de la melodía; Cierre: rol «libre» | sonda J; `src/audit.test.js` «closing trace» (retardo) y «labels fixed at the close» (libre y tensión) |
| 22 | Pesos de Expresión en su ayuda | Reglas: Expresión | `src/audit.test.js` «row 22» |
| 23 | Apoyaturas en Expresión | Reglas: Expresión | `src/expression.test.js` «expressPattern roles» |
| 24 | Pie de página: lo que es estimación | Reglas: Pie de página | `src/audit.test.js` «closing trace» |

Además, fuera de las 24 filas:

| Etiqueta | Regla | Prueba |
|---|---|---|
| Adorno | dec. 8 | `src/why.test.js` «ornaments in words» |
| Melodía que completa el acorde | dec. 11 | `src/why.test.js` «row 5: a lane chord read with the tune and its neighbours» |
| Semicadencia en el porqué | dec. 13 | `src/why.test.js` «row 10» |
| Modos | dec. 3; Reglas: Modo | sonda F |
| Regiones y pivote | dec. 15 | `src/regions.test.js`; sonda J42 |
| «(doblada)», E(5) | Cierre: «(doblada)»; Reglas: Nombres en el texto exportado | `src/audit.test.js` «labels fixed at the close»; `src/harmony.test.js` «writes a power chord as E(5), never E5» |
| Bajo «(paso)» | sin regla escrita (ver abajo) | `src/harmony.test.js` «writes four chord lines and no lone note as a chord» |

Sin regla escrita en `THEORY.md`, porque formularla pide mirar el código: cuándo un bajo es «(paso)» y dónde cae la tensión «media» de la melodía, con los valores de los tres niveles. Sus pruebas fijan lo que hace el código hoy, no una regla.

La sesión B agregó 15 pruebas; la suite queda en 1093 + 2 saltadas.
