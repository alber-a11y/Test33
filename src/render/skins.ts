import type { Graphics } from 'pixi.js';
import type { Prim } from '../game/free';

export function tracePrims(g: Graphics, prims: Prim[], ox = 0, oy = 0): Graphics {
  for (const p of prims) {
    if (p.t === 'line') {
      g.moveTo(p.x1 + ox, p.y1 + oy).lineTo(p.x2 + ox, p.y2 + oy);
    } else {
      g.moveTo(p.cx + ox + Math.cos(p.a0) * p.r, p.cy + oy + Math.sin(p.a0) * p.r);
      g.arc(p.cx + ox, p.cy + oy, p.r, p.a0, p.a1);
    }
  }
  return g;
}

export function scalePrims(prims: Prim[], s: number, ox = 0, oy = 0): Prim[] {
  return prims.map((p) =>
    p.t === 'line'
      ? { t: 'line', x1: p.x1 * s + ox, y1: p.y1 * s + oy, x2: p.x2 * s + ox, y2: p.y2 * s + oy }
      : { ...p, cx: p.cx * s + ox, cy: p.cy * s + oy, r: p.r * s },
  );
}

export interface PathPoint {
  x: number;
  y: number;
  a: number;
  /** distance along the whole path */
  d: number;
}

export function primLength(p: Prim): number {
  return p.t === 'line' ? Math.hypot(p.x2 - p.x1, p.y2 - p.y1) : Math.abs(p.a1 - p.a0) * p.r;
}

/** Points along the primitives every `step` px (with tangent angle). */
export function samplePrims(prims: Prim[], step: number, offset = 0): PathPoint[] {
  const out: PathPoint[] = [];
  let base = 0;
  for (const p of prims) {
    const len = primLength(p);
    for (let s = offset; s <= len; s += step) {
      if (p.t === 'line') {
        const t = len ? s / len : 0;
        out.push({
          x: p.x1 + (p.x2 - p.x1) * t,
          y: p.y1 + (p.y2 - p.y1) * t,
          a: Math.atan2(p.y2 - p.y1, p.x2 - p.x1),
          d: base + s,
        });
      } else {
        const a = p.a0 + (p.a1 - p.a0) * (len ? s / len : 0);
        out.push({ x: p.cx + Math.cos(a) * p.r, y: p.cy + Math.sin(a) * p.r, a: a + Math.PI / 2, d: base + s });
      }
    }
    base += len;
  }
  return out;
}

export function shade(color: number, k: number): number {
  let r = (color >> 16) & 255;
  let g = (color >> 8) & 255;
  let b = color & 255;
  if (k >= 0) {
    r += (255 - r) * k;
    g += (255 - g) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    g *= 1 + k;
    b *= 1 + k;
  }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function hsl(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

function rnd(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ROUND = { cap: 'round', join: 'round' } as const;

export interface Skin {
  id: string;
  palette: number[];
  flow: number;
  /** Colors for two-source levels. */
  flows: number[];
  body(g: Graphics, prims: Prim[], color: number, w: number, seed: number): void;
}

function glossy(g: Graphics, prims: Prim[], color: number, w: number, outlineK = -0.3) {
  tracePrims(g, prims).stroke({ width: w, color: shade(color, outlineK), ...ROUND });
  tracePrims(g, prims).stroke({ width: w * 0.72, color, ...ROUND });
  tracePrims(g, prims, -w * 0.06, -w * 0.08).stroke({ width: w * 0.22, color: shade(color, 0.55), alpha: 0.75, ...ROUND });
}

function ticks(
  g: Graphics,
  prims: Prim[],
  step: number,
  len: number,
  angle: number,
  style: { width: number; color: number; alpha?: number },
  offset = step / 2,
) {
  for (const p of samplePrims(prims, step, offset)) {
    const a = p.a + angle;
    const dx = Math.cos(a) * len * 0.5;
    const dy = Math.sin(a) * len * 0.5;
    g.moveTo(p.x - dx, p.y - dy).lineTo(p.x + dx, p.y + dy);
  }
  g.stroke({ ...style, cap: 'round' });
}

function endpoints(prims: Prim[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of prims) {
    if (p.t === 'line') out.push([p.x1, p.y1], [p.x2, p.y2]);
    else if (Math.abs(p.a1 - p.a0) < Math.PI * 2 - 1e-3)
      out.push(
        [p.cx + Math.cos(p.a0) * p.r, p.cy + Math.sin(p.a0) * p.r],
        [p.cx + Math.cos(p.a1) * p.r, p.cy + Math.sin(p.a1) * p.r],
      );
  }
  return out;
}

const VIVID = [0xef4b4b, 0xff9a1f, 0xf7c531, 0x4ccb5e, 0x22c1b0, 0x3d9df2, 0x9b5de5, 0xf15bb5];

export const SKIN_LIST: Skin[] = [
  {
    id: 'classic',
    palette: VIVID,
    flow: 0x3ec5ff,
    flows: [0x3ec5ff, 0xff5fa2],
    body: (g, prims, color, w) => glossy(g, prims, color, w),
  },
  {
    id: 'wires',
    palette: [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0xfb8c00, 0x8e24aa, 0x00acc1, 0x546e7a],
    flow: 0xffe14d,
    flows: [0xffe14d, 0x7cf7ff],
    body: (g, prims, color, w) => {
      tracePrims(g, prims).stroke({ width: w, color: shade(color, -0.45), ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.74, color, ...ROUND });
      ticks(g, prims, w * 0.55, w * 0.7, Math.PI / 3, { width: w * 0.12, color: shade(color, -0.3), alpha: 0.8 });
      tracePrims(g, prims).stroke({ width: w * 0.16, color: shade(color, 0.5), alpha: 0.6, ...ROUND });
      for (const [x, y] of endpoints(prims)) {
        g.circle(x, y, w * 0.42).fill(0xb87333);
        g.circle(x - w * 0.1, y - w * 0.1, w * 0.16).fill({ color: 0xffd7a8, alpha: 0.9 });
      }
    },
  },
  {
    id: 'branches',
    palette: [0x8d5a2b, 0x7a4b22, 0x9c6b3a, 0x6d4220, 0x8a6036, 0x7f5530, 0x946232, 0x704626],
    flow: 0x8cf05a,
    flows: [0x8cf05a, 0xffb3e6],
    body: (g, prims, color, w, seed) => {
      tracePrims(g, prims).stroke({ width: w * 1.05, color: shade(color, -0.4), ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.8, color, ...ROUND });
      tracePrims(g, prims, w * 0.08, 0).stroke({ width: w * 0.08, color: shade(color, -0.35), alpha: 0.8, ...ROUND });
      tracePrims(g, prims, -w * 0.14, -w * 0.06).stroke({ width: w * 0.12, color: shade(color, 0.3), alpha: 0.6, ...ROUND });
      const r = rnd(seed);
      const leaves = samplePrims(prims, w * 1.6, w * (0.4 + r()));
      leaves.forEach((p, i) => {
        if (r() < 0.25) return;
        const side = i % 2 ? 1 : -1;
        const a = p.a + side * (Math.PI / 2.6);
        const lx = p.x + Math.cos(a) * w * 0.75;
        const ly = p.y + Math.sin(a) * w * 0.75;
        const col = [0x66bb6a, 0x81c784, 0x4caf50, 0x9ccc65][Math.floor(r() * 4)];
        const c = Math.cos(a);
        const s = Math.sin(a);
        const L = w * 0.62;
        const W = w * 0.28;
        g.moveTo(lx - c * L, ly - s * L)
          .quadraticCurveTo(lx - s * W, ly + c * W, lx + c * L, ly + s * L)
          .quadraticCurveTo(lx + s * W, ly - c * W, lx - c * L, ly - s * L)
          .fill(col);
      });
    },
  },
  {
    id: 'ropes',
    palette: [0xd9b77e, 0xcfa86a, 0xe0c08a, 0xc89e5d, 0xd4ad72, 0xdcbb84, 0xc69a58, 0xe2c590],
    flow: 0x59c3ff,
    flows: [0x59c3ff, 0xff7aa8],
    body: (g, prims, color, w, seed) => {
      const accent = VIVID[seed % VIVID.length];
      tracePrims(g, prims).stroke({ width: w, color: shade(color, -0.4), ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.78, color, ...ROUND });
      ticks(g, prims, w * 0.36, w * 0.82, Math.PI / 4, { width: w * 0.13, color: shade(color, -0.28), alpha: 0.9 });
      ticks(g, prims, w * 1.08, w * 0.82, Math.PI / 4, { width: w * 0.13, color: accent, alpha: 0.95 }, w * 0.18);
      tracePrims(g, prims, -w * 0.08, -w * 0.08).stroke({ width: w * 0.14, color: shade(color, 0.45), alpha: 0.45, ...ROUND });
    },
  },
  {
    id: 'candy',
    palette: [0xff4d6d, 0x2ec4b6, 0xff9f1c, 0x7b2cbf, 0x3a86ff, 0x06d6a0, 0xf15bb5, 0xef476f],
    flow: 0xfff176,
    flows: [0xfff176, 0x80f0ff],
    body: (g, prims, color, w) => {
      tracePrims(g, prims).stroke({ width: w, color: shade(color, -0.35), ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.76, color: 0xfffaf5, ...ROUND });
      ticks(g, prims, w * 0.9, w * 0.72, Math.PI / 4, { width: w * 0.3, color });
      tracePrims(g, prims, -w * 0.06, -w * 0.08).stroke({ width: w * 0.16, color: 0xffffff, alpha: 0.7, ...ROUND });
    },
  },
  {
    id: 'ice',
    palette: [0x9be7ff, 0xb3e5fc, 0x81d4fa, 0xa7ffeb, 0xc5cae9, 0x80deea, 0xb2ebf2, 0xbbdefb],
    flow: 0x2f8cff,
    flows: [0x2f8cff, 0xd05ce3],
    body: (g, prims, color, w, seed) => {
      tracePrims(g, prims).stroke({ width: w * 1.05, color: 0xffffff, alpha: 0.85, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.82, color, alpha: 0.85, ...ROUND });
      tracePrims(g, prims, -w * 0.1, -w * 0.1).stroke({ width: w * 0.2, color: 0xffffff, alpha: 0.85, ...ROUND });
      const r = rnd(seed);
      for (const p of samplePrims(prims, w * 1.3, w * r())) {
        if (r() < 0.5) continue;
        g.circle(p.x + (r() - 0.5) * w * 0.4, p.y + (r() - 0.5) * w * 0.4, w * 0.08).fill({ color: 0xffffff, alpha: 0.95 });
      }
    },
  },
  {
    id: 'neon',
    palette: [0xff2bd6, 0x00f0ff, 0x39ff14, 0xfff01f, 0xff6b1f, 0xb026ff, 0x00ff9c, 0xff3864],
    flow: 0xffffff,
    flows: [0xffffff, 0xfff01f],
    body: (g, prims, color, w) => {
      tracePrims(g, prims).stroke({ width: w * 1.9, color, alpha: 0.12, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 1.3, color, alpha: 0.25, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.86, color: 0x14112a, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.44, color, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.14, color: shade(color, 0.7), ...ROUND });
    },
  },
  {
    id: 'lava',
    palette: [0x3a2724, 0x45302a, 0x332220, 0x4a332b, 0x3d2a26, 0x2f1f1c, 0x40291f, 0x382421],
    flow: 0xffd23f,
    flows: [0xffd23f, 0x7cf7ff],
    body: (g, prims, color, w, seed) => {
      tracePrims(g, prims).stroke({ width: w * 1.3, color: 0xff5a1f, alpha: 0.18, ...ROUND });
      tracePrims(g, prims).stroke({ width: w, color: 0x1b0f0d, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.8, color, ...ROUND });
      const r = rnd(seed);
      const pts = samplePrims(prims, w * 0.32, 0);
      if (pts.length > 1) {
        g.moveTo(pts[0].x, pts[0].y);
        pts.forEach((p, i) => {
          const n = (i % 2 ? 1 : -1) * w * (0.08 + r() * 0.16);
          g.lineTo(p.x + Math.cos(p.a + Math.PI / 2) * n, p.y + Math.sin(p.a + Math.PI / 2) * n);
        });
        g.stroke({ width: w * 0.22, color: 0xff7a1a, alpha: 0.35, join: 'round' });
        g.moveTo(pts[0].x, pts[0].y);
        pts.forEach((p, i) => {
          const n = (i % 2 ? 1 : -1) * w * 0.12;
          g.lineTo(p.x + Math.cos(p.a + Math.PI / 2) * n, p.y + Math.sin(p.a + Math.PI / 2) * n);
        });
        g.stroke({ width: w * 0.08, color: 0xffc04d, join: 'round' });
      }
    },
  },
  {
    id: 'rainbow',
    palette: VIVID,
    flow: 0xffffff,
    flows: [0xffffff, 0x222244],
    body: (g, prims, _color, w, seed) => {
      tracePrims(g, prims).stroke({ width: w, color: 0xffffff, ...ROUND });
      const pts = samplePrims(prims, w * 0.22, 0);
      const h0 = (seed * 47) % 360;
      for (let i = 1; i < pts.length; i++) {
        if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > w * 0.5) continue;
        g.moveTo(pts[i - 1].x, pts[i - 1].y)
          .lineTo(pts[i].x, pts[i].y)
          .stroke({ width: w * 0.74, color: hsl((h0 + pts[i].d * 1.2) % 360, 0.85, 0.6), cap: 'round' });
      }
      tracePrims(g, prims, -w * 0.06, -w * 0.08).stroke({ width: w * 0.18, color: 0xffffff, alpha: 0.55, ...ROUND });
    },
  },
  {
    id: 'gold',
    palette: [0xf2c94c, 0xe8b931, 0xf6d365, 0xdeb33a, 0xf0c040, 0xe6be45, 0xf4cd5a, 0xe3b437],
    flow: 0xff4fa3,
    flows: [0xff4fa3, 0x4fc3ff],
    body: (g, prims, color, w, seed) => {
      tracePrims(g, prims).stroke({ width: w, color: 0x9a6a00, ...ROUND });
      tracePrims(g, prims).stroke({ width: w * 0.76, color, ...ROUND });
      tracePrims(g, prims, w * 0.08, w * 0.1).stroke({ width: w * 0.2, color: 0xc08a00, alpha: 0.6, ...ROUND });
      tracePrims(g, prims, -w * 0.07, -w * 0.09).stroke({ width: w * 0.2, color: 0xfff6c8, alpha: 0.9, ...ROUND });
      const r = rnd(seed);
      for (const p of samplePrims(prims, w * 2.2, w * r() * 2)) {
        const s = w * 0.22;
        g.moveTo(p.x, p.y - s).lineTo(p.x + s * 0.25, p.y - s * 0.25).lineTo(p.x + s, p.y)
          .lineTo(p.x + s * 0.25, p.y + s * 0.25).lineTo(p.x, p.y + s).lineTo(p.x - s * 0.25, p.y + s * 0.25)
          .lineTo(p.x - s, p.y).lineTo(p.x - s * 0.25, p.y - s * 0.25).closePath().fill({ color: 0xffffff, alpha: 0.9 });
      }
    },
  },
];

export function getSkin(id: string): Skin {
  return SKIN_LIST.find((s) => s.id === id) ?? SKIN_LIST[0];
}

/** Flow/inner glow overlay for path mode channels. */
export function drawFlow(g: Graphics, prims: Prim[], color: number, w: number): void {
  tracePrims(g, prims).stroke({ width: w * 0.95, color, alpha: 0.22, ...ROUND });
  tracePrims(g, prims).stroke({ width: w * 0.42, color, ...ROUND });
  tracePrims(g, prims).stroke({ width: w * 0.16, color: shade(color, 0.7), alpha: 0.9, ...ROUND });
}

export function drawShadow(g: Graphics, prims: Prim[], w: number): void {
  tracePrims(g, prims).stroke({ width: w * 1.05, color: 0x000000, ...ROUND });
}
