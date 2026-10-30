"""Package verified offline model deliverables, without changing the website."""
from pathlib import Path
import json, hashlib, zipfile
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/blender/curved_v2'
DESIGNS=[('curva-zafiro','Curva Zafiro'),('curva-esmeralda','Curva Esmeralda'),('curva-granate','Curva Granate'),('curva-grafito','Curva Grafito')]
fontpath='C:/Windows/Fonts/segoeui.ttf'
font=ImageFont.truetype(fontpath,25)
small=ImageFont.truetype(fontpath,19)

def sheet(items, path, columns=2):
    canvas=Image.new('RGB',(columns*750,((len(items)+columns-1)//columns)*665),(27,33,42))
    draw=ImageDraw.Draw(canvas)
    for i,(file,title) in enumerate(items):
        x=i%columns*750;y=i//columns*665
        im=Image.open(file).convert('RGB');im.thumbnail((750,620))
        canvas.paste(im,(x+(750-im.width)//2,y))
        draw.text((x+24,y+623),title,font=font,fill='white')
    canvas.save(path)

motion=BASE/'motion_previews';motion.mkdir(exist_ok=True)
for action,name in [('Bellows_OpenClose','01_abanico'),('Bellows_Expressive_Arc','02_arco_expresivo')]:
    paths=sorted((BASE/'_motion_frames'/action).glob('*.png'))
    assert len(paths)==(48 if action=='Bellows_OpenClose' else 64),(action,len(paths))
    frames=[Image.open(p).convert('RGB').quantize(colors=160,method=Image.Quantize.MEDIANCUT) for p in paths]
    frames[0].save(motion/(name+'.gif'),save_all=True,append_images=frames[1:],duration=125,loop=0,optimize=False,disposal=2)

sheet([(BASE/i/'renders/02_abanico_superior.png',name) for i,name in DESIGNS],BASE/'coleccion_curva.png')
blue=BASE/'curva-zafiro/renders'
sheet([(blue/(name+'.png'),label) for name,label in [
    ('03_tres_cuartos_cerrado','Cerrado · cajas rígidas'),
    ('02_abanico_superior','Abanico superior'),
    ('05_abanico_inferior','Abanico inferior'),
    ('06_bajos_anclados','Lado melódico fijo'),
    ('07_apertura_oblicua','Apertura oblicua'),
    ('08_arco_expresivo','Arco expresivo')]],BASE/'poses_del_fuelle.png')

entries=[]
for design,name in DESIGNS:
    folder=BASE/design;q=json.loads((folder/'qa_report.json').read_text())
    assert q['passed'] and q['clean_reimport'] and q['melody_buttons']==31 and q['bass_buttons']==12
    assert len(q['animations'])==9 and q['frames_evaluated']==1971
    assert q['button_press_coverage']['Melody_Button_Press']['count']==31
    assert q['button_press_coverage']['Bass_Button_Press']['count']==12
    for file,key in [('instrument.blend','source_sha256'),('instrument.glb','glb_sha256')]:
        assert hashlib.sha256((folder/file).read_bytes()).hexdigest()==q[key],(design,file)
    assert len(list((folder/'renders').glob('*.png')))==(8 if design=='curva-zafiro' else 4)
    entries.append(dict(id=design,name=name,blend=f'{design}/instrument.blend',glb=f'{design}/instrument.glb',preview=f'{design}/preview.png',qa=f'{design}/qa_report.json',melody_buttons=31,bass_buttons=12,folds=20,triangles=q['triangles'],glb_bytes=q['bytes'],actions=q['action_ranges']))
ui=json.loads((BASE/'ui_playback.json').read_text())
assert ui['complete'] and len(ui['actions'])==9
assert all(a['loop_wraps_observed']>=1 for a in ui['actions'])
manifest=dict(collection='AcordenRush Curva V2',fps=30,units='meters',dimensions='Artistic estimates, not measured from reference photographs',web_integration=False,designs=entries)
(BASE/'collection.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')

README='''# AcordenRush · Colección Curva V2

Cuatro assets adicionales: **Curva Zafiro, Curva Esmeralda, Curva Granate y Curva Grafito**. Comparten una nueva familia de cajas abombadas con hombros redondeados, teclado saliente sobre ala, rejilla curva perforada, lamas metálicas, acabado perlado facetado y rombo textil original. Son variantes cromáticas de esta familia nueva; no son cuatro construcciones mecánicas distintas. La colección anterior permanece aparte. No se integraron estos archivos en la web.

Cada carpeta contiene `instrument.blend`, `instrument.glb`, `preview.png`, cuatro renders PNG y `qa_report.json`. Zafiro incluye cuatro vistas adicionales de movimiento. `coleccion_curva.png` compara los colores; `poses_del_fuelle.png` compara aperturas; `motion_previews/` contiene dos GIF renderizados desde las animaciones reales. No son simulaciones dibujadas sobre imágenes.

## Modelo y escala

31 botones melódicos en hileras 10/11/10 y 12 bajos en **seis filas por dos columnas**, según las nuevas fotografías. Este último arreglo sustituye, para esta familia, el 4×3 solicitado inicialmente. Cada pulsador tiene soporte, aro, vástago y cabeza; los soportes permanecen sobre su placa. Hay 20 pliegues continuos con superficie interior y exterior, ribetes y esquinas, enganches, tornillos y correas. Insignia original AcordenRush/AR; no se copiaron marcas de los fabricantes fotografiados.

Unidades: metros, 30 fps, escala de objetos 1. Las medidas son estimaciones artísticas, no medidas extraídas de las fotos. Altura aproximada de las cajas: 0,314 m; longitud central del fuelle de 0,095 m cerrado a 0,235 m abierto. El ancho total depende de la pose y del ala del teclado. No es un plano de fabricación.

## Controles editables en Blender

Seleccionar `RIG_AcordenRush_Curva`, modo Pose, hueso `CTRL_FUELLE`, propiedades personalizadas. Detener la reproducción y desvincular la acción activa antes de ajustar valores manualmente, pues sus claves sobrescriben los valores.

| Propiedad | Rango | Efecto |
|---|---|---|
| `apertura` | 0–1 | Expansión del fuelle |
| `abanico` | −1–1 | Inferior negativo / superior positivo |
| `lateral` | −1–1 | Desplazamiento espacial oblicuo |
| `torsion` | −1–1 | Torsión moderada |
| `anclaje` | 0–1 | Con 1 queda fijo el extremo melódico |

`CTRL_LADO_BAJO` y `CTRL_LADO_MELODIA` siguen los anillos extremos. Mantener sus traslaciones locales en cero al editar el control maestro para conservar las juntas. No escalar las cajas. Los huesos `BTN_Melody_01…31` y `BTN_Bass_01…12` controlan pulsaciones locales en Y de hasta 1,8 mm, con retorno y rebote leve. Las dos acciones de pulsación recorren ahora TODOS los botones de su respectivo lado, uno por uno y en orden numérico. No son 43 clips individuales: son dos secuencias completas con 43 controles independientes editables.

El fuelle se deforma mediante 61 secciones sobre un arco espacial, con cajas rígidas solidarias a sus extremos. El abanico cambia el espacio entre pliegues arriba y abajo; la apertura oblicua añade curvatura lateral y torsión suave. No es una escala global ni una simulación física de tela. Los drivers son expresiones nativas de Blender, sin funciones Python externas. Evitar exceder los rangos documentados. Se incluyen las fuentes de generación y validación.

## Acciones

| Acción | Cuadros | Ciclo a 30 fps | Movimiento |
|---|---|---|---|
| `Idle_Breath_Loop` | 1–121 | 4 s | Respiración sutil |
| `Bellows_OpenClose` | 1–181 | 6 s | Abanico superior amplio |
| `Bellows_Fan_Lower` | 1–181 | 6 s | Abanico inferior |
| `Bass_Anchored_Phrase` | 1–181 | 6 s | Mueve bajos, extremo melódico fijo |
| `Bellows_Oblique_Sweep` | 1–181 | 6 s | Apertura espacial oblicua |
| `Bellows_Expressive_Arc` | 1–241 | 8 s | Combina inversión, abanico y torsión |
| `Bellows_Short_Accents` | 1–97 | 3,2 s | Acentos cortos |
| `Melody_Button_Press` | 1–565 | 18,8 s | Los 31 botones melódicos, uno por uno |
| `Bass_Button_Press` | 1–223 | 7,4 s | Los 12 bajos, uno por uno |

Las poses iniciales y finales coinciden. En GLB las acciones están horneadas como animaciones de esqueleto: no se exportan los drivers interactivos de Blender. Usar un clip de apertura a la vez. Para combinar pulsaciones con apertura, filtrar las pistas de los huesos `BTN_*`; los clips completos también contienen pistas horneadas del resto del esqueleto. No hay controlador web añadido en esta entrega.

En ambas secuencias, el botón número `i` inicia en el cuadro `5 + 18 × (i − 1)`, alcanza el máximo en `8 + 18 × (i − 1)`, vuelve a cero en `16 + 18 × (i − 1)` y termina el rebote en `21 + 18 × (i − 1)`. Los demás botones permanecen en reposo. Los nombres y rangos originales de las siete acciones de fuelle se conservan.

## Revisión ejecutada

Se reabrió cada BLEND final y se evaluaron sus nueve acciones: **1.971 cuadros por modelo**. Se comprobaron conteos, pesos de botones, escala rígida, coincidencia de extremos, drivers y cierre de loops. Además se comprobó que cada uno de los 43 botones alcanza 1,8 mm, vuelve a reposo al cerrar el loop y actúa sin hundir otro botón a la vez. Los cuadros de pulsación máxima de TODOS los botones se incluyeron también en la comparación del GLB reimportado. `button_press_coverage` en cada informe enumera los 43 botones y sus cuadros de máximo recorrido.

El fuelle es una sola componente cerrada, sin aristas no manifold. Sobre la geometría común de Zafiro se ejecutaron además 35 comprobaciones BVH de autointersección de tela: cinco poses por cada una de las siete acciones de fuelle, sin intersecciones detectadas. Estas muestras no equivalen a una prueba exhaustiva de todas las posibles combinaciones manuales.

Se reprodujeron realmente las nueve acciones en la interfaz de Blender para Zafiro y se observó al menos una vuelta de cada loop; `ui_playback.json` registra cuadros y vueltas. Los otros tres colores comparten geometría y rig y se evaluaron automáticamente; no se afirma reproducción manual separada de cada color. Se revisaron renders cerrados, abiertos, detalles y poses alternativas.

Cada GLB se reimportó en una escena limpia a 30 fps. Se verificaron nueve clips, ausencia de cámaras/luces y comparación de posiciones deformadas en muestras de cada acción. La desviación máxima registrada fue inferior a 0,00001 m. Los informes contienen errores y SHA-256 de los archivos exactos revisados.

## Exportación y límites

Cada GLB contiene una malla con submateriales, esqueleto y texturas incrustadas, alrededor de 132.000 triángulos y 10,2 MB. No contiene cámara, luces ni pedestal. Es un asset de detalle para visualización; no se midió rendimiento móvil ni se incluyen LOD o compresión Draco/KTX2. El BLEND conserva materiales de estudio y organización por subsistemas. La interpretación PBR de glTF puede variar respecto al render de Cycles.

La animación es cinemática y estilizada a partir de gestos reales; no reproduce presión, resistencia de cartón, acústica ni todos los gestos de un intérprete. No se generaron grabaciones de audio nuevas ni afinaciones distintas: el tono musical pertenece al banco de sonidos y al mapa de notas del reproductor, no al color del modelo. Esta entrega se limita a modelos, animaciones y renders, conforme al alcance indicado.

## Referencias y decisiones

Las fotografías aportadas guiaron la silueta redondeada, ala del teclado, 6×2 bajos, perlado, rejilla envolvente y abanico. Son referencias visuales y no autorizaciones para reproducir logotipos.

- [Gorka Hermosa — Accordion Technique Notebook, Elementary Level](https://www.gorkahermosa.com/web/img/publicaciones/3568a.pdf), pp. 6–7: apertura en abanico, apoyo de muñeca/antebrazo y reversión ligeramente circular. Orientó las familias superior/inferior y el cambio de dirección suavizado; no proporciona las dimensiones de estos modelos.
- [Victoria — Production techniques](https://www.accordions.it/en/production-techniques/): construcción del fuelle con pliegues profundos, refuerzos, esquinas y marcos ajustados. Orientó el detalle visual de la unión y ribetes.
- [Hohner — Corona III](https://hohner.de/de/instrumente/akkordeons/91/corona/corona-iii): referencia de formato 31 botones, tres hileras y 12 bajos. No se replica su marca ni se declara equivalencia comercial.

Consulta: 29 de octubre de 2026. Para regenerar, ejecutar Blender 5.2 con `--background --python tools/build_curved_accordions.py`; después `validate_curved_accordions.py`, `render_curved_accordions.py` y `render_curva_motion_previews.py`. El empaquetador usa Python con Pillow. Las rutas de salida se resuelven respecto a la raíz del paquete. La reproducción de interfaz usa `playback_curved_accordions.py` en Blender visible.
'''
(BASE/'LEEME_CONTROLES_Y_QA.md').write_text(README,encoding='utf8')

scripts=['build_curved_accordions.py','build_realistic_accordion.py','validate_curved_accordions.py','render_curved_accordions.py','render_curva_motion_previews.py','playback_curved_accordions.py','package_curved_accordions.py','update_curva_all_buttons.py']
files=[p for p in BASE.rglob('*') if p.is_file() and p.name!='SHA256SUMS.json' and '_motion_frames' not in p.parts and p.suffix in {'.blend','.glb','.png','.json','.md','.gif'}]
files += [ROOT/'tools'/s for s in scripts]
checks={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
checksum=BASE/'SHA256SUMS.json';checksum.write_text(json.dumps(checks,indent=2),encoding='utf8');files.append(checksum)
target=ROOT/'assets/blender/AcordenRush_Curva_V2_31_12.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,Path('AcordenRush_Curva_V2')/p.relative_to(ROOT))
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert sum(n.endswith('.blend') for n in z.namelist())==4
    assert sum(n.endswith('.glb') for n in z.namelist())==4
sha=hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix('.zip.sha256').write_text(sha+'  '+target.name+'\n',encoding='ascii')
print(json.dumps(dict(zip=str(target),bytes=target.stat().st_size,files=len(files),sha256=sha,qa_passed=4,ui_actions=9)))
