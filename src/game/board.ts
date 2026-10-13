import type { Container } from 'pixi.js';
import type { Sfx } from '../audio/audio';
import type { PrizeKind } from '../config';
import type { Skin } from '../render/skins';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardHost {
  skin: Skin;
  prize: PrizeKind;
  /** Canvas-space point of the HUD basket (prizes fly there). */
  basketPoint(): { x: number; y: number };
  /** A move finished (after animations). `counted` false for booster moves. */
  moveDone(o: { won: boolean; counted: boolean }): void;
  undone(): void;
  itemCollected(kind: 'prize' | 'bonus' | 'bomb'): void;
  blocked(): void;
  sfx(name: Sfx, pitch?: number): void;
  vibrate(ms: number): void;
  /** Is the board allowed to accept input right now. */
  canInteract(): boolean;
}

export interface Board {
  root: Container;
  layout(rect: Rect): void;
  destroy(): void;
  undo(): boolean;
  hint(): boolean;
  wand(): Promise<boolean>;
  /** Key booster. Returns false if nothing to unlock. */
  unlockAll(): boolean;
  hasLocks(): boolean;
  hasBombs(): boolean;
  setFuse(n: number | null, frozen: boolean): void;
  /** Point (canvas) for a tutorial hand on the first suggested move. */
  tutorialPoint(): { x: number; y: number } | null;
  clearHint(): void;
  /** Final win animation (prizes fly to the basket). */
  celebrate(): Promise<void>;
  explode(): Promise<void>;
}
