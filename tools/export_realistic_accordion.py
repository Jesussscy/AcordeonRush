"""Re-export editable product without remaking geometry or renders."""
import bpy
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'))
rig=bpy.data.objects['RIG_AcordenRush']
for fc in rig.animation_data.drivers:
    fc.keyframe_points.clear();fc.update()
bpy.context.scene.frame_set(61)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'))
meshes=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join();combined=bpy.context.object;combined.name='AcordenRush web instrument skin'
mods=[m for m in combined.modifiers if m.type=='ARMATURE']
for m in mods[1:]:combined.modifiers.remove(m)
bpy.ops.object.select_all(action='DESELECT');combined.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'AcordeonVallenato_Realista.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_bake_animation=True,
    export_anim_single_armature=True,export_skins=True,export_morph=False,export_materials='EXPORT',
    export_cameras=False,export_lights=False,export_yup=True,export_extras=True)
