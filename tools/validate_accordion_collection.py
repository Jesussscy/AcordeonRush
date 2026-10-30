"""Final read-only validation of the actual four delivered sources and GLBs."""
import bpy,bmesh,ast,json,struct,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/realistic'
source=ast.parse((ROOT/'tools/build_accordion_variants.py').read_text(encoding='utf8'))
functions=ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in ['source_validation','validate_import']],type_ignores=[])
exec(compile(functions,'collection verification helpers','exec'))
models=[('vino-clasico',BASE/'AcordeonVallenato_Realista.blend',BASE/'AcordeonVallenato_Realista.glb')]+[(d,BASE/'variants'/d/'instrument.blend',BASE/'variants'/d/'instrument.glb') for d in ['azul-caribe','marfil-artesanal','negro-escenario']]
results=[]
for name,blend,glb in models:
    bpy.ops.wm.open_mainfile(filepath=str(blend));scene=bpy.context.scene;rig=bpy.data.objects['RIG_AcordenRush']
    packed=sum(1 for sound in bpy.data.sounds if sound.packed_file)
    assert packed==34,(name,'missing packed sound library',packed)
    expected,qa=source_validation();qa.update(validate_import(glb,expected))
    qa.update(design=name,passed=True,packed_sounds=packed,source_sha256=hashlib.sha256(blend.read_bytes()).hexdigest(),glb_sha256=hashlib.sha256(glb.read_bytes()).hexdigest())
    results.append(qa);print('COLLECTION_FINAL_QA_PASS',name,flush=True)
report=dict(passed=True,method='Saved final sources reopened; 310 integer frames per model; clean GLB reimport at 30 fps, 17 poses per design; packed sound library count; file hashes.',gui_playback_all_variants_completed=False,models=results)
(BASE/'collection_qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
