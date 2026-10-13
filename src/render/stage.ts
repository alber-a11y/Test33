import { Application, Container } from 'pixi.js';
import { Tweens } from '../core/tween';

/** The single Pixi application with its layers. */
export class Stage {
  app = new Application();
  bg = new Container();
  board = new Container();
  fx = new Container();
  tweens = new Tweens();
  /** Callbacks run every frame with dt in seconds. */
  private updaters = new Set<(dt: number) => void>();

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.bg, this.board, this.fx);
    this.app.ticker.add((t) => {
      const dt = Math.min(0.05, t.deltaMS / 1000);
      this.tweens.tick(dt);
      this.updaters.forEach((fn) => fn(dt));
    });
  }

  onUpdate(fn: (dt: number) => void): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  get width(): number {
    return this.app.screen.width;
  }
  get height(): number {
    return this.app.screen.height;
  }

  pause(): void {
    this.app.ticker.stop();
  }
  resume(): void {
    this.app.ticker.start();
  }
}

export const stage = new Stage();
