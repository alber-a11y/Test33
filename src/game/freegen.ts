import { Rng } from '../core/rng';
import { type FreeItem, type FreeLevel, type FreePiece, type Prim, FreeSim, solveFree } from './free';

const TAU = Math.PI * 2;
const R = 1; // cup radius
const STANDOFF = 0.38; // parent socket length
const ARM = 0.9; // child arm length

export type FreeTemplate = 'tree' | 'flower' | 'lock';

export interface FreeGenParams {
  template: FreeTemplate;
  /** Preferred solution length. */
  targetPar: number;
  /** Number of movable pieces (cups / rings / arms). */
  pieces: number;
  /** Flower only: how many of the pieces hang directly on the hub. */
  arms?: number;
  prizes: number;
  bombs: number;
  locks: number;
  minPar: number;
  maxPar: number;
  slack: number;
  hard?: boolean;
}

interface WPiece {
  /** World-space prims at the initial layout (rot 0). */
  prims: Prim[];
  parent: number;
  /** World hinge position. */
  hx: number;
  hy: number;
  fixed?: boolean;
  locked?: boolean;
  hue: number;
  kind: FreePiece['kind'];
}

function arcPrims(cx: number, cy: number, r: number, gapDir: number, gap: number): Prim[] {
  if (gap <= 0) return [{ t: 'arc', cx, cy, r, a0: 0, a1: TAU }];
  return [{ t: 'arc', cx, cy, r, a0: gapDir + gap / 2, a1: gapDir + TAU - gap / 2 }];
}

function line(x1: number, y1: number, x2: number, y2: number): Prim {
  return { t: 'line', x1, y1, x2, y2 };
}

function angDiff(a: number, b: number): number {
  let d = (((a - b) % TAU) + TAU) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

/** Convert world-layout pieces into hinge-local pieces. */
function toLevel(ws: WPiece[], items: FreeItem[]): FreeLevel {
  const pieces: FreePiece[] = ws.map((p) => {
    const shift = (x: number, y: number): [number, number] => [x - p.hx, y - p.hy];
    const prims: Prim[] = p.prims.map((pr) => {
      if (pr.t === 'line') {
        const [x1, y1] = shift(pr.x1, pr.y1);
        const [x2, y2] = shift(pr.x2, pr.y2);
        return { t: 'line', x1, y1, x2, y2 };
      }
      const [cx, cy] = shift(pr.cx, pr.cy);
      return { ...pr, cx, cy };
    });
    const par = p.parent >= 0 ? ws[p.parent] : null;
    return {
      prims,
      parent: p.parent,
      hx: par ? p.hx - par.hx : p.hx,
      hy: par ? p.hy - par.hy : p.hy,
      rot: 0,
      fixed: p.fixed,
      locked: p.locked,
      hue: p.hue,
      kind: p.kind,
    };
  });
  return {
    mode: 'free',
    pieces,
    items,
    par: 0,
    solution: [],
    bounds: { x0: 0, y0: 0, x1: 0, y1: 0 },
  };
}

interface CupNode {
  cx: number;
  cy: number;
  piece: number;
  /** directions (world) where this cup is connected */
  links: number[];
  body: 'cup' | 'bar' | 'hook';
  prize: boolean;
}

/** Tree / flower: a fixed root (cup or hub) with hinged child cups. */
function buildTree(p: FreeGenParams, rng: Rng): { pieces: WPiece[]; items: FreeItem[] } | null {
  const pieces: WPiece[] = [];
  const nodes: CupNode[] = [];
  const hueBase = rng.int(0, 7);
  const flower = p.template === 'flower';
  const rootR = flower ? 0.85 : R;
  // root
  pieces.push({ prims: [], parent: -1, hx: 0, hy: 0, fixed: true, hue: hueBase, kind: flower ? 'hub' : 'cup' });
  nodes.push({ cx: 0, cy: 0, piece: 0, links: [], body: 'cup', prize: false });

  // flower: arms around the hub with one or two empty slots to make room
  const hubArms = flower ? Math.min(p.pieces, p.arms ?? 5) : 0;
  const dirCount = flower ? hubArms + (hubArms >= 5 ? rng.int(1, 2) : rng.int(0, 1)) : 6;
  const baseAng = flower ? -Math.PI / 2 : rng.pick([0, Math.PI / 6]);
  const allDirs = Array.from({ length: dirCount }, (_, k) => baseAng + (k * TAU) / dirCount);
  const dirs = flower ? rng.shuffle(allDirs.slice()).slice(0, hubArms) : allDirs;

  const sockets: { from: number; ang: number }[] = [];
  let tries = 0;
  while (pieces.length - 1 < p.pieces && tries++ < 200) {
    let parentNode: number;
    let ang: number;
    if (flower && pieces.length - 1 < hubArms) {
      parentNode = 0;
      ang = dirs[pieces.length - 1];
    } else {
      parentNode = rng.int(flower ? 1 : 0, nodes.length - 1);
      const pn = nodes[parentNode];
      if (pn.links.length >= 3 || pn.body !== 'cup') continue;
      const back = pn.links[0];
      const opts = Array.from({ length: 12 }, (_, k) => (k * TAU) / 12 + baseAng).filter(
        (a) => pn.links.every((l) => angDiff(a, l) > 1.0) && (back === undefined || angDiff(a, back) > 1.9),
      );
      if (!opts.length) continue;
      ang = rng.pick(opts);
    }
    const pn = nodes[parentNode];
    const pr = parentNode === 0 ? rootR : R;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const hx = pn.cx + ux * (pr + STANDOFF);
    const hy = pn.cy + uy * (pr + STANDOFF);
    const arm = flower && parentNode === 0 ? ARM + rng.pick([-0.2, 0, 0, 0.35, 0.7]) : ARM + rng.pick([-0.15, 0, 0, 0.3]);
    const cx = hx + ux * (arm + R);
    const cy = hy + uy * (arm + R);
    // keep cups apart
    if (nodes.some((nd) => Math.hypot(nd.cx - cx, nd.cy - cy) < 2 * R + 0.32)) continue;
    const body: CupNode['body'] = rng.chance(flower ? 0.3 : 0.2) ? (rng.chance(0.5) ? 'bar' : 'hook') : 'cup';
    nodes.push({ cx, cy, piece: pieces.length, links: [ang + Math.PI], body, prize: false });
    pn.links.push(ang);
    sockets.push({ from: parentNode, ang });
    pieces.push({
      prims: [line(hx, hy, hx + ux * arm, hy + uy * arm)],
      parent: pn.piece,
      hx,
      hy,
      hue: (hueBase + pieces.length) % 8,
      kind: body,
    });
  }
  if (pieces.length - 1 < p.pieces) return null;

  // choose prize cups (leaves preferred)
  const cupNodes = nodes.slice(1).filter((nd) => nd.body === 'cup');
  const leafCups = rng.shuffle(cupNodes.filter((nd) => nd.links.length === 1));
  const otherCups = rng.shuffle(cupNodes.filter((nd) => nd.links.length > 1));
  const holders = [...leafCups, ...otherCups];
  const needed = p.prizes + p.bombs;
  if (holders.length < needed) return null;
  const items: FreeItem[] = [];
  for (let k = 0; k < needed; k++) {
    const nd = holders[k];
    nd.prize = true;
    items.push({ x: nd.cx, y: nd.cy, kind: k < p.prizes ? 'prize' : 'bomb' });
  }

  // bodies
  nodes.forEach((nd, idx) => {
    const piece = pieces[nd.piece];
    if (idx === 0) {
      if (flower) {
        piece.prims.push(...arcPrims(0, 0, rootR, 0, 0));
      } else {
        const gapDir = pickGap(nd, rng, 1.2);
        piece.prims.push(...arcPrims(0, 0, R, gapDir, 1.2));
      }
    } else if (nd.body === 'cup') {
      const gap = nd.prize ? 0.72 : rng.pick([1.4, 1.8, 2.2]);
      const gapDir = pickGap(nd, rng, gap);
      piece.prims.push(...arcPrims(nd.cx, nd.cy, R, gapDir, gap));
    } else if (nd.body === 'bar') {
      const back = nd.links[0];
      const bx = nd.cx + Math.cos(back) * R;
      const by = nd.cy + Math.sin(back) * R;
      const px = -Math.sin(back);
      const py = Math.cos(back);
      piece.prims.push(line(bx - px * 1.05, by - py * 1.05, bx + px * 1.05, by + py * 1.05));
    } else {
      const back = nd.links[0];
      const rr = 0.8;
      const ccx = nd.cx + Math.cos(back) * (R - rr);
      const ccy = nd.cy + Math.sin(back) * (R - rr);
      piece.prims.push({ t: 'arc', cx: ccx, cy: ccy, r: rr, a0: back - 1.5, a1: back + 1.5 });
    }
    // sockets to children: from rim to hinge
    for (const s of sockets.filter((s) => s.from === idx)) {
      const pr = idx === 0 ? rootR : R;
      const ux = Math.cos(s.ang);
      const uy = Math.sin(s.ang);
      piece.prims.push(line(nd.cx + ux * pr, nd.cy + uy * pr, nd.cx + ux * (pr + STANDOFF), nd.cy + uy * (pr + STANDOFF)));
    }
  });

  // clamps
  const lockable = rng.shuffle(pieces.map((_, i) => i).filter((i) => i > 0));
  for (let k = 0; k < p.locks && k < lockable.length; k++) pieces[lockable[k]].locked = true;
  return { pieces, items };
}

function pickGap(nd: CupNode, rng: Rng, gap: number): number {
  const opts: number[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k * TAU) / 12;
    if (nd.links.every((l) => angDiff(a, l) > gap / 2 + 0.45)) opts.push(a);
  }
  return opts.length ? rng.pick(opts) : (nd.links[0] ?? 0) + Math.PI;
}

/** Concentric rings with gaps and tabs around a central prize. */
function buildLock(p: FreeGenParams, rng: Rng): { pieces: WPiece[]; items: FreeItem[] } | null {
  const rings = Math.max(2, Math.min(4, p.pieces));
  const pieces: WPiece[] = [];
  const hueBase = rng.int(0, 7);
  const spacing = 0.78;
  const gap = 1.25;
  const tabLen = 0.44;
  const gapDirs: number[] = [];
  for (let j = 0; j < rings; j++) {
    const r = 1.0 + j * spacing;
    const gapDir = Math.PI / 4 + rng.int(0, 3) * (Math.PI / 2) + (rng.chance(0.3) ? Math.PI / 4 : 0);
    gapDirs.push(gapDir);
    const prims: Prim[] = [];
    const doubleGap = j >= 2 && rng.chance(0.4);
    if (doubleGap) {
      prims.push({ t: 'arc', cx: 0, cy: 0, r, a0: gapDir + gap / 2, a1: gapDir + Math.PI - gap / 2 });
      prims.push({ t: 'arc', cx: 0, cy: 0, r, a0: gapDir + Math.PI + gap / 2, a1: gapDir + TAU - gap / 2 });
    } else {
      prims.push(...arcPrims(0, 0, r, gapDir, gap));
    }
    // tabs at multiples of 45° avoiding the gap
    const tabCount = rng.int(1, 3);
    const used: number[] = [];
    for (let t = 0; t < tabCount; t++) {
      const a = rng.int(0, 7) * (Math.PI / 4) + Math.PI / 8;
      if (used.some((u) => angDiff(u, a) < 0.5)) continue;
      if (angDiff(a, gapDir) < gap / 2 + 0.2) continue;
      if (doubleGap && angDiff(a, gapDir + Math.PI) < gap / 2 + 0.2) continue;
      used.push(a);
      const out = j < rings - 1 && (j === 0 || rng.chance(0.5));
      const c = Math.cos(a);
      const s = Math.sin(a);
      if (out) prims.push(line(c * r, s * r, c * (r + tabLen), s * (r + tabLen)));
      else if (j > 0) prims.push(line(c * r, s * r, c * (r - tabLen), s * (r - tabLen)));
    }
    pieces.push({ prims, parent: -1, hx: 0, hy: 0, hue: (hueBase + j * 2) % 8, kind: 'ring' });
  }
  if (gapDirs.every((g) => angDiff(g, gapDirs[0]) < 0.1)) return null;
  const items: FreeItem[] = [{ x: 0, y: 0, kind: p.bombs > 0 ? 'bomb' : 'prize' }];
  const lockable = rng.shuffle(pieces.map((_, i) => i));
  for (let k = 0; k < p.locks && k < lockable.length - 1; k++) pieces[lockable[k]].locked = true;
  return { pieces, items };
}

/** Generate a solvable free level (BFS-verified), preferring par near targetPar. */
export function generateFree(p: FreeGenParams, rng: Rng, attempts = 40, budgetMs = 400): FreeLevel | null {
  let best: FreeLevel | null = null;
  const t0 = Date.now();
  for (let a = 0; a < attempts; a++) {
    if (best && Date.now() - t0 > budgetMs) break;
    const built = p.template === 'lock' ? buildLock(p, rng) : buildTree(p, rng);
    if (!built) continue;
    const level = toLevel(built.pieces, built.items);
    const sim = new FreeSim(level);
    const rots = level.pieces.map(() => 0);
    const ws = sim.world(rots);
    if (sim.overlaps(ws)) continue;
    if (sim.freeMask(rots, ws) !== 0) continue;
    // clamps must not make it unsolvable: solve with clamps
    const res = solveFree(sim, rots, 0, 6000, true);
    if (!res) continue;
    if (res.par < p.minPar || res.par > p.maxPar) continue;
    level.par = res.par;
    level.solution = res.path;
    level.bounds = res.bounds;
    if (p.bombs > 0) level.fuse = res.par + p.slack + 2;
    if (p.hard) level.moveLimit = res.par + p.slack;
    if (res.par === p.targetPar) return level;
    if (!best || Math.abs(res.par - p.targetPar) < Math.abs(best.par - p.targetPar)) best = level;
  }
  return best;
}
