import { HAND_LEVELS, type PrizeKind, type ThemeId, isHardLevel, prizeOf, themeOf } from '../config';
import { Rng, hashSeed } from '../core/rng';
import type { FreeLevel } from './free';
import { type FreeGenParams, generateFree } from './freegen';
import type { PathLevel } from './path';
import { type PathGenParams, type ShapeId, generatePath } from './pathgen';

export type Mode = 'path' | 'free';

export interface LevelInfo {
  n: number;
  mode: Mode;
  hard: boolean;
  theme: ThemeId;
  prize: PrizeKind;
  data: PathLevel | FreeLevel;
}

type PathSpec = { mode: 'path'; seed?: number } & Partial<PathGenParams>;
type FreeSpec = { mode: 'free'; seed?: number } & Partial<FreeGenParams>;
type Spec = PathSpec | FreeSpec;

const P = (o: Partial<PathGenParams> = {}): PathSpec => ({ mode: 'path', ...o });
const F = (o: Partial<FreeGenParams> = {}): FreeSpec => ({ mode: 'free', ...o });

/** Curated first 30 levels: tutorials, then each mechanic introduced gently. */
const HAND: Spec[] = [
  /* 1 */ P({ w: 3, h: 1, shape: 'rect', coverage: 1, minPar: 1, scramble: 1 }),
  /* 2 */ P({ w: 3, h: 3, shape: 'rect', coverage: 0.7, minPar: 2, scramble: 0.5 }),
  /* 3 */ P({ w: 3, h: 4, shape: 'rect', coverage: 0.8, minPar: 3, scramble: 0.55 }),
  /* 4 */ P({ w: 5, h: 5, shape: 'heart', coverage: 0.8, minPar: 4, scramble: 0.6 }),
  /* 5 */ P({ w: 4, h: 4, shape: 'rect', coverage: 0.9, bonus: 1, minPar: 5, scramble: 0.65 }),
  /* 6 */ F({ template: 'tree', pieces: 1, prizes: 1, targetPar: 1 }),
  /* 7 */ F({ template: 'tree', pieces: 2, prizes: 1, targetPar: 2 }),
  /* 8 */ F({ template: 'tree', pieces: 3, prizes: 2, targetPar: 3 }),
  /* 9 */ F({ template: 'lock', pieces: 2, prizes: 1, targetPar: 2 }),
  /* 10 */ P({ w: 5, h: 5, shape: 'diamond', coverage: 0.85, minPar: 7, hard: true, slack: 6 }),
  /* 11 */ P({ w: 4, h: 5, shape: 'rect', coverage: 0.75, locks: 2, bonus: 1, minPar: 6 }),
  /* 12 */ F({ template: 'flower', pieces: 4, arms: 4, prizes: 2, targetPar: 4 }),
  /* 13 */ P({ w: 5, h: 5, shape: 'circle', coverage: 0.8, targets: 2, minPar: 7 }),
  /* 14 */ F({ template: 'tree', pieces: 4, prizes: 2, targetPar: 3 }),
  /* 15 */ P({ w: 4, h: 5, shape: 'rect', coverage: 0.85, links: 1, minPar: 6 }),
  /* 16 */ F({ template: 'lock', pieces: 3, prizes: 1, targetPar: 3 }),
  /* 17 */ P({ w: 5, h: 5, shape: 'plus', coverage: 0.9, bonus: 2, locks: 2, minPar: 7 }),
  /* 18 */ F({ template: 'flower', pieces: 5, arms: 4, prizes: 2, locks: 1, targetPar: 4 }),
  /* 19 */ P({ w: 5, h: 6, shape: 'rect', coverage: 0.8, targets: 2, links: 1, minPar: 9 }),
  /* 20 */ F({ template: 'flower', pieces: 5, arms: 5, prizes: 1, bombs: 1, targetPar: 5, hard: true, slack: 4 }),
  /* 21 */ P({ w: 5, h: 5, shape: 'rect', coverage: 0.85, bombs: 1, bonus: 1, minPar: 8, slack: 5 }),
  /* 22 */ F({ template: 'flower', pieces: 5, arms: 5, prizes: 2, targetPar: 5 }),
  /* 23 */ P({ w: 6, h: 6, shape: 'ring', coverage: 0.85, targets: 2, locks: 2, minPar: 10 }),
  /* 24 */ F({ template: 'lock', pieces: 4, prizes: 1, targetPar: 3 }),
  /* 25 */ P({ w: 5, h: 6, shape: 'rect', coverage: 0.9, colors: 2, targets: 2, minPar: 9 }),
  /* 26 */ F({ template: 'flower', pieces: 6, arms: 4, prizes: 2, bombs: 1, targetPar: 5, slack: 4 }),
  /* 27 */ P({ w: 6, h: 6, shape: 'heart', coverage: 0.85, targets: 2, bonus: 2, links: 2, minPar: 11 }),
  /* 28 */ F({ template: 'flower', pieces: 6, arms: 5, prizes: 2, locks: 1, targetPar: 5 }),
  /* 29 */ P({ w: 6, h: 7, shape: 'hourglass', coverage: 0.85, colors: 2, targets: 2, bombs: 1, minPar: 11, slack: 5 }),
  /* 30 */ F({ template: 'flower', pieces: 6, arms: 5, prizes: 2, bombs: 1, targetPar: 5, hard: true, slack: 4 }),
];

const PATH_DEFAULTS: PathGenParams = {
  w: 4,
  h: 4,
  shape: 'rect',
  targets: 1,
  colors: 1,
  bombs: 0,
  bonus: 0,
  locks: 0,
  links: 0,
  coverage: 0.8,
  straight: 0.5,
  minPar: 3,
  scramble: 0.85,
  slack: 5,
};

const FREE_DEFAULTS: FreeGenParams = {
  template: 'tree',
  targetPar: 3,
  pieces: 3,
  prizes: 1,
  bombs: 0,
  locks: 0,
  minPar: 1,
  maxPar: 12,
  slack: 4,
};

const modeMemo: Mode[] = [];

export function modeOf(n: number): Mode {
  if (n <= HAND_LEVELS) return HAND[n - 1].mode;
  if (modeMemo[n]) return modeMemo[n];
  for (let k = Math.max(HAND_LEVELS + 1, modeMemo.length); k <= n; k++) {
    if (modeMemo[k]) continue;
    let m: Mode = hashSeed('mode', k) % 2 === 0 ? 'path' : 'free';
    const a = k - 1 <= HAND_LEVELS ? HAND[k - 2].mode : modeMemo[k - 1];
    const b = k - 2 <= HAND_LEVELS ? HAND[k - 3].mode : modeMemo[k - 2];
    if (a === m && b === m) m = m === 'path' ? 'free' : 'path';
    modeMemo[k] = m;
  }
  return modeMemo[n];
}

/** 0..1 difficulty for generated levels with a sawtooth rhythm. */
export function difficulty(n: number): number {
  let d = Math.min(1, (n - HAND_LEVELS) / 160) * 0.85 + 0.15;
  if (n % 10 === 0) d = Math.min(1, d + 0.15);
  else if (n % 5 === 0) d *= 0.6;
  return d;
}

const SHAPES_EASY: ShapeId[] = ['rect', 'diamond', 'circle', 'heart', 'plus'];
const SHAPES_ALL: ShapeId[] = ['rect', 'diamond', 'circle', 'heart', 'plus', 'ring', 'hourglass', 'blob', 'arch'];

function genSpec(n: number, rng: Rng): Spec {
  const d = difficulty(n);
  const hard = isHardLevel(n);
  if (modeOf(n) === 'path') {
    const w = 4 + Math.round(d * 2.6 + rng.range(-0.4, 0.4));
    const h = Math.min(8, w + rng.int(0, 2));
    return P({
      w,
      h,
      shape: rng.pick(d < 0.35 ? SHAPES_EASY : SHAPES_ALL),
      targets: 1 + (d > 0.3 && rng.chance(0.5) ? 1 : 0) + (d > 0.75 && rng.chance(0.3) ? 1 : 0),
      colors: d > 0.45 && rng.chance(0.3) ? 2 : 1,
      bombs: d > 0.25 && rng.chance(0.35) ? (d > 0.65 && rng.chance(0.4) ? 2 : 1) : 0,
      bonus: rng.int(0, 2),
      locks: Math.round(d * 4 * rng.next()),
      links: d > 0.35 ? rng.int(0, d > 0.7 ? 3 : 1) : 0,
      coverage: rng.range(0.65, 1),
      straight: rng.range(0.3, 0.7),
      minPar: Math.round(4 + d * 10),
      scramble: 0.6 + d * 0.35,
      slack: Math.max(3, Math.round(7 - d * 4)),
      hard,
    });
  }
  const r = rng.next();
  let spec: FreeSpec;
  if (d < 0.25) {
    spec =
      r < 0.25
        ? F({ template: 'tree', pieces: rng.int(3, 4), prizes: 2 })
        : r < 0.75
          ? F({ template: 'flower', arms: 4, pieces: rng.int(4, 5), prizes: 2 })
          : F({ template: 'lock', pieces: 3 });
  } else if (d < 0.55) {
    spec =
      r < 0.7
        ? F({ template: 'flower', arms: rng.int(4, 5), pieces: rng.int(5, 6), prizes: 2 })
        : F({ template: 'lock', pieces: rng.int(3, 4) });
  } else {
    spec =
      r < 0.8
        ? F({ template: 'flower', arms: rng.int(4, 5), pieces: rng.int(6, 7), prizes: rng.int(2, 3) })
        : F({ template: 'lock', pieces: 4 });
  }
  spec.targetPar = spec.template === 'lock' ? 3 + Math.round(d * 2) : 3 + Math.round(d * 4);
  spec.minPar = Math.max(2, spec.targetPar - 2);
  spec.locks = d > 0.4 && rng.chance(0.4) ? 1 : 0;
  spec.bombs = d > 0.3 && spec.template === 'flower' && rng.chance(0.35) ? 1 : 0;
  if (spec.bombs && (spec.prizes ?? 1) > 1) spec.prizes = (spec.prizes ?? 2) - 1;
  spec.slack = Math.max(3, Math.round(6 - d * 3));
  spec.hard = hard;
  return spec;
}

const cache = new Map<number, LevelInfo>();

export function getLevel(n: number): LevelInfo {
  const hit = cache.get(n);
  if (hit) return structuredClone(hit);
  const rng = new Rng(hashSeed('capy-twist', n));
  const spec = n <= HAND_LEVELS ? HAND[n - 1] : genSpec(n, rng);
  let data: PathLevel | FreeLevel | null = null;
  if (spec.mode === 'path') {
    const params = { ...PATH_DEFAULTS, ...spec } as PathGenParams;
    for (let k = 0; k < 40 && !data; k++) {
      data = generatePath(params, rng);
      if (!data && k % 8 === 7) params.minPar = Math.max(1, params.minPar - 2);
    }
  } else {
    const params = { ...FREE_DEFAULTS, ...spec } as FreeGenParams;
    if (spec.minPar === undefined) params.minPar = Math.max(1, params.targetPar - 1);
    data = generateFree(params, rng, 24);
    if (!data) data = generateFree({ ...params, minPar: 1 }, rng, 24);
    if (!data) data = generateFree({ ...params, template: 'lock', pieces: 2, locks: 0, bombs: 0, minPar: 1 }, rng, 40);
  }
  if (!data) {
    // ultimate fallback: a tiny path level always exists
    data = generatePath({ ...PATH_DEFAULTS, w: 3, h: 3, minPar: 1 }, new Rng(n))!;
  }
  const info: LevelInfo = {
    n,
    mode: data.mode,
    hard: isHardLevel(n),
    theme: themeOf(n),
    prize: prizeOf(n),
    data,
  };
  cache.set(n, info);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return structuredClone(info);
}
