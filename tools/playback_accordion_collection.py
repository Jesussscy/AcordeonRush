"""Reproduce all four clips of each design in real Blender UI; do not save scenes."""
import bpy,time,json
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
designs=['azul-caribe','marfil-artesanal','negro-escenario']
names=['Bellows_OpenClose','Idle_Breath_Loop','Melody_Button_Press','Bass_Button_Press']
state={'design':-1,'clip':-1,'started':0,'last':0,'wraps':0,'seen':set(),'report':[],'loading':True}
def view_setup():
    scene=bpy.context.scene
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.overlay.show_overlays=False
                area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.clip_start=.001
def tick():
    if not bpy.context.screen:return .2
    if state['loading']:
        state['design']+=1
        if state['design']==len(designs):
            (BASE/'variants/ui_playback_collection.json').write_text(json.dumps(state['report'],indent=2),encoding='utf8')
            print('COLLECTION_UI_PLAYBACK_COMPLETE',flush=True)
            return None
        target=BASE/'variants'/designs[state['design']]/'instrument.blend'
        if Path(bpy.data.filepath).resolve()!=target.resolve():bpy.ops.wm.open_mainfile(filepath=str(target))
        view_setup();state.update(clip=-1,loading=False)
        return .8
    scene=bpy.context.scene;screen=bpy.context.screen;rig=bpy.data.objects['RIG_AcordenRush']
    if state['clip']>=0:
        f=scene.frame_current;state['seen'].add(f)
        if f<state['last']:state['wraps']+=1
        state['last']=f
        elapsed=time.monotonic()-state['started']
        if elapsed<7 or state['wraps']==0:
            if elapsed<45:return .05
        if screen.is_animation_playing:bpy.ops.screen.animation_cancel(restore_frame=False)
        state['report'].append({'design':designs[state['design']],'action':names[state['clip']],'actual_screen_playback':True,'loop_wraps_observed':state['wraps'],'elapsed_seconds':elapsed,'observed_frames':sorted(state['seen'])})
    state['clip']+=1
    if state['clip']==len(names):state['loading']=True;return .1
    action=bpy.data.actions[names[state['clip']]];rig.animation_data.action=action
    scene.frame_start=int(action.frame_range[0]);scene.frame_end=int(action.frame_range[1]);scene.frame_set(scene.frame_start)
    state.update(started=time.monotonic(),last=scene.frame_current,wraps=0,seen=set())
    bpy.ops.screen.animation_play()
    return .05
bpy.app.timers.register(tick,first_interval=2,persistent=True)
