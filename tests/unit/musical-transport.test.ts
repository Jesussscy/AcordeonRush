import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AccordionAudio } from '../../src/audio/accordion-sampler.js';
import { MusicalTransport } from '../../src/core/musical-transport';
import * as library from '../../src/gameplay/song-library';
import * as music from '../../src/instrument/accordion-catalog';

// Migrated from tools/validate-musical-transport.mjs.
type Call = [string, string, number, number, number?];
function fakeEngine(clock: { now: number }, calls: Call[], counters = { stops: 0 }) {
  return {
    context: {
      get currentTime() {
        return clock.now;
      },
    },
    allNotesOff() {
      counters.stops++;
    },
    scheduleNote(...args: Call) {
      calls.push(args);
    },
  } as unknown as AccordionAudio;
}

const template = library.parseChart(fs.readFileSync('tests/fixtures/chart-template-v1.json', 'utf8'));

describe('tuning catalog', () => {
  it('publishes 12 families / 24 unique options', () => {
    expect(music.tuningFamilies).toHaveLength(12);
    expect(music.tuningOptions).toHaveLength(24);
    expect(new Set(music.tuningFamilies.map((t) => ((t.semitones % 12) + 12) % 12)).size).toBe(12);
    expect(music.noteName(60)).toBe('Do4');
    expect(music.noteName(74)).toBe('Re5');
    expect(() => music.getTuning('invalid')).toThrow();
  });
});

describe('chart parsing and fingering', () => {
  it('maps the template without problems', () => {
    const mapped = library.fingerChart(template, 'GCF');
    expect(mapped.problems).toHaveLength(0);
    expect(mapped.events).toHaveLength(3);
  });

  it('rejects malformed provenance and timing', () => {
    expect(() =>
      library.parseChart(
        JSON.stringify({ ...template, provenance: { ...template.provenance, reviewer: { bad: true } } }),
      ),
    ).toThrow();
    expect(() =>
      library.parseChart(JSON.stringify({ ...template, events: [{ ...template.events[0], end: -1 }] })),
    ).toThrow();
  });

  it('keeps one bellows direction for simultaneous notes', () => {
    const poly = library.fingerChart({ ...template, events: [{ ...template.events[0], pitches: [60, 64] }] }, 'GCF');
    expect(poly.events).toHaveLength(2);
    expect(new Set(poly.events.map((e) => e.direction)).size).toBe(1);
  });
});

describe('musical transport', () => {
  it('handles count-in, pause, seek into sustain, tempo, loop, finish and reset', async () => {
    const clock = { now: 0 };
    const calls: Call[] = [];
    const counters = { stops: 0 };
    const mapped = library.fingerChart(template, 'GCF');
    const transport = new MusicalTransport(fakeEngine(clock, calls, counters), mapped.events, template.duration);
    await transport.play();
    expect(transport.position).toBe(0);
    expect(transport.isCountingIn).toBe(true);
    transport.pump();
    expect(calls).toHaveLength(1);
    expect(Math.abs(calls[0][2] - 0.08)).toBeLessThan(1e-9);

    clock.now = 0.25;
    transport.pause();
    const paused = transport.position;
    clock.now = 3;
    expect(transport.position).toBe(paused);
    await transport.play();
    expect(transport.position).toBeLessThan(0.3);

    transport.seek(0.85);
    expect(transport.position).toBe(0.85);
    expect(calls.at(-1)![3]).toBeLessThanOrEqual(0.251);

    transport.setRate(0.5);
    clock.now += 0.4;
    expect(Math.abs(transport.position - 1.05)).toBeLessThan(1e-9);

    transport.loop = { a: 0.5, b: 1 };
    transport.pump();
    expect(Math.abs(transport.position - 0.5)).toBeLessThan(1e-9);

    transport.loop = null;
    transport.seek(3.99);
    clock.now += 0.1;
    transport.pump();
    expect(transport.phase).toBe('finished');
    expect(transport.position).toBe(4);

    transport.reset();
    expect(transport.phase).toBe('ready');
    expect(transport.position).toBe(0);
    expect(counters.stops).toBeGreaterThan(5);
  });

  it.each(library.songProfiles.map((p) => [p.song.title, p] as const))(
    'schedules every event of the studio arrangement "%s" on time',
    async (_title, profile) => {
      const chart = library.didacticChart(profile.song, profile.tuning);
      const fingers = library.fingerChart(chart, profile.tuning);
      expect(fingers.problems.filter((p) => p.startsWith('m-'))).toHaveLength(0);
      const clock = { now: 0 };
      const calls: Call[] = [];
      const transport = new MusicalTransport(fakeEngine(clock, calls), fingers.events, chart.duration);
      await transport.play();
      for (clock.now = 0; clock.now < chart.duration + 0.2; clock.now += 0.025) transport.pump();
      expect(transport.phase).toBe('finished');
      expect(calls).toHaveLength(fingers.events.length);
      calls.forEach((call, i) =>
        expect(Math.abs(call[2] - (0.08 + fingers.events[i].start)) * 1000).toBeLessThan(0.01),
      );
      const shift = music.getTuning(profile.tuning).semitones;
      for (const e of fingers.events) expect(e.pitches).toEqual(e.button[e.direction].map((n) => n + shift));
    },
  );
});
