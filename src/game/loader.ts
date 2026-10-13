import { type LevelInfo, getLevel } from './levels';

/**
 * Generates levels off the main thread (Web Worker) with a small cache and
 * prefetching of the next level. Falls back to synchronous generation.
 */
class LevelLoader {
  private worker: Worker | null = null;
  private pending = new Map<number, Promise<LevelInfo>>();
  private resolvers = new Map<number, (l: LevelInfo) => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./gen.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<LevelInfo>) => {
        const r = this.resolvers.get(e.data.n);
        this.resolvers.delete(e.data.n);
        r?.(e.data);
      };
      this.worker.onerror = () => {
        this.worker = null;
        for (const [n, r] of this.resolvers) r(getLevel(n));
        this.resolvers.clear();
      };
    } catch {
      this.worker = null;
    }
  }

  get(n: number): Promise<LevelInfo> {
    const hit = this.pending.get(n);
    if (hit) return hit.then((l) => structuredClone(l));
    let p: Promise<LevelInfo>;
    if (this.worker) {
      p = new Promise((res) => {
        this.resolvers.set(n, res);
        this.worker!.postMessage(n);
      });
    } else {
      p = new Promise((res) => setTimeout(() => res(getLevel(n)), 0));
    }
    this.pending.set(n, p);
    if (this.pending.size > 6) this.pending.delete(this.pending.keys().next().value!);
    return p.then((l) => structuredClone(l));
  }

  prefetch(n: number): void {
    if (!this.pending.has(n)) void this.get(n);
  }
}

export const Levels = new LevelLoader();
