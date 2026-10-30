# Implementation and evidence

## Active application

`src/main.tsx` opens `Workspace.tsx`. `useInstrument.ts` owns input and audio; `AccordionScene.tsx` renders the selected rig. `SongWorkspace.tsx`, `song-library.ts` and `musical-transport.ts` implement timed musical content. The previous studio remains accessible separately.

Direct playing separates musical push/pull direction, visual opening and expression. Closed notes sound without Space or simulated manual pressure. The optional manual bellows exercise is a separate control mode. Physical keyboard, pads and model buttons share input ownership; releasing one source does not release another source's held note.

The instrument uses attributed Hohner recordings from [FreePats](https://freepats.zenvoid.org/Organ/accordion.html), with WAV derivation recorded in `public/instrument/recorded-hn/PROVENANCE.json`. Natural uses the recorded voice; other registrations are virtual layers. Low/high notes outside the sample roots use pitch transposition. There are 24 virtual tuning/register options, not 24 separately recorded accordions. The G/C/F base mapping references the [Hohner 31-button chart](https://hohner.de/fileadmin/documents/instruments/accordions/diatonic/HOHNER-fingeringcharts_diatonic-keyboard-GCF-31-buttons.pdf); other systems derive from that base. Bass chord voicings and coverage are declared in the audit rather than claimed as independent manufacturer verification.

Four updated Curva rigs are copied from the Blender source assets into the web catalog with content hashes. Existing designs remain available: eight models total. All 31 melody and 12 left-hand buttons have real rig travel. Curva assets contain nine animation clips. Bellows sampling is calibrated by measured case separation; button displacement is applied after the animation mixer.

## Reproducible checks

- `npm run build`: TypeScript and production bundle. Vite reports the large Three.js bundle as a size warning.
- `node tools/validate-practice.mjs`: 43 bindings, Spanish/English labels, lesson configurations and actual press/release displacement across eight rigs.
- `node tools/build-music-audit.mjs`: regenerates the published 24-option, 2,064 button/direction musical audit.
- `node tools/validate-musical-transport.mjs`: deterministic production scheduler checks, full local arrangements, imports, direction conflicts, pause, seek, count-in, tempo and loops. A simulated clock is not a hardware latency measurement.
- `python tools/validate-recorded-audio.py`: original/derived sample provenance and audio-data checks.

Browser fixtures are served by the development server under `/artifacts/qa/`. They are excluded from the production output. Evidence files distinguish rendered signal from listening:

- `live-ui-audio-result.json`: actual interface key W produced nonzero post-limiter signal when closed (MIDI 55) and open (MIDI 57), without Space; release and direction-switch checks.
- `tuning-matrix-result.json`: all 2,064 production sampler renders produced signal. Period correlation estimated 79 isolated pitches within the declared tolerance; this is automated acoustic measurement, not a listening panel.
- `workspace-flow-result.json`: 94 integrated checks covering UI tuning selection, input ownership, current model hashes/clips, song setup, automatic notes/3D, fullscreen transport, imports, sustained-note seeking and loops.
- `responsive-workspace-result.json`: actual app in a 390×844 iframe, with native fullscreen explicitly rejected by the fixture to preserve portrait dimensions; checks preview tracking and model/keyboard bounds. This is a CSS viewport check, not a physical phone test.
- `local-media-clock-result.json`: original C–D–E sampler fixture imported with its matching WAV and SHA-256. Local media and displayed chart differed by 10.1 ms at the sampled instant; pause, seek, half-speed with preserved pitch, sustained-note reconstruction and wrong-hash rejection passed. Run this fixture alone: moving focus to another test intentionally pauses the app. The sampled DOM difference does not measure acoustic speaker latency.

Older QA files are retained as historical evidence and may target the former studio. Use the named active-workspace fixtures for the new entry point.

## Limits

Commercial song charts remain generated teaching material unless explicitly imported; see `las-locuras-mias-status.md`. No original recording's exact transcription or tuning is certified. Speaker/headphone latency, device-specific touch behavior and subjective timbre authenticity require listening and physical-device review. The application exposes latency compensation and actual output metering without claiming those reviews happened.
