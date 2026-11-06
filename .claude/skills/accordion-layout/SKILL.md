---
name: accordion-layout
description: How the diatonic bisonoric (push/pull) vallenato button accordion works in this project, the data/layouts/*.json format, button ids (A1, M5, D3), and how to resolve a pitch to button + bellows direction. Use when touching layouts, tunings, note resolution, fingering, keyboard mapping or the 3D button bones.
---

# Acordeón diatónico bisonoro (Vallenato Hero)

## Conceptos
- **Bisonoro**: cada botón suena una nota al **cerrar** el fuelle (`push`) y otra al **abrir** (`pull`). Solo hay UNA dirección de fuelle a la vez para todo el instrumento: dos notas simultáneas deben compartir dirección.
- Mano derecha: 3 hileras, 31 botones. Afinación base **G–C–F (Sol–Do–Fa)**:
  - **afuera** (G, 10 botones, id `A1…A10`, carril verde)
  - **medio** (C, 11 botones, id `M1…M11`, carril amarillo)
  - **adentro** (F, 10 botones, id `D1…D10`, carril rojo)
  - El botón 1 de cada hilera es el de alteraciones (C#/D#, F#/G#, D#/C#).
- Mano izquierda: 12 bajos (alternan bajo simple / acorde). En v1 son acompañamiento automático, no jugables.
- MIDI 60 = C4 = Do4. Afinación de concierto 440 Hz.

## Fuente de verdad
- `data/layouts/gcf.json`: mapa verificado contra la tabla Hohner GCF de 31 botones (URL en el propio JSON). **No inventes notas**: si cambias algo, cita la fuente.
- Otras afinaciones = otro JSON (`fbbeb.json`, `adg.json`…) o transposición declarada (`semitones`) en la sección `tunings`.
- `src/instrument/accordion-catalog.ts` lee el layout y expone `melodyButtons`, `bassButtons`, `allButtons`, `getTuning`, `soundingNotes`, `noteName`.

## Formato `data/layouts/*.json`
```json
{
  "id": "gcf",
  "system": "31/12 diatonic bisonoric, 10/11/10",
  "source": "<url de la tabla oficial>",
  "verify": "Verificar contra la tabla oficial del fabricante antes de cambiar notas",
  "rows": [
    { "name": "afuera", "prefix": "A", "buttons": [ { "id": "A1", "push": "C#4", "pull": "D#4" } ] },
    { "name": "medio",  "prefix": "M", "buttons": [ ... 11 ... ] },
    { "name": "adentro","prefix": "D", "buttons": [ ... 10 ... ] }
  ],
  "bass": [ { "id": "B1", "push": ["G2"], "pull": ["D2"], "chord": false } ],
  "tunings": [ { "id": "GCF", "label": "G/C/F", "semitones": 0, "flats": false } ]
}
```
Notas en notación científica (`C4`, `F#4`, `Bb3`). El parser las convierte a MIDI.

## Huesos del modelo 3D
`BTN_Melody_01…31` siguen el orden de `rows` concatenadas (afuera 1–10, medio 11–21, adentro 22–31). `BTN_Bass_01…12` siguen `bass`. Nunca cambies el orden del JSON sin revisar el rig.

## Resolver nota → botón + fuelle
Implementado en `src/gameplay/fingering.ts` (origen: `fingerChart`):
1. Si el chart trae `"button"` y/o `"bellows"`, se respetan (validar que el botón dé esa nota en esa dirección).
2. Candidatos = todos los (botón, dirección) cuya nota sonora (`push`/`pull` + `semitones` de la afinación) == pitch.
3. Rechaza la dirección si contradice una nota que todavía suena.
4. Costo: cambio de fuelle (+2), salto de posición (+0.1 × distancia), hilera ≠ medio (+0.5), hilera no permitida por dificultad (descartar).
5. Elige el menor costo; si no hay candidato, se reporta en `problems` (no se inventa nota).

## Teclado (por `KeyboardEvent.code`, independiente del idioma)
- afuera: `KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash`
- medio: `KeyA … KeyL Semicolon(Ñ) Quote`
- adentro: `KeyQ … KeyP`
- Fuelle: mantener `Space` = cerrar (push), soltar = abrir (pull). Configurable en el menú.
Las etiquetas visibles dependen del layout (`es`/`en`), nunca el mapeo.
