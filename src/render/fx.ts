import { Container, Sprite, type Texture } from 'pixi.js';
import { Ease } from '../core/tween';
import { stage } from './stage';
import { tex } from './textures';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  spin: number;
  fade: boolean;
  shrink: boolean;
}

const COLORS = [0xff5d8f, 0xffd54f, 0x4fc3f7, 0x7ee081, 0xb388ff, 0xff9f43];

class Fx {
  layer = new Container();
  private parts: Particle[] = [];

  init(): void {
    stage.fx.addChild(this.layer);
    stage.onUpdate((dt) => this.update(dt));
  }

  burst(
    x: number,
    y: number,
    o: { count?: number; tex?: string; colors?: number[]; speed?: number; size?: number; gravity?: number; life?: number } = {},
  ): void {
    const count = o.count ?? 14;
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex(o.tex ?? 'spark'));
      s.anchor.set(0.5);
      const size = (o.size ?? 16) * (0.6 + Math.random() * 0.8);
      s.width = s.height = size;
      s.tint = (o.colors ?? COLORS)[i % (o.colors ?? COLORS).length];
      s.x = x;
      s.y = y;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 260) * (0.4 + Math.random() * 0.8);
      this.layer.addChild(s);
      const life = (o.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      this.parts.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity ?? 300, life, max: life, spin: (Math.random() - 0.5) * 10, fade: true, shrink: true });
    }
  }

  confetti(): void {
    const W = stage.width;
    for (let i = 0; i < 90; i++) {
      const s = new Sprite(tex(i % 3 === 0 ? 'star4' : 'confetti'));
      s.anchor.set(0.5);
      const size = 10 + Math.random() * 10;
      s.width = i % 3 === 0 ? size : size * 0.55;
      s.height = size;
      s.tint = COLORS[i % COLORS.length];
      s.x = Math.random() * W;
      s.y = -20 - Math.random() * 200;
      this.layer.addChild(s);
      const life = 2.4 + Math.random() * 1.2;
      this.parts.push({ s, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 160, g: 60, life, max: life, spin: (Math.random() - 0.5) * 12, fade: true, shrink: false });
    }
  }

  /** Fly a texture from a point to a target along a curve. */
  fly(
    texture: Texture,
    from: { x: number; y: number },
    to: { x: number; y: number },
    o: { size?: number; dur?: number; delay?: number; via?: { x: number; y: number } } = {},
  ): Promise<void> {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    const size = o.size ?? 48;
    s.width = s.height = size;
    s.x = from.x;
    s.y = from.y;
    s.alpha = 0;
    this.layer.addChild(s);
    const via = o.via ?? { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(from.y, to.y) - 80 };
    return stage.tweens
      .run(
        o.dur ?? 0.75,
        (k) => {
          const u = 1 - k;
          s.alpha = Math.min(1, k * 6);
          s.x = u * u * from.x + 2 * u * k * via.x + k * k * to.x;
          s.y = u * u * from.y + 2 * u * k * via.y + k * k * to.y;
          const sc = 1 + Math.sin(k * Math.PI) * 0.35 - k * 0.35;
          s.width = s.height = size * sc;
          s.rotation = k * Math.PI * 2;
        },
        { ease: Ease.inOutSine, delay: o.delay ?? 0 },
      )
      .then(() => {
        s.destroy();
        this.burst(to.x, to.y, { count: 8, size: 12, speed: 140, gravity: 0, life: 0.4 });
      });
  }

  private update(dt: number): void {
    if (!this.parts.length) return;
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) {
        p.s.destroy();
        continue;
      }
      p.vy += p.g * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      const k = p.life / p.max;
      if (p.fade) p.s.alpha = Math.min(1, k * 2);
      if (p.shrink) p.s.scale.set(p.s.scale.x * (0.98 + 0.02 * k));
      keep.push(p);
    }
    this.parts = keep;
  }
}

export const fx = new Fx();
