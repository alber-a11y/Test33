/**
 * Mode A — "Build the path". Grid of rotatable tiles; flow travels from sources
 * through connected tile channels to targets.
 */

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const DIRS = [N, E, S, W] as const;
export const DX: Record<number, number> = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
export const DY: Record<number, number> = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
export const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

/**
 * I straight, L corner, T tee, X cross, E end-cap, S source, G goal,
 * D double corner (two separate arcs), B bridge (two separate straights).
 */
export type PathKind = 'I' | 'L' | 'T' | 'X' | 'E' | 'S' | 'G' | 'D' | 'B';

export const BASE_CHANNELS: Record<PathKind, number[]> = {
  I: [N | S],
  L: [N | E],
  T: [N | E | W],
  X: [N | E | S | W],
  E: [N],
  S: [N],
  G: [N],
  D: [N | E, S | W],
  B: [N | S, E | W],
};

export const PERIOD: Record<PathKind, number> = {
  I: 2,
  L: 4,
  T: 4,
  X: 1,
  E: 4,
  S: 4,
  G: 4,
  D: 2,
  B: 1,
};

export interface PathCell {
  kind: PathKind;
  /** Current rotation in clockwise quarter turns. */
  rot: number;
  /** Solved rotation (meaningful for essential cells). */
  sol: number;
  locked?: boolean;
  /** Sources and goals never rotate. */
  fixed?: boolean;
  /** Cells sharing a link id rotate together. */
  link?: number;
  /** Flow color index for sources and goals. */
  color?: number;
  /** A bomb sits here: flow must reach it before the fuse runs out. */
  bomb?: boolean;
  /** Optional bonus prize collected when flow reaches the cell. */
  bonus?: boolean;
  /** Part of the intended solution. */
  essential?: boolean;
  /** Decorative color slot. */
  hue: number;
}

export interface PathLevel {
  mode: 'path';
  w: number;
  h: number;
  cells: (PathCell | null)[];
  par: number;
  colors: number;
  moveLimit?: number;
  fuse?: number;
}

export function rotMask(mask: number, rot: number): number {
  let m = mask;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export function channels(cell: PathCell): number[] {
  return BASE_CHANNELS[cell.kind].map((m) => rotMask(m, cell.rot));
}

/** Rotation k such that the base channel of `kind` matches `mask`, or -1. */
export function rotFor(kind: PathKind, mask: number): number {
  for (let k = 0; k < 4; k++) if (rotMask(BASE_CHANNELS[kind][0], k) === mask) return k;
  return -1;
}

export function kindForMask(mask: number): { kind: PathKind; rot: number } {
  const bits = [N, E, S, W].filter((d) => mask & d).length;
  let kind: PathKind;
  if (bits === 1) kind = 'E';
  else if (bits === 2) kind = mask === (N | S) || mask === (E | W) ? 'I' : 'L';
  else if (bits === 3) kind = 'T';
  else kind = 'X';
  return { kind, rot: rotFor(kind, mask) };
}

export interface FlowResult {
  /** lit[cellIndex][channel] = bitmask of colors reaching it. */
  lit: number[][];
  /** BFS depth per cell/channel, used to cascade the light-up animation. */
  depth: number[][];
  targetsOk: boolean;
  /** Cells with bombs/bonus currently reached by any flow. */
  reached: Set<number>;
}

export function computeFlow(level: PathLevel): FlowResult {
  const { w, h, cells } = level;
  const lit = cells.map((c) => (c ? BASE_CHANNELS[c.kind].map(() => 0) : []));
  const depth = cells.map((c) => (c ? BASE_CHANNELS[c.kind].map(() => 1e9) : []));
  const chans = cells.map((c) => (c ? channels(c) : []));
  const reached = new Set<number>();

  cells.forEach((c, idx) => {
    if (!c || c.kind !== 'S') return;
    const bit = 1 << (c.color ?? 0);
    const queue: [number, number, number][] = [[idx, 0, 0]];
    lit[idx][0] |= bit;
    depth[idx][0] = 0;
    while (queue.length) {
      const [ci, ch, d] = queue.shift()!;
      reached.add(ci);
      const mask = chans[ci][ch];
      const x = ci % w;
      const y = Math.floor(ci / w);
      for (const dir of DIRS) {
        if (!(mask & dir)) continue;
        const nx = x + DX[dir];
        const ny = y + DY[dir];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        const nc = cells[ni];
        if (!nc) continue;
        const nch = chans[ni].findIndex((m) => m & OPP[dir]);
        if (nch < 0) continue;
        if (depth[ni][nch] > d + 1) depth[ni][nch] = d + 1;
        if (lit[ni][nch] & bit) continue;
        lit[ni][nch] |= bit;
        queue.push([ni, nch, d + 1]);
      }
    }
  });

  let targetsOk = true;
  cells.forEach((c, idx) => {
    if (c && c.kind === 'G') {
      const want = 1 << (c.color ?? 0);
      if (lit[idx][0] !== want) targetsOk = false;
    }
  });
  return { lit, depth, targetsOk, reached };
}

/** Indices of cells that rotate together with `idx`. */
export function linkedGroup(level: PathLevel, idx: number): number[] {
  const c = level.cells[idx];
  if (!c) return [];
  if (c.link === undefined) return [idx];
  const out: number[] = [];
  level.cells.forEach((o, i) => {
    if (o && o.link === c.link) out.push(i);
  });
  return out;
}

export function canRotate(level: PathLevel, idx: number): boolean {
  return linkedGroup(level, idx).every((i) => !level.cells[i]!.locked && !level.cells[i]!.fixed);
}

/** Minimum taps for a group to reach solved state (essential members only). */
export function groupTaps(level: PathLevel, group: number[]): number {
  for (let k = 0; k < 4; k++) {
    const ok = group.every((i) => {
      const c = level.cells[i]!;
      if (!c.essential) return true;
      const p = PERIOD[c.kind];
      return (((c.rot + k - c.sol) % p) + p) % p === 0;
    });
    if (ok) return k;
  }
  return 0;
}

export function computePar(level: PathLevel): number {
  const seen = new Set<number>();
  let par = 0;
  level.cells.forEach((c, i) => {
    if (!c || seen.has(i) || c.locked || c.fixed) return;
    const g = linkedGroup(level, i);
    g.forEach((j) => seen.add(j));
    par += groupTaps(level, g);
  });
  return par;
}

export function cloneLevel<T>(l: T): T {
  return JSON.parse(JSON.stringify(l));
}
