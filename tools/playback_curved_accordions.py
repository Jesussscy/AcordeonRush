"""Real Blender UI playback of all nine actions on the common Curva rig."""
import bpy,time,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/curved_v2'
rig=bpy.data.objects['RIG_AcordenRush_Curva'];scene=bpy.context.scene
names=['Bellows_OpenClose','Bellows_Fan_Lower','Bass_Anchored_Phrase','Bellows_Oblique_Sweep','Bellows_Expressive_Arc','Bellows_Short_Accents','Idle_Breath_Loop','Melody_Button_Press','Bass_Button_Press']
state={'index':-1,'start':0,'last':0,'wraps':0,'frames':set(),'results':[]}
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.overlay.show_overlays=False;area.spaces.active.shading.type='SOLID';area.spaces.active.region_3d.view_perspective='CAMERA'
def tick():
    if not bpy.context.screen:return .1
    if state['index']>=0:
        frame=scene.frame_current;state['frames'].add(frame)
        if frame<state['last']:state['wraps']+=1
        state['last']=frame;elapsed=time.monotonic()-state['start']
        if (elapsed<7 or state['wraps']==0) and elapsed<90:return .08
        if bpy.context.screen.is_animation_playing:bpy.ops.screen.animation_cancel(restore_frame=False)
        state['results'].append(dict(action=names[state['index']],elapsed_seconds=elapsed,loop_wraps_observed=state['wraps'],observed_frames=sorted(state['frames']),actual_ui_playback=True))
        (BASE/'ui_playback.json').write_text(json.dumps(dict(design=scene['Design_id'],complete=False,actions=state['results']),indent=2),encoding='utf8')
    state['index']+=1
    if state['index']==len(names):
        (BASE/'ui_playback.json').write_text(json.dumps(dict(design=scene['Design_id'],complete=True,actions=state['results']),indent=2),encoding='utf8')
        rig.animation_data.action=bpy.data.actions['Bellows_OpenClose'];scene.frame_start=1;scene.frame_end=181;scene.frame_set(91)
        print('CURVA_UI_PLAYBACK_COMPLETE',flush=True);return None
    act=bpy.data.actions[names[state['index']]];rig.animation_data.action=act;scene.frame_start=int(act.frame_range[0]);scene.frame_end=int(act.frame_range[1]);scene.frame_set(scene.frame_start)
    state.update(start=time.monotonic(),last=scene.frame_current,wraps=0,frames=set());bpy.ops.screen.animation_play();return .08
bpy.app.timers.register(tick,first_interval=4)
