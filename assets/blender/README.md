# Acordeón vallenato animado

La versión detallada está en [`realistic/`](realistic/NOTAS_ENTREGA.md): fuente `AcordeonVallenato_Realista.blend`, GLB, cuatro renders, rig de 43 botones, cuatro acciones y registros de verificación. El visor de Three.js permite probar las pulsaciones individuales. Los archivos siguientes corresponden al prototipo anterior, que se conserva como antecedente.

- `AcordeonVallenato_Animado.blend`: editable Blender source with studio lights, camera, separate boxes, 31 treble buttons, 12 bass buttons, and bellows.
- `AcordeonVallenato_Animado.glb`: animated instrument-only export for a web scene; the studio floor, camera, and lights are excluded.
- `AcordeonVallenato_preview.png`: rendered three-quarter open pose.
- `AcordeonVallenato_cerrado.png`: closed pose.
- `AcordeonVallenato_frontal.png`: front view.\n- `AcordeonVallenato_detalle.png`: closer three-quarter detail.

Open the `.blend` in Blender and press **Space** to play the 192-frame loop. Scrub frames 1–48 to see the bellows open; 48–96 closes it. The bellows cloth has an `Abierto · tela extendida` shape key and the raised folds have an `Abierto · fuelle extendido` shape key. End boxes slide with the bellows, and treble buttons have simple press animations.

This is a stylized first pass built from editable meshes. It is not a photogrammetric/manufacturer-accurate Corona III model. The Blender generator is `tools/build_accordion_blender.py` in the project root.

The latest user-supplied diapasón chart is packed into the .blend as an image reference. Select any of the 31 treble button objects to inspect custom properties for GCF, FBbEb, and EAD. The chart's hacia fuera notes are stored as pull (draw/open bellows); hacia dentro notes are stored as push (compress bellows). Its original letter case and -/+ register notation are preserved without inventing octave-specific frequencies.
