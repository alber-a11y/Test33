/** Central tuning knobs: economy, ads, catalog. */

export const AD_CONFIG = {
  /** Interstitials are not shown before this many levels were completed. */
  interstitialFromLevel: 3,
  /** Minimum seconds between two interstitials. "Above average" aggressiveness. */
  interstitialCooldownSec: 40,
  /** Minimum seconds after a rewarded ad before an interstitial may follow. */
  afterRewardedCooldownSec: 25,
  /** Grace period after session start. */
  sessionGraceSec: 45,
  /** Show an interstitial on every N-th restart. */
  restartEvery: 2,
  /** Show an interstitial when leaving a level to the map/menu. */
  onExitLevel: true,
  /** Show an interstitial when the tab comes back after being hidden this long. */
  resumeAfterHiddenSec: 90,
  /** Stub ad durations (seconds). */
  stubInterstitialSec: 4,
  stubRewardedSec: 6,
  /** Seconds before the stub interstitial can be closed. */
  stubInterstitialSkipSec: 3,
};

export const ECONOMY = {
  startCoins: 100,
  startBoosters: { hint: 3, undo: 3, wand: 1, key: 1, freeze: 1 } as Record<BoosterId, number>,
  winBase: 20,
  winPerStar: 5,
  hardMultiplier: 2,
  basketCapacity: 10,
  chestCoins: 80,
  freeCoinsAd: 60,
  freeCoinsCooldownSec: 120,
  continueMoves: 5,
  multipliers: [2, 3, 5, 3, 2],
  daily: [30, 40, 50, 70, 90, 120, 200],
};

export type BoosterId = 'hint' | 'undo' | 'wand' | 'key' | 'freeze';

export const BOOSTERS: { id: BoosterId; price: number; icon: string }[] = [
  { id: 'hint', price: 80, icon: 'hint' },
  { id: 'undo', price: 40, icon: 'undo' },
  { id: 'wand', price: 200, icon: 'wand' },
  { id: 'key', price: 120, icon: 'key' },
  { id: 'freeze', price: 120, icon: 'freeze' },
];

export type ItemKind = 'skin' | 'bg' | 'hat';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  /** Coin price. */
  price?: number;
  /** Number of rewarded ads needed to unlock (3/3). */
  ads?: number;
}

export const SKINS: ShopItem[] = [
  { id: 'classic', kind: 'skin' },
  { id: 'wires', kind: 'skin', price: 400 },
  { id: 'branches', kind: 'skin', price: 500 },
  { id: 'ropes', kind: 'skin', price: 600 },
  { id: 'candy', kind: 'skin', price: 800 },
  { id: 'ice', kind: 'skin', price: 1000 },
  { id: 'neon', kind: 'skin', ads: 3 },
  { id: 'lava', kind: 'skin', ads: 3 },
  { id: 'rainbow', kind: 'skin', ads: 3 },
  { id: 'gold', kind: 'skin', ads: 3 },
];

export const BACKGROUNDS: ShopItem[] = [
  { id: 'auto', kind: 'bg' },
  { id: 'meadow', kind: 'bg' },
  { id: 'autumn', kind: 'bg', price: 300 },
  { id: 'sunset', kind: 'bg', price: 400 },
  { id: 'candy', kind: 'bg', price: 500 },
  { id: 'winter', kind: 'bg', price: 600 },
  { id: 'night', kind: 'bg', price: 800 },
  { id: 'underwater', kind: 'bg', ads: 3 },
  { id: 'space', kind: 'bg', ads: 3 },
];

export const HATS: ShopItem[] = [
  { id: 'none', kind: 'hat' },
  { id: 'mandarin', kind: 'hat' },
  { id: 'party', kind: 'hat', price: 250 },
  { id: 'flowers', kind: 'hat', price: 350 },
  { id: 'beanie', kind: 'hat', price: 450 },
  { id: 'chef', kind: 'hat', price: 550 },
  { id: 'cowboy', kind: 'hat', price: 700 },
  { id: 'crown', kind: 'hat', ads: 3 },
  { id: 'headphones', kind: 'hat', ads: 3 },
  { id: 'wizard', kind: 'hat', ads: 3 },
];

export const ALL_ITEMS: ShopItem[] = [...SKINS, ...BACKGROUNDS, ...HATS];

export function itemKey(item: ShopItem): string {
  return `${item.kind}:${item.id}`;
}

/** Chapter themes in order; chapters are 20 levels long and cycle. */
export const THEMES = [
  'meadow',
  'autumn',
  'sunset',
  'candy',
  'winter',
  'night',
  'underwater',
  'space',
] as const;
export type ThemeId = (typeof THEMES)[number];

export const PRIZES = [
  'mandarin',
  'acorn',
  'flower',
  'strawberry',
  'nut',
  'mushroom',
  'pearl',
  'star',
] as const;
export type PrizeKind = (typeof PRIZES)[number];

export const LEVELS_PER_CHAPTER = 20;
export const HAND_LEVELS = 30;

export function chapterOf(level: number): number {
  return Math.floor((level - 1) / LEVELS_PER_CHAPTER);
}
export function themeOf(level: number): ThemeId {
  return THEMES[chapterOf(level) % THEMES.length];
}
export function prizeOf(level: number): PrizeKind {
  return PRIZES[chapterOf(level) % PRIZES.length];
}
export function isHardLevel(level: number): boolean {
  return level % 10 === 0;
}
