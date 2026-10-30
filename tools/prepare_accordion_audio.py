"""Package the licensed SFZ regions and a demonstrative bisonoric button map."""
from pathlib import Path
import re,json,hashlib
OUT=Path(__file__).resolve().parents[1]/'assets/blender/realistic'
bank=OUT/'audio/button-accordion-hn'
for file in bank.rglob('*#*.flac'):
    file.rename(file.with_name(file.name.replace('#','s')))
sfz_file=bank/'PRESET Button Accordion HN tuned.sfz'
sfz_file.write_text(sfz_file.read_text().replace('F#','Fs'),encoding='utf8')
sfz=(bank/'PRESET Button Accordion HN tuned.sfz').read_text()
regions=[]
for text in sfz.split('<region>')[1:]:
    if 'sample=rel/' in text:continue
    m=re.search(r'sample=(.*?) pitch_keycenter=(\d+) lokey=(\d+) hikey=(\d+) tune=(-?\d+)\s+loop_start=(\d+) loop_end=(\d+)',text)
    if not m:continue
    file,root,low,high,tune,start,end=m.groups()
    release=re.search(r'sample=rel/'+re.escape(file.replace('.flac','_rel.flac'))+r' pitch_keycenter=\d+ lokey=\d+ hikey=\d+ tune=(-?\d+)(?: offset=(\d+))?',sfz)
    data=(bank/file).read_bytes();stream=int.from_bytes(data[18:26],'big');rate=stream>>44
    regions.append(dict(file=file,root=int(root),low=int(low),high=int(high),tune=int(tune),loopStart=int(start)/rate,loopEnd=int(end)/rate,releaseFile='rel/'+file.replace('.flac','_rel.flac'),releaseOffset=int(release[2] or 0)/rate,releaseTune=int(release[1]),originalSampleRate=rate))
def midi(note):
    m=re.match(r'([A-G])([#b]?)(\d)',note);p={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m[1]]
    return (int(m[3])+1)*12+p+({'#':1,'b':-1}.get(m[2],0))
# Demonstration map only: ordered to fit the model's 10/11/10 grouping.
rows=[
 [('E4','F4'),('G4','A4'),('B4','C5'),('D5','E5'),('F5','G5'),('A5','B5'),('C6','D6'),('E6','F6'),('G6','A6'),('B6','C7')],
 [('B3','C4'),('D4','E4'),('F4','G4'),('A4','A4'),('C5','B4'),('E5','D5'),('G5','F5'),('B5','A5'),('D6','C6'),('F6','E6'),('A6','G6')],
 [('A3','B3'),('C4','D4'),('E4','F4'),('G4','A4'),('B4','C5'),('D5','E5'),('F5','G5'),('A5','B5'),('C6','D6'),('E6','F6')]
]
buttons={};num=0
for row,pairs in enumerate(rows):
    for push,pull in pairs:
        num+=1;buttons[f'BTN_Melody_{num:02d}']=dict(push=[midi(push)],pull=[midi(pull)],row=row+1)
bass=[('G2','G3'),('D3','D3'),('C3','C3'),('G3','E3'),('D3','B2'),('G2','G2'),('C3','C3'),('G3','E3'),('F2','F3'),('C3','C3'),('G2','G2'),('D3','D3')]
for i,(push,pull) in enumerate(bass):
    chord=i%2==1;intervals=[0,4,7] if chord else [0]
    buttons[f'BTN_Bass_{i+1:02d}']=dict(push=[midi(push)+n for n in intervals],pull=[midi(pull)+n for n in intervals],chord=chord)
profiles=[
 dict(id='natural',label='Natural · muestra original',ranks=[dict(semitones=0,cents=0,gain=1)],cutoff=6100),
 dict(id='double',label='Doble · registro virtual',ranks=[dict(semitones=0,cents=-4,gain=.52),dict(semitones=0,cents=4,gain=.48)],cutoff=5900),
 dict(id='musette',label='Musette · registro virtual',ranks=[dict(semitones=0,cents=-11,gain=.30),dict(semitones=0,cents=0,gain=.40),dict(semitones=0,cents=11,gain=.30)],cutoff=6600),
 dict(id='octave',label='Octava · registro virtual',ranks=[dict(semitones=-12,cents=0,gain=.40),dict(semitones=0,cents=0,gain=.60)],cutoff=5200)
]
manifest=dict(source='https://github.com/freepats/button-accordion-HN',license='CC0-1.0',baseInstrument='Button Accordion HN, recorded by Jeff Stauffer; bank processed by michael02022.',limitations='One recorded instrument. The other profiles layer and process this same bank; they are not recordings of distinct accordion models. Demonstration note map, not a verified manufacturer GCF fingering chart. Extreme low/high pitches are transposed.',regions=regions,buttons=buttons,profiles=profiles,tunings=[dict(id='GCF',label='GCF · base de demostración',semitones=0),dict(id='ADG',label='ADG · transposición virtual',semitones=2),dict(id='FBbEb',label='F/B♭/E♭ · transposición virtual',semitones=-2),dict(id='EAD',label='EAD · transposición virtual',semitones=-3)])
(OUT/'audio/manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
checks=[]
for p in sorted(bank.rglob('*.flac')):
    data=p.read_bytes();n=int.from_bytes(data[18:26],'big')
    checks.append(dict(file=p.relative_to(bank).as_posix(),bytes=len(data),sampleRate=n>>44,channels=((n>>41)&7)+1,samples=n&((1<<36)-1),sha256=hashlib.sha256(data).hexdigest()))
assert len(regions)==17 and len(checks)==34 and len(buttons)==43
(OUT/'audio/file_manifest.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
print('Packaged 17 sustain / 17 release recordings; 43 mapped buttons; 4 virtual registrations.')
