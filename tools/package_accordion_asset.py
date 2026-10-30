"""Make a portable local viewer + editable product asset bundle."""
from pathlib import Path
import json,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/blender/realistic'
DEST=ROOT/'assets/blender/AcordenRush_Realista_Asset.zip'
qa=json.loads((OUT/'qa_report.json').read_text());assert qa['checks']['clean_reimport']['passed']
assert json.loads((OUT/'button_interaction_qa.json').read_text())['passed']
assert json.loads((OUT/'audio/audio_qa.json').read_text())['passed']
assert json.loads((OUT/'audio/blend_audio_qa.json').read_text())['packed_sound_datablocks']==34
assert len(json.loads((OUT/'ui_playback.json').read_text()))==4
prefix='AcordenRush_Asset/'
files=[p for p in OUT.rglob('*') if p.is_file() and p.suffix!='.blend1']
sources=[ROOT/'tools'/name for name in ['build_realistic_accordion.py','export_realistic_accordion.py','validate_realistic_accordion.py','playback_realistic_accordion.py','pack_realistic_accordion_audio.py','prepare_accordion_audio.py','validate_button_interaction.mjs','package_accordion_asset.py']]
readme='''# AcordenRush — asset editable y sonoro

Abre `assets/blender/realistic/AcordeonVallenato_Realista.blend` en Blender 5.2. El archivo incluye materiales, rig, cuatro acciones y una biblioteca de 34 grabaciones CC0 empaquetadas como sound datablocks. Los sonidos no son pistas en la línea de tiempo.

Lee `assets/blender/realistic/NOTAS_ENTREGA.md` para controles, rangos, escala estimada y limitaciones. Allí están los cuatro renders PNG y los informes de QA.

Para el visor local: instala Node.js, abre esta carpeta, ejecuta `npm install` y después `npm run dev`. Abre la URL local que indique Vite. Activa el sonido y prueba los registros y todos los botones. El GLB contiene solo el instrumento; el audio se entrega en la carpeta complementaria y se controla con Web Audio.

Un modelo físico de 31/12 botones. Cuatro registros sonoros (natural, doble, musette, octava) y cuatro transposiciones; todos derivan de un mismo instrumento grabado. No se presentan como grabaciones independientes de distintos acordeones. Las proporciones y el mapa de notas son estimaciones/demostración, no una reproducción certificada de fabricante.

Los scripts en `tools/` regeneran/verifican los archivos dentro de `assets/blender/realistic/`. Las pruebas de audio se ejecutan abriendo `assets/blender/realistic/audio-qa.html` en el servidor. La prueba de pulsación usa `node tools/validate_button_interaction.mjs`. Los renders son de Blender; la reimportación GLB se verificó en una escena vacía a 30 fps.
'''
with zipfile.ZipFile(DEST,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files+sources:z.write(p,prefix+p.relative_to(ROOT).as_posix())
    z.writestr(prefix+'README.md',readme)
    z.writestr(prefix+'package.json',json.dumps({'name':'acordenrush-product-asset','version':'1.0.0','private':True,'type':'module','scripts':{'dev':'vite --host 127.0.0.1'},'dependencies':{'three':'0.172.0'},'devDependencies':{'vite':'6.4.5'}},indent=2))
    z.writestr(prefix+'index.html','<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/assets/blender/realistic/preview.html"><a href="/assets/blender/realistic/preview.html">Abrir el acordeón</a>')
with zipfile.ZipFile(DEST) as z:assert z.testzip() is None
checksum=hashlib.sha256(DEST.read_bytes()).hexdigest()
DEST.with_suffix('.zip.sha256').write_text(checksum+'  '+DEST.name+'\n',encoding='utf8')
print(json.dumps({'archive':str(DEST),'bytes':DEST.stat().st_size,'files':len(files)+len(sources)+3,'sha256':checksum},indent=2))
