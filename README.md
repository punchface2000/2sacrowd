# 2sacrowd

Party games for one screen: 2 to 4 friends share one iPhone or iPad and play head to head. Installable as a PWA, works offline.

**Live:** https://punchface2000.github.io/2sacrowd/

## Install on iPhone / iPad

1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the home screen. After the first load it works offline. To get a new version, reopen the app while online (sometimes twice).

## Games

### Bee or Honey
Put the device flat between you. Each player has a pad in their corner (top pads are rotated to face the player across). A honey jar or an angry bee appears in the middle after a random wait.

- Tap your pad to grab. The first tap wins the round and a bear paw reaches in.
- Honey: **+1**. Bee: **-1** (scores never go below 0).
- Nobody grabs: the item leaves, no points.
- **Don't spam.** Three early taps within 1.5 s make your hand tired for 3 s (you can't grab).
- First to the target (3, 5 or 7 points) wins.
- 2, 3 or 4 players. Pause button on the left edge (restart / menu).

## Settings
Theme (auto / light / dark) and sound on/off on the home screen. Last used player count and target are remembered per game.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run build      # type check + production build into dist/
npm run icons      # regenerate PNG icons from public/favicon.svg
npm run check      # phone-sized Playwright check (needs a build first), screenshots go to shots/
```

`?seed=123` in the URL makes the rounds reproducible (used by the browser check).

## Files

```
src/
  main.ts                    menu, setup screen, theme, launching games
  style.css                  all styles (CSS variables, light/dark)
  storage.ts                 settings in localStorage, merged with defaults
  sound.ts                   synthesized sound effects (Web Audio)
  art.ts                     SVG art: honey jar, bee, bear, paw
  games/
    types.ts                 GameDef interface (what a game must provide)
    registry.ts              list of games shown in the menu
    bee-or-honey.ts          pure game logic (no DOM), unit tested
    bee-or-honey-ui.ts       screen for Bee or Honey, builds on the logic
tests/                       Vitest tests
scripts/                     icons.mjs, phone-check.mjs
.github/workflows/deploy.yml tests, build and deploy to GitHub Pages on push to main
```

## Adding a game

1. Write the rules as pure logic in `src/games/<name>.ts` with tests in `tests/`.
2. Write `src/games/<name>-ui.ts` exporting a `GameDef` (name, art, options such as players, and `mount`).
3. Add it to the list in `src/games/registry.ts`. It then shows up in the menu with its own setup screen.
