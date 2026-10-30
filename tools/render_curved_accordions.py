"""Product views and actual rendered animated previews; no saved source edits."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/curved_v2'
IDS=['curva-zafiro','curva-esmeralda','curva-granate','curva-grafito']
for design in IDS:
    if '--only' in sys.argv and design!=sys.argv[sys.argv.index('--only')+1]:continue
    folder=BASE/design;bpy.ops.wm.open_mainfile(filepath=str(folder/'instrument.blend'))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
    try:
        if '--cpu' in sys.argv:raise RuntimeError('CPU rendering explicitly requested')
        pref=bpy.context.preferences.addons['cycles'].preferences;pref.compute_device_type='OPTIX';pref.get_devices()
        for d in pref.devices:d.use=d.type=='OPTIX'
        scene.cycles.device='GPU' if any(d.type=='OPTIX' for d in pref.devices) else 'CPU'
    except Exception:scene.cycles.device='CPU'
    if '--cpu' in sys.argv:scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=6
    scene.render.resolution_x=1500;scene.render.resolution_y=1250;scene.render.resolution_percentage=100
    camera=scene.camera;rig=bpy.data.objects['RIG_AcordenRush_Curva'];renders=folder/'renders';renders.mkdir(exist_ok=True)
    shots=[
        ('01_frontal_cerrado','Bellows_OpenClose',1,(0,-1.1,0),(.03,0,0),.43),
        ('02_abanico_superior','Bellows_OpenClose',91,(.55,-1.05,.38),(.015,0,0),.70),
        ('03_tres_cuartos_cerrado','Bellows_OpenClose',1,(.55,-1.05,.38),(.03,0,0),.47),
        ('04_detalle_teclado_fuelle','Melody_Button_Press',26,(.46,-.85,.27),(.135,-.065,.02),.29),
    ]
    if design=='curva-zafiro':shots.extend([
        ('05_abanico_inferior','Bellows_Fan_Lower',91,(.55,-1.05,.38),(.015,0,0),.70),
        ('06_bajos_anclados','Bass_Anchored_Phrase',91,(.55,-1.05,.38),(-.06,0,0),.76),
        ('07_apertura_oblicua','Bellows_Oblique_Sweep',46,(.45,-.85,.50),(.015,0,0),.65),
        ('08_arco_expresivo','Bellows_Expressive_Arc',86,(.55,-1.05,.38),(-.02,0,0),.70),
    ])
    if '--details-only' in sys.argv:shots=[s for s in shots if s[0]=='04_detalle_teclado_fuelle']
    for name,action,frame,loc,target,scale in shots:
        rig.animation_data.action=bpy.data.actions[action];scene.frame_set(frame);camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=scale
        scene.render.filepath=str(renders/(name+'.png'));bpy.ops.render.render(write_still=True)
        print('CURVED_RENDER',design,name,flush=True)
