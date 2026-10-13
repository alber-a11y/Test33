import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/styles.css';
import { AD_CONFIG } from './config';
import { Ads } from './ads/ads';
import { audio } from './audio/audio';
import { installInputGuards } from './core/guard';
import { Pause } from './core/pause';
import { Save } from './core/save';
import { Background } from './render/backgrounds';
import { fx } from './render/fx';
import { stage } from './render/stage';
import { loadTextures } from './render/textures';
import { anyModalOpen, refreshCoins, Screens, type Screen, toast } from './ui/dom';
import { GameScreen } from './ui/game';
import { MapScreen } from './ui/map';
import { MenuScreen } from './ui/menu';
import { bgRef, nav } from './ui/nav';
import { SettingsScreen } from './ui/settings';
import { ShopScreen } from './ui/shop';

async function boot(): Promise<void> {
  const bar = document.querySelector('#boot .boot-bar i') as HTMLElement;
  const progress = (k: number) => (bar.style.width = `${Math.round(k * 100)}%`);
  progress(0.1);
  Save.load();
  document.documentElement.lang = Save.data.settings.lang;
  installInputGuards();
  audio.setVolumes(Save.data.settings);

  await stage.init(document.getElementById('stage')!);
  progress(0.35);
  try {
    await Promise.race([document.fonts.load('900 20px Nunito'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fonts optional */
  }
  progress(0.5);
  await loadTextures();
  progress(0.85);
  fx.init();
  bgRef.bg = new Background(document.getElementById('bg')!);
  await Ads.init();
  Ads.onToast = (m) => toast(m);

  // screens
  Screens.init(document.getElementById('ui')!);
  let menu = new MenuScreen();
  const map = new MapScreen();
  const shop = new ShopScreen();
  const settings = new SettingsScreen();
  const game = new GameScreen();
  [menu, map, shop, settings, game].forEach((s) => Screens.add(s));
  let prev: Screen = menu;
  const go = (s: Screen, p?: unknown) => {
    if (Screens.current && Screens.current !== s && Screens.current !== shop && Screens.current !== settings) prev = Screens.current;
    Screens.go(s, p);
  };
  nav.menu = () => go(menu);
  nav.map = () => go(map);
  nav.shop = (tab?: string) => go(shop, tab);
  nav.settings = () => go(settings);
  nav.play = (level?: number) => {
    audio.unlock();
    go(game, level ?? Save.data.level);
  };
  nav.back = () => go(prev === game ? menu : prev);
  settings.onLangChange = () => {
    menu.el.remove();
    menu = new MenuScreen();
    Screens.add(menu);
  };

  // first user gesture unlocks audio
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });

  // pause when the tab is hidden; interstitial on long absence
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      Pause.acquire('hidden');
      Save.flush();
    } else {
      Pause.release('hidden');
      if (hiddenAt && Date.now() - hiddenAt > AD_CONFIG.resumeAfterHiddenSec * 1000 && !anyModalOpen()) void Ads.interstitial('resume');
    }
  });
  window.addEventListener('pagehide', () => Save.flush());
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => bgRef.bg?.relayout(), 200);
  });

  refreshCoins();
  progress(1);
  const params = new URLSearchParams(location.search);
  const lvl = Number(params.get('level'));
  const scr = params.get('screen');
  if (lvl > 0) nav.play(lvl);
  else if (scr === 'map') nav.map();
  else if (scr === 'shop') nav.shop(params.get('tab') ?? undefined);
  else if (scr === 'settings') nav.settings();
  else nav.menu();
  const bootEl = document.getElementById('boot')!;
  bootEl.classList.add('hide');
  setTimeout(() => bootEl.remove(), 500);

  // debug/automation hooks
  (window as unknown as Record<string, unknown>).__capy = { nav, Save, game, Ads, Pause };
}

void boot();
