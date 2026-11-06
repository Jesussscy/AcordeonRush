import { expect, test } from '@playwright/test';
import { playWithBot } from './bot';

// Uncapped frame rate: measures the real cost of a frame instead of the display's vsync interval.
test.use({
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
  },
});

/** H4 criterion: the full stage (bloom, crowd, beams) holds 60 FPS at 1080p on this machine. */
test('60 FPS en 1080p con el escenario completo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Jugar/ }).click();
  await page.getByRole('button', { name: /^Experto/ }).click();
  await page.getByRole('button', { name: '¡A tocar!' }).click();
  const play = playWithBot(page, { until: 14 });
  await page.waitForFunction(() => (window.__VH__?.session.debugSnapshot().now ?? -9) > 4, null, { timeout: 90_000 });
  const stats = await page.evaluate(
    () =>
      new Promise<{ median: number; p95: number }>((resolve) => {
        const times: number[] = [];
        let last = performance.now();
        const frame = (now: number) => {
          times.push(now - last);
          last = now;
          if (times.length < 300) requestAnimationFrame(frame);
          else {
            times.sort((a, b) => a - b);
            resolve({ median: times[150], p95: times[285] });
          }
        };
        requestAnimationFrame(frame);
      }),
  );
  await play;
  console.log(`1080p frame time: mediana ${stats.median.toFixed(2)} ms, p95 ${stats.p95.toFixed(2)} ms`);
  expect(stats.p95).toBeLessThan(16.7);
});
