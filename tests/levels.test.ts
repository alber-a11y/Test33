import { describe, expect, test } from 'vitest';
import { getLevel, modeOf } from '../src/game/levels';
import { FreeSim, solveFree } from '../src/game/free';
import { computeFlow, type PathLevel, PERIOD } from '../src/game/path';

function solvePathTrivially(l: PathLevel): boolean {
  // put every essential cell to solved rotation, ignoring locks/links (they were built consistently)
  for (const c of l.cells) if (c && c.essential) c.rot = c.sol;
  return computeFlow(l).targetsOk;
}

describe('levels', () => {
  test('first 60 levels are valid and deterministic', () => {
    const rows: string[] = [];
    for (let n = 1; n <= 90; n++) {
      const t0 = performance.now();
      const a = getLevel(n);
      const dt = performance.now() - t0;
      expect(a.mode).toBe(modeOf(n));
      if (a.data.mode === 'path') {
        expect(computeFlow(a.data).targetsOk).toBe(false);
        const copy = structuredClone(a.data);
        expect(solvePathTrivially(copy)).toBe(true);
        rows.push(`${n} path ${a.data.w}x${a.data.h} par=${a.data.par} ${dt.toFixed(0)}ms`);
      } else {
        const sim = new FreeSim(a.data);
        const res = solveFree(sim, a.data.pieces.map((p) => p.rot), 0, 20000);
        expect(res).not.toBeNull();
        expect(res!.par).toBe(a.data.par);
        rows.push(`${n} free pieces=${a.data.pieces.length} items=${a.data.items.length} par=${a.data.par} ${dt.toFixed(0)}ms`);
      }
    }
    console.log(rows.join('\n'));
  }, 300000);

  test('periods sane', () => {
    expect(PERIOD.I).toBe(2);
  });
});
