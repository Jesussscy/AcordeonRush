# AcordenRush

**Toca el fuelle, domina el ritmo.** A Spanish-first React/TypeScript accordion studio with recorded Hohner audio, playable 3D instruments and timed teaching arrangements.

## Run

Node.js 20+, npm and Git LFS are required for a complete checkout.

```bash
git lfs install
git clone https://github.com/Jesussscy/AcordeonRush.git
cd AcordeonRush
git lfs pull
npm ci
npm run dev -- --host 127.0.0.1 --port 5186
```

Open http://127.0.0.1:5186/#practice. `npm run build` creates the production output; `npm run preview` serves it.

## Play and learn

- **Practicar:** choose closed or open notes and press the computer keys, screen pads or 3D buttons. Both directions sound directly without holding Space. Space temporarily selects opening; release restores the selected direction. Manual pressure is optional under the advanced control.
- **Canciones:** opens the original reference first, with supported playback speeds and user-marked A–B listening loops. The separate teaching exercise offers notes with octaves, fingering, durations, repeatable two-bar phrases, sections and practice feedback.
- **Ver tocar:** the local arrangement plays the accordion automatically with the same clock driving notes, depressed buttons and bellows.
- **Pantalla grande:** model above the keyboard, direction and transport controls, accessible exit. Native fullscreen has a full-page fallback.
- Eight designs include four updated Curva models with nine clips each. All 31 melody buttons and 12 bass/chord buttons are represented; the left-hand grid follows the selected model.

The initial workspace is `src/Workspace.tsx`; the previous studio remains separately accessible. Settings and imported musical files stay local to the browser. The official YouTube reference uses an external player.

## Musical content and sources

The five named entries are **generated teaching arrangements**, not verified transcriptions of their commercial recordings: Las locuras mías, Mis cinco sentidos, Amarte más no pude, El confite and Culpa de los dos. Official references are separate from generated note timelines. [Las locuras mías status](docs/las-locuras-mias-status.md) describes the remaining transcription work.

Import your own timed JSON and optional authorized local audio through the material editor. The importer checks declared filename/hash, pitches, timing and common bellows direction. Imported material is labeled user-supplied, never automatically certified. An original C–D–E template is in `public/charts/chart-template.json`.

Audio uses real FreePats Hohner recordings; Natural retains the recorded voice and other registrations use virtual layering. There are **24 tuning/register options derived from a G/C/F base**, with declared transpositions and sample coverage, rather than 24 independent sampled instruments. See `public/instruments/tuning-audit.json`, `public/instrument/recorded-hn/PROVENANCE.json` and [implementation evidence](docs/implementation-verification.md). No commercial master recording is bundled.

Under **Sonido · timbre y balance**, choose close, dry or warm articulation/EQ, adjust melody/bass/chord levels, or isolate the melody. These controls process the same attributed samples; they do not claim a new sampled instrument or make a generated melody match the original recording. The close preset preserves the sample attack with a shorter valve release, and the source's sustained dynamics replace the earlier artificial decay.

The initial **Vallenato** registration adds a virtual reed ensemble with pitch-dependent beating, adjustable voice spread, pressure-sensitive brightness and distinct bass/chord treatment. **Natural** keeps the single-bank reference. Use **Probar Natural / Probar Vallenato** to compare the same short phrase with animated buttons; physical input cancels the preview. The sample build now converts inclusive SFZ loop endpoints correctly, aligns stereo loop phases and measures per-sample sustain levels. The Vallenato registration uses those measurements to reduce uneven note volumes. It is a virtual arrangement of the same Hohner recordings, not a separately sampled Corona III.

## Validation

```bash
npm run typecheck
npm run build
node tools/validate-practice.mjs
node tools/validate-musical-transport.mjs
node tools/build-music-audit.mjs
```

`python tools/validate-recorded-audio.py` additionally checks sample data (NumPy and SoundFile required). Development browser fixtures and their JSON results are under `artifacts/qa/`; they are not production pages. Current evidence covers 2,064 signal cases, the real closed/open UI path, 94 integrated workflow checks and the portrait CSS viewport. Subjective listening and physical-device latency are not certified.

## Files

| Directory | Purpose |
| --- | --- |
| `src/` | Interface, audio engine, transport and 3D scene |
| `public/` | Runtime models, samples, charts and musical audit |
| `assets/blender/` | Editable models, exports, source recordings and asset packages |
| `tools/` | Asset production, synchronization and validation |
| `artifacts/qa/` | Browser fixtures and evidence, including historical checks |
| `docs/` | Source boundaries and implementation report |

Large GLB, Blend, ZIP and GIF assets use Git LFS. Dependencies, build output, automatic Blender backup files and local replacement-model backups are ignored. Asset licenses/provenance are preserved with their corresponding files; no blanket license is asserted over unrelated source material.
