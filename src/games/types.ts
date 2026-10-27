import type { Sound } from '../sound';

/** A selectable option shown on the setup screen, e.g. number of players. */
export interface GameOption {
  id: string; // key stored in settings, e.g. 'players'
  label: string;
  values: number[];
  default: number;
}

export interface MountContext {
  options: Record<string, number>;
  sound: Sound;
  /** Called when the players want to leave the game (back to the menu). */
  exit: () => void;
}

export interface MountedGame {
  destroy: () => void;
}

/** Everything the menu needs to list a game and start it. Add a new game = add one of these. */
export interface GameDef {
  id: string;
  name: string;
  tagline: string;
  art: string; // inline SVG for the menu card
  rules: string[]; // short "how to play" lines for the setup screen
  options: GameOption[];
  mount: (root: HTMLElement, ctx: MountContext) => MountedGame;
}
