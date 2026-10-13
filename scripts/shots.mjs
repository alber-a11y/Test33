// Screenshot automation: node scripts/shots.mjs <baseUrl> <outDir> [scenario]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shots';
const only = process.argv[4];

const devices = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const logs = [];
async function page(dev, query = '', save = null) {
  const ctx = await browser.newContext(devices[dev]);
  if (save) await ctx.addInitScript((s) => localStorage.setItem('capytwist.save.v1', s), JSON.stringify(save));
  const p = await ctx.newPage();
  p.on('console', (m) => logs.push(`[${dev}] ${m.type()}: ${m.text()}`));
  p.on('pageerror', (e) => logs.push(`[${dev}] PAGEERROR: ${e.message}`));
  await p.goto(base + query);
  await p.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await p.waitForTimeout(900);
  return { ctx, p };
}
const SAVE = { v: 1, level: 27, coins: 1840, stars: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [i + 1, (i % 3) + 1])), basket: 6, settings: { lang: process.env.LANG_UI || 'ru', musicOn: false, sfxOn: false, music: 0.7, sfx: 0.9, vibro: true }, daily: { last: '', streak: 2 } };

async function tapSuggested(p) {
  const pt = await p.evaluate(() => {
    const g = window.__capy.game;
    const b = g.board;
    if (!b) return null;
    if (b.level.mode === 'path') {
      const wrong = b.wrongCells().filter((i) => !b.level.cells[i].locked);
      return wrong.length ? b.center(wrong[0]) : null;
    }
    const res = b.nextMoves();
    if (!res || !res.length) return null;
    const m = res[0];
    const ws = b.sim.world(b.rots);
    const S = ws.segs[m.piece];
    let best = null, bd = -1;
    for (let k = 0; k < S.length; k += 2) {
      const d = Math.hypot(S[k] - ws.px[m.piece], S[k + 1] - ws.py[m.piece]);
      if (d > bd) { bd = d; best = [S[k], S[k + 1]]; }
    }
    // drag in the solution direction around the hinge
    const hx = ws.px[m.piece], hy = ws.py[m.piece];
    const a0 = Math.atan2(best[1] - hy, best[0] - hx);
    const a1 = a0 + m.dir * 0.6;
    const r = bd * 0.9;
    const P = (a) => ({ x: b.ox + (hx + Math.cos(a) * r) * b.S, y: b.oy + (hy + Math.sin(a) * r) * b.S });
    return { drag: [P(a0), P(a0 + m.dir * 0.3), P(a1)] };
  });
  if (!pt) return false;
  if (pt.drag) {
    await p.mouse.move(pt.drag[0].x, pt.drag[0].y);
    await p.mouse.down();
    await p.mouse.move(pt.drag[1].x, pt.drag[1].y, { steps: 4 });
    await p.mouse.move(pt.drag[2].x, pt.drag[2].y, { steps: 4 });
    await p.mouse.up();
  } else await p.mouse.click(pt.x, pt.y);
  return true;
}

const scenarios = {
  async play(dev) {
    const n = Number(process.env.PLAY || 1);
    const { ctx, p } = await page(dev, `?level=${n}`, { ...SAVE, level: Math.max(n, 27), tips: {} });
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/${dev}-play${n}-start.png` });
    for (let i = 0; i < 60; i++) {
      const st = await p.evaluate(() => window.__capy.game.state);
      if (st !== 'play') break;
      const ok = await tapSuggested(p);
      if (!ok) break;
      await p.waitForTimeout(420);
      if (i === 1) await p.screenshot({ path: `${out}/${dev}-play${n}-mid.png` });
    }
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${out}/${dev}-play${n}-win.png` });
    const st = await p.evaluate(() => window.__capy.game.state);
    logs.push(`[${dev}] play ${n} -> state ${st}`);
    await ctx.close();
  },
  async menu(dev) { const { ctx, p } = await page(dev, '', SAVE); await p.screenshot({ path: `${out}/${dev}-menu.png` }); await ctx.close(); },
  async map(dev) { const { ctx, p } = await page(dev, '?screen=map', SAVE); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${dev}-map.png` }); await ctx.close(); },
  async shop(dev) { const { ctx, p } = await page(dev, '?screen=shop', SAVE); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${dev}-shop.png` }); await ctx.close(); },
  async shopHats(dev) { const { ctx, p } = await page(dev, '?screen=shop&tab=hats', SAVE); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${dev}-shop-hats.png` }); await ctx.close(); },
  async shopBgs(dev) { const { ctx, p } = await page(dev, '?screen=shop&tab=bgs', SAVE); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${dev}-shop-bgs.png` }); await ctx.close(); },
  async settings(dev) { const { ctx, p } = await page(dev, '?screen=settings', SAVE); await p.screenshot({ path: `${out}/${dev}-settings.png` }); await ctx.close(); },
  async levels(dev) {
    for (const n of (process.env.LEVELS || '1,4,6,12,19,20,25,30').split(',').map(Number)) {
      const { ctx, p } = await page(dev, `?level=${n}`, { ...SAVE, level: Math.max(n, 27), tips: { path: true, free: true, lock: true, bomb: true, link: true, colors: true } });
      await p.waitForTimeout(2600);
      await p.screenshot({ path: `${out}/${dev}-level${n}.png` });
      await ctx.close();
    }
  },
};

for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const dev of (process.env.DEV || 'phone,pc').split(',')) {
    try { await fn(dev); } catch (e) { logs.push(`[${dev}] ${name} FAILED: ${e.message}`); }
  }
}
await browser.close();
console.log(logs.filter((l) => !l.includes('[ads]')).slice(0, 60).join('\n'));
