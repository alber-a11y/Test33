import { audio, songForLevel } from '../audio/audio';
import { Ads } from '../ads/ads';
import { type BoosterId, ECONOMY } from '../config';
import { Pause } from '../core/pause';
import { Save } from '../core/save';
import type { Board, BoardHost, Rect } from '../game/board';
import { FreeBoard } from '../game/freeboard';
import type { LevelInfo } from '../game/levels';
import { Levels } from '../game/loader';
import { PathBoard } from '../game/pathboard';
import { dict, t } from '../i18n';
import { type CapyMood, capySvg, coinSvg, icon, prizeSvg } from '../render/art';
import { fx } from '../render/fx';
import { getSkin } from '../render/skins';
import { stage } from '../render/stage';
import { adBadge, anyModalOpen, button, closeAllModals, coinsPill, h, modal, type Screen, toast, vibrate } from './dom';
import { nav, themeFor, bgRef, myOutfit } from './nav';
import { boosterName, boosterOffer, chestDialog, coinRain } from './rewards';

type State = 'loading' | 'play' | 'won' | 'lost';

const BOOSTER_ORDER: BoosterId[] = ['hint', 'undo', 'wand', 'key', 'freeze'];

export class GameScreen implements Screen {
  el = h('section', { class: 'screen game passthrough' });
  private hudTop!: HTMLElement;
  private hudBottom!: HTMLElement;
  private levelPill!: HTMLElement;
  private modeBadge!: HTMLElement;
  private movesPill!: HTMLElement;
  private basketPill!: HTMLElement;
  private boostersEl!: HTMLElement;
  private capyEl!: HTMLElement;
  private bubble!: HTMLElement;
  private banner = h('div', { class: 'level-banner' });
  private tipEl = h('div', { class: 'tip' });
  private loadingEl = h('div', { class: 'loading-overlay' });

  info: LevelInfo | null = null;
  private board: Board | null = null;
  private state: State = 'loading';
  private moves = 0;
  private movesLeft: number | null = null;
  private fuse: number | null = null;
  private frozen = false;
  private collected = 0;
  private bonus = 0;
  private blockedStreak = 0;
  private idleTimer = 0;
  private bubbleTimer = 0;
  private mood: CapyMood = 'idle';
  private loadToken = 0;

  constructor() {
    this.build();
    document.body.append(this.banner, this.tipEl, this.loadingEl);
    window.addEventListener('resize', () => this.relayout());
  }

  private build(): void {
    this.el.innerHTML = '';
    this.hudTop = h('div', { class: 'hud-top' });
    this.hudTop.appendChild(button(icon('pause'), 'btn-ghost btn-icon', () => this.pauseMenu()));
    this.hudTop.appendChild(h('div', { class: 'grow' }));
    const lv = h('div', { class: 'hud-level' });
    this.levelPill = h('div', { class: 'pill level-pill' });
    this.modeBadge = h('div', { class: 'mode-badge' });
    lv.append(this.levelPill, this.modeBadge);
    this.hudTop.appendChild(lv);
    this.hudTop.appendChild(h('div', { class: 'grow' }));
    const stats = h('div', { class: 'hud-stats' });
    stats.appendChild(coinsPill());
    this.basketPill = h('div', { class: 'pill small basket-pill' });
    this.movesPill = h('div', { class: 'pill small moves-pill' });
    stats.append(this.basketPill, this.movesPill);
    this.hudTop.appendChild(stats);
    this.el.appendChild(this.hudTop);

    this.hudBottom = h('div', { class: 'hud-bottom' });
    this.capyEl = h('div', { class: 'hud-capy' });
    this.bubble = h('div', { class: 'bubble' });
    this.capyEl.addEventListener('click', () => this.pokeCapy());
    this.hudBottom.appendChild(this.capyEl);
    this.boostersEl = h('div', { class: 'boosters' });
    this.hudBottom.appendChild(this.boostersEl);
    this.hudBottom.appendChild(h('div', { class: 'hud-right' }));
    this.el.appendChild(this.hudBottom);
    this.loadingEl.innerHTML = `<div class="pill"><div class="spinner"></div>${t('loading')}</div>`;
  }

  // ---------- lifecycle ----------

  show(level?: unknown): void {
    this.build();
    void this.load(typeof level === 'number' ? level : Save.data.level);
  }

  hide(): void {
    this.destroyBoard();
    clearTimeout(this.idleTimer);
    this.tipEl.classList.remove('on');
    this.banner.classList.remove('on');
    this.loadingEl.classList.remove('on');
  }

  private destroyBoard(): void {
    this.board?.destroy();
    this.board = null;
  }

  async load(n: number): Promise<void> {
    const token = ++this.loadToken;
    this.state = 'loading';
    this.destroyBoard();
    closeAllModals();
    this.tipEl.classList.remove('on');
    const loadingTimer = setTimeout(() => this.loadingEl.classList.add('on'), 150);
    const info = await Levels.get(n);
    clearTimeout(loadingTimer);
    this.loadingEl.classList.remove('on');
    if (token !== this.loadToken) return;
    this.info = info;
    Levels.prefetch(n + 1);
    this.moves = 0;
    this.collected = 0;
    this.bonus = 0;
    this.frozen = false;
    this.blockedStreak = 0;
    this.movesLeft = info.data.moveLimit ?? null;
    this.fuse = info.data.fuse ?? null;
    Save.data.stats.played++;
    Save.save();
    bgRef.bg?.set(themeFor(n));
    audio.play(songForLevel(n));
    const host = this.makeHost();
    this.board = info.data.mode === 'path' ? new PathBoard(info.data, host) : new FreeBoard(info.data, host);
    stage.board.addChild(this.board.root);
    this.updateHud();
    this.setMood('idle');
    requestAnimationFrame(() => {
      if (token !== this.loadToken) return;
      this.relayout();
      this.state = 'play';
      this.intro();
      this.armIdle();
    });
  }

  private boardRect(): Rect {
    const a = this.hudTop.getBoundingClientRect();
    const b = this.hudBottom.getBoundingClientRect();
    const top = a.bottom + 14;
    const bottom = b.top - 8;
    const W = stage.width;
    const side = Math.max(14, W * 0.03);
    return { x: side, y: top, w: W - side * 2, h: Math.max(120, bottom - top) };
  }

  relayout(): void {
    if (!this.board) return;
    this.board.layout(this.boardRect());
    this.board.setFuse(this.fuse, this.frozen);
    bgRef.bg?.relayout();
  }

  // ---------- host ----------

  private makeHost(): BoardHost {
    return {
      skin: getSkin(Save.data.equipped.skin),
      prize: this.info!.prize,
      basketPoint: () => {
        const r = this.basketPill.getBoundingClientRect();
        return { x: r.left + 18, y: r.top + r.height / 2 };
      },
      moveDone: ({ won, counted }) => this.onMoveDone(won, counted),
      undone: () => {
        this.moves = Math.max(0, this.moves - 1);
        if (this.movesLeft !== null) this.movesLeft++;
        if (this.fuse !== null && !this.frozen) this.fuse++;
        this.board?.setFuse(this.fuse, this.frozen);
        this.updateHud();
      },
      itemCollected: (kind) => {
        if (kind === 'prize') this.collected++;
        if (kind === 'bonus') {
          this.collected++;
          this.bonus++;
        }
        if (kind !== 'bomb') {
          setTimeout(() => {
            this.updateHud();
            this.basketPill.classList.remove('bump');
            void this.basketPill.offsetWidth;
            this.basketPill.classList.add('bump');
            audio.sfx('coin');
          }, 700);
        }
        if (kind === 'bomb') this.updateBoosters();
      },
      blocked: () => {
        this.blockedStreak++;
        if (this.blockedStreak === 3) this.say(dict().thinking, 'think');
      },
      sfx: (name, pitch) => audio.sfx(name, { pitch }),
      vibrate: (ms) => vibrate(ms),
      canInteract: () => this.state === 'play' && !anyModalOpen() && !Ads.busy && !Pause.has('ad'),
    };
  }

  private onMoveDone(won: boolean, counted: boolean): void {
    if (this.state !== 'play') return;
    this.armIdle();
    this.blockedStreak = 0;
    if (counted) {
      this.moves++;
      if (this.movesLeft !== null) this.movesLeft--;
      if (this.fuse !== null && !this.frozen && this.board?.hasBombs()) {
        this.fuse--;
        if (this.fuse <= 3 && this.fuse > 0) audio.sfx('tick');
      }
      this.board?.setFuse(this.fuse, this.frozen);
    }
    this.updateHud();
    if (won) {
      void this.win();
      return;
    }
    if (this.fuse !== null && this.fuse <= 0 && !this.frozen && this.board?.hasBombs()) {
      void this.lose('bomb');
      return;
    }
    if (this.movesLeft !== null && this.movesLeft <= 0) void this.lose('moves');
  }

  // ---------- HUD ----------

  private updateHud(): void {
    const info = this.info;
    if (!info) return;
    this.levelPill.textContent = t('levelN', { n: info.n });
    const free = info.mode === 'free';
    this.modeBadge.className = `mode-badge ${free ? 'free' : ''} ${info.hard ? 'hard' : ''}`;
    this.modeBadge.innerHTML = info.hard ? `${icon('skull')} ${t('hardLevel')}` : `${icon(free ? 'free' : 'path')} ${free ? t('modeFree') : t('modePath')}`;
    const cap = ECONOMY.basketCapacity;
    this.basketPill.innerHTML = `<span class="pic">${prizeSvg(info.prize)}</span>${Math.min(cap, Save.data.basket + this.collected)}/${cap}`;
    if (this.movesLeft !== null) {
      this.movesPill.style.display = '';
      this.movesPill.innerHTML = `${icon('moves')} ${t('moves')}: ${Math.max(0, this.movesLeft)}`;
      this.movesPill.classList.toggle('warn', this.movesLeft <= 3);
    } else {
      this.movesPill.style.display = '';
      this.movesPill.classList.remove('warn');
      this.movesPill.innerHTML = `${icon('moves')} ${this.moves}`;
    }
    this.updateBoosters();
  }

  private updateBoosters(): void {
    const b = this.board;
    this.boostersEl.innerHTML = '';
    for (const id of BOOSTER_ORDER) {
      if (id === 'key' && !b?.hasLocks()) continue;
      if (id === 'freeze' && (!b?.hasBombs() || this.frozen)) continue;
      const n = Save.data.boosters[id] ?? 0;
      const el = h(
        'button',
        { class: 'booster', type: 'button', title: boosterName(id) },
        `${icon(id)}${n > 0 ? `<span class="cnt">${n}</span>` : `<span class="cnt ad">${icon('ad')}</span>`}<span class="lbl">${dict().short[id]}</span>`,
      );
      el.addEventListener('click', () => void this.useBooster(id));
      this.boostersEl.appendChild(el);
    }
  }

  private async useBooster(id: BoosterId): Promise<void> {
    audio.unlock();
    audio.sfx('button');
    if (this.state !== 'play' || !this.board) return;
    if ((Save.data.boosters[id] ?? 0) <= 0) {
      const got = await boosterOffer(id);
      this.updateBoosters();
      if (!got) return;
    }
    const b = this.board;
    let used = false;
    switch (id) {
      case 'hint':
        used = b.hint();
        break;
      case 'undo':
        used = b.undo();
        break;
      case 'wand':
        audio.sfx('magic');
        used = await b.wand();
        break;
      case 'key':
        used = b.unlockAll();
        break;
      case 'freeze':
        if (b.hasBombs()) {
          this.frozen = true;
          b.setFuse(this.fuse, true);
          audio.sfx('magic');
          used = true;
        }
        break;
    }
    if (used) {
      Save.addBooster(id, -1);
      this.updateHud();
    } else toast(t('boosterNA'));
  }

  // ---------- capybara ----------

  private setMood(m: CapyMood): void {
    this.mood = m;
    this.capyEl.innerHTML = capySvg({ ...myOutfit(), mood: m });
    this.capyEl.appendChild(this.bubble);
  }

  private say(text: string, mood?: CapyMood, ms = 3200): void {
    if (mood) this.setMood(mood);
    this.bubble.textContent = text;
    this.bubble.classList.add('on');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => {
      this.bubble.classList.remove('on');
      if (this.state === 'play' && this.mood !== 'idle') this.setMood('idle');
    }, ms);
  }

  private pokeCapy(): void {
    audio.unlock();
    audio.sfx('pop', { pitch: Math.floor(Math.random() * 5) });
    vibrate(10);
    const lines = Save.data.settings.lang === 'ru' ? ['Пи-пи!', 'Я верю в тебя!', 'Мандаринку?', 'Ты справишься!', 'Хрум-хрум'] : ['Squeak!', 'I believe in you!', 'Mandarin?', 'You got this!', 'Munch munch'];
    this.say(lines[Math.floor(Math.random() * lines.length)], 'happy', 1800);
  }

  private armIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.state === 'play' && !anyModalOpen()) this.say(dict().thinking, 'think', 3500);
    }, 14000);
  }

  // ---------- intro & tutorials ----------

  private intro(): void {
    const info = this.info!;
    const free = info.mode === 'free';
    this.banner.innerHTML = `<div class="t1">${t('levelN', { n: info.n })}</div><div class="t2 ${free ? 'free' : ''}">${free ? t('modeFree') : t('modePath')}</div>${info.hard ? `<span class="t3">${t('hardLevel')} · ${t('hardHint')}</span>` : ''}`;
    this.banner.classList.add('on');
    audio.sfx('whoosh');
    setTimeout(() => this.banner.classList.remove('on'), 1300);
    const tips: [string, boolean, string][] = [];
    const d = this.info!.data;
    const tipsSeen = Save.data.tips;
    if (info.mode === 'path') tips.push(['path', true, info.n === 1 ? t('tutorialTap') : t('modePathHint')]);
    else tips.push(['free', true, t('tutorialFree')]);
    if (d.mode === 'path') {
      if (d.cells.some((c) => c?.locked)) tips.push(['lock', false, t('tutorialLock')]);
      if (d.cells.some((c) => c?.link !== undefined)) tips.push(['link', false, t('tutorialLink')]);
      if (d.colors > 1) tips.push(['colors', false, t('tutorialColors')]);
      if (d.cells.some((c) => c?.bomb)) tips.push(['bomb', false, t('tutorialBomb')]);
    } else {
      if (d.pieces.some((p) => p.locked)) tips.push(['lock', false, t('tutorialLock')]);
      if (d.items.some((i) => i.kind === 'bomb')) tips.push(['bomb', false, t('tutorialBomb')]);
    }
    const fresh = tips.filter(([k]) => !tipsSeen[k]);
    const firstOfMode = fresh.find(([, isMode]) => isMode);
    const tip = fresh.find(([, isMode]) => !isMode) ?? firstOfMode;
    setTimeout(() => {
      if (this.state !== 'play') return;
      if (tip) {
        this.showTip(tip[2]);
        tipsSeen[tip[0]] = true;
        if (firstOfMode) tipsSeen[firstOfMode[0]] = true;
        Save.save();
      }
      if (firstOfMode && this.board) this.board.tutorialPoint();
      this.say(info.mode === 'free' ? t('modeFreeHint') : t('modePathHint'), 'idle', 3000);
      if (info.hard && info.n > 10) this.hardOffer();
    }, 1250);
  }

  private showTip(text: string): void {
    this.tipEl.textContent = text;
    this.tipEl.style.top = `${this.hudTop.getBoundingClientRect().bottom + 8}px`;
    this.tipEl.classList.add('on');
    setTimeout(() => this.tipEl.classList.remove('on'), 5200);
  }

  /** Aggressive pre-level offer on hard levels. */
  private hardOffer(): void {
    const m = modal({ title: t('hardLevel'), ribbon: '', closable: true });
    m.panel.appendChild(h('div', { class: 'offer-ic' }, icon('wand')));
    m.panel.appendChild(h('p', {}, `${boosterName('wand')} — ${t('getForAd')}`));
    const col = h('div', { class: 'col' });
    col.appendChild(
      button(`${adBadge()} ${t('plusOne')}`, 'btn-purple pulse', async () => {
        if (await Ads.rewarded('hard_level_wand')) {
          Save.addBooster('wand', 1);
          this.updateBoosters();
          m.close();
        }
      }),
    );
    col.appendChild(h('button', { class: 'link', type: 'button' }, t('noThanks')));
    col.lastElementChild!.addEventListener('click', () => m.close());
    m.panel.appendChild(col);
  }

  // ---------- win / lose ----------

  private stars(): number {
    const d = this.info!.data;
    const p = Math.max(1, d.par);
    const m = this.moves;
    if (d.mode === 'path') {
      if (m <= p + Math.ceil(p * 0.2) + 1) return 3;
      if (m <= Math.ceil(p * 1.6) + 3) return 2;
      return 1;
    }
    if (m <= p + 1) return 3;
    if (m <= p * 2 + 2) return 2;
    return 1;
  }

  private async win(): Promise<void> {
    this.state = 'won';
    clearTimeout(this.idleTimer);
    this.tipEl.classList.remove('on');
    const info = this.info!;
    await this.board?.celebrate();
    audio.sfx('win');
    fx.confetti();
    this.setMood('happy');
    const stars = this.stars();
    const replay = (Save.data.stars[info.n] ?? 0) > 0;
    let coins = ECONOMY.winBase + stars * ECONOMY.winPerStar + this.bonus * 5;
    if (info.hard) coins *= ECONOMY.hardMultiplier;
    if (replay) coins = Math.ceil(coins / 2);
    Save.setStars(info.n, stars);
    Save.data.stats.wins++;
    Ads.levelsCompleted++;
    Save.data.basket += this.collected;
    Save.data.prizesTotal += this.collected;
    let chests = 0;
    while (Save.data.basket >= ECONOMY.basketCapacity) {
      Save.data.basket -= ECONOMY.basketCapacity;
      chests++;
    }
    Save.save();
    await new Promise((r) => setTimeout(r, 500));
    await this.winDialog(stars, coins);
    for (let i = 0; i < chests; i++) await chestDialog();
    await Ads.interstitial('level_end');
    void this.load(info.n + 1);
  }

  private winDialog(stars: number, coins: number): Promise<void> {
    const words = dict().winAlt;
    const title = stars === 3 ? words[Math.floor(Math.random() * words.length)] : t('win');
    const m = modal({ title, ribbon: 'green', closable: false });
    const row = h('div', { class: 'stars-row' }, [1, 2, 3].map((i) => icon('star', `ic ${i <= stars ? 'on' : ''}`)).join(''));
    m.panel.appendChild(row);
    [...row.children].forEach((s, i) =>
      setTimeout(() => {
        s.classList.add('show');
        if (i < stars) audio.sfx('star', { pitch: i * 2 });
      }, 250 + i * 280),
    );
    m.panel.appendChild(h('div', { class: 'dlg-capy' }, capySvg({ ...myOutfit(), mood: 'happy' })));
    const reward = h('div', { class: 'reward-line' }, `${coinSvg()}<span>${coins}</span>`);
    m.panel.appendChild(reward);
    // multiplier bar
    const mults = ECONOMY.multipliers;
    const colors = ['#5fd13a', '#45b8ff', '#ff5d8f', '#45b8ff', '#5fd13a'];
    const bar = h('div', { class: 'mult' }, mults.map((v, i) => `<div style="background:${colors[i]}">×${v}</div>`).join('') + '<span class="needle"></span>');
    m.panel.appendChild(bar);
    const needle = bar.querySelector('.needle') as HTMLElement;
    let running = true;
    let cur = mults[0];
    const t0 = performance.now();
    const adBtn = button('', 'btn-purple btn-big pulse', () => void claim(true));
    const tick = (now: number) => {
      if (!running) return;
      const k = (Math.sin((now - t0) / 380) + 1) / 2;
      needle.style.left = `${k * 100}%`;
      const idx = Math.min(mults.length - 1, Math.floor(k * mults.length));
      if (mults[idx] !== cur || !adBtn.innerHTML) {
        cur = mults[idx];
        adBtn.innerHTML = `${adBadge()} ${t('claimX', { n: cur })}`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const col = h('div', { class: 'col' });
    col.appendChild(adBtn);
    const plain = h('button', { class: 'link fade-late', type: 'button' }, t('onlyN', { n: coins }));
    plain.addEventListener('click', () => void claim(false));
    col.appendChild(plain);
    setTimeout(() => plain.classList.add('on'), 2200);
    m.panel.appendChild(col);
    let busy = false;
    const claim = async (ad: boolean) => {
      if (busy) return;
      busy = true;
      running = false;
      let mult = 1;
      if (ad) {
        const chosen = cur;
        if (await Ads.rewarded('win_multiplier')) mult = chosen;
      }
      const total = coins * mult;
      reward.querySelector('span')!.textContent = String(total);
      Save.addCoins(total);
      coinRain(reward, total);
      await new Promise((r) => setTimeout(r, 900));
      m.close();
    };
    return m.closed;
  }

  private async lose(reason: 'moves' | 'bomb'): Promise<void> {
    this.state = 'lost';
    clearTimeout(this.idleTimer);
    this.setMood('sad');
    const m = modal({ title: t('lose'), ribbon: '', closable: false });
    m.panel.appendChild(h('div', { class: 'dlg-capy' }, capySvg({ ...myOutfit(), mood: reason === 'bomb' ? 'wow' : 'sad' })));
    m.panel.appendChild(h('p', {}, reason === 'bomb' ? t('loseBomb').split('!')[0] + '!' : t('loseMoves')));
    const col = h('div', { class: 'col' });
    let continued = false;
    if (reason === 'bomb') {
      col.appendChild(
        button(`${adBadge()} ${icon('freeze')} ${t('freeze')}`, 'btn-purple btn-big pulse', async () => {
          if (await Ads.rewarded('continue_freeze')) {
            continued = true;
            this.frozen = true;
            this.board?.setFuse(this.fuse, true);
            m.close();
          }
        }),
      );
    } else {
      col.appendChild(
        button(`${adBadge()} ${t('continueAd', { n: ECONOMY.continueMoves })}`, 'btn-purple btn-big pulse', async () => {
          if (await Ads.rewarded('continue_moves')) {
            continued = true;
            this.movesLeft = (this.movesLeft ?? 0) + ECONOMY.continueMoves;
            m.close();
          }
        }),
      );
    }
    col.appendChild(button(`${icon('restart')} ${t('retry')}`, 'btn-green', () => m.close()));
    m.panel.appendChild(col);
    audio.sfx('lose');
    await m.closed;
    if (continued) {
      this.state = 'play';
      this.setMood('happy');
      this.updateHud();
      return;
    }
    if (reason === 'bomb') {
      audio.sfx('boom');
      vibrate(120);
      await this.board?.explode();
    }
    await this.restart();
  }

  private async restart(): Promise<void> {
    if (!this.info) return;
    Save.data.stats.restarts++;
    await Ads.interstitial('restart');
    void this.load(this.info.n);
  }

  private pauseMenu(): void {
    if (this.state !== 'play') return;
    Pause.acquire('menu', { audio: false, loop: false });
    const m = modal({ title: t('pause'), ribbon: 'blue', closable: true, onClose: () => Pause.release('menu') });
    const s = Save.data.settings;
    const toggles = h('div', { class: 'row' });
    const mk = (ic: string, get: () => boolean, set: (v: boolean) => void) => {
      const b = button(icon(ic), `btn-icon ${get() ? 'btn-blue' : 'btn-ghost'}`, () => {
        set(!get());
        b.className = `btn btn-icon ${get() ? 'btn-blue' : 'btn-ghost'}`;
        audio.setVolumes(s);
        Save.save();
      });
      toggles.appendChild(b);
    };
    mk('music', () => s.musicOn, (v) => (s.musicOn = v));
    mk('sound', () => s.sfxOn, (v) => (s.sfxOn = v));
    mk('vibro', () => s.vibro, (v) => (s.vibro = v));
    m.panel.appendChild(toggles);
    const col = h('div', { class: 'col' });
    col.appendChild(button(`${icon('play')} ${t('resume')}`, 'btn-green btn-big', () => m.close()));
    col.appendChild(
      button(`${icon('restart')} ${t('restart')}`, 'btn-orange', () => {
        m.close();
        void this.restart();
      }),
    );
    const row = h('div', { class: 'row' });
    row.appendChild(
      button(`${icon('map')} ${t('map')}`, 'btn-blue', async () => {
        m.close();
        await Ads.interstitial('exit');
        nav.map();
      }),
    );
    row.appendChild(
      button(`${icon('home')} ${t('home')}`, 'btn-blue', async () => {
        m.close();
        await Ads.interstitial('exit');
        nav.menu();
      }),
    );
    col.appendChild(row);
    m.panel.appendChild(col);
  }
}
