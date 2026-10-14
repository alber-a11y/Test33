import { type ThemeId, themeOf } from '../config';
import { Save } from '../core/save';
import type { Background } from '../render/backgrounds';

/** Navigation hub; functions are wired in main.ts to avoid import cycles. */
export const nav = {
  menu: () => {},
  map: () => {},
  shop: (_tab?: string) => {},
  settings: () => {},
  play: (_level?: number) => {},
  back: () => {},
};

export const bgRef: { bg: Background | null } = { bg: null };

/** Theme used for menus and levels, honoring the equipped background. */
export function themeFor(level: number): ThemeId {
  const eq = Save.data.equipped.bg;
  if (eq && eq !== 'auto') return eq as ThemeId;
  return themeOf(level);
}

export function setTheme(level: number): void {
  bgRef.bg?.set(themeFor(level));
}

/** The player's current capybara outfit (spread into capySvg options). */
export function myOutfit(): { hat: string; glasses: string; back: string; held: string } {
  const e = Save.data.equipped;
  return { hat: e.hat, glasses: e.glasses, back: e.back, held: e.held };
}
