# Colección AcordenRush — modelos 3D

Cuatro diseños diatónicos originales: Vino Clásico, Azul Caribe, Marfil Artesanal y Negro Escenario. Todos tienen 31 botones de melodía (10/11/10), 12 bajos (4×3), fuelle continuo de 20 pliegues y controles compatibles. Las rejillas, ribetes y adornos presentan geometría distinta entre diseños.

`collection.json` identifica cada `.blend`, `.glb` e imagen. Abre la fuente en Blender 5.2. Las variantes adicionales están en `variants/<diseño>/`. Se incluyen cuatro vistas PNG por diseño y un montaje comparativo.

Acciones a 30 fps: `Idle_Breath_Loop` 1–91; `Bellows_OpenClose` 1–121; `Melody_Button_Press` 1–49; `Bass_Button_Press` 1–49. Los controles se llaman `CTRL_LADO_BAJO`, `CTRL_LADO_MELODIA` y `CTRL_FUELLE`. Escala X local del fuelle: 1 a 2,5454545; las cajas solo se trasladan y mantienen su escala. Los huesos `BTN_Melody_01`…`31` y `BTN_Bass_01`…`12` permiten pulsar cada cabeza y vástago individualmente, con recorrido Y local +0,0018 m.

GCF, ADG, F/B♭/E♭ y EAD son afinaciones sugeridas como metadatos de integración. No cambian la geometría. La biblioteca CC0 de 34 grabaciones se conserva del archivo base; los registros derivados no se presentan como instrumentos distintos grabados. No se modifica ni integra la web desde este paquete.

Las proporciones son estimaciones artísticas. No son medidas certificadas ni reproducciones de fabricante. Se omiten lengüetas y válvulas internas, simulación acústica, torsión y apertura en abanico. Los materiales finos de bump/roughness de Blender se simplifican para glTF. Cada GLB contiene solo el instrumento con skin, materiales y cuatro animaciones; no contiene cámara, luces ni suelo.

Los informes `qa_report.json` documentan conteos, continuidad manifold, 310 cuadros enteros evaluados por diseño y reimportación en escenas vacías a 30 fps. `variants/ui_playback_collection.json`, cuando está incluido, registra la reproducción real adicional en la interfaz. La evaluación numérica y la reproducción de pantalla se distinguen explícitamente. Los `.blend` contienen la biblioteca de sonidos empaquetada; no hay pistas sonoras en la línea de tiempo.

Los scripts de generación y revisión están en `fuentes/`. Para regenerar, colócalos en `tools/` de un proyecto con estos archivos dentro de `assets/blender/realistic/`, siguiendo las instrucciones de las notas. Se conserva la documentación detallada en `NOTAS_ENTREGA.md` y `variants/README.md`.
