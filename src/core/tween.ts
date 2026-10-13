export type Ease = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
};

interface Tween {
  t: number;
  dur: number;
  delay: number;
  ease: Ease;
  update: (v: number) => void;
  done?: () => void;
  resolve: () => void;
  tag?: unknown;
}

/** Frame-driven tweens. Paused automatically together with the game ticker. */
export class Tweens {
  private list: Tween[] = [];

  /** Animate 0..1 over `dur` seconds. */
  run(
    dur: number,
    update: (v: number) => void,
    opts: { ease?: Ease; delay?: number; done?: () => void; tag?: unknown } = {},
  ): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({
        t: 0,
        dur: Math.max(0.0001, dur),
        delay: opts.delay ?? 0,
        ease: opts.ease ?? Ease.outCubic,
        update,
        done: opts.done,
        resolve,
        tag: opts.tag,
      });
    });
  }

  wait(sec: number): Promise<void> {
    return this.run(sec, () => {}, { ease: Ease.linear });
  }

  /** Stop tweens with this tag; their promises resolve immediately. */
  killTag(tag: unknown): void {
    const killed = this.list.filter((tw) => tw.tag === tag);
    if (!killed.length) return;
    this.list = this.list.filter((tw) => tw.tag !== tag);
    killed.forEach((tw) => tw.resolve());
  }

  /** Drop everything (pending promises never resolve, so continuations of a torn-down scene don't run). */
  clear(): void {
    this.list = [];
  }

  tick(dt: number): void {
    if (!this.list.length) return;
    const finished: Tween[] = [];
    for (const tw of this.list) {
      let step = dt;
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
        step = -tw.delay;
        tw.delay = 0;
      }
      tw.t += step;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(tw.ease(k));
      if (k >= 1) finished.push(tw);
    }
    if (finished.length) {
      this.list = this.list.filter((tw) => !finished.includes(tw));
      for (const tw of finished) {
        tw.done?.();
        tw.resolve();
      }
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
