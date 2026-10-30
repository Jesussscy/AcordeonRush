"""Render actual Blender poses to GIF previews; source files are never saved."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/curved_v2'
bpy.ops.wm.open_mainfile(filepath=str(BASE/'curva-zafiro/instrument.blend'))
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE'
if hasattr(s,'eevee') and hasattr(s.eevee,'taa_render_samples'):s.eevee.taa_render_samples=16
s.render.resolution_x=720;s.render.resolution_y=600;s.render.resolution_percentage=100
rig=bpy.data.objects['RIG_AcordenRush_Curva']
for action,count in [('Bellows_OpenClose',48),('Bellows_Expressive_Arc',64)]:
    rig.animation_data.action=bpy.data.actions[action];first,last=rig.animation_data.action.frame_range
    path=BASE/'_motion_frames'/action;path.mkdir(parents=True,exist_ok=True)
    for i in range(count):
        f=first+(last-first)*i/count;s.frame_set(int(f),subframe=f-int(f));s.render.filepath=str(path/('%03d.png'%i));bpy.ops.render.render(write_still=True)
    print('MOTION_FRAMES_COMPLETE',action,count,flush=True)
