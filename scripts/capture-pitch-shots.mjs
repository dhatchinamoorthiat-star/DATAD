/**
 * Capture the screenshots the /pitch walkthrough plays.
 *
 * The audit screenshots in audit/screenshots/ are unusable here — every
 * authenticated route in that set is really a picture of the login page, because
 * the run had no session. This script needs a session, so the frames show the
 * actual product.
 *
 * Which account you use shows in the output. A free-tier account photographs
 * its own paywall: /career/questions is a "Unlock with DATAD Pro" card and Dax
 * leads with a maintenance notice, neither of which is what the pitch is
 * claiming. Capture from an account on the plan you are selling.
 *
 * Two steps, so no password is ever passed to this script:
 *
 *   1. node scripts/capture-pitch-shots.mjs --login
 *      Opens a real browser window. Sign in yourself, and the session is
 *      written to .pitch-session.json (gitignored) once you land past /login.
 *
 *   2. PITCH_BASE_URL=http://localhost:5173 node scripts/capture-pitch-shots.mjs
 *      Reuses that session and takes the eight shots.
 *
 * The saved session expires like any other, so step 1 comes round again
 * whenever step 2 reports that the shots bounced to /login.
 *
 * Output lands in client/public/pitch/ under the exact file names
 * client/src/pages/pitch/pitchScenes.js expects.
 */
import { chromium } from 'playwright';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client', 'public', 'pitch');
// One session file per account, so the two logins can coexist: the paid-tier
// account is the only one that shows the résumé and question bank as anything
// other than a paywall, and the seeded demo account is the only one with notes
// and a term of spending to photograph. Neither is right for all eight shots.
const SESSION = path.resolve(ROOT, process.env.PITCH_SESSION || '.pitch-session.json');

const BASE = process.env.PITCH_BASE_URL || 'http://localhost:5173';
const LOGIN_MODE = process.argv.includes('--login');

// Comma-separated file names, to re-take part of the set from a second account
// without overwriting the frames the first one got right.
const ONLY = (process.env.PITCH_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
const wanted = (file) => ONLY.length === 0 || ONLY.includes(file);

// file name -> route. Keep in sync with pitchScenes.js.
const SHOTS = [
  ['briefing.png', '/briefing'],
  ['study.png', '/study/notes'],
  ['career.png', '/career/resume'],
  ['interviews.png', '/career/questions'],
  ['dax.png', '/dax'],
  ['finance.png', '/me/finance'],
  ['community.png', '/community'],
];

// The mobile scene is the same app at phone width, so it gets its own context.
const MOBILE_SHOT = ['mobile.png', '/briefing'];

const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900);
};

// A route entered straight after another one sometimes photographs its own
// failure state: the in-flight fetch is cancelled by the navigation and the
// page settles on "Could not load ...". The data is fine — a plain reload gets
// the real screen — so look for that copy and give the route one more go rather
// than shipping a broken-looking frame into the pitch.
const FAILED = /Could not load|Something went wrong|Try again/i;

const settleWithRetry = async (page) => {
  await settle(page);
  const body = await page.innerText('body').catch(() => '');
  if (!FAILED.test(body)) return;
  console.warn('  retrying — first paint showed an error state');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
};

// The PWA install card floats over the bottom-right of every page until it is
// dismissed, and it lands squarely on top of content in a 1440x900 frame. Its
// own dismissal is a localStorage flag, so setting it up front keeps the card
// out of all eight shots without touching the component.
const PWA_DISMISSED_KEY = 'datad-pwa-install-dismissed';

// The app remembers its own theme, so the shots follow whichever one the
// account you signed in as happens to be using. That is how a set of light
// frames ended up inside the dark /pitch player. Pin it instead; the context's
// colorScheme option does not reach this, it only sets prefers-color-scheme.
const THEME = process.env.PITCH_THEME === 'light' ? 'light' : 'dark';

// Step one. A headed browser, and a human at the keyboard: the password goes
// into the real login form and never into this script, its arguments or the
// shell history. Playwright's storageState carries the session to step two.
async function login() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

  console.log('Sign in in the browser window. Waiting...');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 5 * 60 * 1000 });
  await settle(page);

  await context.storageState({ path: SESSION });
  await browser.close();
  console.log(`Session saved to ${SESSION}\nNow run the capture without --login.`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    storageState: SESSION,
  });
  const page = await desktop.newPage();
  // The install card is dismissed by a localStorage flag, and localStorage is
  // per-origin, so one visit is enough to set it for every shot that follows.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, theme]) => {
    localStorage.setItem(k, '1');
    localStorage.setItem('theme', theme);
  }, [PWA_DISMISSED_KEY, THEME]);

  for (const [file, route] of SHOTS.filter(([f]) => wanted(f))) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await settleWithRetry(page);
    if (page.url().includes('/login')) {
      console.warn(`! ${route} bounced to /login — skipping ${file}`);
      continue;
    }
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`captured ${file}  <- ${route}`);
  }

  if (!wanted(MOBILE_SHOT[0])) {
    await browser.close();
    console.log(`\nDone. ${OUT}`);
    return;
  }

  const mobile = await desktop.newPage();
  await mobile.setViewportSize({ width: 430, height: 932 });
  await mobile.goto(`${BASE}${MOBILE_SHOT[1]}`, { waitUntil: 'domcontentloaded' });
  await settleWithRetry(mobile);
  await mobile.screenshot({ path: path.join(OUT, MOBILE_SHOT[0]) });
  console.log(`captured ${MOBILE_SHOT[0]}  <- ${MOBILE_SHOT[1]} (mobile)`);

  await browser.close();
  console.log(`\nDone. ${OUT}`);
}

async function run() {
  if (LOGIN_MODE) return login();

  try {
    await access(SESSION);
  } catch {
    console.error(`No saved session at ${SESSION}.\nRun: node scripts/capture-pitch-shots.mjs --login`);
    process.exit(1);
  }
  return main();
}

run().catch((err) => { console.error(err); process.exit(1); });
