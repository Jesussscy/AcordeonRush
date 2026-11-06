import fs from 'node:fs';
const p = 'assets/audio/samples/hohner-hn/manifest.json';
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
const layout = JSON.parse(fs.readFileSync('data/layouts/gcf.json', 'utf8'));
const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  return (Number(m[3]) + 1) * 12 + N[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
let i = 0;
m.buttons = {};
layout.rows.forEach((row, r) =>
  row.buttons.forEach(
    ({ push, pull }) =>
      (m.buttons[`BTN_Melody_${String(++i).padStart(2, '0')}`] = {
        push: [midi(push)],
        pull: [midi(pull)],
        row: r + 1,
      }),
  ),
);
layout.bass.forEach(
  (b, i) =>
    (m.buttons[`BTN_Bass_${String(i + 1).padStart(2, '0')}`] = { push: b.push.map(midi), pull: b.pull.map(midi) }),
);
m.tunings = layout.tunings.flatMap((t) => [{ ...t }, { ...t, id: t.id + '-low', semitones: t.semitones - 12 }]);
m.limitations = 'Virtual transpositions of one recorded bank. Layout source: ' + layout.source;
fs.writeFileSync(p, JSON.stringify(m, null, 2));
