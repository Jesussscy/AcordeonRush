---
name: chart-authoring
description: How to create, import and validate Vallenato Hero song charts (songs/<slug>/chart.json, .mid import, audio.mp3, cover). Use when adding a song, editing a chart, writing the MIDI importer, or debugging why a song does not appear or is unplayable.
---

# Charts de canciones

## Agregar una canción (sin tocar código)
```
songs/<slug-kebab-case>/
├── chart.json      # obligatorio (o song.mid + meta.json)
├── audio.mp3       # opcional: pista real; es lo que se desafina al fallar
└── cover.jpg       # opcional, 512×512, < 150 KB
```
El menú descubre las carpetas con `import.meta.glob('/songs/*/chart.json')` (y `*.mid`). En `npm run dev` aparece al instante; en producción basta `npm run build`.

## Formato `chart.json` (`t` y `dur` en BEATS)
```json
{
  "title": "Paseo de Prueba",
  "artist": "Vallenato Hero (original)",
  "bpm": 96,
  "timeSignature": [4, 4],
  "offsetMs": 0,
  "layout": "gcf",
  "tuning": "GCF",
  "license": "original / CC0 / con permiso de …",
  "parrandaPhrases": [[16, 32]],
  "notes": [
    { "t": 0.0, "pitch": "E4", "dur": 1 },
    { "t": 1.0, "pitch": "G4", "dur": 0.5, "button": "M4", "bellows": "push" }
  ]
}
```
- `pitch` en notación científica. `button` (`A1…A10`, `M1…M11`, `D1…D10`) y `bellows` (`push`=cerrar, `pull`=abrir) son opcionales: si faltan, se resuelven con el algoritmo de la skill `accordion-layout`.
- `parrandaPhrases`: rangos `[inicio, fin)` en beats; sus notas son gemas doradas.
- `offsetMs`: desplazamiento del audio respecto al beat 0.
- Notas con `dur >= 1` beat se tratan como sostenidas (cola), 25 pts por beat.
- Silencios: simplemente no hay nota (en la notación de texto, `R`).

## Notación rápida `pitch:beats`
`E4:1 G4:0.5 G4:0.5 A4:1 R:1` → `tools/text-to-chart.mjs` la convierte (acumula `t`).

## Importar MIDI
`node tools/midi-to-chart.mjs song.mid --channel 1 --title "..." --out songs/<slug>/chart.json`
- Toma el canal/pista de melodía (o la más aguda si no se indica), cuantiza a 1/16, convierte ticks → beats con el PPQ y el primer tempo, une notas solapadas (monofónico).
- Un `song.mid` suelto en la carpeta también se importa en tiempo de ejecución con los mismos defaults.

## Dificultades
Se generan desde Experto (`src/gameplay/difficulty.ts`): Fácil = solo hilera medio y pocos cambios de fuelle; Medio = medio + afuera; Difícil = 3 hileras con densidad reducida; Experto = chart completo. No escribas charts por dificultad salvo que quieras forzarlo (`"difficulties": {"easy": {...}}`).

## Validación
`npm test` corre `tests/charts.test.ts`: cada chart debe parsear, cada nota debe ser tocable en el layout/afinación (o tener override válido), sin solapes con fuelles opuestos, y `parrandaPhrases` dentro de la duración.

## Derechos
Solo material original, CC0 o con permiso explícito. No subir audio comercial.
