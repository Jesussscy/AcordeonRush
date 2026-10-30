"""Distinct exterior designs on the verified 31/12 diatonic mechanical platform.
Blender 5.2: blender -b --python tools/build_accordion_variants.py
"""
import bpy,bmesh,math,json,ast,struct,hashlib,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/blender/realistic'
OUT=BASE/'variants';OUT.mkdir(exist_ok=True)
DESIGNS=[
 dict(id='azul-caribe',name='Azul Caribe',description='Perlado azul profundo, parrilla de rombos y nervaduras en espiga, ribetes de níquel.',defaultTuning='ADG',color='#204a99',style='diamond',tint=[.035,.14,.43],cloth=[.025,.035,.070]),
 dict(id='marfil-artesanal',name='Marfil Artesanal',description='Perlado marfil cálido, parrilla de ranuras verticales y marquetería geométrica original.',defaultTuning='FBbEb',color='#c9b58e',style='vertical',tint=[.76,.66,.47],cloth=[.065,.035,.023]),
 dict(id='negro-escenario',name='Negro Escenario',description='Laca grafito, ranuras horizontales, cantoneras protectoras y acentos vino discretos.',defaultTuning='EAD',color='#292e3a',style='horizontal',tint=[.025,.029,.038],cloth=[.065,.014,.024]),
]
# Reuse only helper function definitions; never execute the base generator.
helper_names={'move_collection','finish','apply','box','cylinder','tube','label','screw'}
source=ast.parse((ROOT/'tools/build_realistic_accordion.py').read_text(encoding='utf8'))
helpers=ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in helper_names],type_ignores=[])
exec(compile(helpers,'shared accordion mesh helpers','exec'))

def getmat(prefix):return next(m for m in bpy.data.materials if m.name.startswith(prefix))
def tint_material(mat,color):
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);mat.diffuse_color=(*color,1)
    for n in mat.node_tree.nodes:
        if n.type=='TEX_IMAGE' and n.image:
            im=n.image;pix=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4)
            shading=pix[:,:3].max(axis=1);shading=shading/max(.001,float(shading.mean()))
            pix[:,:3]=np.clip(shading[:,None]*np.array(color)[None,:],0,1)
            im.pixels.foreach_set(pix.ravel());im.update();im.pack()

def panel(name,cx,y,cz,width,height,cols,rows,style,col,bn,mat):
    """One perforated metal sheet, actual holes + thickness, with three hole profiles."""
    box(name+' acoustic liner',(cx,y+.0025,cz),(width+.003,.002,height+.003),meshblack,col,bn,.0015)
    vs=[];fs=[];N=16
    sx=width/cols;sz=height/rows
    for row in range(rows):
        for column in range(cols):
            x=cx+(column-(cols-1)/2)*sx;z=cz+(row-(rows-1)/2)*sz;base=len(vs)
            for outer in [True,False]:
                for k in range(N):
                    a=2*math.pi*k/N;c=math.cos(a);s=math.sin(a)
                    if outer:
                        r=1/max(abs(c),abs(s));dx=c*sx*.5*r;dz=s*sz*.5*r
                    elif style=='diamond':
                        r=.73/(abs(c)+abs(s));dx=c*sx*.5*r;dz=s*sz*.5*r
                    elif style=='vertical':dx=c*sx*.22;dz=s*sz*.40
                    else:dx=c*sx*.40;dz=s*sz*.20
                    vs.append((x+dx,y,z+dz))
            for k in range(N):j=(k+1)%N;fs.append((base+k,base+j,base+N+j,base+N+k))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);collections[col].objects.link(obj)
    mod=obj.modifiers.new('Stamped sheet thickness','SOLIDIFY');mod.thickness=.00055;apply(obj,mod)
    finish(obj,name,mat,col,bn)
    for x in [cx-width/2-.0012,cx+width/2+.0012]:box(name+' perimeter',(x,y-.0004,cz),(.002,.002,height+.006),mat,col,bn,.0006)
    for z in [cz-height/2-.002,cz+height/2+.002]:box(name+' perimeter',(cx,y-.0004,z),(width+.004,.002,.002),mat,col,bn,.0006)

def joined_export(path):
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='AcordenRush web instrument skin'
    mods=[m for m in skin.modifiers if m.type=='ARMATURE']
    for m in mods[1:]:skin.modifiers.remove(m)
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_bake_animation=True,export_anim_single_armature=True,export_skins=True,export_morph=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_yup=True,export_extras=True)

def source_validation():
    melody=[b for b in rig.pose.bones if b.name.startswith('BTN_Melody_')];bass=[b for b in rig.pose.bones if b.name.startswith('BTN_Bass_')]
    assert len(melody)==31 and len(bass)==12
    bellows=bpy.data.objects['Bellows | continuous 20 pleat textile shell']
    bm=bmesh.new();bm.from_mesh(bellows.data);assert all(e.is_manifold for e in bm.edges)
    left=set(bm.verts);components=0
    while left:
        todo=[left.pop()];components+=1
        while todo:
            for e in todo.pop().link_edges:
                for v in e.verts:
                    if v in left:left.remove(v);todo.append(v)
    assert components==1;bm.free()
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
    expected={};maxerror=0;scaleerror=0;frames_evaluated=0
    for act in list(bpy.data.actions):
        if act.name not in ['Bellows_OpenClose','Idle_Breath_Loop','Melody_Button_Press','Bass_Button_Press']:continue
        rig.animation_data.action=act;first,last=map(int,act.frame_range)
        samples={first,(first+last)//2,last}
        if act.name=='Melody_Button_Press':samples.update([8,21,32])
        if act.name=='Bass_Button_Press':samples.update([9,27])
        for frame in range(first,last+1):
            scene.frame_set(frame);bpy.context.view_layer.update();frames_evaluated+=1
            opening=rig.pose.bones['CTRL_FUELLE'].scale.x
            assert 1-1e-7<=opening<=.280/.110+1e-6
            for name,sign in [('CTRL_LADO_BAJO',-1),('CTRL_LADO_MELODIA',1)]:
                pb=rig.pose.bones[name];mat=pb.matrix@pb.bone.matrix_local.inverted()
                maxerror=max(maxerror,abs(mat.translation.x-sign*.055*(opening-1)))
                scaleerror=max(scaleerror,max(abs(v-1) for v in mat.to_scale()))
            for pb in melody+bass:assert abs(pb.location.x)<1e-7 and abs(pb.location.z)<1e-7 and -.000001<=pb.location.y<=.001801
            if frame in samples:
                dg=bpy.context.evaluated_depsgraph_get();pts=[]
                for obj in meshes:
                    ev=obj.evaluated_get(dg);me=ev.to_mesh()
                    for i in range(0,len(me.vertices),max(1,len(me.vertices)//3)):pts.append(tuple(ev.matrix_world@me.vertices[i].co))
                    ev.to_mesh_clear()
                expected[(act.name,frame)]=pts
    assert maxerror<1e-6 and scaleerror<1e-6
    return expected,dict(melody_buttons=31,melody_rows=[10,11,10],bass_buttons=12,bass_rows=4,bass_columns=3,bellows_folds=20,connected_bellows_components=components,nonmanifold_bellows_edges=0,integer_frames_evaluated=frames_evaluated,max_case_translation_error_m=maxerror,max_case_scale_error=scaleerror)

def validate_import(path,expected):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n])
    assert not doc.get('cameras') and not doc.get('extensions',{}).get('KHR_lights_punctual')
    assert len(doc['animations'])==4
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(path))
    imported=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    for track in imported.animation_data.nla_tracks:track.mute=True
    assert len([b for b in imported.pose.bones if b.name.startswith('BTN_Melody_')])==31
    assert len([b for b in imported.pose.bones if b.name.startswith('BTN_Bass_')])==12
    errors={}
    for (name,frame),points in expected.items():
        act=next(a for a in bpy.data.actions if a.name==name or a.name.startswith(name))
        imported.animation_data.action=act
        if act.slots:imported.animation_data.action_slot=act.slots[0]
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();coords=[]
        for o in bpy.data.objects:
            if o.type!='MESH':continue
            ev=o.evaluated_get(dg);me=ev.to_mesh();coords.extend([ev.matrix_world@v.co for v in me.vertices]);ev.to_mesh_clear()
        tree=KDTree(len(coords))
        for i,co in enumerate(coords):tree.insert(co,i)
        tree.balance();error=max(tree.find(Vector(p))[2] for p in points)
        errors[name+'@'+str(frame)]=error
    worst=max(errors.values());assert worst<1e-5,(path,worst)
    return dict(clean_reimport=True,reimport_fps=30,animations=[a['name'] for a in doc['animations']],max_sample_deviation_m=worst,sampled_poses=len(expected),sample_errors_m=errors,triangles=triangles,mesh_count=len(doc['meshes']),materials=len(doc.get('materials',[])),bytes=len(data),studio_excluded=True)

manifest=json.loads((OUT/'designs.json').read_text(encoding='utf8')) if (OUT/'designs.json').exists() else []
for design in DESIGNS:
    if '--only' in sys.argv and design['id']!=sys.argv[sys.argv.index('--only')+1]:continue
    directory=OUT/design['id'];directory.mkdir(exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'AcordeonVallenato_Realista.blend'))
    scene=bpy.context.scene;rig=bpy.data.objects['RIG_AcordenRush'];collections={c.name:c for c in bpy.data.collections};model_objects=[]
    wine=getmat('Case | wine');black=getmat('Case | satin');steel=getmat('Hardware | brushed');brass=getmat('Hardware | restrained');ivory=getmat('Buttons | warm');cloth=getmat('Bellows | woven');paper=getmat('Bellows | warm edge');meshblack=getmat('Grille | recessed')
    tint_material(wine,design['tint']);tint_material(cloth,design['cloth'])
    if design['id']=='marfil-artesanal':
        tint_material(black,[.065,.035,.022]);tint_material(paper,[.30,.17,.075]);tint_material(steel,[.43,.34,.22]);steel.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.36
    elif design['id']=='negro-escenario':
        tint_material(paper,[.14,.16,.19]);tint_material(steel,[.32,.35,.40]);tint_material(black,[.006,.008,.012])
    else:tint_material(paper,[.44,.50,.58])
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('Melody perforated nickel grille','Grille formed sweep rib','Bass upper vent','Bass lower vent')):bpy.data.objects.remove(obj,do_unlink=True)
    MX=.1225;BX=-.100;GX=MX-.039
    panel('Design melody grille',GX,-.085,0,.037,.2146,5 if design['style']=='diamond' else 3,25 if design['style']=='diamond' else 16,design['style'],'02_Melody_Case','CTRL_LADO_MELODIA',steel)
    for z in [-.115,.112]:panel('Design bass vent',BX,-.084,z,.042,.018,6,2,design['style'],'01_Bass_Case','CTRL_LADO_BAJO',steel)
    if design['id']=='azul-caribe':
        for i in range(8):
            z=-.098+i*.028
            tube('Caribe chevron formed rib',[(GX-.017,-.087,z+.005),(GX,-.089,z-.003),(GX+.017,-.087,z+.005)],.0010,steel,'02_Melody_Case','CTRL_LADO_MELODIA')
        # Slim double pinstripes on the exposed outer cheek.
        for yy in [-.050,.050]:box('Caribe nickel cheek pinstripe',(MX+.0679,yy,0),(.0011,.0015,.264),steel,'02_Melody_Case','CTRL_LADO_MELODIA',.0004)
    elif design['id']=='marfil-artesanal':
        for z in [-.111,.111]:
            tube('Artisanal diamond inlay',[(GX-.014,-.088,z),(GX,-.089,z+.010),(GX+.014,-.088,z),(GX,-.089,z-.010)],.00075,brass,'02_Melody_Case','CTRL_LADO_MELODIA',True)
        for z in [-.095,-.065,-.035,0,.035,.065,.095]:
            # Geometric marquetry on the outer side, following a planar cheek.
            x=MX+.0679
            tube('Artisanal cheek marquetry',[(x,-.036,z),(x,-.006,z+.011),(x,.025,z),(x,-.006,z-.011)],.0008,brass,'02_Melody_Case','CTRL_LADO_MELODIA',True)
        for z in [-.124,.124]:box('Artisanal stepped fascia',(BX,-.086,z),(.053,.0015,.0024),brass,'01_Bass_Case','CTRL_LADO_BAJO',.0005)
    else:
        accent=bpy.data.materials.new('Stage | subdued wine enamel');accent.diffuse_color=(.22,.014,.024,1);accent.use_nodes=True
        shader=accent.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.22,.014,.024,1);shader.inputs['Roughness'].default_value=.31
        for side,cx,w,col,bn in [('Bass',BX,.09,'01_Bass_Case','CTRL_LADO_BAJO'),('Melody',MX,.135,'02_Melody_Case','CTRL_LADO_MELODIA')]:
            for z in [-.139,.139]:
                for x in [cx-w/2+.009,cx+w/2-.009]:box('Stage protective corner guard',(x,-.083,z),(.016,.009,.020),steel,col,bn,.002)
            for x in [cx-w/2+.005,cx+w/2-.005]:box('Stage wine edge accent',(x,-.085,0),(.0015,.002,.248),accent,col,bn,.0005)
    scene['Design_id']=design['id'];scene['Design_notes']=design['description'];scene['Suggested_tuning']=design['defaultTuning'];rig['design_id']=design['id']
    expected,qa=source_validation()
    rig.animation_data.action=bpy.data.actions['Bellows_OpenClose'];scene.frame_start=1;scene.frame_end=121;scene.frame_set(31)
    scene.render.resolution_x=1200;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.cycles.samples=40
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for device in prefs.devices:device.use=device.type=='OPTIX'
        scene.cycles.device='GPU' if any(d.type=='OPTIX' for d in prefs.devices) else 'CPU'
    except Exception:scene.cycles.device='CPU'
    scene.camera.data.ortho_scale=.63
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'instrument.blend'),compress=True)
    scene.render.filepath=str(directory/'preview.png');bpy.ops.render.render(write_still=True)
    joined_export(directory/'instrument.glb')
    qa.update(validate_import(directory/'instrument.glb',expected));qa['design_id']=design['id'];qa['passed']=True
    (directory/'qa_report.json').write_text(json.dumps(qa,indent=2),encoding='utf8')
    manifest=[item for item in manifest if item['id']!=design['id']]
    manifest.append({k:v for k,v in design.items() if k not in ['style','tint','cloth']}|dict(path='variants/'+design['id']+'/instrument.glb',blend='variants/'+design['id']+'/instrument.blend',thumbnail='variants/'+design['id']+'/preview.png'))
    manifest.sort(key=lambda item:[d['id'] for d in DESIGNS].index(item['id']))
    (OUT/'designs.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
    print('VARIANT_COMPLETE',design['id'],flush=True)
print('ALL_VARIANTS_COMPLETE',flush=True)
