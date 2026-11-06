"""Publish local model exports into the local web assets, preserving old versions."""
from pathlib import Path
import hashlib,json,shutil,struct
root=Path(__file__).resolve().parents[2]
dest=root/'assets/models/accordion'
backup=root/'artifacts/model-backups'
backup.mkdir(parents=True,exist_ok=True)
report={}
for path in sorted(dest.glob('*.glb')):
    source=root/'art/blender/curved_v2'/path.stem/'instrument.glb'
    curva=path.stem.startswith('curva-')
    if source.exists():
        old=hashlib.sha256(path.read_bytes()).hexdigest()
        new=hashlib.sha256(source.read_bytes()).hexdigest()
        if old!=new:
            copy=backup/(path.stem+'-'+old[:12]+'.glb')
            if not copy.exists():shutil.copy2(path,copy)
            shutil.copy2(source,path)
        # Full-size PNG goes to art/previews; the game uses a light WebP thumbnail.
        shutil.copy2(source.with_name('preview.png'),root/'art/previews'/(path.stem+'.png'))
        from PIL import Image
        image=Image.open(source.with_name('preview.png'));image.thumbnail((640,480))
        image.save(path.with_suffix('.webp'),'WEBP',quality=82,method=6)
    data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size])
    report[path.stem]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'clips':[a['name'] for a in gltf['animations']],
                       # Curva rigs use a 6x2 bass grid; the previous collection uses 4x3.
                       'bassRows':6 if curva else 4,'bassColumns':2 if curva else 3,
                       'source':f'art/blender/curved_v2/{path.stem}/instrument.blend (export)' if curva else 'Previous collection, preserved'}
(root/'data/accordion-models.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('Synced',len(report),'web designs; updated Curva GLBs and previews, preserved previous binaries.')
