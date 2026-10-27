import './style.css';
import { BEAR } from './art';
import { GAMES, getGame } from './games/registry';
import type { GameDef, MountedGame } from './games/types';
import { Sound } from './sound';
import { loadSettings, saveSettings, type Theme } from './storage';

const app = document.getElementById('app')!;
const settings = loadSettings();
const sound = new Sound();
sound.enabled = settings.sound;

// audio can only start after a user gesture on iOS; Safari is pickier about which
// gesture events count, so try on all of them
for (const ev of ['pointerdown', 'touchend', 'click']) {
  document.addEventListener(ev, () => sound.unlock(), { passive: true, capture: true });
}

const THEME_COLORS = { dark: '#15130f', light: '#fbf7ef' };

function applyTheme(theme: Theme): void {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  // keep the browser/status bar color in sync with a forced theme
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media') ?? '';
    m.content = theme === 'auto' ? (media.includes('light') ? THEME_COLORS.light : THEME_COLORS.dark) : THEME_COLORS[theme];
  });
}
applyTheme(settings.theme);

let running: MountedGame | null = null;

function stopGame(): void {
  running?.destroy();
  running = null;
}

function optionValue(game: GameDef, id: string): number {
  const opt = game.options.find((o) => o.id === id)!;
  const saved = settings.games[game.id]?.[id];
  return saved !== undefined && opt.values.includes(saved) ? saved : opt.default;
}

function seg(items: { label: string; value: string; pressed: boolean }[], attr: string): string {
  return `<div class="seg" role="group">${items
    .map((i) => `<button type="button" ${attr}="${i.value}" aria-pressed="${i.pressed}">${i.label}</button>`)
    .join('')}</div>`;
}

// ---------- home ----------
function showHome(): void {
  stopGame();
  app.innerHTML = `
    <div class="screen home"><div class="inner">
      <header class="hero">
        <div class="bear">${BEAR}</div>
        <h1>2s<b>a</b>crowd</h1>
        <p>Party games for one screen</p>
      </header>
      <section class="cards">
        ${GAMES.map(
          (g) => `
          <button class="card" data-game="${g.id}">
            <span class="art">${g.art}</span>
            <span><h2>${g.name}</h2><p>${g.tagline}</p></span>
          </button>`,
        ).join('')}
        <div class="soon">More games coming soon</div>
      </section>
      <footer class="footer">
        <div class="row"><span class="label">Theme</span>
          ${seg(
            (['auto', 'light', 'dark'] as Theme[]).map((t) => ({
              label: t[0].toUpperCase() + t.slice(1),
              value: t,
              pressed: settings.theme === t,
            })),
            'data-theme-opt',
          )}
        </div>
        <div class="row"><span class="label">Sound</span>
          ${seg(
            [
              { label: 'On', value: 'on', pressed: settings.sound },
              { label: 'Off', value: 'off', pressed: !settings.sound },
            ],
            'data-sound-opt',
          )}
        </div>
      </footer>
    </div></div>`;

  app.querySelectorAll<HTMLElement>('[data-game]').forEach((el) =>
    el.addEventListener('click', () => showSetup(getGame(el.dataset.game!)!)),
  );
  app.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((el) =>
    el.addEventListener('click', () => {
      settings.theme = el.dataset.themeOpt as Theme;
      saveSettings(settings);
      applyTheme(settings.theme);
      showHome();
    }),
  );
  app.querySelectorAll<HTMLElement>('[data-sound-opt]').forEach((el) =>
    el.addEventListener('click', () => {
      settings.sound = el.dataset.soundOpt === 'on';
      sound.enabled = settings.sound;
      saveSettings(settings);
      sound.play('honey');
      showHome();
    }),
  );
}

// ---------- setup ----------
function showSetup(game: GameDef): void {
  const chosen: Record<string, number> = {};
  game.options.forEach((o) => (chosen[o.id] = optionValue(game, o.id)));

  app.innerHTML = `
    <div class="screen setup"><div class="inner">
      <button class="back" data-back>‹ Games</button>
      <div class="setup-art">${game.art}</div>
      <h1>${game.name}</h1>
      <p class="tag">${game.tagline}</p>
      <ol class="rules">${game.rules.map((r) => `<li>${r}</li>`).join('')}</ol>
      <div class="opts">
        ${game.options
          .map(
            (o) => `
          <div class="row"><span class="label">${o.label}</span>
            ${seg(
              o.values.map((v) => ({ label: String(v), value: String(v), pressed: chosen[o.id] === v })),
              `data-opt="${o.id}" data-val`,
            )}
          </div>`,
          )
          .join('')}
      </div>
      <div class="spacer"></div>
      <button class="btn primary start" data-start>Start</button>
    </div></div>`;

  app.querySelector('[data-back]')!.addEventListener('click', showHome);
  app.querySelectorAll<HTMLElement>('[data-opt]').forEach((el) =>
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-opt')!;
      chosen[id] = Number(el.getAttribute('data-val'));
      el.parentElement!.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    }),
  );
  app.querySelector('[data-start]')!.addEventListener('click', () => {
    settings.games[game.id] = { ...chosen };
    saveSettings(settings);
    startGame(game, chosen);
  });
}

// ---------- play ----------
function startGame(game: GameDef, options: Record<string, number>): void {
  stopGame();
  app.innerHTML = '';
  running = game.mount(app, { options, sound, exit: showHome });
}

showHome();
