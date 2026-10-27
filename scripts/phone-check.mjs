// Phone-sized browser check:  npm run build && npm run check
// Serves dist/ with `vite preview`, drives it with Playwright in an iPhone-sized touch viewport,
// plays real rounds (seeded) and saves screenshots to shots/ in light and dark.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = 'shots';
mkdirSync(SHOTS, { recursive: true });

const candidates = [
  '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-linux/headless_shell',
];
const executablePath = process.env.CHROMIUM_PATH ?? candidates.find((p) => existsSync(p));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const failures = [];
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failures.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('preview server did not start');
}

const attr = (page, name) => page.locator('.arena').getAttribute(name);

async function waitShowing(page, timeout = 8000) {
  await page.waitForSelector('.arena[data-phase="showing"]', { timeout });
  return attr(page, 'data-item');
}
async function waitPhase(page, phase, timeout = 8000) {
  await page.waitForSelector(`.arena[data-phase="${phase}"]`, { timeout });
}
async function tapPad(page, p) {
  const box = await page.locator(`.pad[data-p="${p}"]`).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
/** Wait for the next item of a given kind (letting other items time out). */
async function waitItem(page, kind) {
  for (let i = 0; i < 40; i++) {
    const item = await waitShowing(page, 15000);
    if (item === kind) return;
    await waitPhase(page, 'resolved', 5000);
    await waitPhase(page, 'waiting', 5000);
  }
  throw new Error('never saw ' + kind);
}
const scores = async (page) => (await attr(page, 'data-scores')).split(',').map(Number);

async function startGame(page, players, target = 3, seed = 7) {
  await page.goto(`${BASE}?seed=${seed}`);
  await page.click('[data-game="bee-or-honey"]');
  await page.click(`[data-opt="players"][data-val="${players}"]`);
  await page.click(`[data-opt="target"][data-val="${target}"]`);
  await page.click('[data-start]');
  await page.waitForSelector('.arena');
}

async function noPageScroll(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollHeight <= window.innerHeight + 1 &&
      document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
}

async function run(browser, scheme) {
  console.log(`\n=== ${scheme} · iPhone 390x844 ===`);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // menu + setup
  await page.goto(`${BASE}?seed=7`);
  await page.waitForSelector('.home');
  check(`[${scheme}] home has Bee or Honey card`, (await page.locator('[data-game="bee-or-honey"]').count()) === 1);
  check(`[${scheme}] home does not scroll the page`, await noPageScroll(page));
  await page.screenshot({ path: `${SHOTS}/${scheme}-1-home.png` });
  await page.click('[data-game="bee-or-honey"]');
  await page.screenshot({ path: `${SHOTS}/${scheme}-2-setup.png` });

  // 4-player game
  await startGame(page, 4, 3, 7);
  check(`[${scheme}] 4 pads rendered`, (await page.locator('.pad').count()) === 4);
  check(`[${scheme}] arena does not scroll the page`, await noPageScroll(page));
  const padBoxes = await page.locator('.pad').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  check(
    `[${scheme}] pads big enough to tap and inside screen`,
    padBoxes.every((b) => b.width > 120 && b.height > 120 && b.left >= 0 && b.right <= 390 && b.top >= 0 && b.bottom <= 844),
  );
  await waitPhase(page, 'waiting');
  await page.screenshot({ path: `${SHOTS}/${scheme}-3-waiting.png` });

  // early taps do nothing bad (two are tolerated)
  await tapPad(page, 3);
  await sleep(120);
  check(`[${scheme}] a single early tap doesn't tire the hand`, (await page.locator('.pad[data-p="3"].tired').count()) === 0);

  // grab honey with player 0
  await waitItem(page, 'honey');
  await page.screenshot({ path: `${SHOTS}/${scheme}-4-honey.png` });
  await tapPad(page, 0);
  await sleep(330);
  await page.screenshot({ path: `${SHOTS}/${scheme}-5-paw-honey.png` });
  await sleep(200);
  check(`[${scheme}] honey gives +1`, (await scores(page))[0] === 1, JSON.stringify(await scores(page)));

  // sting: player 0 grabs a bee -> back to 0, others unchanged
  await waitItem(page, 'bee');
  await page.screenshot({ path: `${SHOTS}/${scheme}-6-bee.png` });
  await tapPad(page, 0);
  await sleep(380);
  await page.screenshot({ path: `${SHOTS}/${scheme}-7-paw-bee.png` });
  await sleep(150);
  check(`[${scheme}] bee gives -1`, (await scores(page))[0] === 0, JSON.stringify(await scores(page)));

  // spam: tired hand + lockout
  await waitPhase(page, 'waiting', 6000);
  for (let i = 0; i < 4; i++) {
    await tapPad(page, 2);
    await sleep(60);
  }
  await page.waitForSelector('.pad[data-p="2"].tired', { timeout: 2000 }).catch(() => {});
  check(`[${scheme}] spamming makes the hand tired`, (await page.locator('.pad[data-p="2"].tired').count()) === 1);
  await page.screenshot({ path: `${SHOTS}/${scheme}-8-tired.png` });
  // a tired player can't grab: next item, tap with tired player 2 -> no score
  const sBefore = await scores(page);
  const item = await waitShowing(page, 15000);
  await tapPad(page, 2);
  await sleep(250);
  check(`[${scheme}] tired player can't grab (${item})`, (await scores(page))[2] === sBefore[2]);
  // rested hand after ~3 s
  await sleep(3200);
  check(`[${scheme}] hand recovers`, (await page.locator('.pad[data-p="2"].tired').count()) === 0);

  // pause overlay
  await page.touchscreen.tap(30, 422);
  await page.waitForSelector('.pause-overlay', { timeout: 2000 });
  await page.screenshot({ path: `${SHOTS}/${scheme}-9-pause.png` });
  await page.click('[data-act="resume"]');
  check(`[${scheme}] resume closes the pause overlay`, (await page.locator('.overlay:not([hidden])').count()) === 0);

  // play to a win with player 1
  for (let i = 0; i < 3; i++) {
    await waitItem(page, 'honey');
    await tapPad(page, 1);
    await sleep(250);
  }
  await page.waitForSelector('.win-overlay', { timeout: 4000 });
  await sleep(700); // let confetti fly
  await page.screenshot({ path: `${SHOTS}/${scheme}-10-win.png` });
  await page.touchscreen.tap(30, 422);
  await sleep(150);
  check(`[${scheme}] pause is blocked on the win screen`, (await page.locator('.pause-overlay').count()) === 0);
  const winText = await page.locator('.win-text').last().innerText();
  check(`[${scheme}] win screen names the winner`, winText.includes('Blue wins'), winText);
  await page.click('[data-act="rematch"]');
  await sleep(200);
  check(`[${scheme}] rematch resets scores`, (await scores(page)).every((s) => s === 0));
  await page.click('.pause-btn', { force: true }).catch(() => {});
  await page.waitForSelector('[data-act="menu"]', { timeout: 2000 });
  await page.click('[data-act="menu"]');
  await page.waitForSelector('.home');
  check(`[${scheme}] menu button returns home`, true);

  // 2 and 3 players layouts
  for (const n of [2, 3]) {
    await startGame(page, n, 3, 9);
    check(`[${scheme}] ${n} pads for ${n} players`, (await page.locator('.pad').count()) === n);
    await page.screenshot({ path: `${SHOTS}/${scheme}-11-${n}players.png` });
  }

  check(`[${scheme}] no console/page errors`, errors.length === 0, errors.join(' | '));
  await context.close();
}

async function runIpad(browser) {
  console.log('\n=== dark · iPad 820x1180 ===');
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await startGame(page, 4, 3, 7);
  await waitItem(page, 'honey');
  await page.screenshot({ path: `${SHOTS}/ipad-honey.png` });
  check('[ipad] arena does not scroll the page', await noPageScroll(page));
  await context.close();
}

async function runLandscape(browser) {
  console.log('\n=== light · iPhone landscape 844x390 ===');
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await startGame(page, 4, 3, 7);
  await waitItem(page, 'bee');
  await page.screenshot({ path: `${SHOTS}/landscape-bee.png` });
  check('[landscape] arena does not scroll the page', await noPageScroll(page));
  const boxes = await page.locator('.pad').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  check('[landscape] pads at least 80px tall', boxes.every((b) => b.height >= 80), boxes.map((b) => Math.round(b.height)).join(','));
  await context.close();
}

async function runOffline(browser) {
  console.log('\n=== offline ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.home');
  // wait for the service worker to take control and finish precaching
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await sleep(1500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.home', { timeout: 5000 }).catch(() => {});
  check('[offline] app loads from cache without network', (await page.locator('.home').count()) === 1);
  await context.close();
}

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  await run(browser, 'dark');
  await run(browser, 'light');
  await runIpad(browser);
  await runLandscape(browser);
  await runOffline(browser);
  await browser.close();
} catch (e) {
  console.error(e);
  failures.push('script crashed: ' + e.message);
} finally {
  server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
