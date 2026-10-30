"""Embed companion recordings in the editable Blender file without altering geometry."""
import bpy,json,hashlib,struct
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'))
rig=bpy.data.objects['RIG_AcordenRush']
for curve in rig.animation_data.drivers:
    if 'CTRL_LADO_' in curve.data_path:
        curve.keyframe_points.clear();curve.update()
def geometry_hash():
    sha=hashlib.sha256()
    for o in sorted(bpy.data.objects,key=lambda o:o.name):
        if o.type!='MESH':continue
        sha.update(o.name.encode())
        for v in o.data.vertices:sha.update(struct.pack('<fff',*v.co))
        for poly in o.data.polygons:sha.update(struct.pack('<'+'I'*len(poly.vertices),*poly.vertices))
    return sha.hexdigest()
before=geometry_hash();count=0
for path in sorted((OUT/'audio/button-accordion-hn').rglob('*.flac')):
    sound=bpy.data.sounds.load(str(path),check_existing=True)
    sound.name='SND_'+path.stem.replace(' ','_');sound.use_fake_user=True;sound.pack()
    sound.filepath='//'+path.relative_to(OUT).as_posix();count+=1
for filename in ['audio/README.md','audio/button-accordion-hn/LICENSE.txt','audio/manifest.json']:
    name='AUDIO_'+Path(filename).name
    text=bpy.data.texts.get(name) or bpy.data.texts.new(name);text.clear();text.write((OUT/filename).read_text(encoding='utf8'))
after=geometry_hash();assert before==after and count==34
bpy.context.scene['Audio_library']='34 packed CC0 FLAC sound datablocks. No VSE timeline strips. Web synchronization uses accordion-audio.js; audio/README.md documents the single recorded instrument and virtual registers.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'),compress=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'))
packed=[s for s in bpy.data.sounds if s.packed_file]
assert len(packed)==34 and geometry_hash()==before
(OUT/'audio/blend_audio_qa.json').write_text(json.dumps({'packed_sound_datablocks':len(packed),'packed_audio_bytes':sum(s.packed_file.size for s in packed),'verified_after_reopening':True,'geometry_unchanged':before==after,'geometry_sha256':after,'vse_audio_strips':0},indent=2),encoding='utf8')
print('AUDIO_PACKED',count,'geometry unchanged',before,flush=True)
