# AcordenRush — acordeón diatónico

Colección ampliada: `collection.json` y `LEEME_COLECCION.md` reúnen Vino Clásico, Azul Caribe, Marfil Artesanal y Negro Escenario. Todos mantienen la misma plataforma 31/12 y controles compatibles. `collection_qa.json` verifica los cuatro archivos fuente finales frente a sus GLB. Las variantes están en `variants/` con sus vistas y notas propias.

Fuente editable: `AcordeonVallenato_Realista.blend`. Exportación: `AcordeonVallenato_Realista.glb`. El prototipo `../AcordeonVallenato_Animado.blend` se conserva como antecedente.

## Referencias y escala

Se revisaron las cuatro fotografías adjuntas: rojo perlado y ribetes en las dos primeras; herrajes, correas y construcción del fuelle en la tercera; separación entre botonera, parrilla, fuelle y bajos en la cuarta. Las referencias incluyen instrumentos de piano y cromáticos. Se adoptó la especificación diatónica del encargo: 31 botones de melodía en tres hileras de 10/11/10 y 12 bajos en cuatro filas por tres columnas, escalonados. No se reprodujeron los logotipos ni las marcas de agua de las fotografías.

Las fotografías no aportan medidas. Todas las dimensiones son estimaciones artísticas en metros: altura de carcasa 0,322 m; profundidad de carcasa 0,164 m; ancho del fuelle cerrado 0,110 m y abierto 0,280 m. No son cotas certificadas de un instrumento comercial. Eje X: apertura; Y negativo: frente; Z: arriba. GLB convierte a Y arriba conforme a glTF.

## Controles

Selecciona `RIG_AcordenRush` y entra en Pose Mode. Los controles principales se llaman `CTRL_LADO_BAJO`, `CTRL_LADO_MELODIA` y `CTRL_FUELLE`.

- `CTRL_FUELLE`: escala **local X** entre **1,0** y **2,5454545**. Solo deforma el espaciado del fuelle; dos drivers trasladan las cajas en sentidos opuestos. El instrumento completo y las cajas conservan escala 1. Evita superar ese rango.
- `CTRL_LADO_BAJO` y `CTRL_LADO_MELODIA`: controles de los conjuntos rígidos. Su posición X está coordinada por los drivers. Para edición manual independiente se pueden silenciar esos drivers, pero hay que mantener los extremos del fuelle coincidentes. El movimiento normal se realiza desde `CTRL_FUELLE`.
- `BTN_Melody_01` a `BTN_Melody_31` y `BTN_Bass_01` a `BTN_Bass_12`: desplaza su Y local de 0 a +0,0018 m para pulsar. Cabeza y vástago se mueven juntos; anillo y guía permanecen en la placa.

La malla del fuelle es una sola envolvente conectada, cerrada y con grosor, con 20 pliegues. No son barras superpuestas a una caja. Tiene superficies interior/exterior, uniones en ambos extremos y ribetes integrados. La deformación es esquelética: la escala X cambia únicamente las distancias entre los pliegues. Las cajas usan huesos distintos sin escala.

## Acciones a 30 fps

| Acción | Cuadros | Duración del ciclo | Comportamiento |
|---|---:|---:|---|
| `Idle_Breath_Loop` | 1–91 | 3 s | Respiración leve entre 9 % y 17 % de apertura |
| `Bellows_OpenClose` | 1–121 | 4 s | Cerrado en 1/121, medio recorrido en 31/91, abierto en 61 |
| `Melody_Button_Press` | 1–49 | 1,6 s | Botones 05, 16 y 26; fuelle sostenido al 12 % |
| `Bass_Button_Press` | 1–49 | 1,6 s | Bajos 04 y 08, independientes de la melodía |

Cada clip vuelve al estado inicial con interpolación suave. En Action Editor selecciona el rig, elige la acción, ajusta el rango indicado y pulsa Espacio. Las pulsaciones se entregan como clips completos con pose de reposo explícita. Para mezclar una pulsación con el fuelle en Three.js, filtra los tracks por `BTN_Melody_` o `BTN_Bass_` y crea un `AnimationClip` que contenga solo esos tracks; las pistas de reposo de los demás huesos pueden competir si se reproducen ambos clips completos simultáneamente.

## Materiales y web

El paquete también incluye audio real CC0, 17 muestras de sustain y 17 de liberación, más cuatro registros virtuales y cuatro transposiciones. Consulta `audio/README.md`. Es una sola fuente grabada con variaciones; no son cuatro modelos físicos de acordeón. El visor dispone de activación de sonido, registro, afinación, sentido y presión de fuelle.

Laca rojo vino con mapa de variación perlada, nácar cálido, negro satinado, tela mate, cuero, acero y acentos pequeños de latón. Hay UVs explícitas y texturas base embebidas. El detalle fino de bump y la variación procedural de rugosidad se conservan en Blender; GLB utiliza los colores texturizados y los parámetros PBR escalares. No se entrega una simulación óptica multicapa de nácar.

El GLB contiene un skin consolidado, un esqueleto y cuatro animaciones muestreadas. Se excluyen cámara, luces y suelo. No necesita Draco. En Three.js se carga con `GLTFLoader`; usa un entorno de iluminación, `AnimationMixer` y `gltf.animations.find(clip => clip.name === 'Bellows_OpenClose')`. Las luces de estudio del `.blend` no viajan al archivo.

`button-interaction.js` añade pulsación a cualquiera de los 43 botones, sin crear 43 clips. Crea el controlador con `createButtonInteraction(gltf)`. En `keydown` llama a `press('Melody_01')` o `press('Bass_01')`; en `keyup` llama a `release(...)`. Ejecuta `update(dt)` después de `AnimationMixer.update(dt)`. Mantiene la pulsación mientras se sostiene la entrada y devuelve la cabeza al soltar, con transiciones de 26/40 ms. Obtiene dirección y profundidad de las pistas exportadas, para respetar los ejes del GLB. `releaseAll()` sirve para pérdida de foco. La prueba real de Three.js sobre los 43 huesos está en `button_interaction_qa.json`.

El visor `preview.html` permite probar los cuatro clips y presionar todos los botones, incluso sobre la geometría. Desde la raíz del proyecto ejecuta `npm run dev -- --host 127.0.0.1 --port 5178` y visita `http://127.0.0.1:5178/assets/blender/realistic/preview.html`. Este visor es una demostración independiente; la interfaz del juego existente no se ha sustituido.

## Renders y verificación

`renders/01_front.png`, `02_three_quarter_open.png`, `03_three_quarter_closed.png` y `04_detail_buttons_bellows.png` son renders de Blender. `qa_report.json` registra las comprobaciones ejecutadas y sus tolerancias; `ui_playback.json` registra reproducción real en la interfaz de Blender. Consulta esos registros para distinguir comprobación geométrica, reimportación y reproducción de pantalla.

Generación reproducible desde la raíz: `blender -b --python tools/build_realistic_accordion.py`. Validación: `blender -b --python tools/validate_realistic_accordion.py`. Los scripts requieren Blender 5.2; no instalan dependencias. `-- --no-render` omite los renders en la generación.

## Límites

Se modelan el exterior, los montajes de botones y los accesorios. No se incluyen lengüetas, válvulas internas, mecánica acústica funcional ni simulación física de tela. La apertura es simétrica y rectilínea; no incorpora el abanico inclinado ni la torsión de una interpretación real. Los broches de cierre están estacionados sobre las tapas y las correas se mueven rígidamente con su caja. La continuidad se garantiza para el recorrido del control maestro y las acciones entregadas, no para poses arbitrarias que se editen fuera de él. El rendimiento debe medirse en el dispositivo web objetivo.
