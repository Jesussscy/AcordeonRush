"""A new rounded/wing-keyboard 31/12 family, with a live spatial bellows rig.
Blender 5.2: blender -b --python tools/build_curved_accordions.py -- --only curva-zafiro
No web source or previous model is modified. Dimensions are artistic estimates.
"""
import bpy,bmesh,math,json,ast,sys,re
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/blender/curved_v2';OUT.mkdir(parents=True,exist_ok=True)
L0=.095;EXTRA=.140;N_FOLDS=20
BX=-L0/2-.042;MX=L0/2+.056
DESIGNS=[
 dict(id='curva-zafiro',name='Curva Zafiro',color=[.045,.22,.62],cloth=[.075,.009,.023],accent=[.43,.013,.035],motif=[.69,.63,.51],metal=[.52,.57,.64]),
 dict(id='curva-esmeralda',name='Curva Esmeralda',color=[.025,.31,.19],cloth=[.017,.031,.026],accent=[.20,.12,.045],motif=[.72,.64,.43],metal=[.43,.36,.23]),
 dict(id='curva-granate',name='Curva Granate',color=[.42,.025,.067],cloth=[.025,.016,.021],accent=[.13,.052,.026],motif=[.74,.64,.47],metal=[.49,.51,.55]),
 dict(id='curva-grafito',name='Curva Grafito',color=[.15,.17,.19],cloth=[.019,.014,.019],accent=[.39,.018,.027],motif=[.77,.75,.67],metal=[.57,.61,.66]),
]
source=ast.parse((ROOT/'tools/build_realistic_accordion.py').read_text(encoding='utf8'))
names={'move_collection','finish','apply','box','cylinder','tube','label','screw','bone','button','strap','join_objects'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'shared low-level geometry helpers','exec'))

def shader(name,color,metal=0,rough=.4,image=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if image:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
    return m

def pearloid(name,color):
    """Embeddable image-backed celluloid chips, not a flat colour or studio photo."""
    rng=np.random.default_rng(116);n=512;y,x=np.mgrid[0:n,0:n].astype(np.float32)/n
    x=x+.028*np.sin(y*31)+.012*np.sin((x+y)*53);y=y+.026*np.sin(x*27)
    seeds=rng.random((85,2)).astype(np.float32);dist=np.stack([(x-a)**2+(y-b)**2 for a,b in seeds])
    ids=np.argmin(dist,axis=0);near=np.partition(dist,1,axis=0)[:2];edge=np.clip((near[1]-near[0])*190,0,1)
    light=rng.uniform(.40,1.65,85)[ids];directions=rng.uniform(-math.pi,math.pi,85)
    facets=np.clip(1+2.7*((x-seeds[:,0][ids])*np.cos(directions[ids])+(y-seeds[:,1][ids])*np.sin(directions[ids])),.72,1.28)
    value=(.48+.52*edge)*light*facets
    pix=np.ones((n,n,4),dtype=np.float32);pix[:,:,:3]=np.clip(value[:,:,None]*np.array(color)[None,None,:]+(.045*(1-edge))[:,:,None],0,1)
    im=bpy.data.images.new(name,width=n,height=n);im.pixels.foreach_set(pix.ravel());im.pack();return im

def profile(hy,hz,r):
    """96 perimeter vertices, including subdivided broad cloth panels for the motif."""
    points=[]
    for cy,cz,start,edge_end,count in [(hy-r,hz-r,0,(-hy+r,hz),8),(-hy+r,hz-r,90,(-hy,-hz+r),28),(-hy+r,-hz+r,180,(hy-r,-hz),8),(hy-r,-hz+r,270,(hy,hz-r),28)]:
        for k in range(6):
            a=math.radians(start+k*15);points.append((cy+r*math.cos(a),cz+r*math.sin(a)))
        a=math.radians(start+90);begin=(cy+r*math.cos(a),cz+r*math.sin(a))
        for k in range(count):
            t=k/count;points.append((begin[0]*(1-t)+edge_end[0]*t,begin[1]*(1-t)+edge_end[1]*t))
    return points

def mesh_obj(name,verts,faces,mat,col,bn=None,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);collections[col].objects.link(o);return finish(o,name,mat,col,bn,smooth)

STATIONS=[(0,.073,.145),(.05,.078,.151),(.22,.083,.157),(.50,.086,.157),(.74,.080,.151),(.92,.064,.135),(1,.044,.112)]
def dimensions(u):
    for (ua,ya,za),(ub,yb,zb) in zip(STATIONS,STATIONS[1:]):
        if u<=ub:
            t=(u-ua)/(ub-ua);return ya*(1-t)+yb*t,za*(1-t)+zb*t
    return STATIONS[-1][1:]

def sculpted_case(side,sign,width,bn,col):
    vs=[];fs=[]
    for u,hy,hz in STATIONS:
        for yy,zz in profile(hy,hz,.019):vs.append((sign*(L0/2+u*width),yy-.003*math.sin(math.pi*u),zz))
    seg=96
    for i in range(len(STATIONS)-1):
        for k in range(seg):fs.append((i*seg+k,i*seg+(k+1)%seg,(i+1)*seg+(k+1)%seg,(i+1)*seg+k))
    fs.extend([tuple(range(seg-1,-1,-1)),tuple((len(STATIONS)-1)*seg+k for k in range(seg))])
    o=mesh_obj(side+' | sculpted vaulted pearloid shell',vs,fs,wine,col,bn,True)
    o['construction']='Lofted rounded vault; varying depth and shoulder height; separate supported keyboard wing.'
    for u in [.025,.10,.91]:
        hy,hz=dimensions(u);coords=[(sign*(L0/2+u*width),yy-.003*math.sin(math.pi*u),zz) for yy,zz in profile(hy+.0006,hz+.0006,.019)]
        tube(side+' curved cover seam',coords,.00075,steel if u<.1 else black,col,bn,True)
    # A flat, sealed bellows mating frame, inside the outer shell's silhouette.
    box(side+' airtight bellows frame',(sign*(L0/2+.0015),0,0),(.003,.144,.286),black,col,bn,.003)
    for z in [-.144,.144]:
        tube(side+' cap edge',[(sign*(L0/2+u*width),-.061,z) for u in [.10,.25,.5,.7]],.0010,steel,col,bn)
    for z in [-.129,.129]:
        x=sign*(L0/2+.035);screw(side+' cover screw',x,-.088,z,col,bn)
    # parked closure strap, recessed rear lid, actual attachment loops
    cx=sign*(L0/2+width*.5)
    box(side+' rear padded lid',(cx,.078,0),(width*.67,.008,.263),leather,col,bn,.014)
    for z in [-.12,.12]:
        box(side+' rear strap mounting plate',(cx,.085,z),(.022,.003,.019),steel,col,bn,.003)
        cylinder(side+' mounting rivet',(cx,.087,z),.0022,.002,brass,col,bn)
    box(side+' parked leather closing latch',(cx,0,.155),(.033,.015,.0025),leather,col,bn,.004)
    for yy in [-.045,.045]:box(side+' rubber foot',(cx,yy,-.158),(.024,.014,.005),black,col,bn,.003)
    return o

def wing():
    # A true extruded, beveled paddle; it overlaps the cabinet and two brackets.
    points=[(.139,-.119),(.145,-.139),(.183,-.145),(.207,-.128),(.218,-.098),(.218,.100),(.205,.128),(.184,.145),(.145,.139),(.137,.116)]
    vs=[(x,y,z) for y in [-.111,-.084] for x,z in points];n=len(points)
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh_obj('Melody | projecting sculpted keyboard wing',vs,fs,black,'02_Melody_Case','CTRL_LADO_MELODIA')
    mod=o.modifiers.new('Paddle softly rolled perimeter','BEVEL');mod.width=.004;mod.segments=4;apply(o,mod)
    mod=o.modifiers.new('Keyboard weighted normals','WEIGHTED_NORMAL');apply(o,mod)
    for z in [-.087,.087]:box('Melody wing structural bracket',(.152,-.083,z),(.048,.026,.014),black,'02_Melody_Case','CTRL_LADO_MELODIA',.004)
    tube('Melody wing nickel piping',[(x,-.110,z) for x,z in points],.0007,steel,'02_Melody_Case','CTRL_LADO_MELODIA',True)

def curved_grille():
    # Punched cells follow the cabinet bulge instead of a flat rectangular plate.
    width=.071;height=.249;cx=L0/2+.048;ncol=6;nrow=25;sx=width/ncol;sz=height/nrow
    def front(x):
        u=(x-L0/2)/.112;hy,hz=dimensions(u);return -hy-.003*math.sin(math.pi*u)-.002
    liner_vertices=[]
    for z in [-height/2,height/2]:
        for i in range(25):
            x=cx-width/2+width*i/24;liner_vertices.append((x,front(x)+.0010,z))
    mesh_obj('Melody | recessed curved acoustic cloth',liner_vertices,[(i,i+1,25+i+1,25+i) for i in range(24)],acoustic,'02_Melody_Case','CTRL_LADO_MELODIA')
    vs=[];fs=[];N=12
    for iz in range(nrow):
        for ix in range(ncol):
            x=cx+(ix-(ncol-1)/2)*sx;z=(iz-(nrow-1)/2)*sz;base=len(vs)
            for outer in [True,False]:
                for k in range(N):
                    a=2*math.pi*k/N;c=math.cos(a);s=math.sin(a)
                    if outer:fac=1/max(abs(c),abs(s));dx=sx/2*c*fac;dz=sz/2*s*fac
                    else:dx=sx*.32*c;dz=sz*.25*s
                    xx=x+dx;vs.append((xx,front(xx),z+dz))
            for k in range(N):j=(k+1)%N;fs.append((base+k,base+j,base+N+j,base+N+k))
    o=mesh_obj('Melody | curved punched steel grille',vs,fs,steel,'02_Melody_Case',None,True)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    solid=o.modifiers.new('Rolled metal sheet thickness','SOLIDIFY');solid.thickness=.00055;apply(o,solid)
    vg=o.vertex_groups.new(name='CTRL_LADO_MELODIA');vg.add(list(range(len(o.data.vertices))),1,'REPLACE');o.parent=rig;mod=o.modifiers.new('Rigid grille skin','ARMATURE');mod.object=rig
    for z in [-height/2-.0015,height/2+.0015]:tube('Grille rolled horizontal perimeter',[(cx-width/2+width*k/20,front(cx-width/2+width*k/20)-.0006,z) for k in range(21)],.0012,steel,'02_Melody_Case','CTRL_LADO_MELODIA')
    for x in [cx-width/2-.001,cx+width/2+.001]:tube('Grille rolled side perimeter',[(x,front(x)-.0003,-height/2),(x,front(x)-.0003,height/2)],.0012,steel,'02_Melody_Case','CTRL_LADO_MELODIA')
    for i in range(13):
        z=-.112+i*.0186
        tube('Melody grille curved louvre %02d'%i,[(cx-width/2+width*k/12,front(cx-width/2+width*k/12)-.0018,z+.002*math.sin(math.pi*k/12)) for k in range(13)],.00125,steel,'02_Melody_Case','CTRL_LADO_MELODIA')
    box('Original inset maker plaque',(cx,front(cx)-.003,0),(.020,.002,.040),black,'02_Melody_Case','CTRL_LADO_MELODIA',.003)
    label('Original AR crest','AR',(cx,front(cx)-.0045,.005),.0085,ivory,'02_Melody_Case','CTRL_LADO_MELODIA')
    label('Original model inscription','AcordenRush',(cx,-.090,-.139),.0048,steel,'02_Melody_Case','CTRL_LADO_MELODIA')

def make_bellows():
    rings=[]
    for i in range(N_FOLDS):
        for frac,high in [(0,0),(.46,1),(.54,1)]:rings.append(((i+frac)/N_FOLDS,high))
    rings.append((1,0));nr=len(rings);seg=96;vs=[];fs=[];mids=[]
    for inner in [False,True]:
        for t,high in rings:
            thick=.00055 if inner else 0
            for y,z in profile(.068+.009*high-thick,.141+.009*high-thick,.009-thick):vs.append(((t-.5)*L0,y,z))
    for layer in range(2):
        off=layer*nr*seg
        for i in range(nr-1):
            for k in range(seg):
                face=(off+i*seg+k,off+i*seg+(k+1)%seg,off+(i+1)*seg+(k+1)%seg,off+(i+1)*seg+k);fs.append(face if layer==0 else face[::-1])
                y,z=profile(.068,.141,.009)[k];t=(rings[i][0]+rings[i+1][0])/2
                peak=rings[i][1] and rings[i+1][1]
                diamond=abs(t-.5)/.34+abs(z)/.10
                mi=2 if peak else (4 if abs(y)>.055 and diamond<.50 else 3 if abs(y)>.055 and diamond<.88 else 0)
                if peak and abs(y)>.06 and abs(z)>.126:mi=5
                mids.append(mi)
    for i in [0,nr-1]:
        for k in range(seg):fs.append((i*seg+k,nr*seg+i*seg+k,nr*seg+i*seg+(k+1)%seg,i*seg+(k+1)%seg));mids.append(1)
    o=mesh_obj('Bellows | sealed spatial 20 fold shell',vs,fs,None,'03_Bellows')
    for mat in [cloth,leather,binding,accent_cloth,motif_cloth,steel]:o.data.materials.append(mat)
    for p,mi in zip(o.data.polygons,mids):p.material_index=mi
    uv=o.data.uv_layers.active
    for p in o.data.polygons:
        for li in p.loop_indices:
            index=o.data.loops[li].vertex_index%(nr*seg);uv.data[li].uv=((index//seg)/(nr-1)*4,(index%seg)/seg*3)
    for i,(t,_) in enumerate(rings):
        vg=o.vertex_groups.new(name='BELLOW_RING_%02d'%i)
        vg.add([layer*nr*seg+i*seg+k for layer in range(2) for k in range(seg)],1,'REPLACE')
    o.parent=rig;mod=o.modifiers.new('Spatial articulated cloth skin','ARMATURE');mod.object=rig
    o['folds']=20;o['ring_count']=61;o['thickness_m']=.00055;o['construction']='Single sealed manifold shell. Each cross section is rigidly posed along an analytic 3D arc; end sections coincide exactly with the rigid case frames.'
    return o,rings

def setup_driver(pb,channel,index,expression):
    assert len(expression)<256,(channel,len(expression),expression)
    fc=pb.driver_add(channel,index) if index is not None else pb.driver_add(channel)
    fc.keyframe_points.clear();fc.update();dr=fc.driver
    for short,prop in [('o','apertura'),('f','abanico'),('s','lateral'),('w','torsion'),('a','anclaje'),('L','_span'),('k','_fan'),('j','_yaw'),('r','_roll')]:
        if not re.search(r'\b'+short+r'\b',expression):continue
        v=dr.variables.new();v.name=short;v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path=f'pose.bones["CTRL_FUELLE"]["{prop}"]'
    dr.expression=expression

def rig_section(bn,t,offset=0):
    """Analytic centreline integral of Rz(yaw) Ry(fan) X, with optional right anchor."""
    m=f'({t-.5:g}-.5*a)';k='k';j='j';L='L'
    def sinc(v):return f'(sin({v}*{m})/{v} if abs({v})>1e-6 else {m})'
    def cosint(v):return f'((1-cos({v}*{m}))/{v} if abs({v})>1e-6 else 0)'
    dm=f'({j}-{k})';dp=f'({j}+{k})'
    cx=f'{L}*.5*({sinc(dm)}+{sinc(dp)})+.0475*a'
    cy=f'{L}*.5*({cosint(dp)}+{cosint(dm)})'
    cz=f'{L}*((cos({k}*{m})-1)/{k} if abs({k})>1e-6 else 0)'
    pb=rig.pose.bones[bn];pb.rotation_mode='XYZ'
    restx=(t-.5)*L0+offset
    exprs=[f'{cx}-({restx:g})',cy,cz]
    for i,ex in enumerate(exprs):setup_driver(pb,'location',i,ex)
    for i,ex in enumerate([f'r*{m}',f'{k}*{m}',f'{j}*{m}']):setup_driver(pb,'rotation_euler',i,ex)
    pb.lock_scale=(True,True,True)

def actions_create():
    names={
      'Idle_Breath_Loop':(121,lambda p:(.10+.026*math.sin(2*math.pi*p),.60,0,0,.65)),
      'Bellows_OpenClose':(181,lambda p:((1-math.cos(2*math.pi*p))/2,1,0,0,0)),
      'Bellows_Fan_Lower':(181,lambda p:(.88*(1-math.cos(2*math.pi*p))/2,-1,0,0,0)),
      'Bass_Anchored_Phrase':(181,lambda p:(.045+.90*math.sin(math.pi*p)**2,1,0,0,1)),
      'Bellows_Oblique_Sweep':(181,lambda p:(.06+.87*math.sin(math.pi*p)**2,.65,.85*math.sin(2*math.pi*p),.35*math.sin(2*math.pi*p),.35)),
      'Bellows_Expressive_Arc':(241,lambda p:(.12+.75*math.sin(math.pi*p)**2,.70+.17*math.cos(2*math.pi*p),.65*math.sin(4*math.pi*p),.60*math.sin(2*math.pi*p),.5+.5*math.sin(math.pi*p)**2)),
      'Bellows_Short_Accents':(97,lambda p:(.13+.055*(1-math.cos(8*math.pi*p)),.8,0,0,.9)),
      'Melody_Button_Press':(565,lambda p:(.18,.7,0,0,.8)),
      'Bass_Button_Press':(223,lambda p:(.18,.7,0,0,.8)),
    }
    ctrl=rig.pose.bones['CTRL_FUELLE']
    for name,(end,pose) in names.items():
        act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=act
        for f in sorted(set(list(range(1,end+1,3))+[end])):
            p=(f-1)/(end-1)
            for prop,value in zip(['apertura','abanico','lateral','torsion','anclaje'],pose(p)):
                ctrl[prop]=value;ctrl.keyframe_insert(data_path=f'["{prop}"]',frame=f,group='CTRL_FUELLE spatial controls')
        root=rig.pose.bones['ROOT']
        for f in [1,end]:root.location=(0,0,0);root.keyframe_insert(data_path='location',frame=f,group='Export scene sampling anchor')
        selected={f'BTN_Melody_{i:02d}':5+(i-1)*18 for i in range(1,32)} if name=='Melody_Button_Press' else {f'BTN_Bass_{i:02d}':5+(i-1)*18 for i in range(1,13)} if name=='Bass_Button_Press' else {}
        for item in buttons:
            pb=rig.pose.bones[item['bone']];times=[(1,0),(end,0)]
            if item['bone'] in selected:
                t=selected[item['bone']];times=[(1,0),(t,0),(t+3,.0018),(t+7,.0018),(t+11,0),(t+13,.00010),(t+16,0),(end,0)]
            for f,travel in times:pb.location.y=travel;pb.keyframe_insert(data_path='location',frame=f,group=item['bone'])
        for slot in act.slots:
            for layer in act.layers:
                for strip in layer.strips:
                    bag=strip.channelbag(slot)
                    if bag:
                        for fc in bag.fcurves:
                            for kp in fc.keyframe_points:kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
    return {name:[1,v[0]] for name,v in names.items()}

def studio():
    scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='OPTIX'
        scene.cycles.device='GPU' if any(d.type=='OPTIX' for d in prefs.devices) else 'CPU'
    except Exception:scene.cycles.device='CPU'
    scene.render.resolution_x=1500;scene.render.resolution_y=1250;scene.render.resolution_percentage=100;scene.render.fps=30;scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.26,.29,.35,1);bg.inputs[1].default_value=.28
    def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(.55,-1.05,.38));cam=bpy.context.object;cam.name='Studio product camera';move_collection(cam,'90_Studio');aim(cam,(.015,0,0));cam.data.type='ORTHO';cam.data.ortho_scale=.70;cam.data.clip_start=.001;scene.camera=cam
    for name,loc,power,size,color in [('Key',(-.2,-.5,.6),32,.55,(1,.93,.86)),('Fill',(.5,-.3,.2),15,.50,(.75,.85,1)),('Rim',(.1,.4,.45),32,.40,(1,.95,.88))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name='Studio '+name;move_collection(o,'90_Studio');o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,0))
    return scene

def export_glb(path):
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
    o=join_objects(meshes,'AcordenRush Curva web skin')
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_animations=True,export_bake_animation=True,export_anim_single_armature=True,export_skins=True,export_morph=False,export_cameras=False,export_lights=False,export_extras=True)

for design in DESIGNS:
    if '--only' in sys.argv and design['id']!=sys.argv[sys.argv.index('--only')+1]:continue
    bpy.ops.wm.read_factory_settings(use_empty=True);collections={}
    for name in ['00_Rig','01_Bass_Case','02_Melody_Case','03_Bellows','04_Bass_Buttons','05_Melody_Buttons','06_Straps','90_Studio']:
        col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col);collections[name]=col
    model_objects=[];buttons=[]
    wine=shader('Case | fractured pearloid celluloid',design['color'],.12,.29,pearloid('Embedded pearloid chips',design['color']))
    p=wine.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.20;p.inputs['Coat Roughness'].default_value=.32
    black=shader('Case | satin black polymer',(.012,.014,.017),.05,.39)
    steel=shader('Hardware | satin polished nickel',design['metal'],.82,.32);brass=shader('Hardware | restrained warm alloy',(.34,.26,.13),.70,.38)
    ivory=shader('Buttons | warm mother of pearl',(.84,.81,.71),.06,.26);leather=shader('Straps | black grained leather',(.014,.011,.012),0,.64)
    thread=shader('Straps | stitching',(.27,.23,.18),0,.76);binding=shader('Bellows | black reinforced binding',(.013,.014,.017),0,.66)
    cloth=shader('Bellows | woven primary',[v*.36 for v in design['cloth']],0,.90);accent_cloth=shader('Bellows | woven accent',[v*.65 for v in design['accent']],0,.85);motif_cloth=shader('Bellows | original woven diamond',design['motif'],0,.88)
    acoustic=shader('Grille | recessed acoustic cloth',(.004,.006,.008),0,.94)
    # Blender detail normal remains editable; image-backed pearloid exports as PBR.
    for mat in [cloth,accent_cloth,motif_cloth,leather]:
        nt=mat.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=550;bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Distance'].default_value=.00008;bump.inputs['Strength'].default_value=.2;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
    arm=bpy.data.armatures.new('Curva spatial mechanical rig');rig=bpy.data.objects.new('RIG_AcordenRush_Curva',arm);collections['00_Rig'].objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    bone('ROOT',(0,0,-.23));bone('CTRL_FUELLE',(0,.12,0),'ROOT');bone('CTRL_LADO_BAJO',(BX,0,0),'ROOT');bone('CTRL_LADO_MELODIA',(MX,0,0),'ROOT')
    rings=[((i+frac)/20,high) for i in range(20) for frac,high in [(0,0),(.46,1),(.54,1)]]+[(1,0)]
    for i,(t,_) in enumerate(rings):bone('BELLOW_RING_%02d'%i,((t-.5)*L0,0,0),'ROOT')
    arm.edit_bones['CTRL_LADO_BAJO'].parent=arm.edit_bones['BELLOW_RING_00']
    arm.edit_bones['CTRL_LADO_MELODIA'].parent=arm.edit_bones['BELLOW_RING_60']
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    control=rig.pose.bones['CTRL_FUELLE']
    for prop,default,mn,mx in [('apertura',0,0,1),('abanico',1,-1,1),('lateral',0,-1,1),('torsion',0,-1,1),('anclaje',0,0,1)]:
        control[prop]=default;control.id_properties_ui(prop).update(min=mn,max=mx,soft_min=mn,soft_max=mx)
    control['HELP']='Custom properties: apertura 0..1; abanico +1 upper / -1 lower; lateral and torsion -1..1; anclaje 1 fixes melody end. The live drivers pose every ring and both rigid cases.'
    for prop,expression in [('_span','.095+.140*o'),('_fan','.85*o*f'),('_yaw','.30*o*s'),('_roll','.10*o*w')]:
        control[prop]=0.;setup_driver(control,f'["{prop}"]',None,expression)
    arm.bones['CTRL_FUELLE'].color.palette='THEME04'
    sculpted_case('Bass',-1,.084,'CTRL_LADO_BAJO','01_Bass_Case');sculpted_case('Melody',1,.112,'CTRL_LADO_MELODIA','02_Melody_Case');wing();curved_grille()
    box('Bass | pearloid mounted button plate',(BX,-.088,0),(.048,.014,.213),wine,'01_Bass_Case','CTRL_LADO_BAJO',.012)
    for column,count in enumerate([10,11,10]):
        for row in range(count):
            i=len(buttons)+1;z=((count-1)/2-row)*.0220+(column-1)*.003
            x=.178+(column-1)*.0175+.005*z/.12
            button('Melody',i,(x,-.1115,z),'CTRL_LADO_MELODIA','05_Melody_Buttons',.0059)
    for row in range(6):
        for col in range(2):
            i=row*2+col+1;button('Bass',i,(BX+(col-.5)*.022+(row%2)*.002,-.096,(2.5-row)*.029),'CTRL_LADO_BAJO','04_Bass_Buttons',.0063)
    bellows,rings=make_bellows()
    strap('Bass padded hand strap',BX,.087,-.113,.113,.027,'CTRL_LADO_BAJO',.044)
    strap('Melody shoulder strap',MX+.005,.086,-.123,.123,.023,'CTRL_LADO_MELODIA',.086)
    for item in buttons:
        group=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(item['name']+' ') and ('captive' in o.name or 'pearl' in o.name)]
        join_objects(group,item['name']+' | moving pearl crown and stem')
    for col in ['04_Bass_Buttons','05_Melody_Buttons']:
        join_objects([o for o in collections[col].objects if 'socket' in o.name or 'guide' in o.name],col+' fixed guides')
    join_objects(list(collections['06_Straps'].objects),'Rear leather straps and mountings')
    for i,(t,_) in enumerate(rings):rig_section('BELLOW_RING_%02d'%i,t)
    ranges=actions_create();scene=studio();rig.animation_data.action=bpy.data.actions['Bellows_OpenClose'];scene.frame_start=1;scene.frame_end=181;scene.frame_set(91)
    scene['Design_id']=design['id'];scene['Reference_boundary']='New supplied blue and black pearloid button accordions guide the vaulted cabinets, curved grille, projecting keyboard wing and 2x6 bass board. No manufacturer marks reproduced. All dimensions artistic estimates.'
    scene['Motion_boundary']='Analytic kinematic arc, not cloth/air/reed physics. Live custom-property drivers; export samples skeletal motion. The previous straight-expansion collection is preserved unchanged.'
    scene['Action_ranges']=json.dumps(ranges)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.clip_start=.001;area.spaces.active.region_3d.view_distance=.9;area.spaces.active.region_3d.view_location=(.015,0,0);area.spaces.active.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion()
    directory=OUT/design['id'];directory.mkdir(exist_ok=True)
    note=bpy.data.texts.new('CURVA_CONTROLS_AND_LIMITS.txt');note.write('Select RIG_AcordenRush_Curva in Pose mode, CTRL_FUELLE, custom properties. apertura opens the cloth, abanico chooses upper/lower fan, lateral is depth sway, torsion adds mild spatial twist, anclaje=1 fixes the melody end. Stop/unlink the active action before editing controls manually. Cases are rigid. 61 cloth rings are analytically driven and skinned; frame seams match the case transforms exactly. 31 melody /12 bass, bass arranged 6 rows x2 columns per new references. Nine actions, 30fps. Dimensions are artistic estimates. No claim of cloth physics, acoustic construction, new recordings or manufacturer reproduction.\n'+json.dumps(ranges,indent=2))
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.wm.save_as_mainfile(filepath=str(directory/'instrument.blend'),compress=True)
    if '--no-render' not in sys.argv:
        scene.render.filepath=str(directory/'preview.png');bpy.ops.render.render(write_still=True)
    export_glb(directory/'instrument.glb')
    print('CURVED_DESIGN_CREATED',design['id'],flush=True)
