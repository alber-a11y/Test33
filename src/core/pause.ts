import { audio } from '../audio/audio';
import { stage } from '../render/stage';
import { Emitter } from './events';

/**
 * Global pause: ads, hidden tab, pause menu. While any reason is active the
 * game loop and audio are halted. Ads additionally block input.
 */
class PauseManager extends Emitter<{ change: boolean }> {
  private reasons = new Set<string>();

  acquire(reason: string, opts: { audio?: boolean; loop?: boolean } = {}): void {
    const was = this.active;
    this.reasons.add(reason);
    if (opts.audio !== false) audio.pause(reason);
    if (opts.loop !== false) this.loopReasons.add(reason);
    this.sync();
    if (!was) this.emit('change', true);
  }

  release(reason: string): void {
    if (!this.reasons.has(reason)) return;
    this.reasons.delete(reason);
    this.loopReasons.delete(reason);
    audio.resume(reason);
    this.sync();
    if (!this.active) this.emit('change', false);
  }

  has(reason: string): boolean {
    return this.reasons.has(reason);
  }

  get active(): boolean {
    return this.reasons.size > 0;
  }

  private loopReasons = new Set<string>();

  private sync(): void {
    if (this.loopReasons.size) stage.pause();
    else stage.resume();
    document.body.classList.toggle('is-ad', this.reasons.has('ad'));
  }
}

export const Pause = new PauseManager();
