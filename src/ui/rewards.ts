import { audio } from '../audio/audio';
import { Ads } from '../ads/ads';
import { BOOSTERS, type BoosterId, ECONOMY } from '../config';
import { Save } from '../core/save';
import { dict, t } from '../i18n';
import { coinSvg, icon, prizeSvg } from '../render/art';
import { adBadge, button, h, modal, toast } from './dom';

export function boosterName(id: BoosterId): string {
  const d = dict();
  return { hint: d.boosterHint, undo: d.boosterUndo, wand: d.boosterWand, key: d.boosterKey, freeze: d.boosterFreeze }[id];
}
export function boosterDesc(id: BoosterId): string {
  const d = dict();
  return { hint: d.boosterHintDesc, undo: d.boosterUndoDesc, wand: d.boosterWandDesc, key: d.boosterKeyDesc, freeze: d.boosterFreezeDesc }[id];
}

/** Fly coin icons from an element to the coins pill. */
export function coinRain(from: HTMLElement | null, amount: number): void {
  const target = document.querySelector('.screen.on .coins-pill, .modal .coins-pill') as HTMLElement | null;
  if (!from || !target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const n = Math.min(10, Math.max(3, Math.round(amount / 10)));
  for (let i = 0; i < n; i++) {
    const el = h('div', {}, coinSvg());
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '80',
      width: '34px',
      height: '34px',
      left: `${a.left + a.width / 2 - 17 + (Math.random() - 0.5) * 60}px`,
      top: `${a.top + a.height / 2 - 17 + (Math.random() - 0.5) * 30}px`,
      transition: `transform .7s cubic-bezier(.5,-0.3,.6,1) ${i * 0.05}s, opacity .2s ${0.65 + i * 0.05}s`,
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${b.left + 15 - r.left}px, ${b.top + 4 - r.top}px) scale(.8)`;
      el.style.opacity = '0';
    });
    setTimeout(() => {
      el.remove();
      if (i % 2 === 0) audio.sfx('coin', { pitch: i });
    }, 750 + i * 50);
  }
}

/** Offer when a booster runs out: watch an ad (+1) or buy with coins. */
export function boosterOffer(id: BoosterId): Promise<boolean> {
  return new Promise((res) => {
    let got = false;
    const m = modal({ title: boosterName(id), ribbon: 'purple', closable: true, onClose: () => res(got) });
    m.panel.appendChild(h('div', { class: 'offer-ic' }, icon(id)));
    m.panel.appendChild(h('p', {}, boosterDesc(id)));
    const col = h('div', { class: 'col' });
    col.appendChild(
      button(`${adBadge()} ${t('plusOne')}`, 'btn-purple pulse', async () => {
        if (await Ads.rewarded(`booster_${id}`)) {
          Save.addBooster(id, 1);
          got = true;
          m.close();
        }
      }),
    );
    const price = BOOSTERS.find((b) => b.id === id)!.price;
    col.appendChild(
      button(`${t('buy')} · ${price} ${coinSvg('coin-ic inline')}`, 'btn-orange', () => {
        if (Save.spend(price)) {
          audio.sfx('buy');
          Save.addBooster(id, 1);
          got = true;
          m.close();
        } else toast(t('notEnough'));
      }),
    );
    m.panel.appendChild(col);
  });
}

export function freeCoinsLeft(): number {
  return Math.max(0, Math.ceil((Save.data.freeCoinsAt + ECONOMY.freeCoinsCooldownSec * 1000 - Date.now()) / 1000));
}

export async function watchForFreeCoins(from: HTMLElement | null): Promise<boolean> {
  const left = freeCoinsLeft();
  if (left > 0) {
    toast(t('wait', { s: left }));
    return false;
  }
  if (!(await Ads.rewarded('free_coins'))) return false;
  Save.data.freeCoinsAt = Date.now();
  Save.addCoins(ECONOMY.freeCoinsAd);
  coinRain(from, ECONOMY.freeCoinsAd);
  return true;
}

// ---------- daily gift ----------

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dailyAvailable(): boolean {
  return Save.data.daily.last !== today();
}

export function dailyDialog(): Promise<void> {
  const d = Save.data.daily;
  const y = new Date(Date.now() - 86400000);
  const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  const streak = d.last === yesterday ? d.streak % 7 : 0;
  const amount = ECONOMY.daily[streak];
  const m = modal({ title: t('daily'), ribbon: 'green', closable: true });
  m.panel.appendChild(h('p', {}, t('dailyCome')));
  const grid = h('div', { class: 'daily-grid' });
  ECONOMY.daily.forEach((c, i) => {
    const cls = `daily-day ${i < streak ? 'done' : ''} ${i === streak ? 'today' : ''} ${i === 6 ? 'big' : ''}`;
    grid.appendChild(h('div', { class: cls }, `<span>${t('dailyDay', { n: i + 1 })}</span>${i === 6 ? prizeSvg('chest').replace('<svg ', '<svg class="coin-ic" ') : coinSvg()}<span>${c}</span>`));
  });
  m.panel.appendChild(grid);
  const col = h('div', { class: 'col' });
  const claim = (mult: number, el: HTMLElement) => {
    Save.data.daily = { last: today(), streak: streak + 1 };
    Save.addCoins(amount * mult);
    coinRain(el, amount * mult);
    audio.sfx('chest');
    setTimeout(() => m.close(), 500);
  };
  const adBtn = button(`${adBadge()} ${t('claimX', { n: 2 })} · ${amount * 2}`, 'btn-purple pulse', async () => {
    if (await Ads.rewarded('daily_x2')) claim(2, adBtn);
  });
  col.appendChild(adBtn);
  const plain = button(`${t('claim')} · ${amount}`, 'btn-green', () => claim(1, plain));
  col.appendChild(plain);
  m.panel.appendChild(col);
  return m.closed;
}

// ---------- chest ----------

export function chestDialog(): Promise<void> {
  const m = modal({ title: t('chest'), ribbon: 'purple', closable: false });
  const pic = h('div', { class: 'chest-pic shake' }, prizeSvg('chest'));
  m.panel.appendChild(pic);
  const boosterIds: BoosterId[] = ['hint', 'wand', 'undo', 'key', 'freeze'];
  const bonus = boosterIds[Math.floor(Math.random() * boosterIds.length)];
  const coins = ECONOMY.chestCoins;
  m.panel.appendChild(
    h('div', { class: 'reward-line' }, `${coinSvg()} ${coins} <span style="margin-left:10px"></span><span class="offer-ic" style="width:52px;height:52px;border-radius:14px;display:inline-grid">${icon(bonus)}</span> +1`),
  );
  const col = h('div', { class: 'col' });
  const give = (mult: number, el: HTMLElement) => {
    Save.addCoins(coins * mult);
    Save.addBooster(bonus, mult);
    coinRain(el, coins * mult);
    audio.sfx('chest');
    setTimeout(() => m.close(), 600);
  };
  const ad = button(`${adBadge()} ${t('claimX', { n: 2 })}`, 'btn-purple pulse', async () => {
    if (await Ads.rewarded('chest_x2')) give(2, ad);
  });
  col.appendChild(ad);
  const plain = button(t('claim'), 'btn-green', () => give(1, plain));
  col.appendChild(plain);
  m.panel.appendChild(col);
  audio.sfx('chest');
  return m.closed;
}
