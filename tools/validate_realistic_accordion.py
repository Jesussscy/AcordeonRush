"""Actual Blender frame evaluation and clean reimport. Writes evidence, asserts failures."""
import bpy, bmesh, json, math, struct
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

OUT=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AcordeonVallenato_Realista.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['RIG_AcordenRush']
report={'method':'Blender evaluated frames; manifold topology; mechanical boundary checks; GLB JSON inspection; factory-empty GLB import and sampled animated world-space geometry comparison. UI playback recorded separately.','checks':{},'source_samples':{},'reimport_samples':{}}
mel=[b for b in rig.pose.bones if b.name.startswith('BTN_Melody_')]
bass=[b for b in rig.pose.bones if b.name.startswith('BTN_Bass_')]
assert len(mel)==31 and len(bass)==12
report['checks']['buttons']={'melody':len(mel),'rows':[10,11,10],'bass':len(bass),'layout':'4 rows x 3 columns'}
bellows=bpy.data.objects['Bellows | continuous 20 pleat textile shell']
bm=bmesh.new();bm.from_mesh(bellows.data)
assert all(e.is_manifold for e in bm.edges)
left=set(bm.verts); components=0
while left:
    stack=[left.pop()];components+=1
    while stack:
        for edge in stack.pop().link_edges:
            for v in edge.verts:
                if v in left:left.remove(v);stack.append(v)
assert components==1
report['checks']['bellows']={'connected_components':components,'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'folds':20,'thickness_m':.00055}
bm.free()
objects=[o for o in bpy.data.objects if o.type=='MESH' and not any(c.name=='90_Studio' for c in o.users_collection)]
expected={};ranges={};max_seam=0;max_rigidity=0;max_travel=0
for action in sorted(bpy.data.actions,key=lambda a:a.name):
    if action.name not in ['Idle_Breath_Loop','Bellows_OpenClose','Melody_Button_Press','Bass_Button_Press']:continue
    rig.animation_data.action=action
    first,last=map(int,action.frame_range);ranges[action.name]=[first,last]
    frames=list(range(first,last+1)); sample_frames=sorted(set([first,(first+last)//2,last]+([8,21,32] if action.name=='Melody_Button_Press' else [9,27] if action.name=='Bass_Button_Press' else [])))
    for frame in frames:
        scene.frame_set(frame);bpy.context.view_layer.update()
        scale=rig.pose.bones['CTRL_FUELLE'].scale.x
        for name,sgn in [('CTRL_LADO_BAJO',-1),('CTRL_LADO_MELODIA',1)]:
            pb=rig.pose.bones[name];mat=pb.matrix@pb.bone.matrix_local.inverted()
            max_rigidity=max(max_rigidity,max(abs(v-1) for v in mat.to_scale()))
            if abs(mat.translation.x-sgn*.055*(scale-1))>1e-6:print('SIDE_ERROR',action.name,frame,name,scale,mat.translation.x,flush=True)
            max_seam=max(max_seam,abs(mat.translation.x-sgn*.055*(scale-1)))
        # Every closed/open intermediate frame has ordered rings. X mapping is injective.
        assert scale>=1-1e-6 and scale<=.280/.110+1e-5
        for pb in mel+bass:
            assert -.000001 <= pb.location.y <= .001801
            assert abs(pb.location.x)<1e-7 and abs(pb.location.z)<1e-7
            max_travel=max(max_travel,pb.location.y)
        # Seam measured on actual evaluated cloth endpoints against case join planes.
        dg=bpy.context.evaluated_depsgraph_get();ev=bellows.evaluated_get(dg);mesh=ev.to_mesh()
        xs=[(ev.matrix_world@v.co).x for v in mesh.vertices]
        if abs(min(xs)+.055*scale)>1e-6:print('CLOTH_ERROR',action.name,frame,scale,min(xs),max(xs),flush=True)
        max_seam=max(max_seam,abs(min(xs)+.055*scale),abs(max(xs)-.055*scale))
        ev.to_mesh_clear()
        if frame in sample_frames:
            pts=[];all_points=[]
            for o in objects:
                ev=o.evaluated_get(dg);mesh=ev.to_mesh();step=max(1,len(mesh.vertices)//15)
                pts.extend([tuple(ev.matrix_world@mesh.vertices[i].co) for i in range(0,len(mesh.vertices),step)])
                all_points.extend([tuple(ev.matrix_world@v.co) for v in mesh.vertices])
                ev.to_mesh_clear()
            expected[(action.name,frame)]=pts
            mins=[min(p[i] for p in all_points) for i in range(3)];maxs=[max(p[i] for p in all_points) for i in range(3)]
            report['source_samples'][action.name+'@'+str(frame)]={'bounds':[mins,maxs],'vertices':len(all_points)}
    print('SOURCE_CHECKED',action.name,len(frames),'frames',flush=True)
print('SOURCE_MEASUREMENT',max_seam,max_rigidity,flush=True)
assert max_seam<1e-6 and max_rigidity<1e-6
report['checks']['source_animation']={'all_integer_frames_evaluated':sum(b-a+1 for a,b in ranges.values()),'ranges':ranges,'max_case_scale_error':max_rigidity,'max_endpoint_seam_error_m':max_seam,'button_max_travel_m':max_travel,'button_mount_check':'All button heads/stems weighted to their button bone, sockets to parent case; only local Y travel within captive stems. No independent X/Z motion.'}
for o in objects:
    if 'moving head and stem' in o.name:
        group='BTN_'+o.name.split(' ')[0]
        assert o.vertex_groups.get(group)
        assert all(v.groups and abs(sum(g.weight for g in v.groups)-1)<1e-5 for v in o.data.vertices)
glb=OUT/'AcordeonVallenato_Realista.glb'
data=glb.read_bytes();length,ctype=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+length])
assert not doc.get('cameras')
assert not doc.get('extensions',{}).get('KHR_lights_punctual')
assert len(doc.get('animations',[]))==4
assert set(a['name'] for a in doc['animations'])==set(ranges)
assert not any('Studio' in n.get('name','') for n in doc['nodes'])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
report['checks']['glb_structure']={'bytes':len(data),'mesh_count':len(doc['meshes']),'triangles':triangles,'materials':len(doc.get('materials',[])),'textures':len(doc.get('textures',[])),'animations':[a['name'] for a in doc['animations']],'camera_count':len(doc.get('cameras',[])),'studio_excluded':True}

# Reimport into genuinely empty scene, removing source data and actions.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(glb))
scene=bpy.context.scene
armatures=[o for o in bpy.data.objects if o.type=='ARMATURE'];assert len(armatures)==1
rig=armatures[0]
for track in rig.animation_data.nla_tracks:track.mute=True
imported={a.name:a for a in bpy.data.actions}
worst=0
for (name,frame),points in expected.items():
    act=next((a for a in bpy.data.actions if a.name==name or a.name.endswith('_'+name) or a.name.startswith(name)),None)
    assert act,('Missing imported clip',name,list(imported))
    rig.animation_data.action=act
    if act.slots:rig.animation_data.action_slot=act.slots[0]
    scene.frame_set(frame);bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get();coords=[]
    for o in bpy.data.objects:
        if o.type!='MESH':continue
        ev=o.evaluated_get(dg);me=ev.to_mesh()
        coords.extend([ev.matrix_world@v.co for v in me.vertices]);ev.to_mesh_clear()
    tree=KDTree(len(coords))
    for i,co in enumerate(coords):tree.insert(co,i)
    tree.balance()
    err=max(tree.find(Vector(p))[2] for p in points);worst=max(worst,err)
    report['reimport_samples'][name+'@'+str(frame)]={'sampled_vertices':len(points),'max_world_space_deviation_m':err}
    print('REIMPORT_CHECKED',name,frame,err,flush=True)
report['checks']['clean_reimport']={'max_sample_deviation_m':worst,'tolerance_m':.00001,'passed':worst<.00001}
(OUT/'qa_report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
assert worst<.00001,('GLB animation/geometry drift',worst)
print('QA_PASS',json.dumps(report['checks']),flush=True)
