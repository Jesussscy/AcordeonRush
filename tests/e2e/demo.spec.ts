import { expect, test, type Page } from '@playwright/test';
import { playWithBot } from './bot';

async function openDemo(
  page: Page,
  difficulty: 'Fácil' | 'Medio' | 'Difícil' | 'Experto',
  mode: 'Jugar' | 'Práctica' = 'Jugar',
) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`^${mode}`) }).click();
  await page.getByRole('button', { name: new RegExp(`^${difficulty}`) }).click();
  await page.getByRole('button', { name: '¡A tocar!' }).click();
}

function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  return problems;
}

for (const difficulty of ['Fácil', 'Medio', 'Difícil', 'Experto'] as const) {
  test(`la demo se completa perfecta en ${difficulty}`, async ({ page }) => {
    const problems = collectProblems(page);
    await openDemo(page, difficulty);
    const result = await playWithBot(page);
    expect(result.finished).toBe(true);
    const total = Object.values(result.grades).reduce((a, b) => a + b, 0);
    if (Object.values(result.errors).some((v) => v > 0))
      console.log('notas con error', JSON.stringify(await page.evaluate(() => window.__VH__?.session.debugNotes().filter((n) => n.state !== 'hit' || n.grade !== 'perfect'))));
    expect(result.grades.perfect).toBe(total);
    expect(Object.values(result.errors).every((v) => v === 0)).toBe(true);
    await expect(page.getByTestId('final-score')).toBeVisible({ timeout: 10_000 });
    expect(problems).toEqual([]);
  });
}

test('los errores se clasifican y se ven en resultados', async ({ page }) => {
  const problems = collectProblems(page);
  await openDemo(page, 'Experto');
  const result = await playWithBot(page, { skip: [10, 11], wrongBellows: [20], wrongButton: [30] });
  expect(result.errors.missed).toBeGreaterThanOrEqual(2);
  expect(result.errors.bellows).toBe(1);
  expect(result.errors.button).toBe(1);
  await expect(page.getByText('Fuelle equivocado: 1')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('advice')).not.toBeEmpty();
  expect(problems).toEqual([]);
});
