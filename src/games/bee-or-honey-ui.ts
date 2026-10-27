import { BeeOrHoney, type Item } from './bee-or-honey';
import { BEAR, BEE, CROWN, HONEY_JAR, PAW_PRINT, SWEAT, pawSvg } from '../art';
import type { GameDef, MountContext, MountedGame } from './types';

const COLORS = ['#ef5b5b', '#4c8dff', '#3ecf8e', '#a66bff'];
const NAMES = ['Red', 'Blue', 'Green', 'Purple'];

interface Slot {
  player: number;
  row: 'top' | 'bottom';
  col: number; // 1 or 2
  span: boolean; // pad spans both columns
}

/** Who sits where. Bottom pads face up, top pads are rotated 180° so they read right for the player across. */
export function slotsFor(n: number): Slot[] {
  if (n <= 2) {
    return [
      { player: 0, row: 'bottom', col: 1, span: true },
      { player: 1, row: 'top', col: 1, span: true },
    ];
  }
  if (n === 3) {
    return [
      { player: 0, row: 'bottom', col: 1, span: false },
      { player: 1, row: 'bottom', col: 2, span: false },
      { player: 2, row: 'top', col: 1, span: true },
    ];
  }
  return [
    { player: 0, row: 'bottom', col: 1, span: false },
    { player: 1, row: 'bottom', col: 2, span: false },
    { player: 2, row: 'top', col: 1, span: false },
    { player: 3, row: 'top', col: 2, span: false },
  ];
}

function mount(root: HTMLElement, ctx: MountContext): MountedGame {
  const players = ctx.options.players ?? 4;
  const target = ctx.options.target ?? 3;
  const seedParam = new URLSearchParams(location.search).get('seed');
  const seed = seedParam ? Number(seedParam) || 1 : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

  // game clock: real time minus the time spent paused
  let pausedTotal = 0;
  let pauseStart = 0;
  let paused = false;
  const origin = performance.now();
  const toGame = (t: number) => t - origin - pausedTotal;
  const now = () => toGame(performance.now());

  const game = new BeeOrHoney({ players, target }, seed, now());
  const slots = slotsFor(players);

  root.innerHTML = `
    <div class="arena n${players}" data-phase="waiting" data-scores="">
      ${slots
        .map(
          (s) => `
        <button class="pad ${s.row === 'top' ? 'flip' : ''}" data-p="${s.player}" aria-label="${NAMES[s.player]} player"
          style="--pc:${COLORS[s.player]}; grid-row:${s.row === 'top' ? 1 : 3}; grid-column:${s.span ? '1 / -1' : s.col}">
          <span class="pad-inner">
            <span class="pips">${Array.from({ length: target }, () => '<i></i>').join('')}</span>
            <span class="pawicon">${PAW_PRINT}</span>
            <span class="tired-ui" aria-hidden="true">
              <span class="droop">${PAW_PRINT}</span>
              <span class="sweat s1">${SWEAT}</span><span class="sweat s2">${SWEAT}</span>
              <span class="zzz">z z z</span>
              <span class="bar"><i></i></span>
            </span>
          </span>
        </button>`,
        )
        .join('')}
      <div class="center">
        <div class="waitdots"><i></i><i></i><i></i></div>
        <div class="ring"></div>
        <div class="item"></div>
      </div>
      <div class="fx"></div>
      <button class="pause-btn" aria-label="Pause"><span></span><span></span></button>
      <div class="overlay" hidden></div>
    </div>`;

  const arena = root.querySelector<HTMLElement>('.arena')!;
  const center = arena.querySelector<HTMLElement>('.center')!;
  const itemEl = arena.querySelector<HTMLElement>('.item')!;
  const ringEl = arena.querySelector<HTMLElement>('.ring')!;
  const fx = arena.querySelector<HTMLElement>('.fx')!;
  const overlay = arena.querySelector<HTMLElement>('.overlay')!;
  const pauseBtn = arena.querySelector<HTMLButtonElement>('.pause-btn')!;
  const pads: HTMLElement[] = [];
  arena.querySelectorAll<HTMLElement>('.pad').forEach((el) => {
    pads[Number(el.dataset.p)] = el;
  });

  let shownRound = -1;
  let prevPhase = game.getState().phase;
  let prevRound = game.getState().round;
  let raf = 0;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(window.setTimeout(fn, ms));
  };

  // ---------- center item ----------
  function clearCenter(): void {
    itemEl.getAnimations().forEach((a) => a.cancel());
    itemEl.innerHTML = '';
    itemEl.removeAttribute('data-kind');
    center.classList.remove('has-item');
  }

  function showItem(item: Item, withSound: boolean): void {
    const round = game.getState().round;
    shownRound = round;
    itemEl.getAnimations().forEach((a) => a.cancel());
    itemEl.innerHTML = `<div class="item-art ${item}">${item === 'honey' ? HONEY_JAR : BEE}</div>`;
    itemEl.dataset.kind = item;
    center.classList.add('has-item');
    if (withSound) ctx.sound.play(item === 'honey' ? 'honeyAppear' : 'beeAppear');
  }

  function leaveItem(item: Item): void {
    const art = itemEl.firstElementChild as HTMLElement | null;
    if (!art) return;
    const frames: Keyframe[] =
      item === 'bee'
        ? [
            { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
            { transform: 'translate(40%,-130%) rotate(24deg) scale(.5)', opacity: 0 },
          ]
        : [
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: 'translate(0,18%) scale(.7)', opacity: 0 },
          ];
    itemEl.animate(frames, { duration: 520, easing: 'ease-in', fill: 'forwards' });
  }

  // ---------- bear paw ----------
  function playPaw(player: number, item: Item): void {
    const A = arena.getBoundingClientRect();
    const P = pads[player].getBoundingClientRect();
    const C = center.getBoundingClientRect();
    const fromTop = slots.find((s) => s.player === player)!.row === 'top';
    const sx = P.left + P.width / 2 - A.left;
    const sy = fromTop ? 0 : A.height;
    const cx = C.left + C.width / 2 - A.left;
    const cy = C.top + C.height / 2 - A.top;
    const dx = cx - sx;
    const dy = cy - sy;
    const dist = Math.hypot(dx, dy);
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;

    const W = Math.round(Math.min(110, Math.max(84, C.height * 0.36)));
    const handR = W * 0.4;
    const handOffset = handR + 8; // hand centre below the top of the element (matches pawSvg)
    const H = Math.ceil(dist + handOffset + 60);
    // y: translation along the arm axis. hand centre distance d from the start => y = H - d - handOffset
    const yAt = (d: number) => H - d - handOffset;
    const yHide = yAt(-handR * 1.4);
    const yReach = yAt(dist);

    const paw = document.createElement('div');
    paw.className = 'paw';
    paw.style.cssText = `left:${sx - W / 2}px;top:${sy - H}px;width:${W}px;height:${H}px;transform-origin:50% 100%;`;
    paw.innerHTML = pawSvg(W, H);
    fx.appendChild(paw);

    const T = item === 'bee' ? 1150 : 1000;
    const t = (a: number, y: number) => `rotate(${a}deg) translateY(${y}px)`;
    const frames: Keyframe[] = [
      { transform: t(angle, yHide), offset: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
      { transform: t(angle, yReach), offset: 0.26 },
    ];
    if (item === 'bee') {
      [8, -8, 6, -5, 0].forEach((j, i) =>
        frames.push({ transform: t(angle + j, yReach), offset: 0.3 + i * 0.05, easing: 'linear' }),
      );
      frames.push({ transform: t(angle, yReach), offset: 0.56 });
    } else {
      frames.push({ transform: t(angle, yReach), offset: 0.5 });
    }
    frames.push({ transform: t(angle, yHide), offset: 1, easing: 'ease-in' });
    const anim = paw.animate(frames, { duration: T, fill: 'forwards' });
    anim.onfinish = () => paw.remove();

    // the item rides with the paw (honey), or the bee flies off after stinging
    const art = itemEl.firstElementChild as HTMLElement | null;
    if (art) {
      if (item === 'honey') {
        const back = (dist + handR * 1.4) / dist;
        itemEl.animate(
          [
            { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
            { transform: 'translate(0,0) scale(1.06)', opacity: 1, offset: 0.26 },
            { transform: 'translate(0,0) scale(1.06)', opacity: 1, offset: 0.5 },
            { transform: `translate(${-dx * back}px,${-dy * back}px) scale(.8)`, opacity: 1, offset: 0.92 },
            { transform: `translate(${-dx * back}px,${-dy * back}px) scale(.8)`, opacity: 0, offset: 1 },
          ],
          { duration: T, fill: 'forwards' },
        );
      } else {
        itemEl.animate(
          [
            { transform: 'translate(0,0) rotate(0)', opacity: 1, offset: 0 },
            { transform: 'translate(0,0) rotate(0)', opacity: 1, offset: 0.6 },
            { transform: 'translate(30%,-140%) rotate(24deg) scale(.5)', opacity: 0, offset: 1 },
          ],
          { duration: T, fill: 'forwards' },
        );
      }
    }
  }

  // ---------- feedback ----------
  function restart(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth; // restart CSS animation
    el.classList.add(cls);
  }

  function floatText(player: number, text: string, bad: boolean): void {
    const f = document.createElement('span');
    f.className = `float ${bad ? 'bad' : 'good'}`;
    f.textContent = text;
    pads[player].querySelector('.pad-inner')!.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
  }

  function renderPips(): void {
    const s = game.getState();
    pads.forEach((pad, p) => {
      if (!pad) return;
      const pips = pad.querySelectorAll<HTMLElement>('.pips i');
      pips.forEach((pip, i) => {
        const on = i < s.scores[p];
        if (on && !pip.classList.contains('on')) restart(pip, 'bump');
        pip.classList.toggle('on', on);
      });
    });
    arena.dataset.scores = s.scores.join(',');
  }

  function flashRing(player: number, bad: boolean): void {
    ringEl.style.setProperty('--pc', bad ? '#ff3b30' : COLORS[player]);
    restart(ringEl, 'flash');
  }

  // ---------- input ----------
  function onTap(player: number, eventTime: number): void {
    ctx.sound.unlock();
    if (paused || !overlay.hidden) return;
    // use the moment the finger landed (event timestamp), not when this code runs,
    // so near-simultaneous grabs are judged fairly
    const real = performance.now();
    const t = toGame(eventTime > 0 && eventTime <= real && real - eventTime < 500 ? eventTime : real);
    const before = game.getState();
    const r = game.tap(player, t);
    const pad = pads[player];
    switch (r.kind) {
      case 'early':
        restart(pad, 'poke');
        ctx.sound.play('tick');
        break;
      case 'tired':
        restart(pad, 'poke');
        ctx.sound.play('tired');
        break;
      case 'blocked':
        restart(pad, 'nope');
        break;
      case 'grab': {
        if (shownRound !== before.round || !itemEl.firstElementChild) showItem(r.item, false);
        playPaw(player, r.item);
        flashRing(player, r.item === 'bee');
        floatText(player, r.item === 'honey' ? '+1' : r.delta < 0 ? '-1' : 'Ouch!', r.item === 'bee');
        later(() => ctx.sound.play(r.item === 'honey' ? 'honey' : 'sting'), 260);
        later(renderPips, 260);
        if (r.item === 'bee') later(() => restart(pad, 'stung'), 260);
        if (r.won) later(() => showWin(player), 1250);
        break;
      }
      default:
        break;
    }
  }

  pads.forEach((pad, p) => {
    if (!pad) return;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onTap(p, e.timeStamp);
    });
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---------- overlays ----------
  function showWin(winner: number): void {
    ctx.sound.play('win');
    const name = NAMES[winner];
    overlay.hidden = false;
    overlay.className = 'overlay win-overlay';
    overlay.style.setProperty('--pc', COLORS[winner]);
    overlay.innerHTML = `
      <div class="win-text flip">${name} wins!</div>
      <div class="win-mid">
        <div class="win-bear"><span class="crown">${CROWN}</span>${BEAR}</div>
        <div class="win-actions">
          <button class="btn primary" data-act="rematch">Play again</button>
          <button class="btn" data-act="menu">Menu</button>
        </div>
      </div>
      <div class="win-text">${name} wins!</div>`;
    confetti(COLORS[winner]);
  }

  /** Burst of hexagons in the winner's color and honey gold, falling from the middle. */
  function confetti(color: string): void {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = reduce ? 0 : 36;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      const a = Math.random() * Math.PI * 2;
      const r = 120 + Math.random() * 220;
      c.style.cssText =
        `--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;--r:${Math.random() * 540 - 270}deg;` +
        `--s:${0.6 + Math.random() * 0.9};background:${i % 3 === 0 ? '#f5a623' : color};` +
        `animation-delay:${Math.random() * 120}ms`;
      c.addEventListener('animationend', () => c.remove());
      overlay.appendChild(c);
    }
  }

  function showPause(): void {
    overlay.hidden = false;
    overlay.className = 'overlay pause-overlay';
    overlay.innerHTML = `
      <div class="pause-card">
        <h2>Paused</h2>
        <button class="btn primary" data-act="resume">Resume</button>
        <button class="btn" data-act="restart">Restart</button>
        <button class="btn" data-act="menu">Menu</button>
      </div>`;
  }

  function resetUi(): void {
    // drop pending effects from the previous game (e.g. a scheduled win screen)
    timers.forEach((id) => clearTimeout(id));
    timers.length = 0;
    clearCenter();
    overlay.querySelectorAll('.confetti').forEach((c) => c.remove());
    fx.innerHTML = '';
    pads.forEach((pad) => pad?.classList.remove('tired', 'stung', 'poke', 'nope'));
    renderPips();
    overlay.hidden = true;
    overlay.innerHTML = '';
    shownRound = -1;
    prevPhase = game.getState().phase;
    prevRound = game.getState().round;
  }

  function setPaused(p: boolean): void {
    if (p === paused) return;
    paused = p;
    const anims = arena.getAnimations({ subtree: true });
    if (p) {
      pauseStart = performance.now();
      anims.forEach((a) => a.pause());
      showPause();
    } else {
      pausedTotal += performance.now() - pauseStart;
      anims.forEach((a) => a.play());
      overlay.hidden = true;
      overlay.innerHTML = '';
    }
  }

  overlay.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    ctx.sound.unlock();
    switch (btn.dataset.act) {
      case 'resume':
        setPaused(false);
        break;
      case 'restart':
      case 'rematch':
        if (paused) setPaused(false);
        game.reset(now());
        resetUi();
        break;
      case 'menu':
        ctx.exit();
        break;
    }
  });

  pauseBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!overlay.hidden || game.getState().phase === 'over') return; // win screen is showing or coming
    setPaused(true);
  });

  const onVisibility = () => {
    if (document.hidden && overlay.hidden && game.getState().phase !== 'over') setPaused(true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- main loop ----------
  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const t = now();
    game.tick(t);
    const s = game.getState();

    if (s.phase !== prevPhase || s.round !== prevRound) {
      if (s.phase === 'waiting') {
        clearCenter();
      } else if (s.phase === 'showing' && s.item) {
        showItem(s.item, true);
      } else if (s.phase === 'resolved' && s.outcome && s.outcome.player === null && prevPhase === 'showing') {
        leaveItem(s.outcome.item);
      }
      prevPhase = s.phase;
      prevRound = s.round;
    }

    arena.dataset.phase = s.phase;
    arena.dataset.item = s.phase === 'showing' ? (s.item ?? '') : '';
    for (let p = 0; p < players; p++) {
      const pad = pads[p];
      if (!pad) continue;
      const tired = game.isTired(p, t);
      if (tired !== pad.classList.contains('tired')) pad.classList.toggle('tired', tired);
      if (tired) {
        const bar = pad.querySelector<HTMLElement>('.bar i')!;
        bar.style.transform = `scaleX(${game.tiredLeft(p, t) / game.config.tiredMs})`;
      }
    }
  }
  renderPips();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      document.removeEventListener('visibilitychange', onVisibility);
      root.innerHTML = '';
    },
  };
}

export const beeOrHoneyGame: GameDef = {
  id: 'bee-or-honey',
  name: 'Bee or Honey',
  tagline: 'Grab the honey, dodge the bee. First to the target wins.',
  art: HONEY_JAR,
  rules: [
    'Lay the device flat between you. Each player gets a pad.',
    'Honey jar: tap first for +1.',
    'Angry bee: hands off, it stings for −1.',
    'Spam taps before anything shows and your paw gets tired for 3 s.',
  ],
  options: [
    { id: 'players', label: 'Players', values: [2, 3, 4], default: 4 },
    { id: 'target', label: 'Points to win', values: [3, 5, 7], default: 3 },
  ],
  mount,
};
