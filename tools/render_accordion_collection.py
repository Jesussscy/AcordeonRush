"""Four deliverable views for every additional design. Does not modify the blends."""
import bpy
from pathlib import Path
from mathutils import Vector
BASE=Path(__file__).resolve().parents[1]/'assets/blender/realistic/variants'
for design in ['azul-caribe','marfil-artesanal','negro-escenario']:
    bpy.ops.wm.open_mainfile(filepath=str(BASE/design/'instrument.blend'))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='OPTIX'
        scene.cycles.device='GPU' if any(d.type=='OPTIX' for d in prefs.devices) else 'CPU'
    except Exception:scene.cycles.device='CPU'
    scene.render.resolution_x=1200;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    cam=scene.camera;out=BASE/design/'renders';out.mkdir(exist_ok=True)
    rig=bpy.data.objects['RIG_AcordenRush'];rig.animation_data.action=bpy.data.actions['Bellows_OpenClose']
    floor=bpy.data.objects.get('Studio seamless ground')
    for name,frame,loc,target,scale in [
        ('01_front',31,(0,-1,0),(0,0,0),.64),
        ('02_three_quarter_open',61,(.56,-.95,.43),(0,0,0),.70),
        ('03_three_quarter_closed',1,(.56,-.95,.43),(0,0,0),.54),
        ('04_detail_buttons_bellows',31,(.39,-.75,.27),(.13,-.035,.025),.30)]:
        if floor:floor.hide_render=name=='01_front'
        scene.frame_set(frame);cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale
        scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
        print('COLLECTION_RENDER',design,name,flush=True)
