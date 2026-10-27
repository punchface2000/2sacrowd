import { describe, expect, it } from 'vitest';
import { BeeOrHoney, createRng, DEFAULT_CONFIG } from '../src/games/bee-or-honey';

/**
 * Advance a game until a round with the wanted item has just appeared.
 * Returns the exact time the item appeared. Unwanted rounds are left to time out.
 */
function until(game: BeeOrHoney, item: 'honey' | 'bee', startNow = 0): number {
  let now = startNow;
  for (let guard = 0; guard < 500; guard++) {
    game.tick(now); // starts a new round if the last one is finished
    const s0 = game.getState();
    if (s0.phase === 'over') throw new Error('game is over');
    if (s0.phase === 'waiting') {
      const t = Math.max(now, game.itemAppearsAt);
      game.tick(t);
      const s = game.getState();
      if (s.phase === 'showing' && s.item === item) return t;
      now = t + game.config.itemTimeoutMs; // let it time out
      game.tick(now);
    }
    now += game.config.resultMs; // let the result pause pass
  }
  throw new Error('item never appeared');
}

describe('createRng', () => {
  it('is deterministic for a seed and stays in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('BeeOrHoney setup', () => {
  it('rejects bad player counts', () => {
    expect(() => new BeeOrHoney({ players: 1 })).toThrow();
    expect(() => new BeeOrHoney({ players: 5 })).toThrow();
  });
  it('starts waiting with zero scores', () => {
    const g = new BeeOrHoney({ players: 3 }, 7);
    expect(g.getState().phase).toBe('waiting');
    expect(g.getState().scores).toEqual([0, 0, 0]);
  });
  it('is reproducible with the same seed', () => {
    const a = new BeeOrHoney({}, 5);
    const b = new BeeOrHoney({}, 5);
    expect(a.itemAppearsAt).toBe(b.itemAppearsAt);
    expect(a.getState().item).toBe(b.getState().item);
  });
  it('shows the item only after the delay, within configured bounds', () => {
    const g = new BeeOrHoney({}, 3);
    expect(g.itemAppearsAt).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minDelayMs);
    expect(g.itemAppearsAt).toBeLessThanOrEqual(DEFAULT_CONFIG.maxDelayMs);
    g.tick(g.itemAppearsAt - 1);
    expect(g.getState().phase).toBe('waiting');
    g.tick(g.itemAppearsAt);
    expect(g.getState().phase).toBe('showing');
  });
});

describe('grabbing', () => {
  it('honey gives +1 and resolves the round', () => {
    const g = new BeeOrHoney({}, 11);
    const now = until(g, 'honey');
    const r = g.tap(2, now + 300);
    expect(r).toEqual({ kind: 'grab', item: 'honey', delta: 1, won: false });
    expect(g.getState().scores[2]).toBe(1);
    expect(g.getState().phase).toBe('resolved');
    expect(g.getState().outcome).toEqual({ player: 2, item: 'honey' });
  });

  it('bee gives -1 but never below minScore', () => {
    const g = new BeeOrHoney({}, 12);
    const now = until(g, 'bee');
    const r = g.tap(0, now + 200);
    expect(r).toMatchObject({ kind: 'grab', item: 'bee', delta: -1 });
    expect(g.getState().scores[0]).toBe(0);
  });

  it('bee subtracts from a positive score', () => {
    const g = new BeeOrHoney({ target: 5 }, 13);
    let now = until(g, 'honey');
    g.tap(1, now + 100);
    now += g.config.resultMs + 200;
    now = until(g, 'bee', now);
    g.tap(1, now + 100);
    expect(g.getState().scores[1]).toBe(0);
  });

  it('allows negative scores when minScore is lowered', () => {
    const g = new BeeOrHoney({ minScore: -10 }, 14);
    const now = until(g, 'bee');
    g.tap(3, now + 50);
    expect(g.getState().scores[3]).toBe(-1);
  });

  it('only the first tap counts; later taps are ignored', () => {
    const g = new BeeOrHoney({}, 15);
    const now = until(g, 'honey');
    expect(g.tap(0, now + 100).kind).toBe('grab');
    expect(g.tap(1, now + 101).kind).toBe('ignored');
    expect(g.getState().scores).toEqual([1, 0, 0, 0]);
  });

  it('ignores invalid players', () => {
    const g = new BeeOrHoney({ players: 2 }, 16);
    const now = until(g, 'honey');
    expect(g.tap(2, now).kind).toBe('ignored');
    expect(g.tap(-1, now).kind).toBe('ignored');
    expect(g.tap(0.5, now).kind).toBe('ignored');
  });

  it('a tap exactly when the item is due still counts (tick applied first)', () => {
    const g = new BeeOrHoney({}, 17);
    const t = g.itemAppearsAt;
    const item = g.getState().item;
    const r = g.tap(0, t);
    expect(r.kind).toBe('grab');
    if (r.kind === 'grab') expect(r.item).toBe(item);
  });

  it('nobody grabs: item times out, no score change, next round starts', () => {
    const g = new BeeOrHoney({}, 18);
    const t = g.itemAppearsAt;
    g.tick(t);
    expect(g.getState().phase).toBe('showing');
    g.tick(t + g.config.itemTimeoutMs);
    expect(g.getState().phase).toBe('resolved');
    expect(g.getState().outcome?.player).toBeNull();
    expect(g.getState().scores).toEqual([0, 0, 0, 0]);
    const roundBefore = g.getState().round;
    g.tick(t + g.config.itemTimeoutMs + g.config.resultMs);
    expect(g.getState().phase).toBe('waiting');
    expect(g.getState().round).toBe(roundBefore + 1);
  });

  it('too-late taps after resolve are ignored', () => {
    const g = new BeeOrHoney({}, 19);
    const now = until(g, 'honey');
    g.tap(0, now + 100);
    expect(g.tap(1, now + 200).kind).toBe('ignored');
  });
});

describe('winning', () => {
  it('first to the target wins and the game ends', () => {
    const g = new BeeOrHoney({ players: 2, target: 3 }, 21);
    let now = 0;
    for (let i = 0; i < 3; i++) {
      now = until(g, 'honey', now);
      const r = g.tap(1, now + 100);
      expect(r.kind).toBe('grab');
      now += g.config.resultMs + 200;
      g.tick(now);
    }
    const s = g.getState();
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
    expect(s.scores[1]).toBe(3);
  });

  it('after the game is over, taps are ignored and tick does not restart', () => {
    const g = new BeeOrHoney({ players: 2, target: 1 }, 22);
    const now = until(g, 'honey');
    const r = g.tap(0, now + 10);
    expect(r).toMatchObject({ kind: 'grab', won: true });
    g.tick(now + 100000);
    expect(g.getState().phase).toBe('over');
    expect(g.tap(1, now + 100001).kind).toBe('ignored');
  });

  it('reset starts a fresh game', () => {
    const g = new BeeOrHoney({ players: 2, target: 1 }, 23);
    const now = until(g, 'honey');
    g.tap(0, now + 10);
    g.reset(now + 5000);
    const s = g.getState();
    expect(s.phase).toBe('waiting');
    expect(s.winner).toBeNull();
    expect(s.scores).toEqual([0, 0]);
    expect(g.itemAppearsAt).toBeGreaterThan(now + 5000);
  });
});

describe('spamming makes the hand tired', () => {
  it('a couple of early taps are fine', () => {
    const g = new BeeOrHoney({}, 31);
    expect(g.tap(0, 100).kind).toBe('early');
    expect(g.tap(0, 300).kind).toBe('early');
    expect(g.isTired(0, 400)).toBe(false);
  });

  it('three early taps in the window tire the hand', () => {
    const g = new BeeOrHoney({}, 32);
    g.tap(0, 100);
    g.tap(0, 300);
    expect(g.tap(0, 500)).toEqual({ kind: 'tired' });
    expect(g.isTired(0, 600)).toBe(true);
    expect(g.tiredLeft(0, 500)).toBe(g.config.tiredMs);
  });

  it('slow early taps outside the window do not add up', () => {
    const g = new BeeOrHoney({ minDelayMs: 20000, maxDelayMs: 30000 }, 33);
    g.tap(0, 0);
    g.tap(0, 1000);
    expect(g.tap(0, 2000).kind).toBe('early'); // first one fell out of the 1500 ms window
  });

  it('tired players cannot grab, others still can', () => {
    const g = new BeeOrHoney({ tiredMs: 1e9 }, 34);
    g.tap(0, 10);
    g.tap(0, 20);
    g.tap(0, 30);
    const now = until(g, 'honey', 100);
    expect(g.isTired(0, now)).toBe(true);
    expect(g.tap(0, now + 50)).toEqual({ kind: 'blocked' });
    expect(g.getState().phase).toBe('showing'); // a blocked tap does not end the round
    expect(g.tap(1, now + 80).kind).toBe('grab');
  });

  it('hand recovers after tiredMs', () => {
    const g = new BeeOrHoney({ minDelayMs: 20000, maxDelayMs: 30000 }, 35);
    g.tap(2, 0);
    g.tap(2, 10);
    g.tap(2, 20);
    expect(g.isTired(2, 20 + g.config.tiredMs - 1)).toBe(true);
    expect(g.isTired(2, 20 + g.config.tiredMs)).toBe(false);
    expect(g.tap(2, 20 + g.config.tiredMs).kind).toBe('early');
  });

  it('early taps are per player', () => {
    const g = new BeeOrHoney({}, 36);
    g.tap(0, 10);
    g.tap(1, 20);
    g.tap(0, 30);
    expect(g.tap(1, 40).kind).toBe('early');
    expect(g.isTired(0, 50)).toBe(false);
  });
});

describe('balance over many rounds', () => {
  it('produces both honey and bees at roughly the configured rate', () => {
    const g = new BeeOrHoney({ players: 2, target: 10000 }, 99);
    let now = 0;
    let bees = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      now = Math.max(now, g.itemAppearsAt);
      g.tick(now);
      if (g.getState().item === 'bee') bees++;
      now += g.config.itemTimeoutMs + 1;
      g.tick(now);
      now += g.config.resultMs + 1;
      g.tick(now);
    }
    expect(bees / n).toBeGreaterThan(0.35);
    expect(bees / n).toBeLessThan(0.45);
  });
});
