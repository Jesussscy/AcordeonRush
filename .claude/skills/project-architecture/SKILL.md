---
name: project-architecture
description: Folder structure, module boundaries and naming conventions of the Vallenato Hero repo (Vite + React + TypeScript + Three.js + Web Audio). Use before creating, moving or renaming any file so it lands in the right folder, and when deciding where code belongs.
---

# Arquitectura de Vallenato Hero

> Estado: estructura VIGENTE desde el H0 (2026-11-05). Las carpetas `render/`, `hud/`, `stage/` y `highway/` se crean en los hitos H1–H4.
>
> Excepciones aprobadas:
> - `art/blender/` conserva la estructura interna original (`realistic/`, `curved_v2/<id>/instrument.blend`…), porque los scripts de `tools/blender/` dependen de ella.
> - El banco de samples Hohner conserva sus nombres originales con espacios, por trazabilidad con el SFZ y `PROVENANCE.json`.

## Stack
Vite 6 + React 18 + TypeScript (strict) + Three.js 0.172 + Web Audio API propia (sin Tone.js). Tests: Vitest (lógica) + Playwright (E2E y capturas).

## Árbol
```
src/
  main.tsx            entrada (monta <App/>)
  core/               bucle del juego, máquina de estados (menu→loading→playing→paused→results), reloj musical, config, store
  render/             renderer, escena, cámara, luces, postprocesado (bloom), shaders (*.glsl importados con ?raw)
  instrument/         acordeón 3D: AccordionScene, rig de botones, fuelle, catálogo y layouts
  gameplay/           chart, fingering (nota→botón+fuelle), dificultad, juicio de timing, puntaje, racha, Parranda
  highway/            autopista 3D: carriles, gemas, colas, trastes, franja de fuelle (si crece, si no va en gameplay/)
  stage/              escenario y personajes procedurales, público
  hud/                componentes HUD (LED, multiplicador, odómetro, Ambientómetro, sombreros, textos de timing)
  audio/              sampler del acordeón, acompañamiento (caja/guacharaca/bajos), desafine, sfx, pista mp3
  input/              teclado (KeyboardEvent.code), remapeo, MIDI (Web MIDI), fuelle
  ui/                 menús, selección de canción, pausa, resultados, calibración, ajustes; ui/studio/ = estudio libre
  utils/
assets/               = publicDir de Vite (servido tal cual en /)
  models/accordion/   <diseño>.glb + <diseño>.webp
  audio/samples/hohner-hn/   WAV de runtime + manifest.json + LICENSE (CC0)
  audio/sfx/
  fonts/  textures/
data/layouts/         gcf.json y otras afinaciones (importado en build)
songs/<slug>/         chart.json | song.mid, audio.mp3?, cover.jpg?  (descubierto con import.meta.glob)
art/                  fuentes NO runtime: blender/ (antiguo assets/blender), audio-source/ (FLAC + SFZ originales)
tools/                scripts: blender/, audio/, midi-to-chart.mjs, text-to-chart.mjs
tests/                unit/ (Vitest), e2e/ (Playwright), fixtures/
docs/                 ANALISIS.md, PLAN.md, guías, images/ (capturas README)
.claude/skills/
```

## Reglas
1. **Nombres:** carpetas y módulos no-componente en **kebab-case** inglés (`musical-transport.ts`); componentes React en **PascalCase** (`ScoreDisplay.tsx`, que es la convención estándar de React). Sin espacios, tildes ni `ñ` en rutas. El contenido visible va en español.
2. Un módulo por archivo; si un componente pasa de unas 250 líneas, se divide. Código legible: nada de líneas de más de 140 columnas ni CSS minificado a mano.
3. **El bucle del juego no vive en React.** `core/` maneja un rAF propio. React solo monta menús y HUD; el HUD se actualiza con refs o una suscripción con throttle, nunca con `setState` por frame.
4. **Tiempo único:** todo juicio y programación usa el reloj de `core/musical-transport` (AudioContext). `performance.now()` solo para animaciones visuales.
5. Los datos (layouts, charts) son JSON validados al cargar; nunca hardcodear notas en código.
6. Assets de runtime solo en `assets/`; fuentes pesadas en `art/` (LFS). No duplicar binarios entre ambos.
7. Ningún código de `src/` importa de `art/` ni de `tools/`.
8. CSS: un archivo por componente/área (`*.css` junto al componente o CSS modules), con variables en `src/ui/theme.css`. Evitar `!important`.
9. Cada hito termina con `npm run typecheck && npm test && npm run build` en verde y un commit convencional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
