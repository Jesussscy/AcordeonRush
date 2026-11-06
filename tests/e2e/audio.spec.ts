import { expect, test } from '@playwright/test';

/**
 * Offline measurement of the miss feedback: render the real sampler, detune the melody at 1.0 s,
 * recover at 2.0 s, and estimate the pitch by autocorrelation in three windows.
 */
test('el acordeón se desafina al fallar y se recupera en ≈300 ms', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/audio/accordion-sampler.js';
    const { createAccordionAudio, SAMPLE_BANK_URL } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import('../../src/audio/accordion-sampler.js');
    const rate = 44100;
    const ctx = new OfflineAudioContext(1, rate * 3, rate);
    const audio = await createAccordionAudio({ context: ctx as unknown as AudioContext, baseURL: new URL(SAMPLE_BANK_URL, location.origin) });
    await audio.preload();
    audio.setProfile('natural');
    audio.setPlayingMode('direct');
    audio.scheduleMidi([69], 'melody', 0.05, 2.9); // A4
    void ctx.suspend(1.0).then(() => {
      audio.setMelodyFx({ detune: -60 }, 0.02);
      return ctx.resume();
    });
    void ctx.suspend(2.0).then(() => {
      audio.setMelodyFx({}, 0.1);
      return ctx.resume();
    });
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const pitch = (from: number, to: number) => {
      const a = Math.floor(from * rate);
      const n = Math.floor((to - from) * rate);
      const minLag = Math.floor(rate / 600);
      const maxLag = Math.floor(rate / 300);
      let best = 0;
      let bestLag = minLag;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += data[a + i] * data[a + i + lag];
        if (sum > best) {
          best = sum;
          bestLag = lag;
        }
      }
      // Parabolic interpolation around the peak.
      const corr = (lag: number) => {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += data[a + i] * data[a + i + lag];
        return sum;
      };
      const y0 = corr(bestLag - 1);
      const y1 = corr(bestLag);
      const y2 = corr(bestLag + 1);
      const shift = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
      return rate / (bestLag + shift);
    };
    const base = pitch(0.6, 0.9);
    const missed = pitch(1.5, 1.9);
    const recovered = pitch(2.3, 2.5);
    const cents = (f: number) => 1200 * Math.log2(f / base);
    return { base, missedCents: cents(missed), recoveredCents: cents(recovered) };
  });
  console.log(`Desafine medido: base ${result.base.toFixed(1)} Hz, fallo ${result.missedCents.toFixed(1)} cents, a los 300 ms ${result.recoveredCents.toFixed(1)} cents`);
  expect(result.base).toBeGreaterThan(400);
  expect(result.base).toBeLessThan(480);
  expect(result.missedCents).toBeLessThan(-45);
  expect(result.missedCents).toBeGreaterThan(-75);
  expect(Math.abs(result.recoveredCents)).toBeLessThan(8);
});
