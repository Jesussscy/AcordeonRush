"""Create browser-ready PCM from the attributed, real Hohner recordings.

No synthesized notes are introduced. Source FLAC files stay untouched.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1]
bank = root / 'public/instrument'
path = bank / 'manifest.json'
manifest = json.loads(path.read_text(encoding='utf8'))
out = bank / 'recorded-hn'
out.mkdir(exist_ok=True)
files = []
for region in manifest['regions']:
    for key in ('file', 'releaseFile'):
        # The original SFZ/FLAC bank is the provenance source, also on reruns.
        source_name = str(Path(region[key]).with_suffix('.flac')).replace('\\', '/')
        source = bank / 'button-accordion-hn' / source_name
        data, rate = sf.read(source, always_2d=True, dtype='float64')
        data -= data.mean(axis=0)
        if key == 'file':
            end = min(len(data), round(region['loopEnd'] * rate))
            start = round(region['loopStart'] * rate)
            width = min(round(.012 * rate), start, (end-start)//4)
            # Blend the last 12 ms into the samples immediately before loopStart.
            # The wrap then continues into loopStart without an amplitude step.
            blend = np.linspace(0, 1, width)[:, None]
            data[end-width:end] = data[end-width:end]*(1-blend)+data[start-width:start]*blend
        destination = out / Path(source_name).with_suffix('.wav')
        destination.parent.mkdir(exist_ok=True)
        sf.write(destination, np.clip(data, -.999, .999), rate, subtype='PCM_16')
        region[key] = destination.relative_to(out).as_posix()
        files.append({'file': region[key], 'source': source_name,
                      'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                      'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                      'sampleRate': rate, 'channels': data.shape[1],
                      'frames': len(data), 'peak': float(np.max(np.abs(data)))})
manifest['sampleDirectory'] = 'recorded-hn/'
manifest['audioRevision'] = 'hn-pcm-natural-2'
manifest['processing'] = 'Real Hohner FLAC recordings converted to stereo PCM16 WAV, DC removed, 12 ms sustain-loop blend. Natural registration has no added reed layers or directional lowpass.'
path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf8')
(out / 'PROVENANCE.json').write_text(json.dumps({'source': manifest['source'], 'license': manifest['license'], 'recordings': manifest['baseInstrument'], 'processing': manifest['processing'], 'files': files}, indent=2), encoding='utf8')
(out / 'LICENSE.txt').write_bytes((bank/'button-accordion-hn/LICENSE.txt').read_bytes())
print(f'Prepared {len(files)} genuine stereo Hohner recordings as browser-ready PCM WAV; original FLAC preserved.')
