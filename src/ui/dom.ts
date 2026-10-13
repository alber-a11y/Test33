import { audio } from '../audio/audio';
import { Save } from '../core/save';
import { coinSvg, icon } from '../render/art';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  if (html) el.innerHTML = html;
  return el;
}

export function vibrate(ms: number): void {
  if (!Save.data.settings.vibro) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** Button with click sound + press feedback. */
export function button(html: string, cls: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
  const b = h('button', { class: `btn ${cls}`, type: 'button' }, html);
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    audio.unlock();
    audio.sfx('button');
    vibrate(6);
    onClick(e);
  });
  return b;
}

export function adBadge(): string {
  return `<span class="ad-badge">${icon('ad')}</span>`;
}

// ---------- coins pill ----------

const coinPills = new Set<HTMLElement>();

export function coinsPill(onClick?: () => void): HTMLElement {
  const el = h('div', { class: 'pill coins-pill' }, `${coinSvg()}<span class="v">${Save.data.coins}</span>${onClick ? '<span class="plus">+</span>' : ''}`);
  if (onClick)
    el.addEventListener('click', () => {
      audio.sfx('button');
      onClick();
    });
  coinPills.add(el);
  return el;
}

let shownCoins = -1;
Save.on('coins', (v) => {
  const from = shownCoins < 0 ? v : shownCoins;
  shownCoins = v;
  const start = performance.now();
  const dur = Math.min(900, Math.abs(v - from) * 12 + 200);
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / dur);
    const val = Math.round(from + (v - from) * k);
    coinPills.forEach((p) => {
      const s = p.querySelector('.v');
      if (s) s.textContent = String(val);
    });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  coinPills.forEach((p) => {
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  });
});

export function refreshCoins(): void {
  shownCoins = Save.data.coins;
  coinPills.forEach((p) => {
    const s = p.querySelector('.v');
    if (s) s.textContent = String(Save.data.coins);
  });
}

// ---------- toasts ----------

export function toast(msg: string, ms = 2200): void {
  const host = document.getElementById('toasts')!;
  const el = h('div', { class: 'toast' }, msg);
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ---------- modal ----------

export interface ModalHandle {
  root: HTMLElement;
  panel: HTMLElement;
  close: () => void;
  closed: Promise<void>;
}

const openModals: ModalHandle[] = [];

export function modal(opts: { title?: string; ribbon?: string; closable?: boolean; onClose?: () => void; cls?: string }): ModalHandle {
  const root = h('div', { class: `modal ${opts.cls ?? ''}` });
  const panel = h('div', { class: 'panel' });
  if (opts.title) panel.appendChild(h('div', { class: `ribbon ${opts.ribbon ?? ''}` }, opts.title));
  root.appendChild(panel);
  document.body.appendChild(root);
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    root.classList.remove('on');
    const i = openModals.indexOf(handle);
    if (i >= 0) openModals.splice(i, 1);
    setTimeout(() => root.remove(), 220);
    opts.onClose?.();
    resolve();
  };
  if (opts.closable) {
    const x = h('button', { class: 'modal-close', type: 'button', 'aria-label': 'close' }, icon('close'));
    x.addEventListener('click', () => {
      audio.sfx('button');
      close();
    });
    panel.appendChild(x);
  }
  requestAnimationFrame(() => root.classList.add('on'));
  audio.sfx('pop');
  const handle = { root, panel, close, closed };
  openModals.push(handle);
  return handle;
}

export function anyModalOpen(): boolean {
  return openModals.length > 0;
}

export function closeAllModals(): void {
  [...openModals].forEach((m) => m.close());
}

export function confirmDialog(text: string, yes: string, no: string): Promise<boolean> {
  return new Promise((res) => {
    let answer = false;
    const m = modal({ closable: false, onClose: () => res(answer) });
    m.panel.style.paddingTop = '26px';
    m.panel.appendChild(h('p', {}, text));
    const row = h('div', { class: 'row' });
    row.appendChild(
      button(yes, 'btn-red', () => {
        answer = true;
        m.close();
      }),
    );
    row.appendChild(button(no, 'btn-ghost', () => m.close()));
    m.panel.appendChild(row);
  });
}

// ---------- screens ----------

export interface Screen {
  el: HTMLElement;
  show(params?: unknown): void;
  hide(): void;
}

class ScreenManager {
  current: Screen | null = null;
  private host!: HTMLElement;

  init(host: HTMLElement): void {
    this.host = host;
  }

  add(s: Screen): void {
    this.host.appendChild(s.el);
  }

  go(s: Screen, params?: unknown): void {
    if (this.current && this.current !== s) {
      this.current.el.classList.remove('on');
      this.current.hide();
    }
    this.current = s;
    s.show(params);
    requestAnimationFrame(() => s.el.classList.add('on'));
  }
}

export const Screens = new ScreenManager();
