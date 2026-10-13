import { ECONOMY, type BoosterId, type ShopItem, itemKey } from '../config';
import { Emitter } from './events';

export type Lang = 'ru' | 'en';

export interface SaveData {
  v: number;
  /** Highest unlocked level (1-based). */
  level: number;
  stars: Record<number, number>;
  coins: number;
  boosters: Record<BoosterId, number>;
  owned: string[];
  equipped: { skin: string; bg: string; hat: string };
  adProgress: Record<string, number>;
  settings: {
    musicOn: boolean;
    sfxOn: boolean;
    music: number;
    sfx: number;
    vibro: boolean;
    lang: Lang;
  };
  basket: number;
  prizesTotal: number;
  daily: { last: string; streak: number };
  stats: { restarts: number; wins: number; played: number };
  tips: Record<string, boolean>;
  freeCoinsAt: number;
}

const KEY = 'capytwist.save.v1';
const VERSION = 1;

function detectLang(): Lang {
  try {
    const l = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
    return /^(ru|uk|be|kk)/.test(l) ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

function defaults(): SaveData {
  return {
    v: VERSION,
    level: 1,
    stars: {},
    coins: ECONOMY.startCoins,
    boosters: { ...ECONOMY.startBoosters },
    owned: ['skin:classic', 'bg:auto', 'bg:meadow', 'hat:none', 'hat:mandarin'],
    equipped: { skin: 'classic', bg: 'auto', hat: 'mandarin' },
    adProgress: {},
    settings: { musicOn: true, sfxOn: true, music: 0.7, sfx: 0.9, vibro: true, lang: detectLang() },
    basket: 0,
    prizesTotal: 0,
    daily: { last: '', streak: 0 },
    stats: { restarts: 0, wins: 0, played: 0 },
    tips: {},
    freeCoinsAt: 0,
  };
}

type SaveEvents = { coins: number; change: SaveData; boosters: Record<BoosterId, number> };

class SaveStore extends Emitter<SaveEvents> {
  data: SaveData = defaults();
  private timer = 0;

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const d = defaults();
        this.data = {
          ...d,
          ...parsed,
          settings: { ...d.settings, ...(parsed.settings || {}) },
          boosters: { ...d.boosters, ...(parsed.boosters || {}) },
          equipped: { ...d.equipped, ...(parsed.equipped || {}) },
          daily: { ...d.daily, ...(parsed.daily || {}) },
          stats: { ...d.stats, ...(parsed.stats || {}) },
          v: VERSION,
        };
        for (const k of d.owned) if (!this.data.owned.includes(k)) this.data.owned.push(k);
      }
    } catch {
      this.data = defaults();
    }
  }

  /** Debounced persist. */
  save(): void {
    this.emit('change', this.data);
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }

  reset(): void {
    const lang = this.data.settings.lang;
    this.data = defaults();
    this.data.settings.lang = lang;
    this.save();
    this.emit('coins', this.data.coins);
    this.emit('boosters', this.data.boosters);
  }

  addCoins(n: number): void {
    this.data.coins = Math.max(0, this.data.coins + n);
    this.save();
    this.emit('coins', this.data.coins);
  }

  spend(n: number): boolean {
    if (this.data.coins < n) return false;
    this.addCoins(-n);
    return true;
  }

  addBooster(id: BoosterId, n: number): void {
    this.data.boosters[id] = Math.max(0, (this.data.boosters[id] || 0) + n);
    this.save();
    this.emit('boosters', this.data.boosters);
  }

  owns(item: ShopItem): boolean {
    return this.data.owned.includes(itemKey(item));
  }

  grant(item: ShopItem): void {
    const k = itemKey(item);
    if (!this.data.owned.includes(k)) this.data.owned.push(k);
    this.save();
  }

  setStars(level: number, stars: number): void {
    this.data.stars[level] = Math.max(this.data.stars[level] || 0, stars);
    if (level >= this.data.level) this.data.level = level + 1;
    this.save();
  }

  totalStars(): number {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }
}

export const Save = new SaveStore();
