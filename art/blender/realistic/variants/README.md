# Diseños diatónicos AcordenRush 31/12

Tres exteriores adicionales sobre la plataforma mecánica del modelo Vino Clásico. Todos conservan **31 botones melódicos (10/11/10), 12 bajos (4×3), 20 pliegues conectados y cuatro acciones**. Son diseños originales, con proporciones estimadas, sin marcas de fabricante ni afirmación de medidas certificadas.

| Diseño | Diferencia geométrica y acabado | Afinación sugerida para web |
|---|---|---|
| Azul Caribe | Perlado azul, perforaciones romboidales, nervaduras en espiga y dos filetes de níquel en la mejilla exterior | ADG |
| Marfil Artesanal | Perlado marfil, ranuras verticales, motivos romboidales en el marco y decoración metálica lateral | F/B♭/E♭ |
| Negro Escenario | Grafito, ranuras horizontales, cantoneras protectoras y filetes vino | EAD |

Cada carpeta contiene `instrument.blend`, `instrument.glb`, `preview.png` y `qa_report.json`. El archivo `designs.json` usa rutas relativas a la carpeta `assets/blender/realistic`, para compartir los sonidos, los controles de pulsación y la lógica web.

Además, cada subcarpeta `renders/` contiene cuatro vistas PNG: frontal, tres cuartos abierto, tres cuartos cerrado y detalle de botones/fuelle. `QA_poses.png` reúne las tres posiciones principales para comparación visual. El informe final de los cuatro archivos entregados es `../collection_qa.json`; se reabrieron todas las fuentes y se compararon nuevamente con sus exportaciones.

Los controles y nombres de huesos son los mismos que en el modelo base. Las cajas conservan escala 1, el fuelle cambia su espaciado y cada botón tiene un hueso propio. La biblioteca de audio del archivo base se conserva empaquetada en los `.blend`; no se añaden pistas de audio a sus líneas de tiempo. Las afinaciones sugeridas son metadatos para el reproductor web, no alteraciones de la geometría ni grabaciones acústicas nuevas.

Se ejecutaron las comprobaciones numéricas de los **310 cuadros enteros de las cuatro acciones por modelo**: conteos, escala rígida de las cajas, traslación coordinada y recorrido de las teclas. Se comprobó que el fuelle es una sola componente manifold, sin aristas abiertas. Se reimportó cada GLB en una escena vacía a 30 fps y se compararon muestras de geometría animada en 17 poses, con tolerancia de 0,00001 m. Los resultados exactos y errores medidos están en cada informe.

Las imágenes son renders Cycles de Blender, inspeccionados visualmente. **La validación de las variantes se realizó mediante evaluación de cuadros y reimportación, no reproducción manual adicional en la interfaz de Blender.** Los renders muestran una pose a medio recorrido; los extremos también se evaluaron numéricamente. La simulación de lengüetas, válvulas internas y torsión del instrumento queda fuera de este exterior animado.

Generación: `blender -b --python tools/build_accordion_variants.py`. Para regenerar solo un diseño: `blender -b --python tools/build_accordion_variants.py -- --only azul-caribe`.
