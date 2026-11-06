# Practice and recorded-audio verification

Date: 2026-10-29 (America/Bogota).

## Current results

- `npm run build` passed, including strict TypeScript checks.
- `practice-browser-result.json`: **70 browser interaction checks passed** against the actual application. They cover all 43 physical key positions with Shift, direct closed/open notes without holding Space, key release, manual bellows, ES/EN labels, six basses, six chords, tuning/registration updates, two textured designs, synchronized local demo, pause/resume/restart, early sustain release and completed sustains.
- `recorded-audio-result.json`: **nine real Web Audio rendering cases passed**. Every case decoded all 34 PCM recordings. Four registrations × two directions produced measurable audio and returned to zero measured tail RMS after note-off. A ninth case changed direction while holding a note and then verified all-notes-off silence. Natural closed RMS was 0.13872; Natural open RMS was 0.09272 for the test melody plus bass chord. All measured peaks stayed below clipping.
- `recordings-validation.json`: **34 derived recordings validated** against the unchanged original FLAC hashes; stereo PCM16 at 44.1 kHz, matching frame counts, audible waveform energy and 17 continuous sustain-loop joins.
- `practice-mobile-result.json`: **390 × 844 layout passed** using the real application in an iframe. The accordion stage ends at y=471.60; the keyboard starts at y=479.40 and ends at y=837, within the 844px viewport. All 31 melody pads remain in three scrollable rows.
- Large-view controls were checked manually through the browser automation API: entering the view shows the accordion above the keyboard; Escape returns to practice; the view can then be reopened. Native fullscreen is requested when available; the page-filling fallback works without it.
- The design selector was checked after adding a persistent control outside the compact floating preview. The original Curva Granate selection was restored after testing.
- Shared musical validator passed: 43 mappings, 26 tunings, 271,986 generated chart-note mappings.
- The unchanged model rigs retain the earlier `practice-unit.json` results: 43 physical bindings, 780 lesson configurations and 344 button-bone press/release checks across eight GLBs. Each button travels 1.8 mm and returns to rest.

## Evidence

- `practice-large.jpg`: actual browser capture of the dedicated accordion + keyboard view.
- `practice-mobile.jpg`: actual capture of the 390 × 844 iframe test and its report.
- `practice-browser-result.json`, `recorded-audio-result.json`, `recordings-validation.json`, `practice-mobile-result.json`.
- Browser test sources: `practice-runner.html`, `recorded-audio.html`, `mobile-practice.html` (served only by the development server, outside production output).

## Limits

These checks establish interaction behavior, decoded-audio signal and responsive browser layout. No physical phone, external accordion controller, MIDI device or physical speaker recording was tested. Signal checks do not certify subjective timbral likeness to a particular vallenato accordion.

The 34 files are derived from the same attributed, genuine FreePats Hohner recording bank; they are not a newly recorded instrument. Natural uses the recorded stereo reeds without directional filtering. Other registrations are virtual layers; notes outside the recorded range are transposed. The original FLAC bank remains unchanged, and `public/instrument/recorded-hn/PROVENANCE.json` records source/license and both original and derived file hashes.
