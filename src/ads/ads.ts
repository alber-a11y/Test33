import { AD_CONFIG } from '../config';
import { Pause } from '../core/pause';
import { t } from '../i18n';
import { capySvg } from '../render/art';

/** Contract every real ad network adapter must implement. */
export interface AdProvider {
  name: string;
  init(): Promise<void>;
  /** Resolves when the ad is closed (or failed). */
  showInterstitial(): Promise<void>;
  /** Resolves true when the user earned the reward. */
  showRewarded(): Promise<boolean>;
}

/** Full-screen demo ad used until a real network is plugged in. */
export class StubProvider implements AdProvider {
  name = 'stub';
  private fail = new URLSearchParams(location.search).has('adfail');

  async init(): Promise<void> {}

  private overlay(kind: 'interstitial' | 'rewarded'): {
    root: HTMLElement;
    timer: HTMLElement;
    close: HTMLButtonElement;
    bar: HTMLElement;
  } {
    const root = document.createElement('div');
    root.className = `ad-overlay ad-${kind}`;
    const hue = Math.floor(Math.random() * 360);
    root.innerHTML = `
      <div class="ad-top"><span class="ad-label">${t('ad')}</span><span class="ad-timer"></span>
        <button class="ad-close" aria-label="close">✕</button></div>
      <div class="ad-card" style="--h:${hue}">
        <div class="ad-capy">${capySvg({ hat: 'party', mood: 'happy' })}</div>
        <div class="ad-title">${t('adPlaceholder')}</div>
        <div class="ad-sub">${t('adPlaceholderSub')} · ${kind}</div>
      </div>
      <div class="ad-progress"><i></i></div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('on'));
    return {
      root,
      timer: root.querySelector('.ad-timer')!,
      close: root.querySelector('.ad-close')!,
      bar: root.querySelector('.ad-progress i')!,
    };
  }

  private remove(root: HTMLElement): void {
    root.classList.remove('on');
    setTimeout(() => root.remove(), 250);
  }

  showInterstitial(): Promise<void> {
    if (this.fail) return Promise.resolve();
    return new Promise((resolve) => {
      const { root, timer, close, bar } = this.overlay('interstitial');
      const total = AD_CONFIG.stubInterstitialSec;
      const skip = AD_CONFIG.stubInterstitialSkipSec;
      let left = total;
      close.style.visibility = 'hidden';
      bar.style.transition = `width ${total}s linear`;
      requestAnimationFrame(() => (bar.style.width = '100%'));
      const tick = () => {
        timer.textContent = left > 0 ? `${left}` : '';
        if (total - left >= skip) close.style.visibility = 'visible';
        if (left <= 0) clearInterval(iv);
        left--;
      };
      const iv = setInterval(tick, 1000);
      tick();
      close.onclick = () => {
        clearInterval(iv);
        this.remove(root);
        resolve();
      };
    });
  }

  showRewarded(): Promise<boolean> {
    if (this.fail) return Promise.reject(new Error('no fill'));
    return new Promise((resolve) => {
      const { root, timer, close, bar } = this.overlay('rewarded');
      const total = AD_CONFIG.stubRewardedSec;
      let left = total;
      let earned = false;
      bar.style.transition = `width ${total}s linear`;
      requestAnimationFrame(() => (bar.style.width = '100%'));
      const tick = () => {
        if (left <= 0) {
          earned = true;
          timer.textContent = t('adRewardDone');
          root.classList.add('done');
          clearInterval(iv);
        } else timer.textContent = t('adRewardIn', { s: left });
        left--;
      };
      const iv = setInterval(tick, 1000);
      tick();
      const finish = () => {
        clearInterval(iv);
        this.remove(root);
        resolve(earned);
      };
      close.onclick = () => {
        if (earned) return finish();
        const c = document.createElement('div');
        c.className = 'ad-confirm';
        c.innerHTML = `<p>${t('adCloseEarly')}</p><div><button class="btn btn-green ad-keep">${t('adKeepWatching')}</button><button class="btn btn-ghost ad-quit">${t('close')}</button></div>`;
        root.appendChild(c);
        c.querySelector<HTMLButtonElement>('.ad-keep')!.onclick = () => c.remove();
        c.querySelector<HTMLButtonElement>('.ad-quit')!.onclick = finish;
      };
    });
  }
}

type Placement = string;

/** Frequency policy + pause/resume around every ad. */
class AdManager {
  provider: AdProvider = new StubProvider();
  private sessionStart = Date.now();
  private lastInterstitial = 0;
  private lastRewarded = 0;
  private showing = false;
  private restarts = 0;
  levelsCompleted = 0;
  onToast: (msg: string) => void = () => {};

  async init(provider?: AdProvider): Promise<void> {
    if (provider) this.provider = provider;
    await this.provider.init();
  }

  get busy(): boolean {
    return this.showing;
  }

  private interstitialAllowed(): boolean {
    const now = Date.now();
    if (this.showing) return false;
    if (this.levelsCompleted < AD_CONFIG.interstitialFromLevel) return false;
    if (now - this.sessionStart < AD_CONFIG.sessionGraceSec * 1000) return false;
    if (now - this.lastInterstitial < AD_CONFIG.interstitialCooldownSec * 1000) return false;
    if (now - this.lastRewarded < AD_CONFIG.afterRewardedCooldownSec * 1000) return false;
    return true;
  }

  /** Shows an interstitial if policy allows. Never throws. */
  async interstitial(placement: Placement): Promise<boolean> {
    if (placement === 'restart') {
      this.restarts++;
      if (this.restarts % AD_CONFIG.restartEvery !== 0) return false;
    }
    if (placement === 'exit' && !AD_CONFIG.onExitLevel) return false;
    if (!this.interstitialAllowed()) return false;
    this.showing = true;
    Pause.acquire('ad');
    try {
      await this.provider.showInterstitial();
    } catch {
      /* ignore */
    } finally {
      Pause.release('ad');
      this.showing = false;
      this.lastInterstitial = Date.now();
    }
    console.info('[ads] interstitial', placement);
    return true;
  }

  /** Shows a rewarded ad; resolves true if the reward must be granted. */
  async rewarded(placement: Placement): Promise<boolean> {
    if (this.showing) return false;
    this.showing = true;
    Pause.acquire('ad');
    let ok = false;
    try {
      ok = await this.provider.showRewarded();
    } catch {
      this.onToast(t('adUnavailable'));
    } finally {
      Pause.release('ad');
      this.showing = false;
      this.lastRewarded = Date.now();
    }
    console.info('[ads] rewarded', placement, ok);
    return ok;
  }
}

export const Ads = new AdManager();
