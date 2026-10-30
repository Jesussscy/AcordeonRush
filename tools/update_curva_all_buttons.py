"""Upgrade existing Curva assets with complete sequential 31/12 button presses."""
import bpy,ast,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/curved_v2'
for filename,names in [('build_realistic_accordion.py',{'join_objects'}),('build_curved_accordions.py',{'actions_create','export_glb'})]:
    source=ast.parse((ROOT/'tools'/filename).read_text(encoding='utf8'))
    exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),filename,'exec'))
for design in ['curva-zafiro','curva-esmeralda','curva-granate','curva-grafito']:
    directory=BASE/design;bpy.ops.wm.open_mainfile(filepath=str(directory/'instrument.blend'))
    rig=bpy.data.objects['RIG_AcordenRush_Curva'];scene=bpy.context.scene
    rig.animation_data.action=None
    for act in list(bpy.data.actions):bpy.data.actions.remove(act)
    buttons=[dict(bone=b.name,name=b.name.removeprefix('BTN_')) for b in rig.pose.bones if b.name.startswith('BTN_')]
    ranges=actions_create();scene['Action_ranges']=json.dumps(ranges)
    scene['Button_animation_coverage']='Melody_Button_Press: all 31 sequentially, frames 1..565. Bass_Button_Press: all 12 sequentially, frames 1..223. Travel 1.8mm with return and small rebound. 30fps.'
    note=bpy.data.texts['CURVA_CONTROLS_AND_LIMITS.txt'];note.write('\nUPDATED COMPLETE BUTTON COVERAGE\n'+scene['Button_animation_coverage']+'\n'+json.dumps(ranges,indent=2))
    rig.animation_data.action=bpy.data.actions['Bellows_OpenClose'];scene.frame_start=1;scene.frame_end=181;scene.frame_set(91)
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'instrument.blend'),compress=True)
    export_glb(directory/'instrument.glb')
    print('ALL_BUTTONS_UPDATED',design,flush=True)
