#!/usr/bin/env node
// Convert a Standard MIDI File melody into songs/<slug>/chart.json.
//
// Usage:
//   node tools/midi-to-chart.mjs song.mid --title "Título" [--artist "…"] [--track N] [--channel 1-16]
//        [--grid 0.25] [--out songs/<slug>/chart.json]
//
// Uses the same converter as the game (src/gameplay/midi-import.ts), loaded with Node's TypeScript
// type stripping (Node 22.18+ / 23.6+).
import fs from 'node:fs';
import path from 'node:path';
import { chartFromMidi } from '../src/gameplay/midi-import.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file) {
  console.error('Uso: node tools/midi-to-chart.mjs song.mid --title "Título" [--out songs/<slug>/chart.json]');
  process.exit(1);
}
const chart = chartFromMidi(new Uint8Array(fs.readFileSync(file)), {
  title: option('title') ?? path.basename(file, path.extname(file)),
  artist: option('artist'),
  track: option('track') !== undefined ? Number(option('track')) : undefined,
  channel: option('channel') !== undefined ? Number(option('channel')) : undefined,
  grid: option('grid') !== undefined ? Number(option('grid')) : undefined,
});
const json = JSON.stringify(chart, null, 2) + '\n';
const out = option('out');
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);
  console.log(`Chart escrito: ${out} (${chart.notes.length} notas, ${chart.bpm} BPM)`);
} else process.stdout.write(json);
