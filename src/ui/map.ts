import { audio } from '../audio/audio';
import { LEVELS_PER_CHAPTER, chapterOf, isHardLevel, prizeOf } from '../config';
import { Save } from '../core/save';
import { modeOf } from '../game/levels';
import { dict, t } from '../i18n';
import { capySvg, icon, prizeSvg } from '../render/art';
import { button, coinsPill, h, type Screen } from './dom';
import { nav, setTheme, myOutfit } from './nav';

const SPACING = 112;
const TOP_PAD = 220;

/** Infinite, virtualized level map. Level 1 at the bottom. */
export class MapScreen implements Screen {
  el = h('section', { class: 'screen map' });
  private scroll!: HTMLElement;
  private inner!: HTMLElement;
  private svg!: SVGSVGElement;
  private total = 0;
  private rendered = new Map<number, HTMLElement>();
  private banners = new Map<number, HTMLElement>();
  private avatar!: HTMLElement;
  private raf = 0;

  constructor() {
    const top = h('div', { class: 'topbar' });
    top.appendChild(button(icon('back'), 'btn-ghost btn-icon', () => nav.menu()));
    top.appendChild(h('h2', {}, t('map')));
    top.appendChild(h('div', { class: 'grow' }));
    top.appendChild(coinsPill(() => nav.shop('coins')));
    this.el.appendChild(top);
    this.scroll = h('div', { class: 'map-scroll' });
    this.inner = h('div', { class: 'map-inner' });
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'map-path');
    this.inner.appendChild(this.svg);
    this.scroll.appendChild(this.inner);
    this.el.appendChild(this.scroll);
    this.avatar = h('div', { class: 'map-avatar' });
    this.inner.appendChild(this.avatar);
    this.scroll.addEventListener('scroll', () => {
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => this.renderVisible());
    });
  }

  private x(n: number): number {
    const w = this.scroll.clientWidth || 360;
    const amp = Math.min(w * 0.3, 190);
    return w / 2 + Math.sin(n * 0.85) * amp;
  }

  private y(n: number): number {
    return this.total * SPACING + TOP_PAD - n * SPACING;
  }

  private build(): void {
    const unlocked = Save.data.level;
    this.total = Math.max(unlocked + 25, Math.ceil((unlocked + 10) / LEVELS_PER_CHAPTER) * LEVELS_PER_CHAPTER + 5);
    const height = this.total * SPACING + TOP_PAD + 40;
    this.inner.style.height = `${height}px`;
    this.svg.setAttribute('height', String(height));
    this.svg.setAttribute('viewBox', `0 0 ${this.scroll.clientWidth || 360} ${height}`);
    this.rendered.forEach((el) => el.remove());
    this.rendered.clear();
    this.banners.forEach((el) => el.remove());
    this.banners.clear();
    // dashed path
    let d = '';
    for (let n = 1; n <= this.total; n++) {
      const x = this.x(n);
      const y = this.y(n);
      if (n === 1) d = `M${x} ${y}`;
      else {
        const px = this.x(n - 1);
        const py = this.y(n - 1);
        d += ` C${px} ${py - SPACING / 2} ${x} ${y + SPACING / 2} ${x} ${y}`;
      }
    }
    const doneY = this.y(Math.min(unlocked, this.total));
    this.svg.innerHTML = `
      <defs><clipPath id="mapdone"><rect x="0" y="${doneY}" width="100%" height="${height}"/></clipPath></defs>
      <path d="${d}" stroke="rgba(90,52,24,.25)" stroke-width="30" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#fff6e6" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#e8cfa8" stroke-width="6" fill="none" stroke-dasharray="2 18" stroke-linecap="round"/>
      <path d="${d}" stroke="#ffcf4a" stroke-width="10" fill="none" stroke-linecap="round" clip-path="url(#mapdone)"/>`;
    this.avatar.innerHTML = capySvg({ ...myOutfit(), mood: 'happy' });
    this.avatar.style.left = `${this.x(unlocked)}px`;
    this.avatar.style.top = `${this.y(unlocked)}px`;
  }

  private renderVisible(): void {
    const top = this.scroll.scrollTop;
    const bottom = top + this.scroll.clientHeight;
    const unlocked = Save.data.level;
    const nMax = Math.ceil((this.total * SPACING + TOP_PAD - top) / SPACING) + 2;
    const nMin = Math.floor((this.total * SPACING + TOP_PAD - bottom) / SPACING) - 2;
    for (const [n, el] of this.rendered)
      if (n < nMin || n > nMax) {
        el.remove();
        this.rendered.delete(n);
      }
    for (let n = Math.max(1, nMin); n <= Math.min(this.total, nMax); n++) {
      if (this.rendered.has(n)) continue;
      const locked = n > unlocked;
      const mode = modeOf(n);
      const hard = isHardLevel(n);
      const stars = Save.data.stars[n] ?? 0;
      const cls = `map-node ${mode === 'free' ? 'free-mode' : ''} ${hard ? 'hard' : ''} ${locked ? 'locked' : ''} ${n === unlocked ? 'current' : ''}`;
      const node = h(
        'button',
        { class: cls, type: 'button' },
        `${locked ? icon('lock') : n}
        ${!locked ? `<span class="mode-ic">${icon(mode === 'free' ? 'free' : 'path')}</span>` : ''}
        ${!locked && n < unlocked ? `<span class="stars">${[1, 2, 3].map((s) => icon('star', `ic ${s <= stars ? 'on' : ''}`)).join('')}</span>` : ''}`,
      );
      node.style.left = `${this.x(n)}px`;
      node.style.top = `${this.y(n)}px`;
      if (!locked)
        node.addEventListener('click', () => {
          audio.unlock();
          audio.sfx('button');
          nav.play(n);
        });
      this.inner.appendChild(node);
      this.rendered.set(n, node);
    }
    // chapter banners
    const first = Math.max(0, chapterOf(Math.max(1, nMin)));
    const last = chapterOf(Math.max(1, Math.min(this.total, nMax)));
    for (let c = first; c <= last; c++) {
      if (this.banners.has(c)) continue;
      const n = c * LEVELS_PER_CHAPTER + 1;
      const names = dict().chapterNames;
      const b = h(
        'div',
        { class: 'chapter-banner' },
        `<span class="pic">${prizeSvg(prizeOf(n))}</span><span>${names[c % names.length]}<small>${t('chapter', { n: c + 1 })}</small></span>`,
      );
      b.style.top = `${this.y(n) + 62}px`;
      this.inner.appendChild(b);
      this.banners.set(c, b);
    }
  }

  show(): void {
    setTheme(Save.data.level);
    audio.play('menu');
    requestAnimationFrame(() => {
      this.build();
      this.scroll.scrollTop = this.y(Save.data.level) - this.scroll.clientHeight * 0.55;
      this.renderVisible();
    });
  }

  hide(): void {}
}
