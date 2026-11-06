import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { notesFromText, parseSongChart } from '../../src/gameplay/chart';
import { chartForDifficulty } from '../../src/gameplay/difficulty';
import { bellowsChanges, resolveChart } from '../../src/gameplay/fingering';
import { estimateKey, harmonize } from '../../src/gameplay/harmony';
import { Judge, WINDOWS, type GameNote } from '../../src/gameplay/judge';
import { chartFromMidi } from '../../src/gameplay/midi-import';
import { ScoreKeeper } from '../../src/gameplay/scoring';
import { songCatalog } from '../../src/gameplay/song-catalog';

const demo = parseSongChart(JSON.parse(fs.readFileSync('songs/paseo-de-prueba/chart.json', 'utf8')));

describe('chart format', () => {
  it('parses the demo: 96 BPM, 80 beats, 2 Parranda phrases', () => {
    expect(demo.bpm).toBe(96);
    expect(demo.lengthBeats).toBe(80);
    expect(demo.parrandaPhrases).toEqual([
      [32, 48],
      [64, 80],
    ]);
    expect(demo.notes[0]).toMatchObject({ t: 0, pitch: 'E4', midi: 64, dur: 1 });
  });

  it('rejects invalid charts with Spanish messages', () => {
    expect(() => parseSongChart({ title: 'x', bpm: 10, notes: [] })).toThrow(/bpm/);
    expect(() => parseSongChart({ title: 'x', bpm: 90, notes: [{ t: 0, pitch: 'H4', dur: 1 }] })).toThrow(
      /Nota inválida/,
    );
    expect(() =>
      parseSongChart({ title: 'x', bpm: 90, notes: [{ t: 0, pitch: 'C4', dur: 1, bellows: 'up' }] }),
    ).toThrow(/bellows/);
  });

  it('converts pitch:beats text with rests', () => {
    expect(notesFromText('E4:1 R:1 | G4:0.5')).toEqual([
      { t: 0, pitch: 'E4', dur: 1 },
      { t: 2, pitch: 'G4', dur: 0.5 },
    ]);
  });

  it('discovers songs/ folders automatically', () => {
    const entry = songCatalog.find((s) => s.id === 'paseo-de-prueba');
    expect(entry?.chart?.title).toBe('Paseo de Prueba');
    expect(songCatalog.every((s) => !s.error)).toBe(true);
  });
});

describe('fingering', () => {
  it('resolves every demo note, mostly on the middle row, with real bellows work', () => {
    const { notes, dropped } = resolveChart(demo);
    expect(dropped).toHaveLength(0);
    expect(notes).toHaveLength(demo.notes.length);
    expect(notes.filter((n) => n.row === 1).length / notes.length).toBeGreaterThan(0.75);
    const changes = bellowsChanges(notes).length;
    expect(changes).toBeGreaterThan(15);
    expect(changes).toBeLessThan(50);
    for (const n of notes) expect(n.button[n.direction][0]).toBe(n.midi);
  });

  it('honours forced button and bellows', () => {
    const chart = parseSongChart({
      title: 't',
      bpm: 100,
      notes: [{ t: 0, pitch: 'G4', dur: 1, button: 'A5', bellows: 'push' }],
    });
    const [note] = resolveChart(chart).notes;
    expect(note.button.code).toBe('A5');
    expect(note.direction).toBe('push');
    expect(note.forced).toBe(true);
  });

  it('reports notes outside the instrument instead of inventing them', () => {
    const chart = parseSongChart({ title: 't', bpm: 100, notes: [{ t: 0, pitch: 'C2', dur: 1 }] });
    expect(resolveChart(chart).dropped).toHaveLength(1);
  });

  it('lists bellows changes from the resting "pull" state', () => {
    const { notes } = resolveChart(demo);
    const changes = bellowsChanges(notes);
    expect(notes[0].direction).toBe('push'); // E4 closes on M4
    expect(changes[0]).toMatchObject({ t: 0, direction: 'push' });
  });
});

describe('difficulties', () => {
  it('derives 4 levels from the Expert chart', () => {
    const counts = (['easy', 'medium', 'hard', 'expert'] as const).map((d) => chartForDifficulty(demo, d).notes.length);
    expect(counts[3]).toBe(75);
    expect(counts[0]).toBeLessThan(counts[3]);
    expect(counts[0]).toBeGreaterThan(20);
    const easy = chartForDifficulty(demo, 'easy').notes;
    expect(easy.every((n) => n.row === 1)).toBe(true);
    // Fácil: no bellows flips closer than 2 beats.
    const changes = bellowsChanges(easy).map((c) => c.t);
    for (let i = 1; i < changes.length; i++) expect(changes[i] - changes[i - 1]).toBeGreaterThanOrEqual(2);
  });
});

describe('harmony', () => {
  it('detects C major and starts/ends on C', () => {
    expect(estimateKey(demo)).toBe(0);
    const chords = harmonize(demo);
    expect(chords[0].degree).toBe('I');
    expect(chords.at(-1)!.degree).toBe('I');
    expect(new Set(chords.map((c) => c.degree)).size).toBeGreaterThan(1);
  });
});

function makeJudge(options: { assisted?: boolean } = {}) {
  const resolved = resolveChart(demo).notes;
  const notes = Judge.buildNotes(resolved, demo.bpm, demo.parrandaPhrases);
  return { judge: new Judge(notes, { bpm: demo.bpm, assistedBellows: options.assisted }), notes };
}

/** Simulate a perfect player: flip the bellows just before each note, press on time. */
function playPerfect(judge: Judge, notes: GameNote[], skip = new Set<number>()) {
  const events = [];
  for (const n of notes) {
    if (skip.has(n.id)) {
      events.push(...judge.update(n.start + 0.2));
      continue;
    }
    events.push(...judge.update(n.start - 0.03));
    if (judge.bellows !== n.direction) events.push(...judge.setBellows(n.direction, n.start - 0.02));
    events.push(...judge.press(n.button.id, n.start));
    events.push(...judge.update(n.end - 0.01));
    events.push(...judge.release(n.button.id, n.end - 0.01));
  }
  events.push(...judge.update(notes.at(-1)!.end + 1));
  return events;
}

describe('judge', () => {
  it('grades a perfect run as all PERFECTO and scores it', () => {
    const { judge, notes } = makeJudge();
    const score = new ScoreKeeper({ parrandaPhrases: demo.parrandaPhrases, noteBeats: notes.map((n) => n.t) });
    for (const e of playPerfect(judge, notes)) score.apply(e);
    expect(score.grades.perfect).toBe(notes.length);
    expect(Object.values(score.errors).every((v) => v === 0)).toBe(true);
    expect(score.maxStreak).toBe(notes.length);
    expect(score.multiplier).toBe(4);
    expect(score.hats).toBe(3);
    expect(score.score).toBeGreaterThan(notes.length * 50);
  });

  it('uses the timing windows 35 / 70 / 110 ms', () => {
    const { judge, notes } = makeJudge();
    const n = notes[0];
    judge.setBellows(n.direction, n.start - 0.5);
    const [hit] = judge.press(n.button.id, n.start + 0.06);
    expect(hit).toMatchObject({ type: 'hit', grade: 'good' });
    const m = notes[1];
    judge.release(n.button.id, m.start - 0.2);
    judge.update(m.start - 0.1);
    if (judge.bellows !== m.direction) judge.setBellows(m.direction, m.start - 0.1);
    expect(judge.press(m.button.id, m.start - 0.1)[0]).toMatchObject({ type: 'hit', grade: 'ok' });
  });

  it('classifies every error type', () => {
    const { judge, notes } = makeJudge();
    const [a, b, c, d] = notes;
    // Wrong button: a button that does not sound the note in either direction.
    const wrong = notes.find(
      (n) => n.button.id !== a.button.id && n.midi !== a.midi && n.button[a.direction][0] !== a.midi,
    )!;
    judge.setBellows(a.direction, a.start - 0.5);
    expect(judge.press(wrong.button.id, a.start)[0]).toMatchObject({ type: 'error', kind: 'button' });
    judge.release(wrong.button.id, a.start + 0.1);
    // Wrong bellows: right button, never flips → OK + "bellows".
    const opposite = b.direction === 'push' ? 'pull' : 'push';
    judge.setBellows(opposite, b.start - 0.3);
    expect(judge.press(b.button.id, b.start)[0]).toMatchObject({ type: 'bellows-needed' });
    const late = judge.update(b.start + WINDOWS.ok + 0.01);
    expect(late.find((e) => e.type === 'hit')).toMatchObject({ grade: 'ok', bellowsWrong: true });
    judge.release(b.button.id, b.start + 0.2);
    // Missed then pressed late → reclassified as TARDE.
    judge.setBellows(c.direction, c.start - 0.2);
    expect(judge.update(c.start + 0.12)[0]).toMatchObject({ type: 'error', kind: 'missed' });
    expect(judge.press(c.button.id, c.start + 0.13)[0]).toMatchObject({ type: 'reclassify', to: 'late' });
    judge.release(c.button.id, c.start + 0.2);
    // Early press, then missed → TEMPRANO.
    judge.setBellows(d.direction, d.start - 0.3);
    expect(judge.press(d.button.id, d.start - 0.2)[0]).toMatchObject({ type: 'early-press' });
    judge.release(d.button.id, d.start - 0.15);
    expect(judge.update(d.start + 0.12)[0]).toMatchObject({ type: 'error', kind: 'early' });
    // Ghost note: nothing nearby.
    expect(judge.press(a.button.id, notes.at(-1)!.end + 5)[0]).toMatchObject({ type: 'error', kind: 'ghost' });
  });

  it('accepts the bellows as a strum: hold the button, flip the bellows on time', () => {
    const { judge, notes } = makeJudge();
    const n = notes[0];
    const opposite = n.direction === 'push' ? 'pull' : 'push';
    judge.setBellows(opposite, n.start - 0.5);
    judge.press(n.button.id, n.start - 0.05);
    const [hit] = judge.setBellows(n.direction, n.start + 0.01);
    expect(hit).toMatchObject({ type: 'hit', grade: 'perfect', bellowsWrong: false });
  });

  it('ignores bellows direction when "fuelle asistido" is on', () => {
    const { judge, notes } = makeJudge({ assisted: true });
    const n = notes[0];
    judge.setBellows(n.direction === 'push' ? 'pull' : 'push', n.start - 1);
    expect(judge.press(n.button.id, n.start)[0]).toMatchObject({ type: 'hit', grade: 'perfect' });
  });
});

describe('scoring', () => {
  it('breaks the multiplier on errors except the first 2 in Fácil', () => {
    const { judge, notes } = makeJudge();
    const easy = new ScoreKeeper({ graceErrors: 2 });
    const normal = new ScoreKeeper();
    const skip = new Set([12, 14, 16]);
    for (const e of playPerfect(judge, notes, skip)) {
      easy.apply(e);
      normal.apply(e);
    }
    expect(normal.errors.missed).toBe(3);
    expect(normal.maxStreak).toBeLessThan(notes.length);
    expect(easy.score).toBeGreaterThan(normal.score);
  });

  it('fails the song when the meter reaches zero (not in practice)', () => {
    const fail = new ScoreKeeper();
    const practice = new ScoreKeeper({ noFail: true });
    for (let i = 0; i < 20; i++) {
      fail.apply({ type: 'error', kind: 'missed' });
      practice.apply({ type: 'error', kind: 'missed' });
    }
    expect(fail.failed).toBe(true);
    expect(practice.failed).toBe(false);
  });

  it('runs Parranda: x8 and drains the hats', () => {
    const s = new ScoreKeeper();
    s.hats = 3;
    for (let i = 0; i < 40; i++)
      s.apply({ type: 'hit', note: { t: 0 } as GameNote, grade: 'perfect', offset: 0, bellowsWrong: false });
    expect(s.activateParranda()).toEqual([{ type: 'parranda-start' }]);
    expect(s.multiplier).toBe(8);
    s.advance(24);
    expect(s.parranda).toBe(false);
    expect(s.multiplier).toBe(4);
  });
});

describe('MIDI import', () => {
  it('reads a type-0 file into a monophonic chart in beats', () => {
    // 2 quarter notes C4, E4 at 120 BPM, PPQ 480.
    const bytes = new Uint8Array([
      ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0],
      ...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 29],
      ...[0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20],
      ...[0x00, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0],
      ...[0x00, 0x90, 64, 100, 0x83, 0x60, 0x80, 64, 0],
      ...[0x00, 0xff, 0x2f, 0x00],
    ]);
    const chart = chartFromMidi(bytes, { title: 'Prueba' });
    expect(chart.bpm).toBe(120);
    expect(chart.notes).toEqual([
      { t: 0, pitch: 'C4', dur: 1 },
      { t: 1, pitch: 'E4', dur: 1 },
    ]);
  });
});
