#!/usr/bin/env node
// Convert "pitch:beats" text notation into songs/<slug>/chart.json.
//
// Usage:
//   node tools/text-to-chart.mjs <spec.json> [--out songs/<slug>/chart.json]
//
// spec.json:
//   { "title", "artist", "bpm", "layout"?, "tuning"?, "license"?,
//     "phrases": { "A": "E4:1 G4:0.5 …", "B": "…" },
//     "structure": ["A", "A", "B"],
//     "parranda": ["B"] }            // phrase names whose occurrences are Parranda phrases
// R = rest; "|" bar lines are ignored.
import fs from 'node:fs';
import path from 'node:path';

function parsePhrase(text) {
  const notes = [];
  let t = 0;
  for (const token of text.split(/[\s|]+/).filter(Boolean)) {
    const [pitch, beats] = token.split(':');
    const dur = Number(beats);
    if (!pitch || !Number.isFinite(dur) || dur <= 0) throw new Error(`Token inválido: "${token}"`);
    if (pitch.toUpperCase() !== 'R') notes.push({ t, pitch, dur });
    t += dur;
  }
  return { notes, length: t };
}

export function buildChart(spec) {
  const phrases = Object.fromEntries(Object.entries(spec.phrases).map(([name, text]) => [name, parsePhrase(text)]));
  const notes = [];
  const parrandaPhrases = [];
  let cursor = 0;
  for (const name of spec.structure) {
    const phrase = phrases[name];
    if (!phrase) throw new Error(`Frase desconocida en "structure": ${name}`);
    for (const n of phrase.notes) notes.push({ ...n, t: cursor + n.t });
    if ((spec.parranda ?? []).includes(name)) parrandaPhrases.push([cursor, cursor + phrase.length]);
    cursor += phrase.length;
  }
  return {
    title: spec.title,
    artist: spec.artist,
    bpm: spec.bpm,
    timeSignature: spec.timeSignature ?? [4, 4],
    offsetMs: spec.offsetMs ?? 0,
    layout: spec.layout ?? 'gcf',
    tuning: spec.tuning ?? 'GCF',
    ...(spec.license ? { license: spec.license } : {}),
    parrandaPhrases,
    notes,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
) {
  const [specPath, ...rest] = process.argv.slice(2);
  if (!specPath) {
    console.error('Uso: node tools/text-to-chart.mjs <spec.json> [--out songs/<slug>/chart.json]');
    process.exit(1);
  }
  const outIndex = rest.indexOf('--out');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const chart = buildChart(spec);
  const json = JSON.stringify(chart, null, 2) + '\n';
  if (outIndex >= 0) {
    fs.mkdirSync(path.dirname(rest[outIndex + 1]), { recursive: true });
    fs.writeFileSync(rest[outIndex + 1], json);
    console.log(`Chart escrito: ${rest[outIndex + 1]} (${chart.notes.length} notas)`);
  } else process.stdout.write(json);
}
