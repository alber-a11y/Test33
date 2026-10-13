import { audio } from '../audio/audio';
import { Ads } from '../ads/ads';
import { BACKGROUNDS, BOOSTERS, ECONOMY, HATS, SKINS, type ShopItem, type ThemeId, itemKey } from '../config';
import { Save } from '../core/save';
import { dict, t } from '../i18n';
import { capySvg, coinSvg, icon } from '../render/art';
import { THEME_DEFS } from '../render/backgrounds';
import { skinPreview } from '../render/preview';
import { adBadge, button, coinsPill, h, type Screen, toast } from './dom';
import { nav, setTheme } from './nav';
import { boosterDesc, boosterName, coinRain, freeCoinsLeft, watchForFreeCoins } from './rewards';

type Tab = 'skins' | 'bgs' | 'hats' | 'boosters' | 'coins';

export class ShopScreen implements Screen {
  el = h('section', { class: 'screen shop' });
  private tab: Tab = 'skins';
  private tabsEl!: HTMLElement;
  private body!: HTMLElement;
  private timer = 0;
  private freeBtn: HTMLButtonElement | null = null;

  constructor() {
    const top = h('div', { class: 'topbar' });
    top.appendChild(button(icon('back'), 'btn-ghost btn-icon', () => nav.back()));
    top.appendChild(h('h2', {}, t('shop')));
    top.appendChild(h('div', { class: 'grow' }));
    top.appendChild(coinsPill());
    this.el.appendChild(top);
    this.tabsEl = h('div', { class: 'tabs' });
    this.el.appendChild(this.tabsEl);
    this.body = h('div', { class: 'shop-body' });
    this.el.appendChild(this.body);
  }

  private renderTabs(): void {
    const d = dict();
    const tabs: [Tab, string, string][] = [
      ['skins', d.tabSkins, 'palette'],
      ['bgs', d.tabBgs, 'image'],
      ['hats', d.tabHats, 'hat'],
      ['boosters', d.tabBoosters, 'wand'],
      ['coins', d.tabCoins, 'coins'],
    ];
    this.tabsEl.innerHTML = '';
    for (const [id, label, ic] of tabs) {
      const b = h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, type: 'button' }, `${icon(ic)}${label}`);
      b.addEventListener('click', () => {
        audio.sfx('button');
        this.tab = id;
        this.renderTabs();
        this.renderBody();
      });
      this.tabsEl.appendChild(b);
    }
  }

  private equippedId(item: ShopItem): string {
    return item.kind === 'skin' ? Save.data.equipped.skin : item.kind === 'bg' ? Save.data.equipped.bg : Save.data.equipped.hat;
  }

  private equip(item: ShopItem): void {
    if (item.kind === 'skin') Save.data.equipped.skin = item.id;
    else if (item.kind === 'bg') {
      Save.data.equipped.bg = item.id;
      setTheme(Save.data.level);
    } else Save.data.equipped.hat = item.id;
    Save.save();
  }

  private itemName(item: ShopItem): string {
    const d = dict();
    return (item.kind === 'skin' ? d.skins : item.kind === 'bg' ? d.bgs : d.hats)[item.id] ?? item.id;
  }

  private card(item: ShopItem): HTMLElement {
    const owned = Save.owns(item);
    const equipped = this.equippedId(item) === item.id;
    const card = h('div', { class: `card ${equipped ? 'equipped' : ''}` });
    if (item.ads && !owned) card.appendChild(h('span', { class: 'tag' }, `${icon('ad')}`));
    const prev = h('div', { class: 'preview' });
    if (item.kind === 'skin') {
      void skinPreview(item.id).then((url) => (prev.innerHTML = `<img alt="" src="${url}">`));
    } else if (item.kind === 'bg') {
      if (item.id === 'auto') {
        prev.style.background = 'conic-gradient(from 45deg,#9ee1ff,#ffd7a1,#ff9a8b,#ffc6ec,#bfe1ff,#33407e,#2aa6e0,#2a2163,#9ee1ff)';
        prev.innerHTML = `<div style="font-weight:900;font-size:34px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.3)">AUTO</div>`;
      } else {
        const def = THEME_DEFS[item.id as ThemeId];
        prev.style.background = def.sky;
        prev.innerHTML = `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">${def.scenery}</svg>`;
      }
    } else {
      prev.classList.add('hat-prev');
      prev.innerHTML = capySvg({ hat: item.id, mood: 'idle' });
    }
    card.appendChild(prev);
    card.appendChild(h('div', { class: 'name' }, this.itemName(item)));
    if (equipped) {
      card.appendChild(button(`${icon('check')} ${t('equipped')}`, 'btn-ghost', () => {}));
    } else if (owned) {
      card.appendChild(
        button(t('equip'), 'btn-blue', () => {
          this.equip(item);
          this.renderBody();
        }),
      );
    } else if (item.ads) {
      const prog = Save.data.adProgress[itemKey(item)] ?? 0;
      const dots = h('div', { class: 'dots' }, Array.from({ length: item.ads }, (_, i) => `<i class="${i < prog ? 'on' : ''}"></i>`).join(''));
      card.appendChild(dots);
      card.appendChild(
        button(`${adBadge()} ${t('adUnlock', { a: prog, b: item.ads })}`, 'btn-purple', async () => {
          if (!(await Ads.rewarded(`unlock_${itemKey(item)}`))) return;
          const p = (Save.data.adProgress[itemKey(item)] ?? 0) + 1;
          Save.data.adProgress[itemKey(item)] = p;
          if (p >= item.ads!) {
            Save.grant(item);
            this.equip(item);
            audio.sfx('chest');
            toast(`${t('unlocked')} ${this.itemName(item)}`);
          } else {
            audio.sfx('star');
            Save.save();
          }
          this.renderBody();
        }),
      );
    } else if (item.price) {
      card.appendChild(
        button(`${coinSvg()} ${item.price}`, Save.data.coins >= item.price ? 'btn-orange' : 'btn-orange', () => {
          if (!Save.spend(item.price!)) {
            toast(t('notEnough'));
            this.tab = 'coins';
            this.renderTabs();
            this.renderBody();
            return;
          }
          audio.sfx('buy');
          Save.grant(item);
          this.equip(item);
          toast(`${t('bought')} ${this.itemName(item)}`);
          this.renderBody();
        }),
      );
    } else {
      card.appendChild(
        button(t('equip'), 'btn-blue', () => {
          Save.grant(item);
          this.equip(item);
          this.renderBody();
        }),
      );
    }
    return card;
  }

  private renderBody(): void {
    this.body.innerHTML = '';
    const grid = h('div', { class: 'grid' });
    if (this.tab === 'skins') SKINS.forEach((i) => grid.appendChild(this.card(i)));
    else if (this.tab === 'bgs') BACKGROUNDS.forEach((i) => grid.appendChild(this.card(i)));
    else if (this.tab === 'hats') HATS.forEach((i) => grid.appendChild(this.card(i)));
    else if (this.tab === 'boosters') {
      for (const b of BOOSTERS) {
        const card = h('div', { class: 'card booster-card' });
        card.appendChild(h('div', { class: 'preview' }, `${icon(b.id)}<span class="count">×${Save.data.boosters[b.id] ?? 0}</span>`));
        card.appendChild(h('div', { class: 'name' }, boosterName(b.id)));
        card.appendChild(h('div', { class: 'desc' }, boosterDesc(b.id)));
        const btns = h('div', { class: 'btns' });
        btns.appendChild(
          button(`${coinSvg()} ${b.price}`, 'btn-orange', () => {
            if (!Save.spend(b.price)) {
              toast(t('notEnough'));
              return;
            }
            audio.sfx('buy');
            Save.addBooster(b.id, 1);
            this.renderBody();
          }),
        );
        btns.appendChild(
          button(`${adBadge()} +1`, 'btn-purple', async () => {
            if (await Ads.rewarded(`shop_booster_${b.id}`)) {
              Save.addBooster(b.id, 1);
              audio.sfx('magic');
              this.renderBody();
            }
          }),
        );
        card.appendChild(btns);
        grid.appendChild(card);
      }
    } else {
      const card = h('div', { class: 'card' });
      card.appendChild(h('div', { class: 'preview' }, `<div style="width:60%;height:60%">${coinSvg()}</div>`));
      card.appendChild(h('div', { class: 'name' }, t('freeCoins')));
      card.appendChild(h('div', { class: 'desc', style: 'font-weight:700;font-size:13px;text-align:center' }, t('freeCoinsDesc', { n: ECONOMY.freeCoinsAd })));
      const left = freeCoinsLeft();
      const b = button(left > 0 ? t('wait', { s: left }) : `${adBadge()} +${ECONOMY.freeCoinsAd}`, 'btn-purple pulse', async () => {
        await watchForFreeCoins(b);
        this.renderBody();
      });
      b.disabled = left > 0;
      this.freeBtn = b;
      card.appendChild(b);
      grid.appendChild(card);
      // big pack placeholder (double reward)
      const card2 = h('div', { class: 'card' });
      card2.appendChild(h('div', { class: 'preview' }, `<div style="width:70%;height:70%;position:relative">${coinSvg()}<div style="position:absolute;right:-6%;bottom:-6%;width:60%">${coinSvg()}</div></div>`));
      card2.appendChild(h('div', { class: 'name' }, `${t('freeCoins')} ×3`));
      card2.appendChild(h('div', { class: 'desc', style: 'font-weight:700;font-size:13px;text-align:center' }, `${t('adUnlock', { a: Save.data.adProgress['pack'] ?? 0, b: 3 })}`));
      const b2 = button(`${adBadge()} +${ECONOMY.freeCoinsAd * 4}`, 'btn-purple', async () => {
        if (!(await Ads.rewarded('coin_pack'))) return;
        const p = (Save.data.adProgress['pack'] ?? 0) + 1;
        if (p >= 3) {
          Save.data.adProgress['pack'] = 0;
          Save.addCoins(ECONOMY.freeCoinsAd * 4);
          coinRain(b2, ECONOMY.freeCoinsAd * 4);
        } else Save.data.adProgress['pack'] = p;
        Save.save();
        this.renderBody();
      });
      card2.appendChild(b2);
      grid.appendChild(card2);
    }
    this.body.appendChild(grid);
  }

  show(tab?: unknown): void {
    if (typeof tab === 'string') this.tab = tab as Tab;
    this.renderTabs();
    this.renderBody();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      const b = this.freeBtn;
      if (this.tab !== 'coins' || !b || !b.isConnected) return;
      const left = freeCoinsLeft();
      const wasDisabled = b.disabled;
      b.disabled = left > 0;
      if (left > 0) b.textContent = t('wait', { s: left });
      else if (wasDisabled) b.innerHTML = `${adBadge()} +${ECONOMY.freeCoinsAd}`;
    }, 1000);
  }

  hide(): void {
    clearInterval(this.timer);
  }
}
