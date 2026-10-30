"""Publish local model exports into the local web assets, preserving old versions."""
from pathlib import Path
import hashlib,json,shutil,struct
root=Path(__file__).resolve().parents[1]
dest=root/'public/instruments/models'
backup=root/'artifacts/model-backups'
backup.mkdir(parents=True,exist_ok=True)
report={}
for path in sorted(dest.glob('*.glb')):
    source=root/'assets/blender/curved_v2'/path.stem/'instrument.glb'
    if source.exists():
        old=hashlib.sha256(path.read_bytes()).hexdigest()
        new=hashlib.sha256(source.read_bytes()).hexdigest()
        if old!=new:
            copy=backup/(path.stem+'-'+old[:12]+'.glb')
            if not copy.exists():shutil.copy2(path,copy)
            shutil.copy2(source,path)
        shutil.copy2(source.with_name('preview.png'),path.with_suffix('.png'))
    data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size])
    report[path.stem]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'clips':[a['name'] for a in gltf['animations']],
                       'bassRows':6 if source.exists() else 4,'bassColumns':2 if source.exists() else 3,
                       'source':str(source.relative_to(root)).replace('\\','/') if source.exists() else 'Previous collection, preserved'}
(dest/'model-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('Synced',len(report),'web designs; updated Curva GLBs and previews, preserved previous binaries.')
