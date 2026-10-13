import { Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { Ease } from '../core/tween';
import { fx } from '../render/fx';
import { drawShadow, scalePrims, shade, tracePrims } from '../render/skins';
import { stage } from '../render/stage';
import { tex } from '../render/textures';
import type { Board, BoardHost, Rect } from './board';
import { type FreeLevel, type FreeMove, FreeSim, ITEM_R, T, segSegDist, solveFree } from './free';

const HALF = Math.PI / 2;

interface PieceView {
  c: Container;
  sh: Container;
  glow: Graphics;
  clamp: Sprite | null;
  angle: number;
}

interface ItemView {
  s: Sprite;
  text: Text | null;
  freed: boolean;
  baseY: number;
}

export class FreeBoard implements Board {
  root = new Container();
  private shadow = new Container();
  private itemsLayer = new Container();
  private pieceLayer = new Container();
  private hintLayer = new Container();
  private sim: FreeSim;
  private rots: number[];
  private views: PieceView[] = [];
  private items: ItemView[] = [];
  private freed = 0;
  private S = 50;
  private ox = 0;
  private oy = 0;
  private busy = false;
  private won = false;
  private history: number[][] = [];
  private drag: { piece: number; sx: number; sy: number; a0: number; done: boolean } | null = null;
  private time = 0;
  private offUpdate: () => void;
  private fuse: number | null = null;
  private frozen = false;

  constructor(
    public level: FreeLevel,
    private host: BoardHost,
  ) {
    this.sim = new FreeSim(level);
    this.rots = level.pieces.map((p) => p.rot);
    this.shadow.alpha = 0.2;
    this.root.addChild(this.shadow, this.itemsLayer, this.pieceLayer, this.hintLayer);
    this.root.eventMode = 'static';
    this.root.on('pointerdown', (e) => this.onDown(e));
    this.root.on('globalpointermove', (e) => this.onMove(e));
    this.root.on('pointerup', () => this.onUp());
    this.root.on('pointerupoutside', () => this.onUp());
    this.offUpdate = stage.onUpdate((dt) => this.update(dt));
  }

  layout(rect: Rect): void {
    const b = this.level.bounds;
    const margin = 0.9;
    const bw = b.x1 - b.x0 + margin * 2;
    const bh = b.y1 - b.y0 + margin * 2;
    this.S = Math.min(rect.w / bw, rect.h / bh, 78);
    this.ox = rect.x + rect.w / 2 - ((b.x0 + b.x1) / 2) * this.S;
    this.oy = rect.y + rect.h / 2 - ((b.y0 + b.y1) / 2) * this.S;
    this.root.hitArea = new Rectangle(rect.x - 40, rect.y - 40, rect.w + 80, rect.h + 80);
    this.build();
  }

  private build(): void {
    for (const l of [this.shadow, this.itemsLayer, this.pieceLayer]) l.removeChildren().forEach((c) => c.destroy({ children: true }));
    const S = this.S;
    const w = 2 * T * S;
    const skin = this.host.skin;
    const shRoot = new Container();
    shRoot.position.set(this.ox, this.oy + S * 0.1);
    const pRoot = new Container();
    pRoot.position.set(this.ox, this.oy);
    this.shadow.addChild(shRoot);
    this.pieceLayer.addChild(pRoot);
    this.views = [];
    this.level.pieces.forEach((p, i) => {
      const c = new Container();
      const sh = new Container();
      const parentC = p.parent >= 0 ? this.views[p.parent].c : pRoot;
      const parentSh = p.parent >= 0 ? this.views[p.parent].sh : shRoot;
      c.position.set(p.hx * S, p.hy * S);
      sh.position.set(p.hx * S, p.hy * S);
      const angle = this.rots[i] * HALF;
      c.rotation = sh.rotation = angle;
      const prims = scalePrims(p.prims, S);
      const color = p.fixed ? 0xc9b49a : skin.palette[p.hue % skin.palette.length];
      const glow = new Graphics();
      tracePrims(glow, prims).stroke({ width: w * 2.4, color: 0xfff176, alpha: 0.6, cap: 'round', join: 'round' });
      glow.visible = false;
      c.addChild(glow);
      const g = new Graphics();
      if (p.fixed) {
        tracePrims(g, prims).stroke({ width: w * 1.15, color: shade(color, -0.35), cap: 'round', join: 'round' });
        tracePrims(g, prims).stroke({ width: w * 0.85, color, cap: 'round', join: 'round' });
        tracePrims(g, prims, -w * 0.06, -w * 0.08).stroke({ width: w * 0.2, color: 0xffffff, alpha: 0.5, cap: 'round', join: 'round' });
      } else skin.body(g, prims, color, w, i * 13 + 5);
      c.addChild(g);
      const sg = new Graphics();
      drawShadow(sg, prims, w);
      sh.addChild(sg);
      // hinge decoration
      const hinge = new Container();
      const hg = new Graphics();
      hinge.addChild(hg);
      if (p.parent >= 0) {
        const pc = p.parent >= 0 ? this.level.pieces[p.parent] : null;
        const col = pc?.fixed ? 0xb59c7c : skin.palette[(pc?.hue ?? p.hue) % skin.palette.length];
        const s = w * 1.55;
        hg.roundRect(-s / 2, -s / 2, s, s, s * 0.25).fill(shade(col, -0.25));
        hg.roundRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4, s * 0.22).fill(col);
        hg.roundRect(-s / 2 + 3, -s / 2 + 3, s - 6, s * 0.3, s * 0.15).fill({ color: 0xffffff, alpha: 0.35 });
      } else if (p.fixed && p.kind !== 'hub') {
        // bolts along a fixed frame
        const segs = prims.filter((q) => q.t === 'arc');
        for (const q of segs) {
          if (q.t !== 'arc') continue;
          for (const f of [0.2, 0.5, 0.8]) {
            const a = q.a0 + (q.a1 - q.a0) * f;
            const pin = new Sprite(tex('pin'));
            pin.anchor.set(0.5);
            pin.width = pin.height = w * 0.95;
            pin.position.set(q.cx + Math.cos(a) * q.r, q.cy + Math.sin(a) * q.r);
            hinge.addChild(pin);
          }
        }
      } else if (!p.fixed || p.kind === 'hub') {
        const pin = new Sprite(tex('pin'));
        pin.anchor.set(0.5);
        pin.width = pin.height = w * 1.9;
        hinge.addChild(pin);
      }
      c.addChild(hinge);
      let clamp: Sprite | null = null;
      if (p.locked) {
        clamp = new Sprite(tex('clamp'));
        clamp.anchor.set(0.5);
        clamp.width = clamp.height = w * 3;
        c.addChild(clamp);
      }
      parentC.addChild(c);
      parentSh.addChild(sh);
      this.views.push({ c, sh, glow, clamp, angle });
    });
    // items
    this.items = this.level.items.map((it, i) => {
      const s = new Sprite(tex(it.kind === 'bomb' ? 'bomb' : this.host.prize));
      s.anchor.set(0.5);
      s.width = s.height = ITEM_R * 2.1 * S;
      s.position.set(this.ox + it.x * S, this.oy + it.y * S);
      const freed = !!(this.freed & (1 << i));
      s.visible = !freed;
      this.itemsLayer.addChild(s);
      let text: Text | null = null;
      if (it.kind === 'bomb') {
        text = new Text({
          text: '',
          style: { fontFamily: 'Nunito', fontWeight: '900', fontSize: Math.round(S * 0.42), fill: 0xffffff, stroke: { color: 0x3a1a0a, width: Math.max(3, S * 0.08) } },
        });
        text.anchor.set(0.5);
        text.position.set(s.x + S * 0.32, s.y - S * 0.32);
        text.visible = !freed;
        this.itemsLayer.addChild(text);
      }
      return { s, text, freed, baseY: s.y };
    });
    this.updateFuse();
  }

  // ---------- input ----------

  private toWorld(x: number, y: number): [number, number] {
    return [(x - this.ox) / this.S, (y - this.oy) / this.S];
  }

  private pick(wx: number, wy: number): number {
    const ws = this.sim.world(this.rots);
    let best = -1;
    let bestD = 0.6;
    ws.segs.forEach((S, i) => {
      if (this.level.pieces[i].fixed) return;
      for (let k = 0; k < S.length; k += 4) {
        const d = segSegDist(S[k], S[k + 1], S[k + 2], S[k + 3], wx, wy, wx, wy);
        // children win ties (drawn on top)
        if (d < bestD - 0.02 || (d < bestD + 0.02 && i > best && d < 0.6)) {
          bestD = Math.min(bestD, d);
          best = i;
        }
      }
    });
    return best;
  }

  private onDown(e: FederatedPointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.busy || this.won || !this.host.canInteract()) return;
    const [wx, wy] = this.toWorld(e.global.x, e.global.y);
    const piece = this.pick(wx, wy);
    if (piece < 0) return;
    const ws = this.sim.world(this.rots);
    const a0 = Math.atan2(wy - ws.py[piece], wx - ws.px[piece]);
    this.drag = { piece, sx: e.global.x, sy: e.global.y, a0, done: false };
  }

  private onMove(e: FederatedPointerEvent): void {
    const d = this.drag;
    if (!d || d.done) return;
    if (Math.hypot(e.global.x - d.sx, e.global.y - d.sy) < 14) return;
    const [wx, wy] = this.toWorld(e.global.x, e.global.y);
    const ws = this.sim.world(this.rots);
    const a = Math.atan2(wy - ws.py[d.piece], wx - ws.px[d.piece]);
    let da = a - d.a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > 0.22) {
      d.done = true;
      void this.tryRotate(d.piece, da > 0 ? 1 : -1, false);
    }
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.done) return;
    void this.tryRotate(d.piece, 1, true);
  }

  // ---------- moves ----------

  private async tryRotate(i: number, dir: 1 | -1, auto: boolean): Promise<void> {
    if (this.busy || this.won) return;
    this.clearHint();
    const p = this.level.pieces[i];
    if (p.locked) {
      this.host.sfx('blocked');
      this.host.vibrate(30);
      this.host.blocked();
      const cl = this.views[i].clamp;
      if (cl) await stage.tweens.run(0.35, (k) => (cl.rotation = Math.sin(k * Math.PI * 4) * 0.35 * (1 - k)));
      return;
    }
    const ws = this.sim.world(this.rots);
    let d = dir;
    let hit = this.sim.sweep(ws, i, d);
    if (hit >= 0 && auto) {
      const other = this.sim.sweep(ws, i, -d as 1 | -1);
      if (other < 0) {
        d = -d as 1 | -1;
        hit = other;
      }
    }
    if (hit >= 0) {
      await this.bounce(i, d, hit);
      return;
    }
    this.history.push(this.rots.slice());
    await this.animateMove(i, d);
    this.afterMove(true);
  }

  private async bounce(i: number, dir: number, frac: number): Promise<void> {
    this.busy = true;
    this.host.sfx('blocked');
    this.host.vibrate(35);
    this.host.blocked();
    const v = this.views[i];
    const base = v.angle;
    const reach = Math.max(0.05, frac * HALF);
    await stage.tweens.run(0.12, (k) => (v.c.rotation = v.sh.rotation = base + dir * reach * k), { ease: Ease.outCubic });
    await stage.tweens.run(0.3, (k) => (v.c.rotation = v.sh.rotation = base + dir * reach * (1 - k) * Math.cos(k * Math.PI * 2.5)), {
      ease: Ease.outQuad,
    });
    v.c.rotation = v.sh.rotation = base;
    this.busy = false;
  }

  private async animateMove(i: number, dir: number): Promise<void> {
    this.busy = true;
    this.host.sfx('rotate');
    this.host.vibrate(8);
    const v = this.views[i];
    const from = v.angle;
    v.angle = from + dir * HALF;
    this.rots[i] = (this.rots[i] + dir + 4) & 3;
    await stage.tweens.run(0.26, (k) => (v.c.rotation = v.sh.rotation = from + (v.angle - from) * k), { ease: Ease.outBack });
    this.busy = false;
  }

  private afterMove(counted: boolean): void {
    const ws = this.sim.world(this.rots);
    this.level.items.forEach((it, idx) => {
      if (this.freed & (1 << idx)) return;
      const a = this.sim.itemFreeDir(ws, it);
      if (Number.isNaN(a)) return;
      this.freed |= 1 << idx;
      this.release(idx, a);
    });
    const all = (1 << this.level.items.length) - 1;
    const won = this.freed === all;
    if (won) this.won = true;
    this.host.moveDone({ won, counted });
  }

  private release(idx: number, ang: number): void {
    const view = this.items[idx];
    const it = this.level.items[idx];
    view.freed = true;
    if (view.text) view.text.visible = false;
    const s = view.s;
    const out = { x: s.x + Math.cos(ang) * this.S * 1.4, y: s.y + Math.sin(ang) * this.S * 1.4 };
    if (it.kind === 'bomb') {
      this.host.sfx('magic');
      this.host.itemCollected('bomb');
      fx.burst(s.x, s.y, { count: 12, tex: 'star4', colors: [0x9be7ff, 0xffffff], speed: 160, gravity: 0 });
      const sx = s.x;
      const sy = s.y;
      void stage.tweens.run(0.6, (k) => {
        s.x = sx + (out.x - sx) * k * 2;
        s.y = sy + (out.y - sy) * k * 2;
        s.alpha = 1 - k;
        s.rotation = k * 4;
      });
      return;
    }
    this.host.sfx('prize');
    this.host.itemCollected('prize');
    const sx = s.x;
    const sy = s.y;
    void stage.tweens
      .run(0.22, (k) => {
        s.x = sx + (out.x - sx) * k;
        s.y = sy + (out.y - sy) * k;
      }, { ease: Ease.outCubic })
      .then(() => {
        s.visible = false;
        return fx.fly(tex(this.host.prize), { x: s.x, y: s.y }, this.host.basketPoint(), { size: s.width });
      });
  }

  // ---------- boosters ----------

  undo(): boolean {
    if (this.busy || this.won || !this.history.length) return false;
    const prev = this.history.pop()!;
    this.clearHint();
    prev.forEach((r, i) => {
      if (r === this.rots[i]) return;
      const v = this.views[i];
      let d = r - this.rots[i];
      if (d > 2) d -= 4;
      if (d < -2) d += 4;
      const from = v.angle;
      v.angle = from + d * HALF;
      void stage.tweens.run(0.25, (k) => (v.c.rotation = v.sh.rotation = from + (v.angle - from) * k), { ease: Ease.outCubic });
    });
    this.rots = prev;
    this.host.sfx('whoosh');
    this.host.undone();
    return true;
  }

  private nextMoves(): FreeMove[] | null {
    const res = solveFree(this.sim, this.rots, this.freed, 20000);
    return res ? res.path : null;
  }

  hint(): boolean {
    if (this.busy || this.won) return false;
    const path = this.nextMoves();
    if (!path || !path.length) return false;
    this.showHint(path[0]);
    return true;
  }

  private showHint(m: FreeMove): void {
    this.clearHint();
    const v = this.views[m.piece];
    v.glow.visible = true;
    const ws = this.sim.world(this.rots);
    const S = ws.segs[m.piece];
    // point on the piece farthest from the hinge
    let bx = ws.px[m.piece];
    let by = ws.py[m.piece];
    let bd = -1;
    for (let k = 0; k < S.length; k += 2) {
      const d = Math.hypot(S[k] - ws.px[m.piece], S[k + 1] - ws.py[m.piece]);
      if (d > bd) {
        bd = d;
        bx = S[k];
        by = S[k + 1];
      }
    }
    const hand = new Sprite(tex('hand')) as Sprite & { baseY: number };
    hand.anchor.set(0.3, 0.05);
    hand.width = hand.height = Math.max(54, this.S * 1.1);
    hand.position.set(this.ox + bx * this.S, this.oy + by * this.S);
    hand.baseY = hand.y;
    hand.label = 'hand';
    this.hintLayer.addChild(hand);
    // direction arrow around the hinge
    const g = new Graphics();
    const hx = this.ox + ws.px[m.piece] * this.S;
    const hy = this.oy + ws.py[m.piece] * this.S;
    const r = this.S * 0.9;
    const a0 = Math.atan2(by - ws.py[m.piece], bx - ws.px[m.piece]);
    const a1 = a0 + m.dir * 1.1;
    g.moveTo(hx + Math.cos(a0) * r, hy + Math.sin(a0) * r)
      .arc(hx, hy, r, Math.min(a0, a1), Math.max(a0, a1))
      .stroke({ width: 6, color: 0xffe066, cap: 'round' });
    const tipA = a1;
    const tx = hx + Math.cos(tipA) * r;
    const ty = hy + Math.sin(tipA) * r;
    const ta = tipA + (m.dir * Math.PI) / 2;
    g.moveTo(tx + Math.cos(ta) * 14, ty + Math.sin(ta) * 14)
      .lineTo(tx + Math.cos(ta + 2.5) * 12, ty + Math.sin(ta + 2.5) * 12)
      .lineTo(tx + Math.cos(ta - 2.5) * 12, ty + Math.sin(ta - 2.5) * 12)
      .closePath()
      .fill(0xffe066);
    this.hintLayer.addChild(g);
  }

  tutorialPoint(): { x: number; y: number } | null {
    const path = this.level.solution;
    if (!path.length) return null;
    this.showHint(path[0]);
    return null;
  }

  clearHint(): void {
    this.views.forEach((v) => (v.glow.visible = false));
    this.hintLayer.removeChildren().forEach((c) => c.destroy());
  }

  async wand(): Promise<boolean> {
    if (this.busy || this.won) return false;
    const path = this.nextMoves();
    if (!path || !path.length) return false;
    this.clearHint();
    this.host.sfx('magic');
    for (const m of path.slice(0, Math.min(2, path.length))) {
      const ws = this.sim.world(this.rots);
      fx.burst(this.ox + ws.px[m.piece] * this.S, this.oy + ws.py[m.piece] * this.S, {
        count: 12,
        tex: 'star4',
        colors: [0xffe066, 0xffffff, 0xb388ff],
        speed: 150,
        gravity: 0,
      });
      this.history.push(this.rots.slice());
      await this.animateMove(m.piece, m.dir);
      this.afterMove(false);
      if (this.won) break;
      await stage.tweens.wait(0.12);
    }
    return true;
  }

  hasLocks(): boolean {
    return this.level.pieces.some((p) => p.locked);
  }

  hasBombs(): boolean {
    return this.level.items.some((it, i) => it.kind === 'bomb' && !(this.freed & (1 << i)));
  }

  unlockAll(): boolean {
    if (!this.hasLocks()) return false;
    this.level.pieces.forEach((p, i) => {
      if (!p.locked) return;
      p.locked = false;
      const cl = this.views[i].clamp;
      if (cl) {
        const parent = cl.parent;
        const g = cl.getGlobalPosition();
        fx.burst(g.x, g.y, { count: 10, colors: [0xdfe6ec, 0xffffff, 0xffe066], speed: 180, size: 12 });
        void stage.tweens.run(0.35, (k) => {
          cl.alpha = 1 - k;
          cl.scale.set(cl.scale.x * (1 + k * 0.05));
        }).then(() => parent?.removeChild(cl));
        this.views[i].clamp = null;
      }
    });
    this.sim.refreshMovable();
    this.host.sfx('unlock');
    return true;
  }

  setFuse(n: number | null, frozen: boolean): void {
    this.fuse = n;
    this.frozen = frozen;
    this.updateFuse();
  }

  private updateFuse(): void {
    this.items.forEach((v) => {
      if (!v.text) return;
      v.text.text = this.fuse === null ? '' : this.frozen ? '❄' : String(this.fuse);
      v.text.style.fill = this.frozen ? 0x9be7ff : this.fuse !== null && this.fuse <= 3 ? 0xff5252 : 0xffffff;
    });
  }

  private update(dt: number): void {
    this.time += dt;
    this.items.forEach((v, i) => {
      if (v.freed) return;
      v.s.y = v.baseY + Math.sin(this.time * 2.4 + i) * this.S * 0.04;
      if (this.level.items[i].kind === 'bomb' && !this.frozen) v.s.rotation = Math.sin(this.time * 9) * 0.06;
    });
    this.views.forEach((v) => {
      if (v.glow.visible) v.glow.alpha = 0.5 + Math.sin(this.time * 7) * 0.4;
    });
    this.hintLayer.children.forEach((c) => {
      if (c.label === 'hand') c.y = (c as Sprite & { baseY: number }).baseY + Math.sin(this.time * 6) * 8;
    });
  }

  async celebrate(): Promise<void> {
    this.clearHint();
    await stage.tweens.wait(0.9);
  }

  async explode(): Promise<void> {
    this.items.forEach((v, i) => {
      if (v.freed || this.level.items[i].kind !== 'bomb') return;
      fx.burst(v.s.x, v.s.y, { count: 30, colors: [0xff7a1a, 0xffd23f, 0x555555], speed: 360, size: 22 });
      v.s.visible = false;
      if (v.text) v.text.visible = false;
    });
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
