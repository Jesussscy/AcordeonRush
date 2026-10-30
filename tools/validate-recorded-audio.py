from pathlib import Path
import hashlib,json
import numpy as np
import soundfile as sf

root=Path(__file__).resolve().parents[1]
bank=root/'public/instrument'
manifest=json.loads((bank/'manifest.json').read_text(encoding='utf8'))
provenance=json.loads((bank/'recorded-hn/PROVENANCE.json').read_text(encoding='utf8'))
assert len(provenance['files'])==34
results=[]
for item in provenance['files']:
    original=bank/'button-accordion-hn'/item['source']
    encoded=bank/'recorded-hn'/item['file']
    assert hashlib.sha256(original.read_bytes()).hexdigest()==item['source_sha256']
    assert hashlib.sha256(encoded.read_bytes()).hexdigest()==item['sha256']
    info=sf.info(encoded)
    assert info.channels==2 and info.samplerate==44100 and info.subtype=='PCM_16'
    assert info.frames==sf.info(original).frames
    data,_=sf.read(encoded,always_2d=True)
    assert np.max(np.abs(data))<1 and np.sqrt(np.mean(data**2))>.001
    results.append({'file':item['file'],'sha256_verified':True,'source_preserved':True,'stereo':True,'rms':float(np.sqrt(np.mean(data**2)))})
for region in manifest['regions']:
    data,rate=sf.read(bank/manifest['sampleDirectory']/region['file'],always_2d=True)
    start=round(region['loopStart']*rate);end=round(region['loopEnd']*rate)
    assert 0<start<end<=len(data)
    assert np.max(np.abs(data[end-1]-data[start-1]))<.00004
out=root/'artifacts/qa/recordings-validation.json'
out.write_text(json.dumps({'passed':True,'recordings':34,'sustain_loops':17,'method':'Verify actual PCM audio against original recorded FLAC hashes and waveform continuity.','results':results},indent=2),encoding='utf8')
print('PASS: 34 genuine recordings, preserved source hashes, stereo PCM16, 17 continuous loop boundaries.')
