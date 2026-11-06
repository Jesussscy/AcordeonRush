import fs from 'node:fs';
import { expect, test } from '@playwright/test';

test('práctica: velocidad 50 %, bucle de sección y sin fin de partida', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Práctica/ }).click();
  await page.getByRole('button', { name: /^Fácil/ }).click();
  await page.locator('input[type=range]').first().fill('50');
  await page.getByRole('combobox').first().selectOption({ label: 'Compases 1–4' });
  await page.getByRole('button', { name: '¡A tocar!' }).click();
  await page.waitForFunction(() => window.__VH__?.session.debugSnapshot().ready, null, { timeout: 90_000 });
  const t0 = await page.evaluate(() => window.__VH__!.session.debugSnapshot().now);
  await page.waitForTimeout(2000);
  const t1 = await page.evaluate(() => window.__VH__!.session.debugSnapshot().now);
  // Half speed: ~1 s of song time per 2 s of real time.
  expect(t1 - t0).toBeGreaterThan(0.8);
  expect(t1 - t0).toBeLessThan(1.2);
  // Section = 16 beats = 10 s of song time = 20 s at half speed (+ count-in).
  await page.waitForFunction(() => window.__VH__!.session.debugSnapshot().loops >= 1, null, { timeout: 40_000 });
  const snap = await page.evaluate(() => window.__VH__!.session.debugSnapshot());
  expect(snap.finished).toBe(false);
  expect(snap.now).toBeLessThan(10.5);
});

test('soltar una carpeta en songs/ (chart.json o .mid) la agrega sin tocar código', async ({ page }) => {
  const chartDir = 'songs/_e2e-nueva';
  const midiDir = 'songs/_e2e-midi';
  try {
    fs.mkdirSync(chartDir, { recursive: true });
    const demo = JSON.parse(fs.readFileSync('songs/paseo-de-prueba/chart.json', 'utf8'));
    fs.writeFileSync(`${chartDir}/chart.json`, JSON.stringify({ ...demo, title: 'Canción Nueva E2E', artist: 'Test' }));
    // C4 E4 G4 C5 quarter notes at 100 BPM (PPQ 480), as a type-0 MIDI file.
    const notes = [60, 64, 67, 72].flatMap((n) => [0x00, 0x90, n, 100, 0x83, 0x60, 0x80, n, 0]);
    const track = [0x00, 0xff, 0x51, 0x03, 0x09, 0x27, 0xc0, ...notes, 0x00, 0xff, 0x2f, 0x00];
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0];
    const length = [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, track.length];
    fs.mkdirSync(midiDir, { recursive: true });
    fs.writeFileSync(`${midiDir}/melodia.mid`, Buffer.from([...header, ...length, ...track]));

    await page.goto('/');
    await page.getByRole('button', { name: /^Jugar/ }).click();
    await expect(page.getByText('Canción Nueva E2E')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('listitem').filter({ hasText: 'e2e midi' }).click();
    await page.getByRole('button', { name: '¡A tocar!' }).click();
    await page.waitForFunction(() => window.__VH__?.session.debugSnapshot().ready, null, { timeout: 90_000 });
    const notesInGame = await page.evaluate(() => window.__VH__!.session.debugNotes().map((n) => n.code));
    expect(notesInGame.length).toBe(4);
  } finally {
    fs.rmSync(chartDir, { recursive: true, force: true });
    fs.rmSync(midiDir, { recursive: true, force: true });
  }
});

test('demostración: el acordeón toca toda la canción solo, perfecto', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Demostración/ }).click();
  await page.getByRole('button', { name: /^Experto/ }).click();
  await page.getByRole('button', { name: '¡Que suene!' }).click();
  await page.waitForFunction(() => window.__VH__?.session.debugSnapshot().finished, null, { timeout: 120_000 });
  const snap = await page.evaluate(() => window.__VH__!.session.debugSnapshot());
  expect(snap.grades.perfect).toBe(75);
  expect(Object.values(snap.errors).every((v) => v === 0)).toBe(true);
  await expect(page.getByTestId('final-score')).toBeVisible({ timeout: 10_000 });
});
