import { audio } from '../audio/audio';
import { Save } from '../core/save';
import { t } from '../i18n';
import { capySvg, icon } from '../render/art';
import { button, confirmDialog, h, refreshCoins, type Screen } from './dom';
import { nav, setTheme } from './nav';

export class SettingsScreen implements Screen {
  el = h('section', { class: 'screen settings' });
  onLangChange: () => void = () => {};

  private render(): void {
    this.el.innerHTML = '';
    const top = h('div', { class: 'topbar' });
    top.appendChild(button(icon('back'), 'btn-ghost btn-icon', () => nav.back()));
    top.appendChild(h('h2', {}, t('settings')));
    this.el.appendChild(top);
    const wrap = h('div', { style: 'overflow:auto;flex:1;touch-action:pan-y' });
    wrap.appendChild(h('div', { class: 'settings-capy' }, capySvg({ hat: Save.data.equipped.hat, mood: 'think' })));
    const panel = h('div', { class: 'panel settings-panel' });
    const s = Save.data.settings;
    const apply = () => {
      audio.setVolumes(s);
      Save.save();
    };
    const toggleRow = (ic: string, label: string, get: () => boolean, set: (v: boolean) => void, slider?: { get: () => number; set: (v: number) => void }) => {
      const row = h('div', { class: 'set-row' }, `${icon(ic)}<span class="grow">${label}</span>`);
      const tg = h('button', { class: `toggle ${get() ? 'on' : ''}`, type: 'button', 'aria-label': label });
      tg.addEventListener('click', () => {
        set(!get());
        tg.classList.toggle('on', get());
        apply();
        audio.sfx('button');
      });
      row.appendChild(tg);
      panel.appendChild(row);
      if (slider) {
        const r = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(slider.get() * 100)) }) as HTMLInputElement;
        r.addEventListener('input', () => {
          slider.set(Number(r.value) / 100);
          apply();
        });
        r.addEventListener('change', () => audio.sfx('pop'));
        panel.appendChild(r);
      }
    };
    toggleRow('music', t('music'), () => s.musicOn, (v) => (s.musicOn = v), { get: () => s.music, set: (v) => (s.music = v) });
    toggleRow('sound', t('sound'), () => s.sfxOn, (v) => (s.sfxOn = v), { get: () => s.sfx, set: (v) => (s.sfx = v) });
    toggleRow('vibro', t('vibration'), () => s.vibro, (v) => (s.vibro = v));
    const langRow = h('div', { class: 'set-row' }, `${icon('globe')}<span class="grow">${t('language')}</span>`);
    const seg = h('div', { class: 'seg' });
    for (const [code, label] of [['ru', 'RU'], ['en', 'EN']] as const) {
      const b = h('button', { class: s.lang === code ? 'on' : '', type: 'button' }, label);
      b.addEventListener('click', () => {
        if (s.lang === code) return;
        s.lang = code;
        Save.save();
        audio.sfx('button');
        document.documentElement.lang = code;
        this.onLangChange();
        this.render();
      });
      seg.appendChild(b);
    }
    langRow.appendChild(seg);
    panel.appendChild(langRow);
    panel.appendChild(
      button(`${icon('trash')} ${t('resetProgress')}`, 'btn-red btn-small', async () => {
        if (await confirmDialog(t('resetConfirm'), t('yes'), t('no'))) {
          Save.reset();
          refreshCoins();
          setTheme(1);
          this.onLangChange();
          this.render();
        }
      }),
    );
    panel.appendChild(h('div', { class: 'version' }, `Capy Twist · ${t('version')} ${__APP_VERSION__}`));
    wrap.appendChild(panel);
    this.el.appendChild(wrap);
  }

  show(): void {
    this.render();
  }
  hide(): void {}
}
