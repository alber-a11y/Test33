import { Container, Sprite } from 'pixi.js';
import type { ThemeId } from '../config';
import { stage } from './stage';
import { tex } from './textures';

interface ThemeDef {
  sky: string;
  dark: boolean;
  scenery: string;
  particles: { tex: string; colors: number[]; count: number; motion: 'fall' | 'rise' | 'float' | 'twinkle'; size: [number, number]; speed: number; alpha?: number };
  accent: string;
}

const hills = (c1: string, c2: string, c3: string) => `
  <path d="M0 230 C60 200 120 205 180 222 C250 240 320 200 400 214 V300 H0Z" fill="${c1}"/>
  <path d="M0 252 C80 232 150 250 220 240 C290 230 340 246 400 238 V300 H0Z" fill="${c2}"/>
  <path d="M0 274 C90 262 170 280 260 268 C320 260 360 270 400 266 V300 H0Z" fill="${c3}"/>`;

const cloud = (x: number, y: number, s: number, o = 0.9) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}"><ellipse cx="0" cy="0" rx="26" ry="12"/><ellipse cx="-16" cy="4" rx="16" ry="9"/><ellipse cx="18" cy="5" rx="18" ry="9"/><ellipse cx="4" cy="-8" rx="15" ry="11"/></g>`;

const pine = (x: number, y: number, s: number, c: string, snow = false) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="0" width="6" height="12" fill="#6D4C41"/><path d="M0 -46 L18 -14 H8 L22 6 H-22 L-8 -14 H-18Z" fill="${c}"/>${snow ? '<path d="M0 -46 L9 -30 Q0 -26 -9 -30Z M-8 -14 H8 L12 -8 Q0 -4 -12 -8Z" fill="#fff"/>' : ''}</g>`;

const roundTree = (x: number, y: number, s: number, c: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-4" width="6" height="18" fill="#7B5236"/><circle cx="0" cy="-16" r="16" fill="${c}"/><circle cx="-10" cy="-8" r="10" fill="${c}"/><circle cx="10" cy="-8" r="10" fill="${c}"/><circle cx="-5" cy="-21" r="5" fill="#fff" opacity=".18"/></g>`;

export const THEME_DEFS: Record<ThemeId, ThemeDef> = {
  meadow: {
    sky: 'linear-gradient(180deg,#9ee1ff 0%,#d4f3ff 45%,#fff7e0 100%)',
    dark: false,
    accent: '#4caf50',
    scenery: `${cloud(70, 50, 1.1)}${cloud(300, 80, 0.8)}${cloud(200, 30, 0.6, 0.7)}
      ${hills('#9be38c', '#7dd36f', '#5fc35a')}
      ${roundTree(40, 228, 1, '#4caf50')}${roundTree(360, 222, 1.2, '#43a047')}
      ${[30, 90, 150, 240, 310, 370].map((x, i) => `<circle cx="${x}" cy="${282 - (i % 2) * 6}" r="3" fill="${['#ff7aa8', '#fff', '#ffd54f'][i % 3]}"/>`).join('')}`,
    particles: { tex: 'petal', colors: [0xffc1d9, 0xffffff, 0xfff3a6], count: 18, motion: 'fall', size: [8, 14], speed: 18 },
  },
  autumn: {
    sky: 'linear-gradient(180deg,#ffd7a1 0%,#ffe9c9 50%,#fff4e4 100%)',
    dark: false,
    accent: '#e8772e',
    scenery: `${cloud(320, 60, 0.9, 0.8)}
      ${hills('#f0b05a', '#e09040', '#c9772d')}
      ${roundTree(50, 226, 1.2, '#f57c00')}${roundTree(110, 236, 0.9, '#e53935')}${roundTree(350, 222, 1.3, '#ffb300')}${roundTree(290, 240, 0.8, '#ef6c00')}`,
    particles: { tex: 'leaf', colors: [0xff8a3d, 0xe85d2a, 0xffc04d, 0xc9502a], count: 16, motion: 'fall', size: [12, 20], speed: 26 },
  },
  sunset: {
    sky: 'linear-gradient(180deg,#ff9a8b 0%,#ffc3a0 40%,#ffe6c7 75%,#fff6e8 100%)',
    dark: false,
    accent: '#ff6f61',
    scenery: `<circle cx="280" cy="170" r="46" fill="#fff1b8" opacity=".9"/><circle cx="280" cy="170" r="64" fill="#fff1b8" opacity=".25"/>
      ${hills('#c98bb9', '#b06ea6', '#8f5a95')}
      ${[60, 120, 340].map((x) => `<path d="M${x} 250 q-2 -22 0 -40" stroke="#6d3f6b" stroke-width="3" fill="none"/><circle cx="${x}" cy="208" r="6" fill="#ffb3c7"/>`).join('')}`,
    particles: { tex: 'spark', colors: [0xfff3c4, 0xffd1a8], count: 22, motion: 'rise', size: [5, 10], speed: 14, alpha: 0.8 },
  },
  candy: {
    sky: 'linear-gradient(180deg,#ffc6ec 0%,#ffe1f4 50%,#fff3fa 100%)',
    dark: false,
    accent: '#ff4fa0',
    scenery: `${cloud(80, 60, 1, 0.95)}${cloud(320, 40, 0.8, 0.95)}
      ${hills('#ffb3d9', '#ff94c8', '#f875b6')}
      ${[[50, 230, '#ff5d8f'], [340, 226, '#4fc3f7'], [270, 246, '#ffd54f']].map(([x, y, c]) => `<rect x="${Number(x) - 2}" y="${y}" width="4" height="40" fill="#fff"/><circle cx="${x}" cy="${y}" r="16" fill="${c}"/><path d="M${Number(x) - 10} ${y} a10 10 0 0 1 20 0" stroke="#fff" stroke-width="4" fill="none"/>`).join('')}`,
    particles: { tex: 'confetti', colors: [0xff5d8f, 0x4fc3f7, 0xffd54f, 0x7ee081, 0xb388ff], count: 26, motion: 'fall', size: [6, 10], speed: 30 },
  },
  winter: {
    sky: 'linear-gradient(180deg,#bfe1ff 0%,#e4f2ff 55%,#f7fbff 100%)',
    dark: false,
    accent: '#42a5f5',
    scenery: `${cloud(90, 50, 1, 0.95)}${cloud(300, 70, 1.1, 0.9)}
      ${hills('#e3f0fb', '#d2e6f7', '#ffffff')}
      ${pine(40, 236, 1.1, '#2e7d5b', true)}${pine(80, 246, 0.8, '#2f8f68', true)}${pine(350, 232, 1.2, '#2e7d5b', true)}`,
    particles: { tex: 'flake', colors: [0xffffff, 0xe3f2fd], count: 30, motion: 'fall', size: [8, 16], speed: 22, alpha: 0.95 },
  },
  night: {
    sky: 'linear-gradient(180deg,#1c2660 0%,#33407e 55%,#5b4f8c 100%)',
    dark: true,
    accent: '#ffd54f',
    scenery: `<circle cx="320" cy="60" r="26" fill="#fff6cc"/><circle cx="310" cy="54" r="26" fill="#33407e" opacity=".0"/>
      <circle cx="320" cy="60" r="44" fill="#fff6cc" opacity=".12"/>
      ${hills('#2a336b', '#232a5a', '#1b2149')}
      ${roundTree(40, 230, 1.1, '#1f2a55')}${pine(360, 236, 1.2, '#1a2350')}
      ${[[60, 270], [140, 280], [250, 274]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-1.5" y="-10" width="3" height="10" fill="#e8e3d0"/><ellipse cx="0" cy="-10" rx="7" ry="4" fill="#7ee0c3" opacity=".85"/></g>`).join('')}`,
    particles: { tex: 'spark', colors: [0xfff176, 0xc6ff8a], count: 24, motion: 'float', size: [6, 12], speed: 10 },
  },
  underwater: {
    sky: 'linear-gradient(180deg,#6fd6ff 0%,#2aa6e0 50%,#0b6fb0 100%)',
    dark: true,
    accent: '#4fc3f7',
    scenery: `<path d="M0 270 C80 258 160 276 240 266 C310 258 360 268 400 262 V300 H0Z" fill="#f3d9a0"/>
      ${[30, 70, 330, 370].map((x, i) => `<path d="M${x} 270 C${x - 10} 240 ${x + 10} 220 ${x} 190 C${x + 12} 220 ${x - 6} 240 ${x + 6} 270Z" fill="${i % 2 ? '#2e9d6a' : '#3cbf7f'}"/>`).join('')}
      <path d="M150 270 q10 -30 0 -40 q16 8 14 40Z" fill="#ff7a8a"/><circle cx="250" cy="266" r="8" fill="#ffb74d"/>`,
    particles: { tex: 'bubble', colors: [0xffffff], count: 22, motion: 'rise', size: [8, 18], speed: 26, alpha: 0.85 },
  },
  space: {
    sky: 'radial-gradient(ellipse at 30% 20%,#5b3f9e 0%,#2a2163 45%,#100c2c 100%)',
    dark: true,
    accent: '#b388ff',
    scenery: `<circle cx="330" cy="70" r="30" fill="#ff8a65"/><ellipse cx="330" cy="70" rx="48" ry="9" fill="none" stroke="#ffcc80" stroke-width="4" transform="rotate(-18 330 70)"/>
      <circle cx="60" cy="210" r="18" fill="#80deea"/><circle cx="54" cy="204" r="5" fill="#fff" opacity=".4"/>
      <path d="M0 280 C100 270 300 290 400 276 V300 H0Z" fill="#3a2f72"/>`,
    particles: { tex: 'star4', colors: [0xffffff, 0xfff59d, 0xb3e5fc], count: 40, motion: 'twinkle', size: [5, 12], speed: 0 },
  },
};

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  rot: number;
  ph: number;
  base: number;
}

/** DOM sky + scenery, Pixi ambient particles. */
export class Background {
  private el: HTMLElement;
  private layer = new Container();
  private parts: P[] = [];
  private theme: ThemeId | null = null;
  private time = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    stage.bg.addChild(this.layer);
    stage.onUpdate((dt) => this.update(dt));
  }

  set(theme: ThemeId): void {
    if (theme === this.theme) return;
    this.theme = theme;
    const def = THEME_DEFS[theme];
    const prev = this.el.querySelector('.bg-scene');
    const scene = document.createElement('div');
    scene.className = 'bg-scene';
    scene.style.background = def.sky;
    scene.innerHTML = `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">${def.scenery}</svg>`;
    this.el.appendChild(scene);
    requestAnimationFrame(() => scene.classList.add('on'));
    if (prev) setTimeout(() => prev.remove(), 700);
    document.body.classList.toggle('theme-dark', def.dark);
    this.spawn(def);
  }

  private spawn(def: ThemeDef): void {
    this.layer.removeChildren();
    this.parts = [];
    const { particles: pc } = def;
    const W = stage.width;
    const H = stage.height;
    const count = Math.round(pc.count * Math.min(1.6, Math.max(0.7, (W * H) / (900 * 700))));
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex(pc.tex));
      s.anchor.set(0.5);
      const size = pc.size[0] + Math.random() * (pc.size[1] - pc.size[0]);
      s.width = s.height = size;
      if (pc.tex === 'confetti') s.width = size * 0.55;
      s.tint = pc.colors[i % pc.colors.length];
      s.alpha = (pc.alpha ?? 0.75) * (0.6 + Math.random() * 0.4);
      s.x = Math.random() * W;
      s.y = Math.random() * H;
      const sp = pc.speed * (0.6 + Math.random() * 0.8);
      const p: P = {
        s,
        vx: (Math.random() - 0.5) * sp * 0.4,
        vy: pc.motion === 'fall' ? sp : pc.motion === 'rise' ? -sp : 0,
        rot: (Math.random() - 0.5) * 1.5,
        ph: Math.random() * 10,
        base: s.alpha,
      };
      if (pc.motion === 'float') {
        p.vx = (Math.random() - 0.5) * sp;
        p.vy = (Math.random() - 0.5) * sp;
      }
      this.parts.push(p);
      this.layer.addChild(s);
    }
  }

  private update(dt: number): void {
    this.time += dt;
    const W = stage.width;
    const H = stage.height;
    for (const p of this.parts) {
      const s = p.s;
      s.x += (p.vx + Math.sin(this.time * 0.8 + p.ph) * 8) * dt;
      s.y += p.vy * dt;
      s.rotation += p.rot * dt;
      if (p.vy === 0 && p.vx === 0) {
        s.alpha = p.base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2 + p.ph * 3)));
      } else if (this.theme === 'night') {
        s.alpha = p.base * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.time * 1.7 + p.ph)));
      }
      if (s.y > H + 20) s.y = -20;
      if (s.y < -20) s.y = H + 20;
      if (s.x > W + 20) s.x = -20;
      if (s.x < -20) s.x = W + 20;
    }
  }

  /** Re-spread particles after a resize. */
  relayout(): void {
    if (this.theme) this.spawn(THEME_DEFS[this.theme]);
  }
}
