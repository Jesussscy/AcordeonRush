"""Model-only collection: no application source or website changes."""
from pathlib import Path
import json,hashlib,zipfile
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/realistic';OUT=ROOT/'assets/blender'
final_qa=json.loads((BASE/'collection_qa.json').read_text(encoding='utf8'))
assert final_qa['passed'] and len(final_qa['models'])==4 and all(m['passed'] for m in final_qa['models'])
designs=[dict(id='vino-clasico',name='Vino Clásico',description='Perlado vino y parrilla perforada de níquel.',tuning='GCF',blend='AcordeonVallenato_Realista.blend',glb='AcordeonVallenato_Realista.glb',preview='renders/02_three_quarter_open.png')]
for d in json.loads((BASE/'variants/designs.json').read_text(encoding='utf8')):
    qa=json.loads((BASE/'variants'/d['id']/'qa_report.json').read_text());assert qa['passed'] and qa['melody_buttons']==31 and qa['bass_buttons']==12
    designs.append(dict(id=d['id'],name=d['name'],description=d['description'],tuning=d['defaultTuning'],blend=d['blend'],glb=d['path'],preview=d['thumbnail']))
manifest=dict(system='Diatonic 31 melody buttons / 12 bass buttons',rows=[10,11,10],bassLayout=[4,3],folds=20,estimatedUnits='metres',controls=['CTRL_LADO_BAJO','CTRL_LADO_MELODIA','CTRL_FUELLE'],actions=[dict(name='Idle_Breath_Loop',frames=[1,91]),dict(name='Bellows_OpenClose',frames=[1,121]),dict(name='Melody_Button_Press',frames=[1,49]),dict(name='Bass_Button_Press',frames=[1,49])],fps=30,designs=designs,tuningNote='Tuning is suggested integration metadata. It does not change geometry or identify a newly recorded acoustic instrument.')
(BASE/'collection.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
canvas=Image.new('RGB',(1880,1820),'#151b21');draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',39);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
draw.text((44,28),'ACORDENRUSH / COLECCIÓN DIATÓNICA',font=font,fill='#f5efe4')
draw.text((46,86),'4 diseños originales · 31 botones melódicos + 12 bajos · rig y animaciones',font=small,fill='#b4bec6')
for index,d in enumerate(designs):
    x=40+(index%2)*920;y=140+(index//2)*830
    tile=ImageOps.contain(Image.open(BASE/d['preview']).convert('RGB'),(890,735),Image.Resampling.LANCZOS)
    canvas.paste(tile,(x+(890-tile.width)//2,y))
    draw.text((x+16,y+743),d['name'].upper(),font=font,fill='#f4ede0')
    draw.text((x+18,y+792),f"31 / 12 · {d['tuning']} sugerida",font=small,fill='#bac6cc')
canvas.save(BASE/'Coleccion_AcordenRush.png')
readme='''# Colección AcordenRush — modelos 3D

Cuatro diseños diatónicos originales: Vino Clásico, Azul Caribe, Marfil Artesanal y Negro Escenario. Todos tienen 31 botones de melodía (10/11/10), 12 bajos (4×3), fuelle continuo de 20 pliegues y controles compatibles. Las rejillas, ribetes y adornos presentan geometría distinta entre diseños.

`collection.json` identifica cada `.blend`, `.glb` e imagen. Abre la fuente en Blender 5.2. Las variantes adicionales están en `variants/<diseño>/`. Se incluyen cuatro vistas PNG por diseño y un montaje comparativo.

Acciones a 30 fps: `Idle_Breath_Loop` 1–91; `Bellows_OpenClose` 1–121; `Melody_Button_Press` 1–49; `Bass_Button_Press` 1–49. Los controles se llaman `CTRL_LADO_BAJO`, `CTRL_LADO_MELODIA` y `CTRL_FUELLE`. Escala X local del fuelle: 1 a 2,5454545; las cajas solo se trasladan y mantienen su escala. Los huesos `BTN_Melody_01`…`31` y `BTN_Bass_01`…`12` permiten pulsar cada cabeza y vástago individualmente, con recorrido Y local +0,0018 m.

GCF, ADG, F/B♭/E♭ y EAD son afinaciones sugeridas como metadatos de integración. No cambian la geometría. La biblioteca CC0 de 34 grabaciones se conserva del archivo base; los registros derivados no se presentan como instrumentos distintos grabados. No se modifica ni integra la web desde este paquete.

Las proporciones son estimaciones artísticas. No son medidas certificadas ni reproducciones de fabricante. Se omiten lengüetas y válvulas internas, simulación acústica, torsión y apertura en abanico. Los materiales finos de bump/roughness de Blender se simplifican para glTF. Cada GLB contiene solo el instrumento con skin, materiales y cuatro animaciones; no contiene cámara, luces ni suelo.

Los informes `qa_report.json` documentan conteos, continuidad manifold, 310 cuadros enteros evaluados por diseño y reimportación en escenas vacías a 30 fps. `variants/ui_playback_collection.json`, cuando está incluido, registra la reproducción real adicional en la interfaz. La evaluación numérica y la reproducción de pantalla se distinguen explícitamente. Los `.blend` contienen la biblioteca de sonidos empaquetada; no hay pistas sonoras en la línea de tiempo.

Los scripts de generación y revisión están en `fuentes/`. Para regenerar, colócalos en `tools/` de un proyecto con estos archivos dentro de `assets/blender/realistic/`, siguiendo las instrucciones de las notas. Se conserva la documentación detallada en `NOTAS_ENTREGA.md` y `variants/README.md`.
'''
(BASE/'LEEME_COLECCION.md').write_text(readme,encoding='utf8')
required=['AcordeonVallenato_Realista.blend','AcordeonVallenato_Realista.glb','collection.json','collection_qa.json','Coleccion_AcordenRush.png','LEEME_COLECCION.md','NOTAS_ENTREGA.md','qa_report.json','ui_playback.json','button_interaction_qa.json']
for d in designs:
    renderdir=BASE/'renders' if d['id']=='vino-clasico' else BASE/'variants'/d['id']/'renders'
    for name in ['01_front.png','02_three_quarter_open.png','03_three_quarter_closed.png','04_detail_buttons_bellows.png']:
        assert (renderdir/name).is_file(),f'Missing render {d["id"]}: {name}'
files=[BASE/name for name in required]
for folder in ['renders','variants','audio']:
    files.extend(p for p in (BASE/folder).rglob('*') if p.is_file() and p.suffix!='.blend1')
sources=[ROOT/'tools'/name for name in ['build_realistic_accordion.py','build_accordion_variants.py','export_realistic_accordion.py','validate_realistic_accordion.py','validate_accordion_collection.py','pack_realistic_accordion_audio.py','prepare_accordion_audio.py','playback_realistic_accordion.py','playback_accordion_collection.py','render_accordion_collection.py','package_accordion_collection.py']]
dest=OUT/'AcordenRush_Coleccion_31_12.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,'AcordenRush_Coleccion/'+p.relative_to(BASE).as_posix())
    for p in sources:z.write(p,'AcordenRush_Coleccion/fuentes/'+p.name)
with zipfile.ZipFile(dest) as z:assert z.testzip() is None
sha=hashlib.sha256(dest.read_bytes()).hexdigest();dest.with_suffix('.zip.sha256').write_text(sha+'  '+dest.name+'\n',encoding='utf8')
print(json.dumps(dict(archive=str(dest),bytes=dest.stat().st_size,models=len(designs),files=len(files)+len(sources),sha256=sha),indent=2))
