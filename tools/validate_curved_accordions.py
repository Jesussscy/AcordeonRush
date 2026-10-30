"""Independent geometric/kinematic checks and a fresh GLB reimport, Blender 5.2."""
import bpy,bmesh,math,json,struct,sys,hashlib
from pathlib import Path
from mathutils import Vector,Euler
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/blender/curved_v2'
IDS=['curva-zafiro','curva-esmeralda','curva-granate','curva-grafito']

def expected_section(t,props):
    o,f,s,w,a=[float(props[name]) for name in ['apertura','abanico','lateral','torsion','anclaje']]
    L=.095+.14*o;k=.85*o*f;j=.30*o*s;r=.10*o*w;m=t-.5-.5*a
    def sinc(v):return math.sin(v*m)/v if abs(v)>1e-6 else m
    def cint(v):return (1-math.cos(v*m))/v if abs(v)>1e-6 else 0
    c=Vector((L*.5*(sinc(j-k)+sinc(j+k))+.0475*a,L*.5*(cint(j+k)+cint(j-k)),L*((math.cos(k*m)-1)/k if abs(k)>1e-6 else 0)))
    return c,Euler((r*m,k*m,j*m),'XYZ').to_matrix()

def collision_count(mesh):
    points=[v.co.copy() for v in mesh.vertices];polys=[tuple(p.vertices) for p in mesh.polygons]
    tree=BVHTree.FromPolygons(points,polys,all_triangles=False,epsilon=0)
    pairs=tree.overlap(tree)
    # Topologically adjacent faces share an edge/vertex by design.
    unique={(min(a,b),max(a,b)) for a,b in pairs if a!=b and not set(polys[a]).intersection(polys[b])}
    return len(unique)

for design in IDS:
    if '--only' in sys.argv and design!=sys.argv[sys.argv.index('--only')+1]:continue
    directory=BASE/design;bpy.ops.wm.open_mainfile(filepath=str(directory/'instrument.blend'))
    scene=bpy.context.scene;scene.render.fps=30;rig=bpy.data.objects['RIG_AcordenRush_Curva'];master=rig.pose.bones['CTRL_FUELLE']
    melody=[b for b in rig.pose.bones if b.name.startswith('BTN_Melody_')];bass=[b for b in rig.pose.bones if b.name.startswith('BTN_Bass_')]
    assert len(melody)==31 and len(bass)==12
    cloth=bpy.data.objects['Bellows | sealed spatial 20 fold shell'];bm=bmesh.new();bm.from_mesh(cloth.data)
    assert all(e.is_manifold for e in bm.edges);unseen=set(bm.verts);components=0
    while unseen:
        stack=[unseen.pop()];components+=1
        while stack:
            for e in stack.pop().link_edges:
                for v in e.verts:
                    if v in unseen:unseen.remove(v);stack.append(v)
    assert components==1;bm.free()
    model=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
    expected={};ranges={};count=0;max_seam=0;max_scale=0;max_motion=0;max_rotation=0;collision_checks={};min_bound=10;loop_errors={};button_coverage={}
    for action in sorted(bpy.data.actions,key=lambda a:a.name):
        if action.name not in json.loads(scene['Action_ranges']):continue
        rig.animation_data.action=action;first,last=map(int,action.frame_range);ranges[action.name]=[first,last]
        press_bones=melody if action.name=='Melody_Button_Press' else bass if action.name=='Bass_Button_Press' else []
        peaks={pb.name:0.0 for pb in press_bones};active_at_peak={}
        sample_frames=sorted(set([first,first+(last-first)//4,(first+last)//2,first+(last-first)*3//4,last]+[8+18*i for i in range(len(press_bones))]))
        start_positions=None
        for frame in range(first,last+1):
            scene.frame_set(frame);bpy.context.view_layer.update();count+=1
            # All live drivers must be valid after reopening, without custom Python namespaces.
            assert all(fc.driver.is_valid for fc in rig.animation_data.drivers)
            o,f,s,w,a=[float(master[n]) for n in ['apertura','abanico','lateral','torsion','anclaje']]
            assert -.00001<=o<=1.00001 and max(abs(f),abs(s),abs(w))<=1.00001
            # Conservative longitudinal Jacobian bound: positive => rings remain ordered.
            bound=.095+.14*o-.151*abs(.85*o*f)-.078*abs(.30*o*s)-.004*abs(.10*o*w)
            min_bound=min(min_bound,bound);assert bound>.04
            for index,t in [(0,0),(15,.25),(30,.5),(45,.75),(60,1)]:
                pb=rig.pose.bones['BELLOW_RING_%02d'%index];c,rotation=expected_section(t,master)
                # index15 corresponds the valley at t=.25 because there are three rings per fold.
                max_motion=max(max_motion,(pb.matrix.translation-c).length)
                max_rotation=max(max_rotation,max(abs(pb.matrix[i][j]-rotation[i][j]) for i in range(3) for j in range(3)))
            for bn,ring_name,sign in [('CTRL_LADO_BAJO','BELLOW_RING_00',-1),('CTRL_LADO_MELODIA','BELLOW_RING_60',1)]:
                pb=rig.pose.bones[bn];deform=pb.matrix@pb.bone.matrix_local.inverted()
                joint=deform@Vector((sign*.095/2,0,0));c=rig.pose.bones[ring_name].matrix.translation
                max_seam=max(max_seam,(joint-c).length);max_scale=max(max_scale,max(abs(v-1) for v in deform.to_scale()))
            for pb in melody+bass:assert abs(pb.location.x)<1e-7 and abs(pb.location.z)<1e-7 and -.000001<=pb.location.y<=.001801
            if press_bones:
                for pb in press_bones:peaks[pb.name]=max(peaks[pb.name],float(pb.location.y))
                if frame in [8+18*i for i in range(len(press_bones))]:
                    pressed=sorted(pb.name for pb in melody+bass if pb.location.y>.0017)
                    expected_bone=sorted(press_bones,key=lambda b:b.name)[(frame-8)//18].name
                    assert pressed==[expected_bone],(action.name,frame,pressed,expected_bone)
                    active_at_peak[str(frame)]=expected_bone
                others=bass if action.name=='Melody_Button_Press' else melody
                assert all(abs(pb.location.y)<1e-7 for pb in others)
            if frame in [first,last]:
                pose=[pb.matrix.copy() for pb in rig.pose.bones]
                if start_positions is None:start_positions=pose
                else:loop_errors[action.name]=max(abs(ma[i][j]-mb[i][j]) for ma,mb in zip(start_positions,pose) for i in range(4) for j in range(4))
            if frame in sample_frames:
                dg=bpy.context.evaluated_depsgraph_get();pts=[]
                for obj in model:
                    ev=obj.evaluated_get(dg);me=ev.to_mesh()
                    pts.extend(tuple(ev.matrix_world@me.vertices[i].co) for i in range(0,len(me.vertices),max(1,len(me.vertices)//4)))
                    ev.to_mesh_clear()
                expected[(action.name,frame)]=pts
                if design=='curva-zafiro' and action.name not in ['Melody_Button_Press','Bass_Button_Press']:
                    ev=cloth.evaluated_get(dg);me=ev.to_mesh();collisions=collision_count(me);ev.to_mesh_clear()
                    collision_checks[action.name+'@'+str(frame)]=collisions
                    assert collisions==0,('cloth self intersection',action.name,frame,collisions)
        if press_bones:
            assert all(abs(peak-.0018)<1e-7 for peak in peaks.values()),peaks
            button_coverage[action.name]=dict(count=len(peaks),peak_travel_m=peaks,peak_frames=active_at_peak)
        print('CURVED_SOURCE_CHECK',design,action.name,flush=True)
    assert max_motion<2e-6 and max_rotation<2e-6 and max_scale<2e-6 and max_seam<2e-6,(max_motion,max_rotation,max_scale,max_seam)
    assert max(loop_errors.values())<2e-6,loop_errors
    # Attachments: every moving button vertex is fully assigned to its own captive-head bone.
    for obj in model:
        if 'moving pearl crown' in obj.name:
            assert len(obj.vertex_groups)==1 and obj.vertex_groups[0].name.startswith('BTN_')
            assert all(len(v.groups)==1 and abs(v.groups[0].weight-1)<1e-6 for v in obj.data.vertices)
    report=dict(design=design,melody_buttons=31,melody_rows=[10,11,10],bass_buttons=12,bass_rows=6,bass_columns=2,folds=20,connected_components=components,nonmanifold_edges=0,live_driver_errors=0,frames_evaluated=count,action_ranges=ranges,max_ring_position_error_m=max_motion,max_ring_rotation_error=max_rotation,max_case_scale_error=max_scale,max_attachment_seam_error_m=max_seam,loop_matrix_errors=loop_errors,min_longitudinal_jacobian_bound_m=min_bound,cloth_self_intersections=collision_checks)
    report['button_press_coverage']=button_coverage
    glb=directory/'instrument.glb';data=glb.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);assert len(doc['animations'])==9 and not doc.get('cameras') and not doc.get('extensions',{}).get('KHR_lights_punctual')
    assert set(a['name'] for a in doc['animations'])==set(ranges)
    assert not any('Studio' in n.get('name','') for n in doc['nodes'])
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(glb))
    imported=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    for tr in imported.animation_data.nla_tracks:tr.mute=True
    errors={}
    for (name,frame),points in expected.items():
        act=next(a for a in bpy.data.actions if a.name==name or a.name.startswith(name));imported.animation_data.action=act
        if act.slots:imported.animation_data.action_slot=act.slots[0]
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();coords=[]
        for obj in bpy.data.objects:
            if obj.type!='MESH':continue
            ev=obj.evaluated_get(dg);me=ev.to_mesh();coords.extend(ev.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
        tree=KDTree(len(coords))
        for i,c in enumerate(coords):tree.insert(c,i)
        tree.balance();error=max(tree.find(Vector(p))[2] for p in points);errors[name+'@'+str(frame)]=error
    worst=max(errors.values());report.update(clean_reimport=worst<1e-5,reimport_max_deviation_m=worst,reimport_pose_errors_m=errors,triangles=triangles,bytes=len(data),skin_meshes=len(doc['meshes']),animations=[a['name'] for a in doc['animations']],source_sha256=hashlib.sha256((directory/'instrument.blend').read_bytes()).hexdigest(),glb_sha256=hashlib.sha256(data).hexdigest())
    report['passed']=report['clean_reimport'];(directory/'qa_report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    assert report['passed'],('animated GLB drift',worst)
    print('CURVED_FINAL_QA_PASS',design,worst,flush=True)
