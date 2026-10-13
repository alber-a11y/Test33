import { audio } from '../audio/audio';
import { ECONOMY } from '../config';
import { Save } from '../core/save';
import { t } from '../i18n';
import { capySvg, coinSvg, icon, prizeSvg } from '../render/art';
import { prizeOf } from '../config';
import { button, coinsPill, h, type Screen } from './dom';
import { nav, setTheme } from './nav';
import { dailyAvailable, dailyDialog, freeCoinsLeft, watchForFreeCoins } from './rewards';

export class MenuScreen implements Screen {
  el = h('section', { class: 'screen menu' });
  private playBtn!: HTMLButtonElement;
  private dailyBtn!: HTMLButtonElement;
  private freeBtn!: HTMLButtonElement;
  private capyHost!: HTMLElement;
  private basket!: HTMLElement;
  private timer = 0;

  constructor() {
    this.render();
  }

  render(): void {
    this.el.innerHTML = '';
    const top = h('div', { class: 'topbar' });
    top.appendChild(coinsPill(() => nav.shop('coins')));
    top.appendChild(h('div', { class: 'grow' }));
    const gifts = h('div', { class: 'side-gifts' });
    top.appendChild(gifts);
    top.appendChild(button(icon('settings'), 'btn-ghost btn-icon', () => nav.settings()));
    this.el.appendChild(top);

    this.dailyBtn = h('button', { class: 'gift-btn wiggle', type: 'button' }, `${icon('gift')}<span class="badge">1</span>`);
    this.dailyBtn.addEventListener('click', () => {
      audio.sfx('button');
      void dailyDialog().then(() => this.refresh());
    });
    this.freeBtn = h('button', { class: 'gift-btn', type: 'button' }, `${coinSvg()}<span class="lbl">+${ECONOMY.freeCoinsAd}</span>`);
    this.freeBtn.addEventListener('click', () => {
      audio.sfx('button');
      void watchForFreeCoins(this.freeBtn).then(() => this.refresh());
    });
    gifts.append(this.freeBtn, this.dailyBtn);

    const center = h('div', { class: 'menu-center' });
    center.appendChild(h('div', { class: 'logo' }, '<span>Capy</span> <span>Twist</span>'));
    center.appendChild(h('div', { class: 'tagline' }, t('tagline')));
    const onsen = h('div', { class: 'onsen' });
    this.capyHost = onsen;
    center.appendChild(onsen);
    this.basket = h('div', { class: 'pill small basket-mini' });
    center.appendChild(this.basket);
    this.el.appendChild(center);

    const actions = h('div', { class: 'menu-actions' });
    this.playBtn = button('', 'btn-green btn-big play-btn pulse', () => nav.play());
    actions.appendChild(this.playBtn);
    const row = h('div', { class: 'row' });
    row.appendChild(button(`${icon('map')} ${t('map')}`, 'btn-blue', () => nav.map()));
    row.appendChild(button(`${icon('shop')} ${t('shop')}`, 'btn-orange', () => nav.shop()));
    actions.appendChild(row);
    this.el.appendChild(actions);
  }

  private drawOnsen(): void {
    const hat = Save.data.equipped.hat;
    const steam = [18, 42, 70].map((l, i) => `<div class="steam" style="left:${l}%;animation-delay:${i * 0.9}s"></div>`).join('');
    this.capyHost.innerHTML = `${capySvg({ hat, mood: 'sleep' })}
      <svg class="pool" viewBox="0 0 300 110" preserveAspectRatio="none">
        <ellipse cx="150" cy="58" rx="148" ry="50" fill="#9c8a7a"/>
        <ellipse cx="150" cy="52" rx="140" ry="44" fill="#7fd8f0"/>
        <ellipse cx="150" cy="46" rx="122" ry="30" fill="#a5e8fa"/>
        <path d="M60 50 q15 -8 30 0 M190 40 q15 -8 30 0 M120 64 q12 -6 24 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
        ${[20, 60, 240, 280].map((x, i) => `<ellipse cx="${x}" cy="${i % 2 ? 84 : 76}" rx="${18 + (i % 2) * 6}" ry="13" fill="${i % 2 ? '#8f7d6c' : '#b3a191'}"/>`).join('')}
      </svg>${steam}`;
  }

  refresh(): void {
    const lvl = Save.data.level;
    this.playBtn.innerHTML = `${icon('play')}<span>${t('play')}<small>${t('levelN', { n: lvl })}</small></span>`;
    this.dailyBtn.style.display = dailyAvailable() ? '' : 'none';
    const left = freeCoinsLeft();
    this.freeBtn.style.opacity = left > 0 ? '.55' : '1';
    this.freeBtn.classList.toggle('wiggle', left <= 0);
    const cap = ECONOMY.basketCapacity;
    this.basket.innerHTML = `<span class="pic">${prizeSvg(prizeOf(lvl))}</span><div class="progress"><i style="width:${(Save.data.basket / cap) * 100}%"></i></div><span>${Save.data.basket}/${cap}</span>`;
  }

  show(): void {
    setTheme(Save.data.level);
    this.drawOnsen();
    this.refresh();
    audio.play('menu');
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.refresh(), 1000);
  }

  hide(): void {
    clearInterval(this.timer);
  }
}
