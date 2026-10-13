/**
 * Mode B — "Free the prize". Pieces hang on hinges (a tree); tapping rotates a
 * piece (with everything attached to it) by 90°. Rotation is blocked by
 * collisions. A prize is freed once a clear corridor to the outside opens.
 */

export type Prim =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'arc'; cx: number; cy: number; r: number; a0: number; a1: number };

export interface FreePiece {
  /** Shape in local coordinates; the hinge is at the origin. */
  prims: Prim[];
  /** Parent piece index, or -1 when pinned to the board. */
  parent: number;
  /** Hinge position in the parent's local frame (or world when pinned). */
  hx: number;
  hy: number;
  /** Current rotation relative to parent, clockwise quarter turns. */
  rot: number;
  /** Clamped: cannot rotate until a key is used. */
  locked?: boolean;
  /** Static frame (hub/stand), never rotates. */
  fixed?: boolean;
  hue: number;
  /** Visual hint for connector rendering. */
  kind?: 'cup' | 'bar' | 'ring' | 'hub' | 'hook';
}

export interface FreeItem {
  x: number;
  y: number;
  kind: 'prize' | 'bomb';
}

export interface FreeMove {
  piece: number;
  dir: 1 | -1;
}

export interface FreeLevel {
  mode: 'free';
  pieces: FreePiece[];
  items: FreeItem[];
  par: number;
  solution: FreeMove[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
  moveLimit?: number;
  fuse?: number;
}

/** Tube half thickness in world units. */
export const T = 0.12;
export const ITEM_R = 0.42;
const COLLIDE = 2 * T - 1e-4;
const NEAR_HINGE = 0.3;
const HALF_PI = Math.PI / 2;
const RAYS = 32;

// ---------- geometry helpers ----------

function segPointDist2(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export function segSegDist(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  // proper intersection test
  const r1 = cross(bx - ax, by - ay, cx - ax, cy - ay);
  const r2 = cross(bx - ax, by - ay, dx - ax, dy - ay);
  const r3 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
  const r4 = cross(dx - cx, dy - cy, bx - cx, by - cy);
  if (((r1 > 0 && r2 < 0) || (r1 < 0 && r2 > 0)) && ((r3 > 0 && r4 < 0) || (r3 < 0 && r4 > 0))) return 0;
  return Math.sqrt(
    Math.min(
      segPointDist2(ax, ay, bx, by, cx, cy),
      segPointDist2(ax, ay, bx, by, dx, dy),
      segPointDist2(cx, cy, dx, dy, ax, ay),
      segPointDist2(cx, cy, dx, dy, bx, by),
    ),
  );
}

/** Sample primitives into segments [x1,y1,x2,y2,...]. */
export function primsToSegs(prims: Prim[]): number[] {
  const out: number[] = [];
  for (const p of prims) {
    if (p.t === 'line') {
      out.push(p.x1, p.y1, p.x2, p.y2);
    } else {
      const sweep = p.a1 - p.a0;
      const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
      let px = p.cx + Math.cos(p.a0) * p.r;
      let py = p.cy + Math.sin(p.a0) * p.r;
      for (let i = 1; i <= n; i++) {
        const a = p.a0 + (sweep * i) / n;
        const qx = p.cx + Math.cos(a) * p.r;
        const qy = p.cy + Math.sin(a) * p.r;
        out.push(px, py, qx, qy);
        px = qx;
        py = qy;
      }
    }
  }
  return out;
}

export interface WorldState {
  ang: Float64Array;
  px: Float64Array;
  py: Float64Array;
  segs: Float64Array[];
}

/** Precomputed simulation helpers for one free level. */
export class FreeSim {
  readonly n: number;
  readonly parent: number[];
  readonly movable: boolean[];
  readonly subtree: number[][];
  readonly inSub: Uint8Array[];
  readonly local: Float64Array[];
  readonly hinge: [number, number][];
  private moveCache = new Map<number, number>();
  private freeCache = new Map<number, number>();

  constructor(public level: FreeLevel) {
    const ps = level.pieces;
    this.n = ps.length;
    this.parent = ps.map((p) => p.parent);
    this.movable = ps.map((p) => !p.locked && !p.fixed);
    this.local = ps.map((p) => Float64Array.from(primsToSegs(p.prims)));
    this.hinge = ps.map((p) => [p.hx, p.hy]);
    const children: number[][] = ps.map(() => []);
    ps.forEach((p, i) => p.parent >= 0 && children[p.parent].push(i));
    this.subtree = ps.map((_, i) => {
      const out: number[] = [];
      const st = [i];
      while (st.length) {
        const c = st.pop()!;
        out.push(c);
        st.push(...children[c]);
      }
      return out;
    });
    this.inSub = this.subtree.map((sub) => {
      const m = new Uint8Array(this.n);
      sub.forEach((j) => (m[j] = 1));
      return m;
    });
  }

  /** Recompute movability (e.g. after a key unlocks clamps). */
  refreshMovable(): void {
    this.level.pieces.forEach((p, i) => (this.movable[i] = !p.locked && !p.fixed));
    this.moveCache.clear();
  }

  key(rots: ArrayLike<number>): number {
    let k = 0;
    for (let i = this.n - 1; i >= 0; i--) k = k * 4 + (rots[i] & 3);
    return k;
  }

  decode(key: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < this.n; i++) {
      r.push(key % 4);
      key = Math.floor(key / 4);
    }
    return r;
  }

  world(rots: ArrayLike<number>): WorldState {
    const n = this.n;
    const ang = new Float64Array(n);
    const px = new Float64Array(n);
    const py = new Float64Array(n);
    const segs: Float64Array[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.parent[i];
      const [hx, hy] = this.hinge[i];
      if (p < 0) {
        px[i] = hx;
        py[i] = hy;
        ang[i] = (rots[i] & 3) * HALF_PI;
      } else {
        const c = Math.cos(ang[p]);
        const s = Math.sin(ang[p]);
        px[i] = px[p] + hx * c - hy * s;
        py[i] = py[p] + hx * s + hy * c;
        ang[i] = ang[p] + (rots[i] & 3) * HALF_PI;
      }
      const c = Math.cos(ang[i]);
      const s = Math.sin(ang[i]);
      const L = this.local[i];
      const out = new Float64Array(L.length);
      for (let k = 0; k < L.length; k += 2) {
        out[k] = px[i] + L[k] * c - L[k + 1] * s;
        out[k + 1] = py[i] + L[k] * s + L[k + 1] * c;
      }
      segs.push(out);
    }
    return { ang, px, py, segs };
  }

  /** True if any two pieces overlap in this state. */
  overlaps(ws: WorldState): boolean {
    for (let a = 0; a < this.n; a++)
      for (let b = a + 1; b < this.n; b++) {
        const pc = this.parent[b] === a ? b : this.parent[a] === b ? a : -1;
        if (this.pairCollides(ws.segs[a], ws.segs[b], pc >= 0 ? ws.px[pc] : NaN, pc >= 0 ? ws.py[pc] : NaN))
          return true;
      }
    return false;
  }

  private pairCollides(A: Float64Array, B: Float64Array, hx: number, hy: number): boolean {
    const near = !Number.isNaN(hx);
    for (let i = 0; i < A.length; i += 4) {
      const aNear = near && segPointDist2(A[i], A[i + 1], A[i + 2], A[i + 3], hx, hy) < NEAR_HINGE * NEAR_HINGE;
      for (let j = 0; j < B.length; j += 4) {
        if (aNear && segPointDist2(B[j], B[j + 1], B[j + 2], B[j + 3], hx, hy) < NEAR_HINGE * NEAR_HINGE) continue;
        if (segSegDist(A[i], A[i + 1], A[i + 2], A[i + 3], B[j], B[j + 1], B[j + 2], B[j + 3]) < COLLIDE)
          return true;
      }
    }
    return false;
  }

  /**
   * Sweep-test rotating piece `i` (with subtree) by dir*90°.
   * Returns the blocking fraction in (0,1] or 1 if free... returns -1 when free,
   * otherwise the fraction of the turn at which contact happens.
   */
  sweep(ws: WorldState, i: number, dir: 1 | -1): number {
    if (!this.movable[i]) return 0;
    const cx = ws.px[i];
    const cy = ws.py[i];
    const sub = this.inSub[i];
    const par = this.parent[i];
    // gather moving segs with radial ranges
    const mov: number[] = [];
    let maxR = 0;
    for (const j of this.subtree[i]) {
      const S = ws.segs[j];
      for (let k = 0; k < S.length; k += 4) {
        const d1 = Math.hypot(S[k] - cx, S[k + 1] - cy);
        const d2 = Math.hypot(S[k + 2] - cx, S[k + 3] - cy);
        const dmin = Math.sqrt(segPointDist2(S[k], S[k + 1], S[k + 2], S[k + 3], cx, cy));
        const dmax = Math.max(d1, d2);
        maxR = Math.max(maxR, dmax);
        mov.push(S[k] - cx, S[k + 1] - cy, S[k + 2] - cx, S[k + 3] - cy, dmin, dmax, j === i ? 1 : 0);
      }
    }
    // static candidate pairs
    const pairs: number[] = []; // moving seg offset, static seg x1,y1,x2,y2
    const stat: number[] = [];
    for (let b = 0; b < this.n; b++) {
      if (sub[b]) continue;
      const S = ws.segs[b];
      for (let k = 0; k < S.length; k += 4) {
        const dmin = Math.sqrt(segPointDist2(S[k], S[k + 1], S[k + 2], S[k + 3], cx, cy));
        const dmax = Math.max(Math.hypot(S[k] - cx, S[k + 1] - cy), Math.hypot(S[k + 2] - cx, S[k + 3] - cy));
        if (dmin > maxR + COLLIDE) continue;
        const nearB = b === par && dmin < NEAR_HINGE;
        const so = stat.length;
        stat.push(S[k], S[k + 1], S[k + 2], S[k + 3]);
        for (let m = 0; m < mov.length; m += 7) {
          if (dmin > mov[m + 5] + COLLIDE || dmax < mov[m + 4] - COLLIDE) continue;
          if (nearB && mov[m + 6] === 1 && mov[m + 4] < NEAR_HINGE) continue;
          pairs.push(m, so);
        }
      }
    }
    if (!pairs.length) return -1;
    const steps = Math.max(4, Math.ceil((HALF_PI * maxR) / (1.2 * T)));
    for (let s = 1; s <= steps; s++) {
      const a = (dir * HALF_PI * s) / steps;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      for (let q = 0; q < pairs.length; q += 2) {
        const m = pairs[q];
        const so = pairs[q + 1];
        const x1 = cx + mov[m] * c - mov[m + 1] * sn;
        const y1 = cy + mov[m] * sn + mov[m + 1] * c;
        const x2 = cx + mov[m + 2] * c - mov[m + 3] * sn;
        const y2 = cy + mov[m + 2] * sn + mov[m + 3] * c;
        if (segSegDist(x1, y1, x2, y2, stat[so], stat[so + 1], stat[so + 2], stat[so + 3]) < COLLIDE)
          return (s - 1) / steps;
      }
    }
    return -1;
  }

  /** Bitmask of valid moves: bit 2*i for +1 (cw), bit 2*i+1 for -1 (ccw). */
  moves(rots: number[], ws?: WorldState): number {
    const key = this.key(rots);
    const cached = this.moveCache.get(key);
    if (cached !== undefined) return cached;
    const w = ws ?? this.world(rots);
    let mask = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.movable[i]) continue;
      if (this.sweep(w, i, 1) < 0) mask |= 1 << (2 * i);
      if (this.sweep(w, i, -1) < 0) mask |= 1 << (2 * i + 1);
    }
    this.moveCache.set(key, mask);
    return mask;
  }

  /** Is a single item free (clear corridor to the outside)? Returns ray angle or NaN. */
  itemFreeDir(ws: WorldState, item: FreeItem): number {
    const L = 40;
    const clear = ITEM_R * 0.75 + T;
    // collect nearby segs only once
    const segs = ws.segs;
    for (let r = 0; r < RAYS; r++) {
      const a = (r / RAYS) * Math.PI * 2;
      const ex = item.x + Math.cos(a) * L;
      const ey = item.y + Math.sin(a) * L;
      let ok = true;
      for (let p = 0; p < segs.length && ok; p++) {
        const S = segs[p];
        for (let k = 0; k < S.length; k += 4) {
          if (segSegDist(item.x, item.y, ex, ey, S[k], S[k + 1], S[k + 2], S[k + 3]) < clear) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return a;
    }
    return NaN;
  }

  /** Bitmask of items free in this rotation state. */
  freeMask(rots: number[], ws?: WorldState): number {
    const key = this.key(rots);
    const cached = this.freeCache.get(key);
    if (cached !== undefined) return cached;
    const w = ws ?? this.world(rots);
    let mask = 0;
    this.level.items.forEach((it, i) => {
      if (!Number.isNaN(this.itemFreeDir(w, it))) mask |= 1 << i;
    });
    this.freeCache.set(key, mask);
    return mask;
  }
}

export interface SolveResult {
  par: number;
  path: FreeMove[];
  states: number;
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * BFS over (rotations, freed items). Returns shortest move sequence that frees
 * every item, or null when unsolvable within `cap` explored states.
 */
export function solveFree(
  sim: FreeSim,
  startRots: number[],
  startFreed: number,
  cap = 6000,
  trackBounds = false,
): SolveResult | null {
  const nItems = sim.level.items.length;
  const all = (1 << nItems) - 1;
  const startKey = sim.key(startRots) * 16 + (startFreed | sim.freeMask(startRots));
  const prev = new Map<number, [number, number]>(); // key -> [prevKey, moveCode]
  prev.set(startKey, [-1, -1]);
  let frontier = [startKey];
  const bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let explored = 0;
  const grow = (ws: WorldState) => {
    for (const S of ws.segs)
      for (let k = 0; k < S.length; k += 2) {
        if (S[k] < bounds.x0) bounds.x0 = S[k];
        if (S[k] > bounds.x1) bounds.x1 = S[k];
        if (S[k + 1] < bounds.y0) bounds.y0 = S[k + 1];
        if (S[k + 1] > bounds.y1) bounds.y1 = S[k + 1];
      }
  };
  while (frontier.length) {
    const next: number[] = [];
    for (const key of frontier) {
      const freed = key % 16;
      if (freed === all) {
        // reconstruct
        const path: FreeMove[] = [];
        let k = key;
        while (true) {
          const [pk, mv] = prev.get(k)!;
          if (pk < 0) break;
          path.push({ piece: mv >> 1, dir: mv & 1 ? -1 : 1 });
          k = pk;
        }
        path.reverse();
        return { par: path.length, path, states: explored, bounds };
      }
      if (++explored > cap) return null;
      const rots = sim.decode(Math.floor(key / 16));
      const ws = sim.world(rots);
      if (trackBounds) grow(ws);
      const mm = sim.moves(rots, ws);
      for (let i = 0; i < sim.n; i++) {
        for (let d = 0; d < 2; d++) {
          if (!(mm & (1 << (2 * i + d)))) continue;
          const r2 = rots.slice();
          r2[i] = (r2[i] + (d ? 3 : 1)) & 3;
          const f2 = freed | sim.freeMask(r2);
          const k2 = sim.key(r2) * 16 + f2;
          if (prev.has(k2)) continue;
          prev.set(k2, [key, 2 * i + d]);
          next.push(k2);
        }
      }
    }
    frontier = next;
  }
  return null;
}
