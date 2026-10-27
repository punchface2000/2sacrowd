import type { GameDef } from './types';
import { beeOrHoneyGame } from './bee-or-honey-ui';

/** The game library. To add a game: write its module, then append it here. */
export const GAMES: GameDef[] = [beeOrHoneyGame];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
