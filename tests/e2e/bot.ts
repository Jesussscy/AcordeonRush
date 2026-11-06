import type { Page } from '@playwright/test';

export type BotOptions = {
  /** Note ids the bot does not play (simulated misses). */
  skip?: number[];
  /** Note ids played with the wrong bellows direction. */
  wrongBellows?: number[];
  /** Note ids played on a wrong button. */
  wrongButton?: number[];
  /** Press Enter as soon as Parranda is ready. */
  parranda?: boolean;
  /** Stop after this song time (seconds). */
  until?: number;
};

/**
 * In-page bot: reads the resolved notes from the debug hook and dispatches real KeyboardEvents
 * (button keys + Space for the bellows) on time, against the game's own audio clock.
 */
export async function playWithBot(page: Page, options: BotOptions = {}) {
  await page.waitForFunction(() => window.__VH__?.session.debugSnapshot().ready, null, { timeout: 90_000 });
  return page.evaluate((opts: BotOptions) => {
    const session = window.__VH__!.session;
    const notes = session.debugNotes();
    const skip = new Set(opts.skip ?? []);
    const wrongBellows = new Set(opts.wrongBellows ?? []);
    const wrongButton = new Set(opts.wrongButton ?? []);
    const fire = (type: 'keydown' | 'keyup', code: string) =>
      window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    let i = 0;
    let bellowsDown = false;
    const ups: { t: number; code: string }[] = [];
    return new Promise<ReturnType<typeof session.debugSnapshot>>((resolve) => {
      const tick = () => {
        const snap = session.debugSnapshot();
        const now = snap.now;
        for (const up of ups.splice(0))
          if (now >= up.t) fire('keyup', up.code);
          else ups.push(up);
        if (opts.parranda && snap.hats >= 1.5 && !snap.parranda) fire('keydown', 'Enter');
        while (i < notes.length && now >= notes[i].start - 0.004) {
          const n = notes[i++];
          if (skip.has(n.id)) continue;
          let push = n.direction === 'push';
          if (wrongBellows.has(n.id)) push = !push;
          if (push !== bellowsDown) {
            fire(push ? 'keydown' : 'keyup', 'Space');
            bellowsDown = push;
          }
          const key = wrongButton.has(n.id) ? notes.find((m) => m.row !== n.row && m.key !== n.key)!.key : n.key;
          fire('keydown', key);
          ups.push({ t: Math.max(n.start + 0.05, n.end - 0.03), code: key });
        }
        if (snap.finished || (opts.until !== undefined && now > opts.until)) return resolve(snap);
        setTimeout(tick, 1);
      };
      tick();
    });
  }, options);
}
