"""Create browser-ready PCM from the attributed, real Hohner recordings.

No synthesized notes are introduced. Source FLAC files stay untouched.
"""
from pathlib import Path
import hashlib
import json
import re
import time
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1]
bank = root / 'public/instrument'
path = bank / 'manifest.json'
manifest = json.loads(path.read_text(encoding='utf8'))
out = bank / 'recorded-hn'
out.mkdir(exist_ok=True)
files = []
loop_quality = []
sfz = (bank/'button-accordion-hn/PRESET Button Accordion HN tuned.sfz').read_text(encoding='utf8')
for region in manifest['regions']:
    for key in ('file', 'releaseFile'):
        # The original SFZ/FLAC bank is the provenance source, also on reruns.
        source_name = str(Path(region[key]).with_suffix('.flac')).replace('\\', '/')
        source = bank / 'button-accordion-hn' / source_name
        data, rate = sf.read(source, always_2d=True, dtype='float64')
        data -= data.mean(axis=0)
        if key == 'file':
            original_loop = re.search(r'pitch_keycenter='+str(region['root'])+r'\b.*?loop_start=(\d+)\s+loop_end=(\d+)',sfz,re.S)
            if not original_loop:
                raise ValueError(f"Missing original SFZ loop for {region['root']}")
            start = int(original_loop[1])
            legacy_end = min(len(data),int(original_loop[2]))
            # SFZ loop_end includes its final frame; Web Audio loopEnd is exclusive.
            end = min(len(data),int(original_loop[2])+1)
            region['loopEnd'] = end/rate
            width = min(round(.018 * rate), start, (end-start)//4)
            # Match both recorded channels around the wrap before blending. A step-free
            # boundary alone can still hide destructive interference in the crossfade.
            tail = data[end-width:end]
            def correlation(candidate, reference=tail):
                window = data[candidate-width:candidate]
                return float(np.sum(reference*window)/(np.sqrt(np.sum(reference**2)*np.sum(window**2))+1e-12))
            before = correlation(start,data[legacy_end-width:legacy_end])
            radius = min(round(rate/(440*2**((region['root']-69)/12))*2), round(.025*rate))
            candidates = range(max(width,start-radius), min(end-width,start+radius)+1)
            chosen = max(candidates, key=correlation)
            after = correlation(chosen)
            loop_quality.append({'root':region['root'],'before':before,'after':after,'shiftFrames':chosen-start,'inclusiveEndCorrected':True})
            start = chosen
            region['loopStart'] = start/rate
            sustain_rms = float(np.sqrt(np.mean(data[start:end]**2)))
            region['performanceGain'] = float(np.clip(.23/max(.001,sustain_rms),.65,1.35))
            loop_quality[-1].update({'sustainRms':sustain_rms,'performanceGain':region['performanceGain']})
            # Blend the last 12 ms into the samples immediately before loopStart.
            # The wrap then continues into loopStart without an amplitude step.
            blend = np.linspace(0, 1, width)[:, None]
            data[end-width:end] = data[end-width:end]*(1-blend)+data[start-width:start]*blend
        destination = out / Path(source_name).with_suffix('.wav')
        destination.parent.mkdir(exist_ok=True)
        temporary = destination.with_suffix('.building.wav')
        sf.write(temporary, np.clip(data, -.999, .999), rate, subtype='PCM_16')
        for attempt in range(10):
            try:
                temporary.replace(destination)
                break
            except PermissionError:
                if attempt == 9:
                    raise
                time.sleep(.1)
        region[key] = destination.relative_to(out).as_posix()
        files.append({'file': region[key], 'source': source_name,
                      'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                      'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                      'sampleRate': rate, 'channels': data.shape[1],
                      'frames': len(data), 'peak': float(np.max(np.abs(data)))})
manifest['sampleDirectory'] = 'recorded-hn/'
manifest['audioRevision'] = 'hn-phase-matched-3'
manifest['processing'] = 'Original Hohner FLAC preserved; stereo PCM16 with DC removal and 18 ms phase-matched loop blend. Measured sustain gain compensation applies only to the virtual Vallenato profile. Natural has no added reed layers.'
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf8')
(out / 'PROVENANCE.json').write_text(json.dumps({'source': manifest['source'], 'license': manifest['license'], 'recordings': manifest['baseInstrument'], 'processing': manifest['processing'], 'files': files}, indent=2), encoding='utf8')
(out / 'LICENSE.txt').write_bytes((bank/'button-accordion-hn/LICENSE.txt').read_bytes())
print(f'Prepared {len(files)} genuine stereo Hohner recordings as browser-ready PCM WAV; original FLAC preserved.')
(root/'artifacts/qa/loop-quality.json').write_text(json.dumps({'passed':all(q['after']>=q['before']-1e-8 for q in loop_quality),'method':'Stereo waveform correlation before loop crossfade; unchanged pitches and source hashes. Not a subjective listening test.','loops':loop_quality},indent=2),encoding='utf8')
