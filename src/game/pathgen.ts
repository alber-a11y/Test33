import { Rng } from '../core/rng';
import {
  type PathCell,
  type PathKind,
  type PathLevel,
  DIRS,
  DX,
  DY,
  OPP,
  PERIOD,
  computeFlow,
  computePar,
  kindForMask,
} from './path';

export type ShapeId =
  | 'rect'
  | 'diamond'
  | 'circle'
  | 'heart'
  | 'plus'
  | 'ring'
  | 'hourglass'
  | 'blob'
  | 'arch';

export interface PathGenParams {
  w: number;
  h: number;
  shape: ShapeId;
  targets: number;
  colors: 1 | 2;
  bombs: number;
  bonus: number;
  locks: number;
  links: number;
  /** Fraction of the shape the flow tree covers; the rest are decoys. */
  coverage: number;
  /** 0..1, probability to continue straight while growing the tree. */
  straight: number;
  minPar: number;
  /** Fraction of essential cells that start rotated wrong. */
  scramble: number;
  /** Extra moves above par granted by bombs/move limits. */
  slack: number;
  hard?: boolean;
}

export function makeMask(shape: ShapeId, w: number, h: number, rng: Rng): boolean[] {
  const m: boolean[] = [];
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / (w / 2);
      const v = (y + 0.5 - cy) / (h / 2);
      let ok = true;
      switch (shape) {
        case 'diamond':
          ok = Math.abs(u) + Math.abs(v) <= 1.15;
          break;
        case 'circle':
          ok = u * u + v * v <= 1.12;
          break;
        case 'heart': {
          const X = u * 1.25;
          const Y = -v * 1.3 + 0.35;
          ok = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0.02;
          break;
        }
        case 'plus':
          ok = Math.abs(u) <= 0.42 || Math.abs(v) <= 0.42;
          break;
        case 'ring':
          ok = u * u + v * v <= 1.15 && u * u + v * v >= 0.12;
          break;
        case 'hourglass':
          ok = Math.abs(u) <= Math.abs(v) + 0.45;
          break;
        case 'arch':
          ok = !(v > 0.2 && Math.abs(u) < 0.4);
          break;
        case 'blob':
          ok = u * u + v * v <= 1.25 + rng.range(-0.35, 0.25);
          break;
        default:
          ok = true;
      }
      m.push(ok);
    }
  // keep the largest connected component
  const comp = new Array(w * h).fill(-1);
  let best = -1;
  let bestSize = 0;
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = id;
    let size = 0;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % w;
      const y = Math.floor(c / w);
      for (const d of DIRS) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (m[ni] && comp[ni] < 0) {
          comp[ni] = id;
          stack.push(ni);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
    id++;
  }
  return m.map((v, i) => v && comp[i] === best);
}

interface Tree {
  /** port mask per cell (0 = not in tree) */
  ports: number[];
  owner: number[];
  parent: number[];
  dist: number[];
}

function neighbors(i: number, w: number, h: number): [number, number][] {
  const x = i % w;
  const y = Math.floor(i / w);
  const out: [number, number][] = [];
  for (const d of DIRS) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    out.push([ny * w + nx, d]);
  }
  return out;
}

function growForest(
  mask: boolean[],
  w: number,
  h: number,
  sources: number[],
  budget: number,
  straight: number,
  rng: Rng,
): Tree {
  const n = w * h;
  const ports = new Array(n).fill(0);
  const owner = new Array(n).fill(-1);
  const parent = new Array(n).fill(-1);
  const dist = new Array(n).fill(0);
  const lastDir = new Array(n).fill(0);
  const active: number[][] = sources.map((s, k) => {
    owner[s] = k;
    return [s];
  });
  let count = sources.length;
  const sizes = sources.map(() => 1);
  while (count < budget) {
    // grow the smallest tree that still has room
    const order = sources.map((_, k) => k).sort((a, b) => sizes[a] - sizes[b]);
    let grown = false;
    for (const k of order) {
      const act = active[k];
      while (act.length) {
        // growing-tree: mostly newest (long corridors), sometimes random (branches)
        const pickIdx = rng.chance(0.7) ? act.length - 1 : rng.int(0, act.length - 1);
        const c = act[pickIdx];
        const opts = neighbors(c, w, h).filter(([ni]) => mask[ni] && owner[ni] < 0);
        const isSource = sources.includes(c);
        if (!opts.length || (isSource && ports[c] !== 0)) {
          act.splice(pickIdx, 1);
          continue;
        }
        let choice = rng.pick(opts);
        const straightOpt = opts.find(([, d]) => d === lastDir[c]);
        if (straightOpt && rng.chance(straight)) choice = straightOpt;
        const [ni, d] = choice;
        ports[c] |= d;
        ports[ni] |= OPP[d];
        owner[ni] = k;
        parent[ni] = c;
        dist[ni] = dist[c] + 1;
        lastDir[ni] = d;
        act.push(ni);
        sizes[k]++;
        count++;
        grown = true;
        break;
      }
      if (grown) break;
    }
    if (!grown) break;
  }
  return { ports, owner, parent, dist };
}

const DECOYS: PathKind[] = ['L', 'L', 'L', 'I', 'I', 'D', 'D', 'D', 'T'];

/** Generate a solvable path level. Returns null when constraints fail. */
export function generatePath(p: PathGenParams, rng: Rng): PathLevel | null {
  const { w, h } = p;
  const mask = makeMask(p.shape, w, h, rng);
  const cellsIdx = mask.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (cellsIdx.length < 3) return null;

  // pick sources on the border of the shape, far apart
  const isBorder = (i: number) =>
    neighbors(i, w, h).length < 4 || neighbors(i, w, h).some(([ni]) => !mask[ni]);
  const borderCells = cellsIdx.filter(isBorder);
  const sources: number[] = [];
  const first = rng.pick(borderCells.length ? borderCells : cellsIdx);
  sources.push(first);
  if (p.colors === 2) {
    const fx = first % w;
    const fy = Math.floor(first / w);
    const far = [...borderCells].sort(
      (a, b) =>
        Math.abs((b % w) - fx) + Math.abs(Math.floor(b / w) - fy) -
        (Math.abs((a % w) - fx) + Math.abs(Math.floor(a / w) - fy)),
    );
    sources.push(far[rng.int(0, Math.min(2, far.length - 1))]);
  }
  const budget = Math.max(sources.length * 3, Math.round(cellsIdx.length * p.coverage));
  const tree = growForest(mask, w, h, sources, budget, p.straight, rng);

  // leaves: in-tree cells with exactly one port, excluding sources
  const bitCount = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1));
  const leaves = cellsIdx.filter(
    (i) => tree.owner[i] >= 0 && bitCount(tree.ports[i]) === 1 && !sources.includes(i),
  );
  const roles = new Map<number, 'G' | 'bomb' | 'bonus'>();
  const goalColor = new Map<number, number>();
  for (let k = 0; k < sources.length; k++) {
    const mine = leaves.filter((i) => tree.owner[i] === k).sort((a, b) => tree.dist[b] - tree.dist[a]);
    const want = p.colors === 2 ? Math.max(1, Math.round(p.targets / 2)) : p.targets;
    if (mine.length < want) return null;
    let placed = 0;
    for (const leaf of mine) {
      if (placed >= want) break;
      if (tree.dist[leaf] < 2) continue;
      roles.set(leaf, 'G');
      goalColor.set(leaf, k);
      placed++;
    }
    if (placed < want) return null;
  }
  const spare = rng.shuffle(leaves.filter((i) => !roles.has(i) && tree.dist[i] >= 2));
  for (let b = 0; b < p.bombs && spare.length; b++) roles.set(spare.pop()!, 'bomb');
  for (let b = 0; b < p.bonus && spare.length; b++) roles.set(spare.pop()!, 'bonus');
  if ([...roles.values()].filter((r) => r === 'bomb').length < p.bombs) return null;

  // essential cells: tree paths from goals/bombs back to sources
  const essential = new Set<number>();
  for (const [leaf, role] of roles) {
    if (role === 'bonus') continue;
    let c = leaf;
    while (c >= 0) {
      essential.add(c);
      c = tree.parent[c];
    }
  }

  const cells: (PathCell | null)[] = new Array(w * h).fill(null);
  let hueSeed = rng.int(0, 7);
  for (const i of cellsIdx) {
    let cell: PathCell;
    if (tree.owner[i] >= 0) {
      const { kind, rot } = kindForMask(tree.ports[i]);
      cell = { kind, rot, sol: rot, hue: (hueSeed + rng.int(0, 2)) % 8, essential: essential.has(i) };
      if (sources.includes(i)) {
        cell.kind = 'S';
        cell.fixed = true;
        cell.color = sources.indexOf(i);
      } else if (roles.get(i) === 'G') {
        cell.kind = 'G';
        cell.fixed = true;
        cell.color = goalColor.get(i);
      } else if (roles.get(i) === 'bomb') {
        cell.bomb = true;
      } else if (roles.get(i) === 'bonus') {
        cell.bonus = true;
      }
    } else {
      const kind = rng.pick(DECOYS);
      const rot = rng.int(0, 3);
      cell = { kind, rot, sol: rot, hue: (hueSeed + rng.int(0, 2)) % 8, essential: false };
    }
    hueSeed = (hueSeed + (rng.chance(0.25) ? 1 : 0)) % 8;
    cells[i] = cell;
  }

  const level: PathLevel = { mode: 'path', w, h, cells, par: 0, colors: p.colors };

  // locks: some essential cells fixed in solved orientation, some decoys fixed randomly
  const lockable = rng.shuffle(
    cellsIdx.filter((i) => !cells[i]!.fixed && !cells[i]!.bomb),
  );
  for (let k = 0, placed = 0; k < lockable.length && placed < p.locks; k++) {
    const c = cells[lockable[k]]!;
    if (PERIOD[c.kind] === 1) continue;
    c.locked = true;
    placed++;
  }

  // links: adjacent unlocked pairs
  let linkId = 0;
  const linkable = rng.shuffle(cellsIdx.filter((i) => !cells[i]!.locked && !cells[i]!.fixed && cells[i]!.essential));
  for (const i of linkable) {
    if (linkId >= p.links) break;
    const a = cells[i]!;
    if (a.link !== undefined || PERIOD[a.kind] === 1) continue;
    const nb = rng
      .shuffle(neighbors(i, w, h))
      .map(([ni]) => ni)
      .find((ni) => {
        const b = cells[ni];
        return b && !b.locked && !b.fixed && b.link === undefined && PERIOD[b.kind] > 1;
      });
    if (nb === undefined) continue;
    a.link = linkId;
    cells[nb]!.link = linkId;
    linkId++;
  }

  // scramble
  for (let attempt = 0; attempt < 30; attempt++) {
    const groupShift = new Map<number, number>();
    for (const i of cellsIdx) {
      const c = cells[i]!;
      if (c.locked || c.fixed) {
        c.rot = c.sol;
        continue;
      }
      let k: number;
      if (c.link !== undefined) {
        if (!groupShift.has(c.link)) groupShift.set(c.link, rng.int(1, 3));
        k = groupShift.get(c.link)!;
      } else if (c.essential) {
        k = rng.chance(p.scramble) ? (rng.chance(0.4 + p.scramble * 0.5) ? rng.int(1, 3) : 1) : 0;
      } else {
        k = rng.int(0, 3);
      }
      c.rot = (c.sol + k) % 4;
    }
    level.par = computePar(level);
    if (level.par >= p.minPar && !computeFlow(level).targetsOk) break;
    if (attempt === 29) return null;
  }

  if (p.bombs > 0) level.fuse = level.par + p.slack + 2;
  if (p.hard) level.moveLimit = level.par + p.slack;
  return level;
}
