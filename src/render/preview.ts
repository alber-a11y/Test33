import { Container, Graphics } from 'pixi.js';
import type { Prim } from '../game/free';
import { getSkin, drawShadow } from './skins';
import { stage } from './stage';

const cache = new Map<string, string>();

/** Render a small sample of a skin to a data URL (for shop cards). */
export async function skinPreview(id: string): Promise<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const skin = getSkin(id);
  const c = new Container();
  const w = 22;
  const shapes: { prims: Prim[]; hue: number }[] = [
    { prims: [{ t: 'arc', cx: 70, cy: 80, r: 44, a0: Math.PI * 0.75, a1: Math.PI * 2.25 }], hue: 0 },
    { prims: [{ t: 'line', x1: 128, y1: 40, x2: 128, y2: 124 }, { t: 'line', x1: 128, y1: 124, x2: 176, y2: 124 }], hue: 5 },
    { prims: [{ t: 'arc', cx: 196, cy: 64, r: 30, a0: Math.PI * 0.5, a1: Math.PI * 1.5 }], hue: 3 },
  ];
  const sh = new Graphics();
  sh.alpha = 0.18;
  sh.position.set(0, 5);
  c.addChild(sh);
  shapes.forEach((s, i) => {
    drawShadow(sh, s.prims, w);
    const g = new Graphics();
    skin.body(g, s.prims, skin.palette[s.hue % skin.palette.length], w, i * 31 + 7);
    c.addChild(g);
  });
  // flow sample
  const flow = new Graphics();
  flow.moveTo(128, 40).lineTo(128, 124).lineTo(176, 124).stroke({ width: w * 0.4, color: skin.flow, cap: 'round', join: 'round' });
  flow.alpha = 0.95;
  c.addChild(flow);
  const bg = new Graphics();
  bg.rect(0, 0, 240, 160).fill({ color: 0xffffff, alpha: 0 });
  c.addChildAt(bg, 0);
  const url = await stage.app.renderer.extract.base64({ target: c, resolution: 2 });
  c.destroy({ children: true });
  cache.set(id, url);
  return url;
}
