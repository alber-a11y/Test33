import { Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { Ease } from '../core/tween';
import type { Prim } from './free';
import { fx } from '../render/fx';
import { drawFlow, drawShadow, scalePrims, shade } from '../render/skins';
import { stage } from '../render/stage';
import { tex } from '../render/textures';
import type { Board, BoardHost, Rect } from './board';
import {
  type FlowResult,
  type PathCell,
  type PathLevel,
  BASE_CHANNELS,
  DIRS,
  DX,
  DY,
  OPP,
  PERIOD,
  canRotate,
  channels,
  computeFlow,
  linkedGroup,
} from './path';

const HALF = Math.PI / 2;

/** Primitives per channel in unit cell coords (cell centred at 0,0). */
function kindPrims(kind: PathCell['kind']): Prim[][] {
  const L = (x1: number, y1: number, x2: number, y2: number): Prim => ({ t: 'line', x1, y1, x2, y2 });
  const NE: Prim = { t: 'arc', cx: 0.5, cy: -0.5, r: 0.5, a0: HALF, a1: Math.PI };
  const SW: Prim = { t: 'arc', cx: -0.5, cy: 0.5, r: 0.5, a0: -HALF, a1: 0 };
  switch (kind) {
    case 'I':
      return [[L(0, -0.5, 0, 0.5)]];
    case 'L':
      return [[NE]];
    case 'T':
      return [[L(-0.5, 0, 0.5, 0), L(0, 0, 0, -0.5)]];
    case 'X':
      return [[L(-0.5, 0, 0.5, 0), L(0, -0.5, 0, 0.5)]];
    case 'E':
      return [[L(0, -0.5, 0, -0.05)]];
    case 'S':
    case 'G':
      return [[L(0, -0.5, 0, -0.02)]];
    case 'D':
      return [[NE], [SW]];
    case 'B':
      return [[L(0, -0.5, 0, 0.5)], [L(-0.5, 0, 0.5, 0)]];
  }
}

const LINK_COLORS = [0xff6fb1, 0x45c4ff, 0xffc94a, 0x7be07b];
const MIX = 0x9a8c7a;

interface CellView {
  idx: number;
  c: Container;
  sh: Container;
  flows: Graphics[];
  angle: number;
  lit: number[];
}

export class PathBoard implements Board {
  root = new Container();
  private shadow = new Container();
  private cellsLayer = new Container();
  private couplings = new Graphics();
  private overlay = new Container();
  private hintLayer = new Container();
  private views: (CellView | null)[] = [];
  private cell = 60;
  private ox = 0;
  private oy = 0;
  private flow: FlowResult;
  private history: number[][] = [];
  private reachedOnce = new Set<number>();
  private goalsOk = new Set<number>();
  private bombTexts = new Map<number, Text>();
  private bombSprites = new Map<number, Sprite>();
  private bonusSprites = new Map<number, Sprite>();
  private goalSprites = new Map<number, Sprite>();
  private clampSprites = new Map<number, Sprite>();
  private pending = 0;
  private time = 0;
  private offUpdate: () => void;
  private fuse: number | null = null;
  private frozen = false;
  private won = false;

  constructor(
    public level: PathLevel,
    private host: BoardHost,
  ) {
    this.shadow.alpha = 0.18;
    this.root.addChild(this.shadow, this.cellsLayer, this.couplings, this.overlay, this.hintLayer);
    this.flow = computeFlow(level);
    this.offUpdate = stage.onUpdate((dt) => this.update(dt));
  }

  private get colorsOf(): number[] {
    return this.level.colors > 1 ? this.host.skin.flows : [this.host.skin.flow];
  }

  layout(rect: Rect): void {
    const { w, h } = this.level;
    this.cell = Math.floor(Math.min(rect.w / w, rect.h / h, 118));
    this.ox = rect.x + (rect.w - this.cell * w) / 2;
    this.oy = rect.y + (rect.h - this.cell * h) / 2;
    this.build();
  }

  private center(idx: number): { x: number; y: number } {
    const x = idx % this.level.w;
    const y = Math.floor(idx / this.level.w);
    return { x: this.ox + (x + 0.5) * this.cell, y: this.oy + (y + 0.5) * this.cell };
  }

  private build(): void {
    for (const l of [this.shadow, this.cellsLayer, this.overlay]) l.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.bombTexts.clear();
    this.bombSprites.clear();
    this.bonusSprites.clear();
    this.goalSprites.clear();
    this.clampSprites.clear();
    const skin = this.host.skin;
    const S = this.cell;
    const tw = S * 0.25;
    this.views = this.level.cells.map((cell, idx) => {
      if (!cell) return null;
      const { x, y } = this.center(idx);
      const c = new Container();
      c.position.set(x, y);
      const sh = new Container();
      sh.position.set(x, y + S * 0.07);
      const chPrims = kindPrims(cell.kind).map((ps) => scalePrims(ps, S));
      const all = chPrims.flat();
      const color = cell.kind === 'S' || cell.kind === 'G' ? this.colorsOf[cell.color ?? 0] : skin.palette[cell.hue % skin.palette.length];
      const body = new Graphics();
      if (cell.kind === 'B') {
        // under-pass first, then over-pass with a gap shadow
        skin.body(body, chPrims[1], color, tw, idx * 7 + 3);
        body.moveTo(0, -S * 0.22).lineTo(0, S * 0.22).stroke({ width: tw * 1.6, color: 0x000000, alpha: 0.18, cap: 'round' });
        skin.body(body, chPrims[0], shade(color, 0.08), tw, idx * 7 + 5);
      } else {
        skin.body(body, all, color, tw, idx * 7 + 3);
      }
      if (cell.kind === 'E') {
        body.circle(0, -S * 0.05, tw * 0.62).fill(shade(color, -0.3));
        body.circle(0, -S * 0.05, tw * 0.45).fill(color);
        body.circle(-tw * 0.12, -S * 0.05 - tw * 0.12, tw * 0.15).fill({ color: 0xffffff, alpha: 0.6 });
      }
      c.addChild(body);
      const sg = new Graphics();
      drawShadow(sg, all, tw);
      if (cell.kind === 'E') sg.circle(0, -S * 0.05, tw * 0.62).fill(0x000000);
      sh.addChild(sg);
      const flows = chPrims.map((ps) => {
        const g = new Graphics();
        drawFlow(g, ps, 0xffffff, tw);
        if (cell.kind === 'E') g.circle(0, -S * 0.05, tw * 0.3).fill(0xffffff);
        g.alpha = 0;
        c.addChild(g);
        return g;
      });
      const angle = cell.rot * HALF;
      c.rotation = angle;
      sh.rotation = angle;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.hitArea = new Rectangle(-S / 2, -S / 2, S, S);
      c.on('pointertap', () => this.tap(idx));
      this.cellsLayer.addChild(c);
      this.shadow.addChild(sh);
      this.addOverlay(cell, idx, x, y);
      return { idx, c, sh, flows, angle, lit: BASE_CHANNELS[cell.kind].map(() => 0) };
    });
    // link markers
    const links = new Graphics();
    const groups = new Map<number, number[]>();
    this.level.cells.forEach((c, i) => c && c.link !== undefined && groups.set(c.link, [...(groups.get(c.link) ?? []), i]));
    for (const [id, members] of groups) {
      const col = LINK_COLORS[id % LINK_COLORS.length];
      for (let k = 1; k < members.length; k++) {
        const a = this.center(members[k - 1]);
        const b = this.center(members[k]);
        const n = 6;
        for (let j = 1; j < n; j++) {
          const t = j / n;
          links.circle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, S * 0.035).fill(col);
        }
      }
      for (const m of members) {
        const p = this.center(m);
        links.circle(p.x, p.y, S * 0.13).stroke({ width: S * 0.045, color: col });
        links.circle(p.x, p.y, S * 0.06).fill(col);
      }
    }
    this.overlay.addChildAt(links, 0);
    this.applyFlow(false);
  }

  private addOverlay(cell: PathCell, idx: number, x: number, y: number): void {
    const S = this.cell;
    if (cell.kind === 'S') {
      const col = this.colorsOf[cell.color ?? 0];
      const g = new Graphics();
      g.circle(x, y + S * 0.04, S * 0.3).fill({ color: 0x000000, alpha: 0.15 });
      g.circle(x, y, S * 0.3).fill(0xfdf6ec).stroke({ width: S * 0.04, color: shade(col, -0.35) });
      g.circle(x, y, S * 0.22).fill(col);
      g.circle(x - S * 0.07, y - S * 0.07, S * 0.07).fill({ color: 0xffffff, alpha: 0.7 });
      // droplet glyph
      const d = S * 0.1;
      g.moveTo(x, y - d * 1.3).quadraticCurveTo(x + d, y, x, y + d).quadraticCurveTo(x - d, y, x, y - d * 1.3).fill({ color: 0xffffff, alpha: 0.9 });
      this.overlay.addChild(g);
    } else if (cell.kind === 'G') {
      const col = this.colorsOf[cell.color ?? 0];
      const g = new Graphics();
      g.circle(x, y + S * 0.05, S * 0.36).fill({ color: 0x000000, alpha: 0.15 });
      g.circle(x, y, S * 0.36).fill({ color: 0xffffff, alpha: 0.55 }).stroke({ width: S * 0.05, color: col });
      this.overlay.addChild(g);
      const sp = new Sprite(tex(this.host.prize));
      sp.anchor.set(0.5);
      sp.width = sp.height = S * 0.52;
      sp.position.set(x, y);
      this.overlay.addChild(sp);
      const shine = new Graphics();
      shine.ellipse(x - S * 0.15, y - S * 0.17, S * 0.1, S * 0.05).fill({ color: 0xffffff, alpha: 0.7 });
      this.overlay.addChild(shine);
      this.goalSprites.set(idx, sp);
    }
    if (cell.bomb) {
      const sp = new Sprite(tex('bomb'));
      sp.anchor.set(0.5);
      sp.width = sp.height = S * 0.62;
      sp.position.set(x, y + S * 0.05);
      this.overlay.addChild(sp);
      this.bombSprites.set(idx, sp);
      const t = new Text({
        text: '',
        style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: Math.round(S * 0.24), fill: 0xffffff, stroke: { color: 0x3a1a0a, width: Math.max(3, S * 0.06) } },
      });
      t.anchor.set(0.5);
      t.position.set(x + S * 0.22, y - S * 0.22);
      this.overlay.addChild(t);
      this.bombTexts.set(idx, t);
    }
    if (cell.bonus && !this.reachedOnce.has(idx)) {
      const sp = new Sprite(tex(this.host.prize));
      sp.anchor.set(0.5);
      sp.width = sp.height = S * 0.42;
      sp.position.set(x, y + S * 0.08);
      this.overlay.addChild(sp);
      this.bonusSprites.set(idx, sp);
    }
    if (cell.locked) {
      const sp = new Sprite(tex('clamp'));
      sp.anchor.set(0.5);
      sp.width = sp.height = S * 0.36;
      sp.position.set(x + S * 0.3, y + S * 0.3);
      this.overlay.addChild(sp);
      this.clampSprites.set(idx, sp);
    }
    this.updateFuseTexts();
  }

  private tap(idx: number): void {
    if (this.won || !this.host.canInteract()) return;
    const view = this.views[idx];
    const cell = this.level.cells[idx];
    if (!view || !cell) return;
    this.clearHint();
    if (!canRotate(this.level, idx)) {
      this.host.sfx('blocked');
      this.host.vibrate(30);
      this.host.blocked();
      const g = linkedGroup(this.level, idx);
      for (const i of g) {
        const v = this.views[i];
        if (!v) continue;
        const base = v.angle;
        stage.tweens.run(0.3, (k) => {
          const a = base + Math.sin(k * Math.PI * 4) * 0.12 * (1 - k);
          v.c.rotation = a;
          v.sh.rotation = a;
        });
        const cl = this.clampSprites.get(i);
        if (cl) stage.tweens.run(0.3, (k) => (cl.rotation = Math.sin(k * Math.PI * 4) * 0.3 * (1 - k)));
      }
      return;
    }
    this.history.push(this.level.cells.map((c) => (c ? c.rot : 0)));
    if (this.history.length > 200) this.history.shift();
    this.rotateGroup(idx, 1, true);
  }

  private rotateGroup(idx: number, dir: number, counted: boolean): Promise<void> {
    const group = linkedGroup(this.level, idx);
    this.host.sfx('rotate');
    this.host.vibrate(8);
    this.pending++;
    // drop light immediately for rotating cells
    for (const i of group) {
      const cell = this.level.cells[i]!;
      cell.rot = (cell.rot + dir + 4) % 4;
      this.views[i]!.flows.forEach((f) => (f.alpha = 0));
    }
    const jobs = group.map((i) => {
      const v = this.views[i]!;
      const from = v.angle;
      v.angle = from + dir * HALF;
      const to = v.angle;
      stage.tweens.killTag(v);
      return stage.tweens.run(
        0.2,
        (k) => {
          const a = from + (to - from) * k;
          v.c.rotation = a;
          v.sh.rotation = a;
        },
        { ease: Ease.outBack, tag: v },
      );
    });
    return Promise.all(jobs).then(() => {
      this.pending--;
      if (this.pending > 0) return;
      const won = this.applyFlow(true);
      this.host.moveDone({ won, counted });
    });
  }

  /** Recompute flow and update visuals. Returns whether the level is won. */
  private applyFlow(animate: boolean): boolean {
    this.flow = computeFlow(this.level);
    const { lit, depth } = this.flow;
    const cols = this.colorsOf;
    let newlyLit = 0;
    this.views.forEach((v, idx) => {
      if (!v) return;
      v.flows.forEach((g, ch) => {
        const mask = lit[idx][ch] ?? 0;
        const was = v.lit[ch];
        v.lit[ch] = mask;
        if (!mask) {
          g.alpha = 0;
          return;
        }
        let color = MIX;
        for (let c = 0; c < cols.length; c++) if (mask === 1 << c) color = cols[c];
        g.tint = color;
        if (!was && animate) {
          newlyLit++;
          g.alpha = 0;
          stage.tweens.run(0.18, (k) => (g.alpha = k), { delay: Math.min(1.2, depth[idx][ch] * 0.035) });
        } else g.alpha = 1;
      });
    });
    if (animate && newlyLit > 0) this.host.sfx('flow');
    this.drawCouplings();
    // bombs & bonus reached
    for (const idx of this.flow.reached) {
      if (this.reachedOnce.has(idx)) continue;
      const cell = this.level.cells[idx];
      if (!cell) continue;
      if (cell.bomb || cell.bonus) {
        this.reachedOnce.add(idx);
        if (animate) this.collect(idx, cell.bomb ? 'bomb' : 'bonus');
      }
    }
    // goals
    let goalsAll = true;
    this.level.cells.forEach((c, idx) => {
      if (!c || c.kind !== 'G') return;
      const ok = lit[idx][0] === 1 << (c.color ?? 0);
      if (!ok) goalsAll = false;
      const sp = this.goalSprites.get(idx);
      if (ok && !this.goalsOk.has(idx)) {
        this.goalsOk.add(idx);
        if (animate && sp) {
          this.host.sfx('connect');
          const base = sp.scale.x;
          stage.tweens.run(0.4, (k) => sp.scale.set(base * (1 + Math.sin(k * Math.PI) * 0.35)));
          fx.burst(sp.x, sp.y, { count: 10, size: 14, speed: 160, gravity: 0, life: 0.5 });
        }
      } else if (!ok) this.goalsOk.delete(idx);
    });
    const bombsLeft = this.level.cells.some((c, i) => c?.bomb && !this.reachedOnce.has(i));
    const won = goalsAll && !bombsLeft;
    if (won) this.won = true;
    return won;
  }

  private collect(idx: number, kind: 'bomb' | 'bonus'): void {
    if (kind === 'bomb') {
      const sp = this.bombSprites.get(idx);
      const t = this.bombTexts.get(idx);
      if (sp) {
        this.host.sfx('magic');
        fx.burst(sp.x, sp.y, { count: 14, tex: 'bubble', colors: [0x8fd8ff, 0xffffff], speed: 180, gravity: -60 });
        stage.tweens.run(0.4, (k) => {
          sp.alpha = 1 - k;
          sp.scale.set(sp.scale.x * (1 - k * 0.02));
        });
      }
      if (t) t.visible = false;
      this.host.itemCollected('bomb');
    } else {
      const sp = this.bonusSprites.get(idx);
      if (sp) {
        this.host.sfx('prize');
        sp.visible = false;
        void fx.fly(tex(this.host.prize), { x: sp.x, y: sp.y }, this.host.basketPoint(), { size: sp.width });
      }
      this.host.itemCollected('bonus');
    }
  }

  private drawCouplings(): void {
    const g = this.couplings;
    g.clear();
    const { w, h, cells } = this.level;
    const S = this.cell;
    const chans = cells.map((c) => (c ? channels(c) : []));
    const cols = this.colorsOf;
    cells.forEach((c, idx) => {
      if (!c) return;
      const x = idx % w;
      const y = Math.floor(idx / w);
      for (const dir of [2, 4]) {
        // E, S neighbours only (each pair once)
        const nx = x + DX[dir];
        const ny = y + DY[dir];
        if (nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!cells[ni]) continue;
        const ch = chans[idx].findIndex((m) => m & dir);
        const nch = chans[ni].findIndex((m) => m & OPP[dir]);
        if (ch < 0 || nch < 0) continue;
        const lit = this.flow.lit[idx][ch] && this.flow.lit[ni][nch];
        const cx = this.ox + (x + 0.5) * S + DX[dir] * S * 0.5;
        const cy = this.oy + (y + 0.5) * S + DY[dir] * S * 0.5;
        const horiz = dir === 2;
        const bw = horiz ? S * 0.12 : S * 0.34;
        const bh = horiz ? S * 0.34 : S * 0.12;
        const mask = this.flow.lit[idx][ch];
        let col = 0xb9a58c;
        if (lit) {
          col = MIX;
          for (let k = 0; k < cols.length; k++) if (mask === 1 << k) col = cols[k];
        }
        g.roundRect(cx - bw / 2, cy - bh / 2 + S * 0.03, bw, bh, S * 0.04).fill({ color: 0x000000, alpha: 0.15 });
        g.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, S * 0.04).fill(lit ? shade(col, -0.15) : 0xd9c9b2);
        g.roundRect(cx - bw / 2 + 2, cy - bh / 2 + 2, bw - 4, bh * 0.35, S * 0.03).fill({ color: 0xffffff, alpha: 0.35 });
      }
    });
    void DIRS;
  }

  setFuse(n: number | null, frozen: boolean): void {
    this.fuse = n;
    this.frozen = frozen;
    this.updateFuseTexts();
  }

  private updateFuseTexts(): void {
    for (const [idx, t] of this.bombTexts) {
      if (this.reachedOnce.has(idx)) {
        t.visible = false;
        continue;
      }
      t.text = this.fuse === null ? '' : this.frozen ? '❄' : String(this.fuse);
      t.style.fill = this.frozen ? 0x9be7ff : this.fuse !== null && this.fuse <= 3 ? 0xff5252 : 0xffffff;
    }
  }

  private update(dt: number): void {
    this.time += dt;
    const pulse = 0.85 + Math.sin(this.time * 4) * 0.15;
    this.views.forEach((v) => {
      if (!v) return;
      v.flows.forEach((g, ch) => {
        if (v.lit[ch] && g.alpha > 0.5) g.alpha = pulse + 0.15;
      });
    });
    for (const [, sp] of this.bombSprites) {
      if (this.frozen) continue;
      sp.rotation = Math.sin(this.time * 9) * 0.06;
    }
    for (const [, sp] of this.bonusSprites) sp.y += Math.sin(this.time * 3 + sp.x) * 0.15;
    this.hintLayer.children.forEach((c, i) => {
      if (c.label === 'hand') c.y = (c as Sprite & { baseY: number }).baseY + Math.sin(this.time * 6) * 8;
      else c.alpha = 0.55 + Math.sin(this.time * 6 + i) * 0.35;
    });
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev || this.won) return false;
    this.clearHint();
    this.level.cells.forEach((c, i) => {
      if (!c) return;
      const d = (prev[i] - c.rot + 4) % 4;
      if (!d) return;
      c.rot = prev[i];
      const v = this.views[i]!;
      const from = v.angle;
      v.angle = from - (4 - d) * HALF;
      const to = v.angle;
      v.flows.forEach((f) => (f.alpha = 0));
      stage.tweens.run(0.22, (k) => {
        const a = from + (to - from) * k;
        v.c.rotation = a;
        v.sh.rotation = a;
      }, { ease: Ease.outCubic });
    });
    this.host.sfx('whoosh');
    stage.tweens.wait(0.24).then(() => this.applyFlow(true));
    this.host.undone();
    return true;
  }

  /** Essential cells currently off their solution. */
  private wrongCells(): number[] {
    const out: number[] = [];
    this.level.cells.forEach((c, i) => {
      if (!c || !c.essential || c.locked || c.fixed) return;
      const p = PERIOD[c.kind];
      if ((((c.rot - c.sol) % p) + p) % p !== 0) out.push(i);
    });
    // prefer cells closest to lit flow
    const litNear = (i: number) => {
      const x = i % this.level.w;
      const y = Math.floor(i / this.level.w);
      return DIRS.some((d) => {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= this.level.w || ny >= this.level.h) return false;
        return (this.flow.lit[ny * this.level.w + nx] ?? []).some((m) => m);
      });
    };
    return out.sort((a, b) => Number(litNear(b)) - Number(litNear(a)));
  }

  private tapsNeeded(i: number): number {
    const g = linkedGroup(this.level, i);
    for (let k = 1; k < 4; k++) {
      if (
        g.every((j) => {
          const c = this.level.cells[j]!;
          if (!c.essential) return true;
          const p = PERIOD[c.kind];
          return (((c.rot + k - c.sol) % p) + p) % p === 0;
        })
      )
        return k;
    }
    return 1;
  }

  hint(): boolean {
    const wrong = this.wrongCells().filter((i) => canRotate(this.level, i));
    if (!wrong.length) return false;
    this.showHintAt(wrong[0], this.tapsNeeded(wrong[0]));
    return true;
  }

  private showHintAt(idx: number, taps: number): void {
    this.clearHint();
    const { x, y } = this.center(idx);
    const S = this.cell;
    const ring = new Graphics();
    ring.roundRect(x - S * 0.48, y - S * 0.48, S * 0.96, S * 0.96, S * 0.2).stroke({ width: S * 0.07, color: 0xffe066 });
    this.hintLayer.addChild(ring);
    const hand = new Sprite(tex('hand')) as Sprite & { baseY: number };
    hand.anchor.set(0.3, 0.05);
    hand.width = hand.height = S * 0.75;
    hand.position.set(x + S * 0.05, y + S * 0.1);
    hand.baseY = hand.y;
    hand.label = 'hand';
    this.hintLayer.addChild(hand);
    if (taps > 1) {
      const t = new Text({
        text: `×${taps}`,
        style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: Math.round(S * 0.28), fill: 0xffe066, stroke: { color: 0x5a3a00, width: 5 } },
      });
      t.anchor.set(0.5);
      t.position.set(x - S * 0.3, y - S * 0.36);
      this.hintLayer.addChild(t);
    }
  }

  tutorialPoint(): { x: number; y: number } | null {
    const wrong = this.wrongCells();
    if (!wrong.length) return null;
    this.showHintAt(wrong[0], this.tapsNeeded(wrong[0]));
    return this.center(wrong[0]);
  }

  clearHint(): void {
    this.hintLayer.removeChildren().forEach((c) => c.destroy());
  }

  async wand(): Promise<boolean> {
    const wrong = this.wrongCells().filter((i) => canRotate(this.level, i)).slice(0, 3);
    if (!wrong.length) return false;
    this.clearHint();
    this.host.sfx('magic');
    for (const i of wrong) {
      const taps = this.tapsNeeded(i);
      const { x, y } = this.center(i);
      fx.burst(x, y, { count: 10, tex: 'star', colors: [0xffe066, 0xffffff, 0xb388ff], speed: 140, gravity: 0, size: 14 });
      for (let k = 0; k < taps; k++) {
        if (this.won) break;
        await this.rotateGroup(i, 1, false);
      }
    }
    return true;
  }

  hasLocks(): boolean {
    return false;
  }

  hasBombs(): boolean {
    return this.level.cells.some((c, i) => c?.bomb && !this.reachedOnce.has(i));
  }

  unlockAll(): boolean {
    return false;
  }

  async celebrate(): Promise<void> {
    this.clearHint();
    const target = this.host.basketPoint();
    let delay = 0;
    const jobs: Promise<void>[] = [];
    for (const [, sp] of this.goalSprites) {
      sp.visible = false;
      this.host.sfx('prize');
      jobs.push(fx.fly(tex(this.host.prize), { x: sp.x, y: sp.y }, target, { size: sp.width * 1.2, delay }));
      delay += 0.15;
      this.host.itemCollected('prize');
    }
    // sparkle across lit pieces
    this.views.forEach((v, i) => {
      if (v && v.lit.some((m) => m) && i % 2 === 0) {
        const { x, y } = this.center(i);
        fx.burst(x, y, { count: 3, size: 10, speed: 80, gravity: 0, life: 0.5, colors: [0xffffff, this.host.skin.flow] });
      }
    });
    await Promise.all(jobs);
  }

  async explode(): Promise<void> {
    for (const [idx, sp] of this.bombSprites) {
      if (this.reachedOnce.has(idx)) continue;
      fx.burst(sp.x, sp.y, { count: 30, colors: [0xff7a1a, 0xffd23f, 0x555555], speed: 360, size: 22 });
      sp.visible = false;
    }
    const base = this.root.position.clone();
    await stage.tweens.run(0.5, (k) => {
      this.root.position.set(base.x + Math.sin(k * 60) * 10 * (1 - k), base.y + Math.cos(k * 50) * 8 * (1 - k));
    });
    this.root.position.copyFrom(base);
  }

  destroy(): void {
    this.offUpdate();
    stage.tweens.clear();
    this.root.destroy({ children: true });
  }
}
