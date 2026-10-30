import bpy
import math
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets" / "blender"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for block in list(datablocks):
        if block.users == 0:
            datablocks.remove(block)

def material(name, color, metallic=0.0, roughness=0.35):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat

red = material("01 · Laca carmesí", (0.31, 0.018, 0.028), 0.32, 0.22)
red_light = material("02 · Nácar rubí", (0.55, 0.035, 0.052), 0.24, 0.24)
black = material("03 · Ébano satinado", (0.018, 0.022, 0.026), 0.22, 0.28)
gold = material("04 · Latón cepillado", (0.72, 0.39, 0.11), 0.72, 0.25)
ivory = material("05 · Botones de marfil", (0.88, 0.81, 0.65), 0.15, 0.19)
pearl = material("06 · Botones nacarados", (0.72, 0.82, 0.82), 0.26, 0.16)
dark_red = material("07 · Fuelle oscuro", (0.10, 0.012, 0.02), 0.18, 0.42)

def pearloid_finish(mat, dark_color, light_color, roughness=(0.20, 0.29)):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    texcoord = nodes.new("ShaderNodeTexCoord")
    broad = nodes.new("ShaderNodeTexNoise")
    broad.inputs["Scale"].default_value = 8.0
    broad.inputs["Detail"].default_value = 3.0
    broad.inputs["Roughness"].default_value = 0.72
    links.new(texcoord.outputs["Generated"], broad.inputs["Vector"])
    colors = nodes.new("ShaderNodeValToRGB")
    colors.color_ramp.elements[0].position = 0.24
    colors.color_ramp.elements[0].color = (*dark_color, 1)
    colors.color_ramp.elements[1].position = 0.78
    colors.color_ramp.elements[1].color = (*light_color, 1)
    links.new(broad.outputs["Fac"], colors.inputs["Fac"])
    links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 155.0
    fine.inputs["Detail"].default_value = 2.0
    links.new(texcoord.outputs["Generated"], fine.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.03
    bump.inputs["Distance"].default_value = 0.006
    links.new(fine.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    shader.inputs["Roughness"].default_value = (roughness[0] + roughness[1]) / 2

pearloid_finish(red, (0.12,0.006,0.014), (0.56,0.035,0.065))
pearloid_finish(red_light, (0.24,0.012,0.027), (0.72,0.08,0.11), (0.18,0.27))

cloth_nodes = dark_red.node_tree.nodes
cloth_links = dark_red.node_tree.links
cloth_shader = cloth_nodes.get("Principled BSDF")
cloth_noise = cloth_nodes.new("ShaderNodeTexNoise")
cloth_noise.inputs["Scale"].default_value = 190.0
cloth_noise.inputs["Detail"].default_value = 2.0
cloth_tex = cloth_nodes.new("ShaderNodeTexCoord")
cloth_links.new(cloth_tex.outputs["Generated"], cloth_noise.inputs["Vector"])
cloth_bump = cloth_nodes.new("ShaderNodeBump")
cloth_bump.inputs["Strength"].default_value = 0.22
cloth_bump.inputs["Distance"].default_value = 0.008
cloth_links.new(cloth_noise.outputs["Fac"], cloth_bump.inputs["Height"])
cloth_links.new(cloth_bump.outputs["Normal"], cloth_shader.inputs["Normal"])
cloth_shader.inputs["Roughness"].default_value = 0.63
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1250
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.filepath = str(OUT / "AcordeonVallenato_preview.png")
scene.render.resolution_percentage = 82
scene.world.color = (0.028, 0.022, 0.028)
scene.view_settings.view_transform = 'AgX'
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 192

def cube(name, location, dims, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if parent:
        obj.parent = parent
        obj.location = location
    else:
        obj.location = location
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Aristas suaves", 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new("Normales de acabado", 'WEIGHTED_NORMAL')
    return obj

def uv_sphere(name, location, radius, mat, parent=None, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    if parent:
        obj.parent = parent
        obj.location = location
    else:
        obj.location = location
    if scale:
        obj.scale = scale
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj

def text_object(name, body, location, size, mat, parent=None):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = body
    data.size = size
    data.extrude = 0.0015
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
        obj.location = location
    else:
        obj.location = location
    return obj

left = cube("Caja izquierda · bajo", (-0.95, 0, 0), (0.76, 0.90, 2.62), red, 0.13)
right = cube("Caja derecha · melodía", (0.95, 0, 0), (0.76, 0.90, 2.62), red, 0.13)
left["role"] = "Bass side; moves with bellows"
right["role"] = "Treble side; 31 diatonic buttons"

for body, side in ((left, "IZQ"), (right, "DER")):
    cube(f"Placa frontal {side}", (0, -0.456, 0), (0.62, 0.055, 2.38), black, 0.055, body)
    cube(f"Filete superior {side}", (0, -0.492, 1.15), (0.51, 0.028, 0.035), gold, 0.012, body)
    cube(f"Filete inferior {side}", (0, -0.492, -1.15), (0.51, 0.028, 0.035), gold, 0.012, body)
    for x in (-0.27, 0.27):
        for z in (-1.02, -0.72, 0.72, 1.02):
            uv_sphere(f"Remache {side}", (x, -0.50, z), 0.025, gold, body, (1, 0.48, 1))

cube("Tablero de bajos", (0, -0.493, 0), (0.48, 0.032, 1.58), red_light, 0.12, left)
for row in range(4):
    for col in range(3):
        x = (col - 1) * 0.145 + (row % 2) * 0.026
        z = 0.52 - row * 0.35
        uv_sphere(f"Bajo {row+1}-{col+1} · botón", (x, -0.54, z), 0.069, ivory if (row+col) % 3 else pearl, left, (1, 0.60, 1))

cube("Tablero de melodía · 31 botones", (0, -0.493, 0), (0.49, 0.032, 2.05), red_light, 0.10, right)
# The user-supplied diapason chart maps each physical row in both air directions.
# Preserve its register notation (uppercase/lowercase, +/-) as exact source labels.
NOTE_MAP = {
    "GCF": {
        "outside": [["D#","-A","C","E","F#","A","c","e","f#","a"], ["G#","-B","D","F","A","B","d","f","a","b","d+"], ["C#","E","G","A#","d","e","g","a#","d+","e+"]],
        "inside": [["C#","-G","-B","D","G","B","d","g","c+","d+"], ["F#","-G","C","E","G","C","e","g","c+","e+","g+"], ["d#","C","F","A","c","f","a","c+","f+","a+"]],
    },
    "FBbEb": {
        "outside": [["C#","-G","-A#","D","E","G","A#","d","e","g"], ["F#","-A","C","D#","G","A","C","d#","g","a","c+"], ["B","D","F","G#","c","d","f","g#","c+","d+"]],
        "inside": [["-B","-F","-A","C","F","A","C","f","a","c+"], ["E","-F","-A#","D","F","A#","d","f","a#","d+","f+"], ["C#","-A#","D#","G","A#","d#","g","a#","d#+","g+"]],
    },
    "EAD": {
        "outside": [["C","-F#","-A","C#","D#","F#","A","C#","d#","f#"], ["F","-G#","-B","D","F#","G#","B","d","f","g#","b"], ["A#","C#","E","G","B","c#","e","g","b","c#+"]],
        "inside": [["-A#","-E","-G#","-B","E","G#","B","e","g#","b"], ["D#","-E","-A","C#","E","A","C#","e","a","c#+","e+"], ["C","-A","D","F#","A","d","f#","a","d+","f#+"]],
    },
}
NOTE_MAP = {tuning: {"pull": directions["outside"], "push": directions["inside"]} for tuning, directions in NOTE_MAP.items()}
for tuning_name, directions in NOTE_MAP.items():
    for direction, rows in directions.items():
        assert [len(row) for row in rows] == [10, 11, 10], f"Invalid 31-button chart: {tuning_name} {direction}"
button_objects = []
button_index = 0
for col, count in enumerate((10, 11, 10)):
    x = (col - 1) * 0.165
    for row in range(count):
        z = 0.84 - row * (1.68 / (count - 1))
        label = f"Melodía {button_index+1:02d} · fila {col+1}"
        uv_sphere(f"{label} · aro", (x, -0.535, z), 0.071, gold, right, (1, 0.52, 1))
        button = uv_sphere(f"{label} · botón", (x, -0.568, z), 0.052, pearl if (row + col) % 4 else ivory, right, (1, 0.58, 1))
        button["tecla"] = button_index + 1
        button["fila"] = col + 1
        button["posición_en_fila"] = row + 1
        for tuning_name, directions in NOTE_MAP.items():
            button[f"{tuning_name}_push"] = directions["push"][col][row]
            button[f"{tuning_name}_pull"] = directions["pull"][col][row]
        button_objects.append(button)
        button_index += 1

# Keep the exact supplied fingering image packed into the editable Blender file.
reference_path = Path(r"C:\Users\Xermy\AppData\Local\Temp\codex-clipboard-5a15ae19-8f2a-47ce-bd64-4adb39d2fae5.png")
if reference_path.exists():
    reference = bpy.data.images.load(str(reference_path), check_existing=True)
    reference.name = "REFERENCIA · diapasón GCF FBbEb EAD"
    reference.pack()
    reference.use_fake_user = True

for idx in range(7):
    z = -0.72 + idx * 0.24
    rail = cube(f"Rejilla · ranura {idx+1}", (0.0, -0.538, z), (0.42, 0.025, 0.018), gold if idx in (0, 6) else black, 0.008, right)
    rail.location.x = -0.01
# Side grille and metal bellows anchors add the construction details visible in product photos.
cube("Rejilla lateral · marco", (0.394, 0.06, 0), (0.045, 0.68, 1.72), black, 0.045, right)
for idx in range(11):
    z = -0.66 + idx * 0.132
    cube(f"Rejilla lateral · ranura {idx+1:02d}", (0.422, 0.06, z), (0.018, 0.45, 0.025), gold if idx in (0, 10) else red_light, 0.01, right)
for body, x in ((left, 0.378), (right, -0.378)):
    cube("Abrazadera del fuelle · latón", (x, -0.37, 0), (0.036, 0.11, 2.36), gold, 0.018, body)
    for z in (-1.02, 1.02):
        uv_sphere("Perno de anclaje del fuelle", (x, -0.435, z), 0.042, black, body, (1,0.55,1))
uv_sphere("Medallón del acordeón", (0, -0.547, 1.00), 0.13, gold, right, (1.0, 0.38, 0.72))
text_object("Marca · centro", "AR", (0, -0.602, 1.0), 0.11, black, right)
text_object("Placa de marca", "ACORDENRUSH", (0, -0.553, -1.02), 0.072, ivory, right)
for idx, button in enumerate(button_objects):
    home_y = button.location.y
    pulse = 22 + (idx % 8) * 4
    for frame, offset in ((1, 0), (pulse, 0), (pulse+3, 0.065), (pulse+6, 0), (pulse+9, 0), (97, 0), (pulse+96, 0), (pulse+99, 0.065), (pulse+102, 0)):
        button.location.y = home_y + offset
        button.keyframe_insert(data_path="location", frame=frame, group="Botones · pulsación")

verts, faces, material_ids = [], [], []
rib_count = 19
closed_width, open_width = 1.16, 2.56
rib_width, depth, height = 0.052, 0.74, 2.30
for i in range(rib_count):
    cx = -closed_width/2 + i * closed_width/(rib_count-1)
    half = rib_width/2
    base = len(verts)
    verts.extend([(cx-half,-depth/2,-height/2),(cx+half,-depth/2,-height/2),(cx+half,depth/2,-height/2),(cx-half,depth/2,-height/2),
                  (cx-half,-depth/2,height/2),(cx+half,-depth/2,height/2),(cx+half,depth/2,height/2),(cx-half,depth/2,height/2)])
    faces.extend([(base+0,base+1,base+5,base+4),(base+1,base+2,base+6,base+5),(base+2,base+3,base+7,base+6),(base+3,base+0,base+4,base+7),(base+4,base+5,base+6,base+7),(base+3,base+2,base+1,base+0)])
    material_ids.extend([1 if i%2 else 0, 2, 1 if i%2 else 0, 2, 1 if i%2 else 0, 2])
mesh = bpy.data.meshes.new("Malla de pliegues · perfil articulado")
mesh.from_pydata(verts, [], faces)
mesh.materials.append(dark_red)
mesh.materials.append(red_light)
mesh.materials.append(black)
mesh.update()
bellows = bpy.data.objects.new("Fuelle · pliegues con morph de apertura", mesh)
bpy.context.collection.objects.link(bellows)
for poly, mat_id in zip(mesh.polygons, material_ids):
    poly.material_index = mat_id
basis = bellows.shape_key_add(name="Cerrado · base")
extended = bellows.shape_key_add(name="Abierto · fuelle extendido")
for i in range(rib_count):
    cx = -open_width/2 + i * open_width/(rib_count-1)
    for j in range(8):
        idx = i*8+j
        extended.data[idx].co.x = cx + (-rib_width/2 if j in (0,3,4,7) else rib_width/2)
bellows.data.shape_keys.name = "Control del fuelle"
bellows["animation"] = "Shape key 0 = closed; 1 = extended"
bevel = bellows.modifiers.new("Pliegues redondeados", 'BEVEL')
bevel.width = 0.012
bevel.segments = 2
bellows.modifiers.new("Normales suaves", 'WEIGHTED_NORMAL')

# Continuous cloth backing fills the valleys between the raised ribs.
cloth = cube("Fuelle · tela continua", (0, 0, 0), (closed_width, depth * 0.90, height * 0.97), dark_red, 0.035)
cloth_basis = cloth.shape_key_add(name="Cerrado · base")
cloth_open = cloth.shape_key_add(name="Abierto · tela extendida")
for vertex_index, vertex in enumerate(cloth.data.vertices):
    cloth_open.data[vertex_index].co.x = vertex.co.x * (open_width / closed_width)
cloth.data.shape_keys.name = "Tela del fuelle"

poses = ((1, 0.95, 0.0), (48, 1.65, 1.0), (96, 0.95, 0.0), (144, 1.65, 1.0), (192, 0.95, 0.0))
for frame, x, amount in poses:
    left.location.x = -x
    right.location.x = x
    left.keyframe_insert(data_path="location", frame=frame, group="Cajas · abrir y cerrar")
    right.keyframe_insert(data_path="location", frame=frame, group="Cajas · abrir y cerrar")
    extended.value = amount
    extended.keyframe_insert(data_path="value", frame=frame, group="Fuelle · expansión")
    cloth_open.value = amount
    cloth_open.keyframe_insert(data_path="value", frame=frame, group="Fuelle · tela")

floor_mat = material("Fondo · carbón", (0.018, 0.021, 0.027), 0.12, 0.43)
cube("Base de estudio", (0, 0.0, -1.57), (8, 6, 0.16), floor_mat, 0.10)
def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

bpy.ops.object.camera_add(location=(5.7, -8.8, 4.2))
camera = bpy.context.object
camera.name = "Cámara · producto tres cuartos"
aim(camera, (0, 0, 0))
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 6.6
scene.camera = camera

def area_light(name, loc, power, size, color, target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.shape = 'DISK'
    light.data.size = size
    light.data.color = color
    aim(light, target)
    return light

area_light("Key · cálida", (1.2,-5.0,5.0), 850, 5.0, (1.0,0.76,0.55))
area_light("Relleno · frontal", (-4.5,-3.0,1.3), 620, 4.0, (0.60,0.73,1.0))
area_light("Rim · dorado", (0.5,3.4,4.1), 1100, 3.2, (1.0,0.37,0.16))

scene.frame_set(48)
bpy.ops.object.select_all(action='DESELECT')
right.select_set(True)
bpy.context.view_layer.objects.active = right
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 8.0
            area.spaces.active.region_3d.view_location = (0, 0, 0)
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()

blend_path = OUT / "AcordeonVallenato_Animado.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
scene.render.filepath = str(OUT / "AcordeonVallenato_preview.png")
bpy.ops.render.render(write_still=True)
scene.frame_set(1)
scene.render.filepath = str(OUT / "AcordeonVallenato_cerrado.png")
bpy.ops.render.render(write_still=True)
scene.frame_set(48)
scene.render.filepath = str(OUT / "AcordeonVallenato_frontal.png")
bpy.ops.object.camera_add(location=(0, -9.0, 0.85))
front_camera = bpy.context.object
front_camera.name = "Cámara temporal · frontal"
aim(front_camera, (0, 0, 0))
front_camera.data.type = 'ORTHO'
front_camera.data.ortho_scale = 5.25
scene.camera = front_camera
bpy.ops.render.render(write_still=True)
scene.render.filepath = str(OUT / "AcordeonVallenato_detalle.png")
bpy.ops.object.camera_add(location=(2.2, -4.1, 2.6))
detail_camera = bpy.context.object
detail_camera.name = "Cámara temporal · detalle"
aim(detail_camera, (0, 0, 0.15))
detail_camera.data.type = 'ORTHO'
detail_camera.data.ortho_scale = 4.4
scene.camera = detail_camera
bpy.ops.render.render(write_still=True)

glb_path = OUT / "AcordeonVallenato_Animado.glb"
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name != "Base de estudio" and obj.type not in {'CAMERA', 'LIGHT'}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = bellows
bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format='GLB', use_selection=True, export_animations=True, export_skins=True, export_morph=True, export_materials='EXPORT', export_extras=True, export_cameras=False, export_lights=False)
print(f"Created {blend_path}")
print(f"Created {glb_path}")
print(f"Created {scene.render.filepath}")
