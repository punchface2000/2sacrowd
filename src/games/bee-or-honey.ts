// Bee or Honey: pure game logic. No DOM, no real clock, no Math.random.
// Time is passed in by the caller (ms), randomness comes from a seeded RNG.

export type Item = 'honey' | 'bee';
export type Phase = 'waiting' | 'showing' | 'resolved' | 'over';

export interface BeeOrHoneyConfig {
  players: number; // 2..4
  target: number; // points needed to win
  minDelayMs: number; // wait before an item appears
  maxDelayMs: number;
  beeChance: number; // 0..1
  itemTimeoutMs: number; // item leaves if nobody grabs
  resultMs: number; // pause after a round before the next one
  spamTaps: number; // this many early taps ...
  spamWindowMs: number; // ... within this window make the hand tired
  tiredMs: number; // lockout duration
  minScore: number; // scores never drop below this
}

export const DEFAULT_CONFIG: BeeOrHoneyConfig = {
  players: 4,
  target: 3,
  minDelayMs: 1200,
  maxDelayMs: 4200,
  beeChance: 0.4,
  itemTimeoutMs: 2200,
  resultMs: 1300,
  spamTaps: 3,
  spamWindowMs: 1500,
  tiredMs: 3000,
  minScore: 0,
};

export type TapResult =
  | { kind: 'ignored' } // round over, game over, or invalid player
  | { kind: 'blocked' } // hand is tired
  | { kind: 'early' } // too early, no penalty yet
  | { kind: 'tired' } // this tap tipped the hand into tiredness
  | { kind: 'grab'; item: Item; delta: number; won: boolean };

export interface RoundOutcome {
  player: number | null; // null: nobody grabbed
  item: Item;
}

export interface GameState {
  phase: Phase;
  scores: number[];
  item: Item | null; // item of the current/last round
  winner: number | null;
  outcome: RoundOutcome | null; // result of the last resolved round
  round: number;
}

/** Small, fast, seedable PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BeeOrHoney {
  readonly config: BeeOrHoneyConfig;
  private rng: () => number;
  private seed: number;
  private phase: Phase = 'waiting';
  private scores: number[];
  private item: Item | null = null;
  private winner: number | null = null;
  private outcome: RoundOutcome | null = null;
  private round = 0;
  private showAt = 0; // when the current item appears
  private nextAt = 0; // when the next round starts (resolved phase)
  private tiredUntil: number[];
  private earlyTaps: number[][];

  constructor(config: Partial<BeeOrHoneyConfig> = {}, seed = 1, now = 0) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.players < 2 || this.config.players > 4) {
      throw new Error('players must be between 2 and 4');
    }
    this.seed = seed;
    this.rng = createRng(seed);
    this.scores = [];
    this.tiredUntil = [];
    this.earlyTaps = [];
    this.reset(now);
  }

  /** Start a fresh game (rematch). Keeps the RNG running so rounds differ. */
  reset(now: number): void {
    const n = this.config.players;
    this.scores = new Array(n).fill(0);
    this.tiredUntil = new Array(n).fill(0);
    this.earlyTaps = Array.from({ length: n }, () => []);
    this.winner = null;
    this.outcome = null;
    this.item = null;
    this.round = 0;
    this.startRound(now);
  }

  getState(): GameState {
    return {
      phase: this.phase,
      scores: [...this.scores],
      item: this.item,
      winner: this.winner,
      outcome: this.outcome,
      round: this.round,
    };
  }

  isTired(player: number, now: number): boolean {
    return now < this.tiredUntil[player];
  }

  /** Milliseconds of tiredness left for a player (0 if rested). */
  tiredLeft(player: number, now: number): number {
    return Math.max(0, this.tiredUntil[player] - now);
  }

  /** Time at which the pending item appears (only meaningful while waiting). */
  get itemAppearsAt(): number {
    return this.showAt;
  }

  /** Advance the state machine. Call regularly (e.g. every animation frame). */
  tick(now: number): void {
    if (this.phase === 'waiting' && now >= this.showAt) {
      this.phase = 'showing';
    }
    if (this.phase === 'showing' && now >= this.showAt + this.config.itemTimeoutMs) {
      // nobody grabbed: the item leaves, no points either way
      this.outcome = { player: null, item: this.item as Item };
      this.phase = 'resolved';
      this.nextAt = now + this.config.resultMs;
    }
    if (this.phase === 'resolved' && now >= this.nextAt) {
      this.startRound(now);
    }
  }

  tap(player: number, now: number): TapResult {
    if (!Number.isInteger(player) || player < 0 || player >= this.config.players) {
      return { kind: 'ignored' };
    }
    // make sure a due phase change is applied before judging the tap
    this.tick(now);

    if (this.phase === 'resolved' || this.phase === 'over') return { kind: 'ignored' };
    if (this.isTired(player, now)) return { kind: 'blocked' };

    if (this.phase === 'waiting') {
      const recent = this.earlyTaps[player].filter((t) => now - t < this.config.spamWindowMs);
      recent.push(now);
      if (recent.length >= this.config.spamTaps) {
        this.earlyTaps[player] = [];
        this.tiredUntil[player] = now + this.config.tiredMs;
        return { kind: 'tired' };
      }
      this.earlyTaps[player] = recent;
      return { kind: 'early' };
    }

    // phase === 'showing': first valid tap wins the round
    const item = this.item as Item;
    const delta = item === 'honey' ? 1 : -1;
    this.scores[player] = Math.max(this.config.minScore, this.scores[player] + delta);
    this.outcome = { player, item };
    const won = this.scores[player] >= this.config.target;
    if (won) {
      this.winner = player;
      this.phase = 'over';
    } else {
      this.phase = 'resolved';
      this.nextAt = now + this.config.resultMs;
    }
    return { kind: 'grab', item, delta, won };
  }

  private startRound(now: number): void {
    const { minDelayMs, maxDelayMs, beeChance } = this.config;
    this.round += 1;
    this.phase = 'waiting';
    this.item = this.rng() < beeChance ? 'bee' : 'honey';
    this.showAt = now + minDelayMs + this.rng() * (maxDelayMs - minDelayMs);
    // early taps from the previous round no longer count
    this.earlyTaps = this.earlyTaps.map(() => []);
  }

  /** For debugging and tests. */
  get initialSeed(): number {
    return this.seed;
  }
}
