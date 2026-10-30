"""Product instrument, Blender 5.2. Run with blender -b --python this_file.
All dimensions below are artistic estimates in metres, not reference measurements.
"""
import bpy, math, json, random, bmesh
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.noise import multi_fractal

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/blender/realistic'
OUT.mkdir(parents=True, exist_ok=True)
RENDERS = OUT / 'renders'
RENDERS.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='OPTIX'
    if any(d.type=='OPTIX' for d in prefs.devices):scene.cycles.device='GPU'
except Exception as exc:
    print('GPU unavailable, using CPU:',exc,flush=True)
scene.render.resolution_x = 1600
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 30
scene.view_settings.view_transform = 'AgX'
scene.world = bpy.data.worlds.new('Studio neutral environment')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.28,.32,.39,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .3

collections = {}
for name in ['00_Rig','01_Bass_Case','02_Melody_Case','03_Bellows','04_Bass_Buttons','05_Melody_Buttons','06_Straps','90_Studio']:
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    collections[name] = col
def move_collection(obj, name):
    for col in list(obj.users_collection): col.objects.unlink(obj)
    collections[name].objects.link(obj)

# Image-backed PBR colour is retained by glTF. Fine surface bump is a Blender detail.
def image_texture(name, kind):
    n = 256
    pixels = np.ones((n,n,4), dtype=np.float32)
    rng = random.Random(17)
    for j in range(n):
        for i in range(n):
            u,v=i/n,j/n
            cloud = multi_fractal(Vector((u*8,v*8,1.3)),1.0,2.0,4)
            t = max(0,min(1,(cloud+.7)*.43))
            if kind=='wine':
                c = np.array((.29,.018,.034))*(.64+.70*t)
                c += (.065*t**5,.016*t**5,.016*t**5)
            elif kind=='pearl':
                c = np.array((.88,.83,.71))*(.9+.12*t)
            else:
                weave = .88 + .10*(math.sin(i*math.pi/2)*math.sin(j*math.pi/2))
                c = np.array((.075,.025,.033))*weave*(.85+.25*t)
            pixels[j,i,:3] = c
    im=bpy.data.images.new(name,width=n,height=n)
    im.pixels.foreach_set(pixels.ravel())
    im.pack()
    return im

def material(name, color, metal=0, rough=.4, texture=None, bump=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    nt=m.node_tree; p=nt.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if texture:
        tx=nt.nodes.new('ShaderNodeTexImage'); tx.image=texture
        nt.links.new(tx.outputs['Color'],p.inputs['Base Color'])
    if bump:
        coord=nt.nodes.new('ShaderNodeTexCoord')
        noise=nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=750
        nt.links.new(coord.outputs['Generated'],noise.inputs['Vector'])
        b=nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.16
        b.inputs['Distance'].default_value=bump
        nt.links.new(noise.outputs['Fac'],b.inputs['Height']); nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
        ramp=nt.nodes.new('ShaderNodeMapRange'); ramp.inputs['To Min'].default_value=rough-.045
        ramp.inputs['To Max'].default_value=rough+.045
        nt.links.new(noise.outputs['Fac'],ramp.inputs['Value']); nt.links.new(ramp.outputs[0],p.inputs['Roughness'])
    return m

wine=material('Case | wine pearloid lacquer',(.28,.014,.027),.22,.28,image_texture('Wine pearloid albedo','wine'),.00004)
wine.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.34
wine.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.22
black=material('Case | satin black edge trim',(.012,.015,.019),.12,.36,bump=.000035)
steel=material('Hardware | brushed nickel steel',(.53,.59,.64),.86,.3,bump=.000015)
brass=material('Hardware | restrained aged brass',(.39,.27,.105),.78,.36)
ivory=material('Buttons | warm mother of pearl',(.86,.82,.71),.04,.25,image_texture('Mother of pearl albedo','pearl'),.000014)
cloth=material('Bellows | woven oxblood textile',(.065,.021,.025),0,.83,image_texture('Woven textile albedo','cloth'),.00012)
binding=material('Bellows | charcoal leather binding',(.022,.019,.021),0,.62,bump=.00007)
paper=material('Bellows | warm edge piping',(.38,.32,.245),.06,.58)
leather=material('Straps | grained black leather',(.018,.014,.013),0,.58,bump=.0001)
thread=material('Straps | subdued stitching',(.28,.25,.20),0,.8)
meshblack=material('Grille | recessed acoustic lining',(.006,.008,.01),0,.93)
model_objects=[]

# A single armature. CTRL_FUELLE X scale expands only the pleated mesh.
# Side controls are driven translations; their own scales stay exactly one.
arm=bpy.data.armatures.new('AcordenRush mechanical rig')
rig=bpy.data.objects.new('RIG_AcordenRush',arm); collections['00_Rig'].objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, parent=None):
    b=arm.edit_bones.new(name); b.head=head; b.tail=Vector(head)+Vector((0,.027,0))
    if parent: b.parent=arm.edit_bones[parent]
    return b
bone('ROOT',(0,0,-.20))
bone('CTRL_FUELLE',(0,0,0),'ROOT')
CLOSED=.110; OPEN=.280; HALF_DELTA=(OPEN-CLOSED)/2
BX=-CLOSED/2-.045; MX=CLOSED/2+.0675
bone('CTRL_LADO_BAJO',(BX,0,0),'ROOT')
bone('CTRL_LADO_MELODIA',(MX,0,0),'ROOT')
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True; rig.display_type='WIRE'
rig['Instructions']='CTRL_FUELLE: local Scale X 1..2.5454545. Side bones translate in opposite directions via drivers. Button bones local Y +0.0018 m to press.'
for name, sign in [('CTRL_LADO_BAJO',-1),('CTRL_LADO_MELODIA',1)]:
    pb=rig.pose.bones[name]
    fc=pb.driver_add('location',0)
    fc.keyframe_points.clear();fc.update()
    dr=fc.driver
    v=dr.variables.new(); v.name='expansion'; v.type='SINGLE_PROP'
    v.targets[0].id=rig; v.targets[0].data_path='pose.bones["CTRL_FUELLE"].scale[0]'
    dr.expression=f'{sign*CLOSED/2}*(expansion-1)'
    pb.lock_scale=(True,True,True); pb.lock_rotation=(True,True,True)
ctrl=rig.pose.bones['CTRL_FUELLE']; ctrl.lock_location=(True,True,True); ctrl.lock_rotation=(True,True,True); ctrl.lock_scale=(False,True,True)
ctrl['Min_X_Scale']=1.; ctrl['Max_X_Scale']=OPEN/CLOSED
arm.bones['CTRL_FUELLE'].color.palette='THEME04'
for name in ['CTRL_LADO_BAJO','CTRL_LADO_MELODIA']: arm.bones[name].color.palette='THEME03'

def finish(obj, name, mat, col, weight=None, smooth=False):
    obj.name=name; move_collection(obj,col)
    if mat: obj.data.materials.append(mat)
    if obj.type=='MESH':
        if not obj.data.uv_layers:
            uv=obj.data.uv_layers.new(name='SurfaceUV')
            # Position-based UVs are explicit and survive glTF.
            for poly in obj.data.polygons:
                normal=poly.normal; axis=max(range(3),key=lambda i:abs(normal[i]))
                axes=[i for i in range(3) if i!=axis]
                for li in poly.loop_indices:
                    co=obj.data.vertices[obj.data.loops[li].vertex_index].co
                    uv.data[li].uv=(co[axes[0]]*6+.5,co[axes[1]]*6+.5)
        if smooth:
            for p in obj.data.polygons: p.use_smooth=True
        if weight:
            obj.parent=rig
            vg=obj.vertex_groups.new(name=weight); vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
            mod=obj.modifiers.new('Rigid mechanical skin','ARMATURE'); mod.object=rig
        model_objects.append(obj)
    return obj

def apply(obj,mod):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

def box(name,loc,dims,mat,col,bone_name=None,bevel=.0015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Manufactured corner radius','BEVEL'); b.width=bevel; b.segments=3; apply(o,b)
        n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); apply(o,n)
    return finish(o,name,mat,col,bone_name)

def cylinder(name,loc,radius,depth,mat,col,bone_name=None,vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=(math.pi/2,0,0))
    o=bpy.context.object
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    b=o.modifiers.new('Machined lip','BEVEL'); b.width=min(.0005,depth*.22); b.segments=2; apply(o,b)
    return finish(o,name,mat,col,bone_name,True)

def tube(name,coords,radius,mat,col,bone_name=None,cyclic=False):
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.bevel_depth=radius; data.bevel_resolution=2; data.resolution_u=8
    s=data.splines.new('POLY'); s.points.add(len(coords)-1)
    for p,co in zip(s.points,coords):p.co=(*co,1)
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,data); collections[col].objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,col,bone_name,True)

def label(name,text,loc,size,mat,col,bone_name):
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.curves.new(name,'FONT'); data.body=text; data.size=size; data.align_x='CENTER'; data.align_y='CENTER'
    data.extrude=.00008; data.bevel_depth=.000035; data.bevel_resolution=1
    o=bpy.data.objects.new(name,data); collections[col].objects.link(o); o.location=loc; o.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,col,bone_name)

def screw(name,x,y,z,col,bn):
    cylinder(name,(x,y,z),.0017,.0010,steel,col,bn,12)
    box(name+' slot',(x,y-.00055,z),(.0021,.00018,.00036),black,col,bn,.0001)

# Cases have a discrete rear cover, bright trim and inset end frames.
for side,cx,w,col,bn in [('Bass',BX,.090,'01_Bass_Case','CTRL_LADO_BAJO'),('Melody',MX,.135,'02_Melody_Case','CTRL_LADO_MELODIA')]:
    box(side+' rigid pearloid shell',(cx,0,0),(w,.164,.322),wine,col,bn,.010)
    box(side+' rear cover seam',(cx,.077,0),(w-.009,.012,.304),black,col,bn,.007)
    box(side+' rear pearloid lid',(cx,.083,0),(w-.012,.006,.298),wine,col,bn,.006)
    for zz in [-.149,.149]:
        box(side+' nickel end cap',(cx,0,zz),(w-.009,.165,.006),steel,col,bn,.0025)
        box(side+' top inset',(cx,0,zz+(.004 if zz>0 else -.004)),(w-.015,.150,.004),wine,col,bn,.002)
    # Face frame and true seam following the perimeter.
    box(side+' front removable fascia',(cx,-.080,0),(w-.008,.007,.291),black,col,bn,.007)
    for z in [-.136,.136]:
        box(side+' upper lower fascia rim',(cx,-.0848,z),(w-.021,.0015,.0023),steel,col,bn,.0006)
    for x in [cx-w/2+.012,cx+w/2-.012]:
        for z in [-.130,.130]: screw(side+' fascia screw',x,-.085,z,col,bn)
    # Rear corner screws and low protective feet.
    for x in [cx-w/2+.012,cx+w/2-.012]:
        for z in [-.133,.133]: cylinder(side+' rear fastener',(x,.088,z),.0017,.001,steel,col,bn,12)
    for yy in [-.053,.053]:box(side+' rubber foot',(cx,yy,-.163),(w*.52,.018,.006),black,col,bn,.002)
    # Bellow frame: flat joint planes sit exactly on x=+-CLOSED/2.
    sign=-1 if side=='Bass' else 1
    x=sign*(CLOSED/2+.003)
    box(side+' bellows mating frame',(x,0,0),(.006,.157,.310),black,col,bn,.002)
    box(side+' frame outer nickel bead',(x+sign*.0018,0,0),(.0014,.159,.312),steel,col,bn,.0006)
    # Closing snap straps are stored folded on each top cap.
    box(side+' parked bellows lock leather',(cx-.008,.009,.159),(.040,.016,.0025),leather,col,bn,.002)
    cylinder(side+' locking stud',(cx-.014,-.006,.158),.0032,.002,brass,col,bn)
    for xx in [-w*.24,w*.24]:
        box(side+' strap anchor plate',(cx+xx,.061,.132),(.014,.004,.015),steel,col,bn,.0015)
        screw(side+' anchor rivet',cx+xx,.057,.132,col,bn)

# Separate button board and grille, as seen on the supplied diatonic reference.
KEY_X=MX+.028
box('Melody raised keyboard bezel',(KEY_X,-.089,0),(.065,.020,.267),black,'02_Melody_Case','CTRL_LADO_MELODIA',.007)
box('Melody pearloid button deck',(KEY_X,-.100,0),(.059,.006,.259),wine,'02_Melody_Case','CTRL_LADO_MELODIA',.005)
box('Bass scalloped button board',(BX+.004,-.087,0),(.066,.015,.180),wine,'01_Bass_Case','CTRL_LADO_BAJO',.009)

def grille(name,cx,y,cz,cols,rows,pitch,col,bn):
    width=cols*pitch; height=rows*pitch
    box(name+' acoustic cavity',(cx,y+.0025,cz),(width+.003,.002,height+.003),meshblack,col,bn,.002)
    # Real apertures: 12 sectors per hole, welded cell boundaries, sheet thickness.
    vs=[]; fs=[]; N=12; r=pitch*.30
    for iz in range(rows):
        for ix in range(cols):
            xx=cx+(ix-(cols-1)/2)*pitch; zz=cz+(iz-(rows-1)/2)*pitch
            base=len(vs)
            for outer in [True,False]:
                for k in range(N):
                    a=2*math.pi*k/N; c,s=math.cos(a),math.sin(a)
                    rad=pitch/2/max(abs(c),abs(s)) if outer else r
                    vs.append((xx+rad*c,y,zz+rad*s))
            for k in range(N):
                j=(k+1)%N; fs.append((base+k,base+j,base+N+j,base+N+k))
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); collections[col].objects.link(o)
    so=o.modifiers.new('Pressed perforated sheet thickness','SOLIDIFY'); so.thickness=.00055; apply(o,so)
    finish(o,name,steel,col,bn)
    for xx in [cx-width/2-.0012,cx+width/2+.0012]:
        box(name+' vertical frame',(xx,y-.0003,cz),(.002,.002,height+.006),steel,col,bn,.0007)
    for zz in [cz-height/2-.002,cz+height/2+.002]:
        box(name+' horizontal frame',(cx,y-.0003,zz),(width+.004,.002,.002),steel,col,bn,.0007)

GX=MX-.039
grille('Melody perforated nickel grille',GX,-.085,0,5,29,.0074,'02_Melody_Case','CTRL_LADO_MELODIA')
# Reference-inspired nickel sweep ribs above perforations, with actual depth.
for zi in range(10):
    z=-.104+zi*.023
    coords=[(GX-.017,-.0865,z-.005),(GX-.008,-.088,z-.002),(GX+.005,-.0885,z+.001),(GX+.017,-.087,z+.008)]
    tube('Grille formed sweep rib %02d'%zi,coords,.0010,steel,'02_Melody_Case','CTRL_LADO_MELODIA')
grille('Bass lower vent',BX,-.084,-.115,7,3,.0060,'01_Bass_Case','CTRL_LADO_BAJO')
grille('Bass upper vent',BX,-.084,.112,7,3,.0060,'01_Bass_Case','CTRL_LADO_BAJO')

# Original narrow plaque, no manufacturer branding.
box('Original maker plaque',(GX,-.090,0),(.016,.0015,.049),black,'02_Melody_Case','CTRL_LADO_MELODIA',.002)
label('Original AR monogram','AR',(GX,-.0913,.009),.006,ivory,'02_Melody_Case','CTRL_LADO_MELODIA')
label('Original mark','AcordenRush',(MX,-.0855,.141),.0048,ivory,'02_Melody_Case','CTRL_LADO_MELODIA')
label('Plaque edition','01',(GX,-.0913,-.010),.005,brass,'02_Melody_Case','CTRL_LADO_MELODIA')

# Buttons: all three pieces connected, only head and stem move during a press.
buttons=[]
def button(kind,num,loc,parent_bone,col,radius):
    x,y,z=loc; name=f'{kind}_{num:02d}'
    bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='EDIT')
    bone('BTN_'+name,(x,y,z),parent_bone)
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.bones['BTN_'+name].color.palette='THEME02'
    cylinder(name+' fixed nickel socket',(x,y+.001,z),radius+.0012,.0026,steel,col,parent_bone)
    cylinder(name+' recessed black guide',(x,y-.0004,z),radius+.0005,.0016,black,col,parent_bone)
    cylinder(name+' captive stem',(x,y-.0019,z),radius*.43,.0065,black,col,'BTN_'+name,16)
    cylinder(name+' pearl rim',(x,y-.0042,z),radius,.0027,ivory,col,'BTN_'+name,24)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=10,radius=1,location=(x,y-.0053,z))
    o=bpy.context.object; o.scale=(radius,radius*.37,radius)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name+' rounded pearl crown',ivory,col,'BTN_'+name,True)
    buttons.append({'name':name,'bone':'BTN_'+name,'parent':parent_bone,'center':loc,'radius':radius})

idx=0
for column,count in enumerate([10,11,10]):
    for row in range(count):
        idx+=1
        x=KEY_X+(column-1)*.0170 + .0025*(row/(count-1)-.5)
        z=((count-1)/2-row)*.0227+(column-1)*.0035
        button('Melody',idx,(x,-.104,z),'CTRL_LADO_MELODIA','05_Melody_Buttons',.0058)
for row in range(4):
    for col in range(3):
        button('Bass',row*3+col+1,(BX+.003+(col-1)*.018+(row%2)*.0025,-.096,(1.5-row)*.030+(col-1)*.0025),'CTRL_LADO_BAJO','04_Bass_Buttons',.0064)

# Twenty corrugations in ONE watertight, thickness-bearing pleated shell.
# Each ring joins the next. Both end rims coincide with the case mating planes.
FOLDS=20; SEG=32
def rounded_rect(hy,hz,r):
    pts=[]
    for cy,cz,ang in [(hy-r,hz-r,0),(-hy+r,hz-r,90),(-hy+r,-hz+r,180),(hy-r,-hz+r,270)]:
        for k in range(8):
            a=math.radians(ang+k*90/8)
            # Start at +Y,+Z corner, progress around cross section.
            pts.append((cy+r*math.cos(a),cz+r*math.sin(a)))
    return pts

# Ordered from upper right via upper left: rounded profile in YZ plane.
def profile(hy,hz,r):
    pts=[]
    for cy,cz,start in [(hy-r,hz-r,0),(-hy+r,hz-r,90),(-hy+r,-hz+r,180),(hy-r,-hz+r,270)]:
        for k in range(8):
            a=math.radians(start+k*90/8)
            pts.append((cy+r*math.cos(a),cz+r*math.sin(a)))
    return pts

rings=[]
for i in range(FOLDS):
    for frac,high in [(0,0),(.43,1),(.57,1)]: rings.append(((i+frac)/FOLDS,high))
rings.append((1,0))
nr=len(rings); vs=[]; fs=[]; mids=[]
for inner in [False,True]:
    for t,high in rings:
        thick=.00055 if inner else 0
        for yy,zz in profile(.069+high*.009-thick,.143+high*.009-thick,.009):
            vs.append(((t-.5)*CLOSED,yy,zz))
for layer in range(2):
    off=layer*nr*SEG
    for i in range(nr-1):
        for k in range(SEG):
            kn=(k+1)%SEG
            face=(off+i*SEG+k,off+i*SEG+kn,off+(i+1)*SEG+kn,off+(i+1)*SEG+k)
            fs.append(face if layer==0 else face[::-1])
            # Fold peak is a narrow continuous binding, corner gussets use leather.
            ispeak=rings[i][1] and rings[i+1][1]
            corner=(k%8 in [1,2,3,4,5])
            mids.append(2 if ispeak else (1 if corner else 0))
for i in [0,nr-1]:
    for k in range(SEG):
        kn=(k+1)%SEG
        fs.append((i*SEG+k,nr*SEG+i*SEG+k,nr*SEG+i*SEG+kn,i*SEG+kn)); mids.append(1)
me=bpy.data.meshes.new('Continuous 20 fold closed cloth shell'); me.from_pydata(vs,[],fs); me.update()
bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
bellows=bpy.data.objects.new('Bellows | continuous 20 pleat textile shell',me); collections['03_Bellows'].objects.link(bellows)
finish(bellows,bellows.name,None,'03_Bellows','CTRL_FUELLE')
for mat in [cloth,binding,paper]:me.materials.append(mat)
for p,mi in zip(me.polygons,mids):p.material_index=mi
bellows['fold_count']=20; bellows['thickness_m']=.00055
bellows['construction']='One closed manifold shell. 61 joined transverse rings, outer and inner surfaces, joined end rims. X expansion affects fold spacing only.'
# UVs follow the cloth, including sides/top, avoiding stretched box projection.
uv=me.uv_layers.active
for p in me.polygons:
    for li in p.loop_indices:
        vi=me.loops[li].vertex_index % (nr*SEG)
        uv.data[li].uv=((vi//SEG)/(nr-1)*4,(vi%SEG)/SEG*3)

# Real curved leather carrying straps on back and a bass hand strap.
def strap(name,cx,y,z0,z1,width,bn,bow,col='06_Straps'):
    verts=[]; faces=[]; steps=24
    for i in range(steps+1):
        t=i/steps; zz=z0+(z1-z0)*t; yy=y+bow*math.sin(math.pi*t)
        for dx in [-width/2,width/2]: verts.append((cx+dx,yy,zz))
    for i in range(steps):faces.append((i*2,i*2+1,i*2+3,i*2+2))
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); collections[col].objects.link(o)
    so=o.modifiers.new('Leather strap thickness','SOLIDIFY');so.thickness=.0023;apply(o,so)
    be=o.modifiers.new('Rounded leather edges','BEVEL');be.width=.0007;be.segments=2;apply(o,be)
    finish(o,name,leather,col,bn,True)
    # Individual seam dashes rather than floating continuous ropes.
    for dx in [-width*.38,width*.38]:
        for i in range(20):
            a=(i+.12)/20; b=(i+.56)/20
            coords=[(cx+dx,y+bow*math.sin(math.pi*t)+.0015,z0+(z1-z0)*t) for t in [a,b]]
            tube(name+' saddle stitch',coords,.00024,thread,col,bn)
    for zz in [z0,z1]:
        box(name+' buckle mount',(cx,y-.001,zz),(width+.004,.004,.014),steel,col,bn,.002)
        cylinder(name+' rivet',(cx,y-.004,zz),.002,.001,brass,col,bn,16)
strap('Bass hand strap',BX-.008,.087,-.115,.115,.027,'CTRL_LADO_BAJO',.046)
strap('Melody shoulder strap inner',MX-.025,.087,-.126,.126,.019,'CTRL_LADO_MELODIA',.093)
strap('Melody shoulder strap outer',MX+.031,.087,-.126,.126,.019,'CTRL_LADO_MELODIA',.075)

# Keep static parts editable but consolidate per-bone buttons and straps.
def join_objects(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    # Joining retains group weights; one armature modifier suffices.
    mods=[m for m in o.modifiers if m.type=='ARMATURE']
    for m in mods[1:]:o.modifiers.remove(m)
    return o
for info in buttons:
    group=[o for o in list(bpy.data.objects) if o.type=='MESH' and o.name.startswith(info['name']+' ') and ('captive' in o.name or 'pearl' in o.name)]
    join_objects(group,info['name']+' moving head and stem')
for col in ['04_Bass_Buttons','05_Melody_Buttons']:
    group=[o for o in collections[col].objects if 'socket' in o.name or 'guide' in o.name]
    join_objects(group,col+' fixed sockets')
join_objects([o for o in collections['06_Straps'].objects],'Leather straps with stitching and buckles')

# Exportable named skeletal actions. Bone drivers are baked into GLB sampling.
def action(name,frames,opens,presses=None):
    act=bpy.data.actions.new(name); act.use_fake_user=True
    rig.animation_data_create();rig.animation_data.action=act
    for pb in rig.pose.bones: pb.location=(0,0,0);pb.scale=(1,1,1);pb.rotation_euler=(0,0,0)
    for f,v in zip(frames,opens):
        ctrl.scale.x=1+(OPEN/CLOSED-1)*v
        ctrl.keyframe_insert(data_path='scale',frame=f,group='CTRL_FUELLE')
    if presses:
        for bone_name,start in presses:
            pb=rig.pose.bones[bone_name]
            for f,dy in [(1,0),(start,0),(start+3,.0018),(start+7,.0018),(start+11,0),(frames[-1],0)]:
                pb.location.y=dy;pb.keyframe_insert(data_path='location',frame=f,group=bone_name)
    # Explicit rest keys keep clips independent even if played after a button action.
    used={p[0] for p in (presses or [])}
    for info in buttons:
        if info['bone'] not in used:
            pb=rig.pose.bones[info['bone']]
            for f in [1,frames[-1]]:pb.location.y=0;pb.keyframe_insert(data_path='location',frame=f,group='Button rest')
    for slot in act.slots:
        for layer in act.layers:
            for strip in layer.strips:
                bag=strip.channelbag(slot)
                if bag:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
    return act
actions={}
actions['Idle_Breath_Loop']=action('Idle_Breath_Loop',[1,46,91],[.09,.17,.09])
actions['Bellows_OpenClose']=action('Bellows_OpenClose',[1,61,121],[0,1,0])
actions['Melody_Button_Press']=action('Melody_Button_Press',[1,49],[.12,.12],[('BTN_Melody_05',5),('BTN_Melody_16',18),('BTN_Melody_26',29)])
actions['Bass_Button_Press']=action('Bass_Button_Press',[1,49],[.12,.12],[('BTN_Bass_04',6),('BTN_Bass_08',24)])
rig.animation_data.action=actions['Bellows_OpenClose']
scene.frame_start=1;scene.frame_end=121;scene.frame_set(61)
for f,text in [(1,'CLOSED'),(31,'HALF OPEN'),(61,'FULL OPEN'),(91,'HALF CLOSE'),(121,'CLOSED / LOOP')]:scene.timeline_markers.new(text,frame=f)

# Studio is segregated, and never selected for GLB export.
floor=material('Studio | slate',(.048,.061,.077),0,.72)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.168))
o=bpy.context.object;o.name='Studio seamless ground';o.data.materials.append(floor);move_collection(o,'90_Studio')
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def camera(name,loc,target,scale):
    bpy.ops.object.camera_add(location=loc);o=bpy.context.object;o.name=name;move_collection(o,'90_Studio')
    aim(o,target);o.data.type='ORTHO';o.data.ortho_scale=scale;o.data.lens=70
    return o
cam=camera('Camera | three quarter product',(.56,-.95,.43),(0,0,0),.70);scene.camera=cam
def area(name,loc,power,size,color,target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;move_collection(o,'90_Studio')
    o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,target)
area('Softbox | broad key',(.15,-.52,.65),38,.55,(1,.91,.82))
area('Softbox | cool fill',(-.55,-.23,.20),20,.45,(.76,.86,1))
area('Softbox | back rim',(.24,.38,.45),42,.38,(1,.94,.85))
area('Softbox | frontal strip',(-.08,-.7,.08),9,.35,(1,1,1))

for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=.85
            a.spaces.active.region_3d.view_location=(0,0,0)
            a.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
            a.spaces.active.clip_start=.001
            a.spaces.active.shading.type='MATERIAL'

scene['Reference_boundary']='Four supplied photos reviewed. Images 1-3 include piano/chromatic examples; image 4 guides diatonic construction. 31/12 counts override reference keyboards. No measured scale, manufacturer reproduction or mechanical internals claimed.'
scene['QA_pending']='See qa_report.json. Geometric animation checks and clean GLB reimport performed by separate validation script.'
note=bpy.data.texts.new('READ_ME_CONTROLS.txt')
note.write('AcordenRush / estimated metric scale. CTRL_FUELLE local scale X 1 to 2.5454545 opens the bellows; side boxes are driven translations only. Select rig in Pose mode. Actions: Idle_Breath_Loop 1-91; Bellows_OpenClose 1-121; Melody_Button_Press 1-49; Bass_Button_Press 1-49. 30 fps. Button bones local Y +0.0018m. For arbitrary side control motion, mute the two X location drivers and maintain bellows end planes manually. Default rig master keeps the seams exact. Exported GLB uses baked rigid-body and bellows bone transforms. All dimensions estimated; no manufacturer logo. The textile inner cavity and moving keys are modeled, acoustic internals/reeds are omitted. Surface noise bump and procedural roughness remain Blender-only; base colour textures, scalar PBR and clearcoat export. Studio excluded from GLB.')

# Save editable source before creating the consolidated delivery mesh.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
blend_path=OUT/'AcordeonVallenato_Realista.blend'
for path in sorted((OUT/'audio/button-accordion-hn').rglob('*.flac')):
    sound=bpy.data.sounds.load(str(path),check_existing=True);sound.name='SND_'+path.stem.replace(' ','_');sound.use_fake_user=True;sound.pack();sound.filepath='//'+path.relative_to(OUT).as_posix()
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

if '--no-render' not in __import__('sys').argv:
    for name,frame,loc,target,scale in [
        ('01_front',31,(0,-1,0),(0,0,0),.64),
        ('02_three_quarter_open',61,(.56,-.95,.43),(0,0,0),.70),
        ('03_three_quarter_closed',1,(.56,-.95,.43),(0,0,0),.54),
        ('04_detail_buttons_bellows',31,(.39,-.75,.27),(.13,-.035,.025),.30),
    ]:
        o=bpy.data.objects['Studio seamless ground'];o.hide_render=name=='01_front'
        scene.frame_set(frame);cam.location=loc;aim(cam,target);cam.data.ortho_scale=scale
        scene.render.filepath=str(RENDERS/(name+'.png'))
        bpy.ops.render.render(write_still=True)
    scene.frame_set(61);cam.location=(.56,-.95,.43);aim(cam,(0,0,0));cam.data.ortho_scale=.70

# Applied bevels, UVs and one combined skin reduce draw calls for Three.js.
meshes=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
combined=join_objects(meshes,'AcordenRush web instrument skin')
bpy.ops.object.select_all(action='DESELECT');combined.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'AcordeonVallenato_Realista.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_bake_animation=True,
    export_anim_single_armature=True,export_skins=True,export_morph=False,export_materials='EXPORT',
    export_cameras=False,export_lights=False,export_yup=True,export_extras=True)
print('DELIVERY_COMPLETE',str(OUT),flush=True)
