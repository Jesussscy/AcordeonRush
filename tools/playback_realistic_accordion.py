"""Run in foreground Blender with the saved blend for real UI playback evidence."""
import bpy,time,json
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
rig=bpy.data.objects['RIG_AcordenRush'];scene=bpy.context.scene
names=['Bellows_OpenClose','Idle_Breath_Loop','Melody_Button_Press','Bass_Button_Press']
state={'index':-1,'started':0,'last':0,'wraps':0,'seen':set(),'actions':[]}
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_perspective='CAMERA'
def timer():
    screen=bpy.context.screen
    if screen is None:return .2
    if state['index']>=0:
        current=scene.frame_current
        state['seen'].add(current)
        if current<state['last']:state['wraps']+=1
        state['last']=current
        if time.monotonic()-state['started']<7 or state['wraps']<1:
            if time.monotonic()-state['started']<45:return .05
        if screen.is_animation_playing:bpy.ops.screen.animation_cancel(restore_frame=False)
        state['actions'].append({'action':names[state['index']],'elapsed_seconds':time.monotonic()-state['started'],'loop_wraps_observed':state['wraps'],'observed_frames':sorted(state['seen']),'actual_screen_playback':True})
    state['index']+=1
    if state['index']>=len(names):
        (OUT/'ui_playback.json').write_text(json.dumps(state['actions'],indent=2),encoding='utf8')
        rig.animation_data.action=bpy.data.actions['Bellows_OpenClose'];scene.frame_start=1;scene.frame_end=121;scene.frame_set(61)
        print('UI_PLAYBACK_COMPLETE',flush=True)
        return None
    name=names[state['index']];act=bpy.data.actions[name]
    rig.animation_data.action=act
    scene.frame_start=int(act.frame_range[0]);scene.frame_end=int(act.frame_range[1]);scene.frame_set(scene.frame_start)
    state.update(started=time.monotonic(),last=scene.frame_current,wraps=0,seen=set())
    bpy.ops.screen.animation_play()
    return .05
bpy.app.timers.register(timer,first_interval=3)
