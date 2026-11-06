# Prompt maestro — acordeón vallenato 3D realista

```text
Actúa como modelador/a senior de producto, artista de materiales PBR y especialista en rigging/animación de instrumentos musicales en Blender. Trabaja sobre el proyecto AcordenRush y las fotografías de acordeones de botones que proporcionó el usuario. La prioridad es un acordeón diatónico colombiano de vallenato que se reconozca como un instrumento físico real, no como un juguete, una ilustración ni un bloque geométrico.

REFERENCIAS Y CRITERIO
Antes de modelar, inspecciona todas las fotos adjuntas y el .blend existente. Toma de las referencias sus proporciones, la caja de botones de tres hileras, los botones de bajos, el fuelle central plegado, la rejilla, los herrajes y los acabados rojos/negros. Usa también la nueva lámina de digitación: presenta Sol (GCF), Fa (FBbEb) y Mi (EAD), con notas separadas por dirección del fuelle (hacia fuera/halar y hacia dentro/empujar). Asocia esas notas a sus botones físicos conservando mayúsculas, minúsculas y los marcadores `-`/`+` de registro tal como aparecen en la lámina. No adivines octavas en Hz cuando la imagen no las define; guarda las etiquetas originales como metadatos del botón. Úsalas como guía visual; no inventes un modelo exacto de fabricante ni reproduzcas logotipos/marcas que no haya autorizado el usuario. Si una dimensión real no aparece en las referencias, conserva proporciones verosímiles y deja anotado que es una estimación.

Corrige explícitamente las limitaciones del blockout actual: no dejes los pliegues del fuelle como barras separadas con huecos, no uses botones flotantes, no dejes cajas lisas sin detalle y no deformes las cajas para simular la apertura. El fuelle debe ser una pieza continua con pliegues físicos legibles; las dos cajas rígidas deben conservar su forma y deslizarse al abrir y cerrar.

INSTRUMENTO
Modela un acordeón diatónico vallenato de botones, estilo Corona/El Rey como referencia de construcción, visto en tres cuartos desde el frente. Mantén una silueta compacta, robusta y ligeramente redondeada, con dos cajas rígidas de madera/plástico técnico y un fuelle central profundo. La orientación debe dejar ver claramente tanto los 31 botones de melodía como los botones del bajo.

- Lado melódico: 31 botones físicos exactos, distribuidos en tres hileras diagonales de 10, 11 y 10; respetar separación y desplazamiento entre filas, montados sobre una placa real. Cada botón debe tener borde o anillo, vástago corto y cabeza redondeada, con pequeñas diferencias de material/tono como nácar o marfil. Evita esferas grandes pegadas directamente a la caja. Guarda en cada objeto la nota de la lámina para GCF, FBbEb y EAD, separando `push` y `pull`; no imprimas nombres de nota sobre la carcasa salvo que el usuario pida explícitamente una capa didáctica.
- Lado de bajos: crea 12 botones en una matriz compacta de cuatro filas por tres columnas, con disposición escalonada, bases/anillos y tamaño ligeramente mayor. Mantén espacio para correas, tapa y tornillería.
- Fuelle: una superficie textil continua, opaca y sellada, con 16–22 pliegues regulares, profundidad visible, paneles laterales y ribetes. Los pliegues deben juntarse limpiamente con ambas cajas en todos los estados; no debe haber huecos, intersecciones ni penetraciones durante la animación. Alterna pliegues oscuros con bandas de color de la referencia y añade ribetes finos; conserva la lectura de tela comprimida, no de tubos rígidos.
- Cajas: biseles de fabricación realistas, cantos protectores, tapas posteriores, costuras, tornillos, rejillas, placas, correas/enganches y pequeños detalles de ensamblaje. La rejilla metálica debe tener perforaciones o ranuras modeladas/normal-mapped, marcos finos y profundidad. Añade una placa central original de AcordenRush discreta; no falsifiques insignias de marca.
- Si las fotos muestran variaciones de color/modelo, adopta como primera versión el acabado rojo vino/nácar con negro y latón, sin mezclar componentes incompatibles de distintos modelos.

MATERIALES Y PRESENTACIÓN
Usa materiales PBR creíbles: carcasa con acabado perlado rojo (variación sutil, barniz y reflejos controlados), zonas negras satinadas, tela de fuelle mate con trama fina, botones de nácar/marfil, rejilla de acero/aluminio y herrajes de latón/cromo. No uses rojo plano ni metal dorado exagerado. Añade variación de roughness y microdetalle mediante mapas/procedurales discretos. Diseña luces de estudio suaves que permitan leer el relieve sin quemar los reflejos.

RIG Y ANIMACIÓN
Mantén las cajas rígidas y conecta ambas a controles/empties limpios: `CTRL_LADO_BAJO`, `CTRL_LADO_MELODIA` y `CTRL_FUELLE`. El fuelle debe abrir y cerrar de manera sincronizada mediante shape keys, armature o deformación equivalente, conservando pliegues con grosor y tela continua. Expande las cajas en sentidos opuestos; no escales el instrumento entero ni estires las cajas. La transición debe empezar cerrada, alcanzar una apertura amplia natural y volver a cerrar con easing suave. Comprueba visualmente las costuras en el fuelle comprimido, a mitad de recorrido y en máxima apertura.

Crea acciones claramente nombradas:
1. `Idle_Breath_Loop`: respiración lenta y sutil del fuelle en reposo, repetible sin salto.
2. `Bellows_OpenClose`: abrir y cerrar completo, loop continuo, con deformación limpia y cajas sincronizadas.
3. `Melody_Button_Press`: botones seleccionados se hunden brevemente y recuperan su posición, sin desplazarse de sus guías.
4. `Bass_Button_Press`: pulsación independiente de uno o varios botones del bajo.
Incluye pulsaciones de demostración discretas, sin hacer que todos los botones se hundan a la vez. Si el alcance lo permite, crea controles por fila o por botón para que el juego pueda activar teclas concretas.

ORGANIZACIÓN TÉCNICA
Trabaja en Blender y conserva un .blend editable. Nombra y agrupa objetos por subsistemas: caja izquierda/bajos, caja derecha/melodía, fuelle, teclas, herrajes, materiales, cámara y luces. Aplica transforms donde corresponda, centra orígenes útiles, usa nombres sin `Cube.001`, comprueba normales, UVs, escala/unidades y evita geometría duplicada innecesaria. El modelo debe mantener suficiente detalle de cerca y una malla razonable para tiempo real.

ENTREGABLES
- `AcordeonVallenato_Realista.blend`: fuente editable, rig, materiales, cámaras, luces y acciones.
- `AcordeonVallenato_Realista.glb`: exportación PBR para Three.js/web, con acciones/morph targets exportados y sin cámara, luces ni pedestal de estudio.
- Renders PNG de alta calidad: vista frontal, tres cuartos abierto, tres cuartos cerrado y detalle de botones/fuelle.
- Una nota breve con controles, nombres de acciones, rango de cuadros, escala, limitaciones y pasos de exportación.

CONTROL DE CALIDAD ANTES DE ENTREGAR
Abre el .blend recién guardado en Blender; reproduce todas las acciones y revisa al menos el fuelle cerrado, medio abierto y totalmente abierto. Verifica el conteo de 31 teclas y 12 bajos, que cada botón permanezca unido a su placa, que las cajas no se deformen y que el fuelle no se separe ni se atraviese. Exporta el GLB, vuelve a importarlo en una escena limpia y confirma que conserva materiales, geometría y animación. Renderiza y revisa las vistas antes de darlo por terminado. No declares una revisión como realizada si no se ejecutó.

Haz primero el modelo completo con fidelidad visual; no sustituyas las partes detalladas por cubos, cilindros genéricos o una imagen pegada. Si una función avanzada no es viable, conserva el modelo y la animación base funcionando y documenta exactamente qué falta.
```
