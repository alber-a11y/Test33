/** All illustrations are hand-written SVG strings (no external assets). */
import type { PrizeKind } from '../config';

let uidCounter = 0;
/** Make gradient ids unique so many inline copies can coexist in the DOM. */
function uniq(svg: string): string {
  const u = `u${(uidCounter++).toString(36)}`;
  return svg.replace(/id="([^"]+)"/g, `id="$1${u}"`).replace(/url\(#([^)]+)\)/g, `url(#$1${u})`);
}

export type CapyMood = 'idle' | 'happy' | 'sad' | 'sleep' | 'think' | 'wow';

const C = {
  fur: '#C08353',
  furDark: '#9A6239',
  furLight: '#DDA676',
  ear: '#7E4E2C',
  muzzle: '#A8703F',
  ink: '#33200F',
};

function eyes(mood: CapyMood): string {
  switch (mood) {
    case 'happy':
      return `<path d="M68 74 Q77 63 86 74" stroke="${C.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
              <path d="M114 74 Q123 63 132 74" stroke="${C.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'sleep':
      return `<path d="M68 72 Q77 79 86 72" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
              <path d="M114 72 Q123 79 132 72" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    case 'sad':
      return `<g class="capy-eyes"><ellipse cx="77" cy="74" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="79" cy="71" r="2.4" fill="#fff"/>
              <ellipse cx="123" cy="74" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="125" cy="71" r="2.4" fill="#fff"/></g>
              <path d="M66 66 L86 60" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M134 66 L114 60" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M70 84 q-4 8 0 11 q4 -3 0 -11z" fill="#6EC6FF"/>`;
    case 'think':
      return `<g class="capy-eyes"><ellipse cx="77" cy="73" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="80" cy="69" r="2.6" fill="#fff"/>
              <ellipse cx="123" cy="73" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="126" cy="69" r="2.6" fill="#fff"/></g>
              <path d="M114 58 Q123 53 132 58" stroke="${C.ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case 'wow':
      return `<g class="capy-eyes"><circle cx="77" cy="73" r="9" fill="#fff"/><circle cx="77" cy="74" r="6" fill="${C.ink}"/><circle cx="79" cy="71" r="2" fill="#fff"/>
              <circle cx="123" cy="73" r="9" fill="#fff"/><circle cx="123" cy="74" r="6" fill="${C.ink}"/><circle cx="125" cy="71" r="2" fill="#fff"/></g>`;
    default:
      return `<g class="capy-eyes"><ellipse cx="77" cy="74" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="79.5" cy="71" r="2.5" fill="#fff"/>
              <ellipse cx="123" cy="74" rx="6.5" ry="7.5" fill="${C.ink}"/><circle cx="125.5" cy="71" r="2.5" fill="#fff"/></g>`;
  }
}

function mouth(mood: CapyMood): string {
  switch (mood) {
    case 'happy':
      return `<path d="M88 106 Q100 124 112 106 Z" fill="#7A2E2E"/><path d="M93 113 Q100 120 107 113 Q100 110 93 113Z" fill="#F07878"/>`;
    case 'sad':
      return `<path d="M91 113 Q100 106 109 113" stroke="${C.ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case 'wow':
      return `<ellipse cx="100" cy="111" rx="6" ry="7" fill="#7A2E2E"/>`;
    default:
      return `<path d="M91 107 Q95.5 112 100 107 Q104.5 112 109 107" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

export function hatSvg(hat: string): string {
  switch (hat) {
    case 'mandarin':
      return `<g class="capy-hat"><ellipse cx="100" cy="36" rx="20" ry="4" fill="#000" opacity=".12"/>
        <circle cx="100" cy="20" r="17" fill="url(#gMand)"/>
        <circle cx="93" cy="15" r="1.4" fill="#E8781A"/><circle cx="106" cy="22" r="1.4" fill="#E8781A"/><circle cx="98" cy="26" r="1.4" fill="#E8781A"/>
        <ellipse cx="94" cy="13" rx="5" ry="3" fill="#fff" opacity=".45"/>
        <path d="M100 4 q2 -4 1 -6" stroke="#5B3A1E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M101 4 C108 -4 118 -2 120 2 C113 6 106 7 101 4Z" fill="#4CAF50"/><path d="M102 4 L117 1.5" stroke="#2E7D32" stroke-width="1.2"/></g>`;
    case 'party':
      return `<g class="capy-hat"><path d="M80 38 L100 -8 L120 38 Z" fill="#FF5DA2"/>
        <path d="M86 24 L114 24 L117 31 L83 31Z" fill="#FFD93D"/><path d="M93 8 L107 8 L110 15 L90 15Z" fill="#4FC3F7"/>
        <circle cx="100" cy="-9" r="7" fill="#FFD93D"/><circle cx="98" cy="-11" r="2" fill="#fff" opacity=".7"/></g>`;
    case 'flowers':
      return `<g class="capy-hat">${[60, 80, 100, 120, 140]
        .map((x, i) => {
          const y = 36 - Math.cos(((x - 100) / 50) * 1.2) * 8;
          const col = ['#FF7AA8', '#FFD93D', '#B388FF', '#FF8A65', '#80DEEA'][i];
          return `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288]
            .map((a) => `<ellipse cx="0" cy="-6" rx="4.2" ry="6" fill="${col}" transform="rotate(${a})"/>`)
            .join('')}<circle r="3.6" fill="#FFF3B0"/></g>`;
        })
        .join('')}<path d="M56 40 Q100 22 144 40" stroke="#66BB6A" stroke-width="3" fill="none"/></g>`;
    case 'beanie':
      return `<g class="capy-hat"><path d="M54 46 C54 6 146 6 146 46 Z" fill="#E53950"/>
        <rect x="50" y="38" width="100" height="14" rx="7" fill="#F8F1E5"/>
        ${[62, 74, 86, 98, 110, 122, 134].map((x) => `<path d="M${x} 40 v10" stroke="#E0D6C6" stroke-width="2.4"/>`).join('')}
        <circle cx="100" cy="6" r="10" fill="#F8F1E5"/><path d="M70 30 Q100 18 130 30" stroke="#FF7B8D" stroke-width="3" fill="none"/></g>`;
    case 'chef':
      return `<g class="capy-hat"><rect x="70" y="18" width="60" height="24" rx="4" fill="#fff" stroke="#E2E2E2" stroke-width="2"/>
        <circle cx="78" cy="14" r="14" fill="#fff"/><circle cx="100" cy="6" r="16" fill="#fff"/><circle cx="122" cy="14" r="14" fill="#fff"/>
        <path d="M84 24 v14 M100 22 v16 M116 24 v14" stroke="#ECECEC" stroke-width="2"/></g>`;
    case 'cowboy':
      return `<g class="capy-hat"><ellipse cx="100" cy="38" rx="58" ry="10" fill="#8D5A2B"/>
        <path d="M72 38 C70 6 86 4 100 14 C114 4 130 6 128 38 Z" fill="#A86B34"/>
        <path d="M73 30 Q100 36 127 30 L127 36 Q100 42 73 36Z" fill="#5D3A1A"/><circle cx="100" cy="34" r="3" fill="#FFD54F"/></g>`;
    case 'crown':
      return `<g class="capy-hat"><path d="M70 40 L66 8 L84 24 L100 2 L116 24 L134 8 L130 40 Z" fill="url(#gGold)" stroke="#B8860B" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="100" cy="28" r="5" fill="#E53950"/><circle cx="82" cy="32" r="3.5" fill="#4FC3F7"/><circle cx="118" cy="32" r="3.5" fill="#66BB6A"/>
        <circle cx="66" cy="8" r="3.5" fill="#FFE082"/><circle cx="100" cy="2" r="3.5" fill="#FFE082"/><circle cx="134" cy="8" r="3.5" fill="#FFE082"/></g>`;
    case 'headphones':
      return `<g class="capy-hat"><path d="M46 70 C42 10 158 10 154 70" stroke="#37474F" stroke-width="9" fill="none" stroke-linecap="round"/>
        <rect x="32" y="58" width="22" height="34" rx="10" fill="#FF5DA2"/><rect x="146" y="58" width="22" height="34" rx="10" fill="#FF5DA2"/>
        <rect x="38" y="64" width="10" height="22" rx="5" fill="#FF9EC8"/><rect x="152" y="64" width="10" height="22" rx="5" fill="#FF9EC8"/></g>`;
    case 'wizard':
      return `<g class="capy-hat"><ellipse cx="100" cy="38" rx="46" ry="9" fill="#5E35B1"/>
        <path d="M74 38 Q92 10 104 -14 Q110 -20 116 -10 Q112 -6 110 -2 Q118 16 126 38 Z" fill="#7E57C2"/>
        <path d="M78 32 Q100 38 122 32 L124 38 Q100 44 76 38Z" fill="#FFD54F"/>
        <path d="M96 12 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z" fill="#FFE082"/><circle cx="110" cy="24" r="2" fill="#FFE082"/></g>`;
    default:
      return '';
  }
}

const DEFS = `<defs>
  <radialGradient id="gMand" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFC15A"/><stop offset=".6" stop-color="#FF9124"/><stop offset="1" stop-color="#E86A10"/></radialGradient>
  <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF59D"/><stop offset=".5" stop-color="#FFD54F"/><stop offset="1" stop-color="#F9A825"/></linearGradient>
  <radialGradient id="gBody" cx="45%" cy="30%" r="80%"><stop offset="0" stop-color="${C.furLight}"/><stop offset=".55" stop-color="${C.fur}"/><stop offset="1" stop-color="${C.furDark}"/></radialGradient>
  <radialGradient id="gHead" cx="45%" cy="30%" r="80%"><stop offset="0" stop-color="#D9A070"/><stop offset=".6" stop-color="${C.fur}"/><stop offset="1" stop-color="#A86B3E"/></radialGradient>
</defs>`;

/** Front-facing chibi capybara. viewBox 0 0 200 200 (hat may overflow upward). */
export function capySvg(opts: { hat?: string; mood?: CapyMood; extra?: string } = {}): string {
  const mood = opts.mood ?? 'idle';
  const hat = opts.hat ?? 'mandarin';
  const back = '';
  return uniq(`<svg class="capy capy-${mood}" viewBox="0 -24 200 224" xmlns="http://www.w3.org/2000/svg">${DEFS}
  <ellipse cx="100" cy="190" rx="64" ry="9" fill="#000" opacity=".14"/>
  <g class="capy-bodyg">
    <path d="M36 152 C36 108 62 94 100 94 C138 94 164 108 164 152 C164 178 140 188 100 188 C60 188 36 178 36 152Z" fill="url(#gBody)"/>
    <ellipse cx="100" cy="160" rx="40" ry="22" fill="${C.furLight}" opacity=".7"/>
    <ellipse cx="70" cy="186" rx="16" ry="7" fill="${C.ear}"/><ellipse cx="130" cy="186" rx="16" ry="7" fill="${C.ear}"/>
    <ellipse class="capy-arm-l" cx="58" cy="150" rx="10" ry="16" fill="${C.furDark}" transform="rotate(18 58 150)"/>
    <ellipse class="capy-arm-r" cx="142" cy="150" rx="10" ry="16" fill="${C.furDark}" transform="rotate(-18 142 150)"/>
  </g>
  <g class="capy-headg">${back}
    <ellipse cx="58" cy="40" rx="12" ry="10" fill="${C.ear}"/><ellipse cx="58" cy="42" rx="6" ry="5" fill="#5E3A20"/>
    <ellipse cx="142" cy="40" rx="12" ry="10" fill="${C.ear}"/><ellipse cx="142" cy="42" rx="6" ry="5" fill="#5E3A20"/>
    <rect x="42" y="32" width="116" height="96" rx="46" fill="url(#gHead)"/>
    <path d="M60 46 Q100 30 140 46" stroke="#E2B48A" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/>
    ${eyes(mood)}
    <ellipse cx="60" cy="98" rx="10" ry="6.5" fill="#F48A80" opacity=".5"/><ellipse cx="140" cy="98" rx="10" ry="6.5" fill="#F48A80" opacity=".5"/>
    <rect x="66" y="84" width="68" height="40" rx="20" fill="${C.muzzle}"/>
    <ellipse cx="100" cy="88" rx="24" ry="5" fill="#C48A57" opacity=".6"/>
    <ellipse cx="88" cy="95" rx="5.5" ry="3.8" fill="${C.ink}"/><ellipse cx="112" cy="95" rx="5.5" ry="3.8" fill="${C.ink}"/>
    ${mouth(mood)}
    ${hatSvg(hat)}
  </g>
  ${mood === 'sleep' ? `<g class="capy-z" fill="#6D8BC9" font-family="Nunito,Arial" font-weight="900"><text x="150" y="24" font-size="22">z</text><text x="166" y="6" font-size="16">z</text></g>` : ''}
  ${opts.extra ?? ''}
</svg>`);
}

// ---------- prizes & items (viewBox 0 0 100 100) ----------

export function prizeSvg(kind: PrizeKind | 'bomb' | 'coin' | 'chest' | 'basket'): string {
  const wrap = (body: string, defs = '') =>
    uniq(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`);
  switch (kind) {
    case 'mandarin':
      return wrap(
        `<ellipse cx="50" cy="90" rx="26" ry="5" fill="#000" opacity=".12"/>
        <circle cx="50" cy="56" r="34" fill="url(#m)"/>
        ${[[36, 44], [60, 40], [66, 62], [44, 70], [54, 54], [32, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#E06A0E" opacity=".7"/>`).join('')}
        <ellipse cx="38" cy="40" rx="10" ry="6" fill="#fff" opacity=".5" transform="rotate(-30 38 40)"/>
        <path d="M50 24 q1 -8 -2 -12" stroke="#5B3A1E" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M51 22 C60 8 78 8 84 14 C74 24 60 26 51 22Z" fill="#4CAF50"/><path d="M53 21 L80 14" stroke="#2E7D32" stroke-width="2"/>`,
        `<radialGradient id="m" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#FFD27A"/><stop offset=".55" stop-color="#FF9A2E"/><stop offset="1" stop-color="#E5650C"/></radialGradient>`,
      );
    case 'acorn':
      return wrap(
        `<ellipse cx="50" cy="92" rx="22" ry="5" fill="#000" opacity=".12"/>
        <path d="M24 46 C24 74 38 90 50 92 C62 90 76 74 76 46 Z" fill="url(#a)"/>
        <ellipse cx="38" cy="58" rx="5" ry="12" fill="#fff" opacity=".45"/>
        <path d="M18 46 C18 26 32 18 50 18 C68 18 82 26 82 46 C70 52 30 52 18 46Z" fill="url(#c)"/>
        <path d="M26 40 L40 26 M38 46 L58 24 M54 47 L72 30 M30 30 L48 46 M48 22 L68 44" stroke="#7A4A20" stroke-width="2" opacity=".5"/>
        <path d="M50 18 q2 -10 8 -12" stroke="#6B3E1A" stroke-width="5" fill="none" stroke-linecap="round"/>`,
        `<linearGradient id="a" x1="0" x2="1"><stop offset="0" stop-color="#FFE07A"/><stop offset=".6" stop-color="#F5B82E"/><stop offset="1" stop-color="#D98E12"/></linearGradient>
         <linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8874A"/><stop offset="1" stop-color="#8E5526"/></linearGradient>`,
      );
    case 'flower':
      return wrap(
        `<ellipse cx="50" cy="92" rx="22" ry="5" fill="#000" opacity=".12"/>
        ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="50" cy="28" rx="13" ry="20" fill="url(#p)" transform="rotate(${a} 50 52)"/>`).join('')}
        <circle cx="50" cy="52" r="14" fill="url(#y)"/>
        ${[[45, 48], [55, 50], [50, 57], [44, 55], [56, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#C77800"/>`).join('')}`,
        `<radialGradient id="p" cx="50%" cy="80%" r="80%"><stop offset="0" stop-color="#FFD1E3"/><stop offset="1" stop-color="#FF5C9D"/></radialGradient>
         <radialGradient id="y" cx="40%" cy="35%"><stop offset="0" stop-color="#FFF59D"/><stop offset="1" stop-color="#FFB300"/></radialGradient>`,
      );
    case 'strawberry':
      return wrap(
        `<ellipse cx="50" cy="92" rx="20" ry="5" fill="#000" opacity=".12"/>
        <path d="M50 92 C30 84 16 60 20 42 C24 28 40 26 50 30 C60 26 76 28 80 42 C84 60 70 84 50 92Z" fill="url(#s)"/>
        ${[[36, 46], [50, 44], [64, 46], [30, 58], [44, 58], [58, 58], [70, 58], [38, 70], [52, 72], [64, 70], [46, 82]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#FFE082"/>`).join('')}
        <ellipse cx="34" cy="44" rx="5" ry="9" fill="#fff" opacity=".35" transform="rotate(25 34 44)"/>
        <path d="M50 32 L36 20 L46 24 L50 12 L54 24 L64 20Z M50 32 L30 30 L42 28 M50 32 L70 30 L58 28" fill="#43A047" stroke="#2E7D32" stroke-width="2" stroke-linejoin="round"/>`,
        `<radialGradient id="s" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#FF7A7A"/><stop offset=".6" stop-color="#E8273A"/><stop offset="1" stop-color="#B0122A"/></radialGradient>`,
      );
    case 'nut':
      return wrap(
        `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".12"/>
        <path d="M50 92 C26 92 18 70 22 56 C26 42 40 36 50 36 C60 36 74 42 78 56 C82 70 74 92 50 92Z" fill="url(#n)"/>
        <path d="M22 54 C24 30 36 16 50 16 C64 16 76 30 78 54 C66 46 34 46 22 54Z" fill="#7B4A26"/>
        <path d="M30 40 Q50 30 70 40" stroke="#A8703F" stroke-width="2.5" fill="none" opacity=".7"/>
        <ellipse cx="38" cy="64" rx="6" ry="11" fill="#fff" opacity=".3"/>
        <path d="M50 16 q0 -8 6 -10" stroke="#5B3A1E" stroke-width="4" fill="none" stroke-linecap="round"/>`,
        `<radialGradient id="n" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#E8B07A"/><stop offset=".6" stop-color="#C47F45"/><stop offset="1" stop-color="#94592A"/></radialGradient>`,
      );
    case 'mushroom':
      return wrap(
        `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".12"/>
        <path d="M38 54 C36 70 36 84 40 90 C46 92 54 92 60 90 C64 84 64 70 62 54Z" fill="#FFF3E0" stroke="#E8D4B8" stroke-width="2"/>
        <path d="M12 56 C12 26 30 12 50 12 C70 12 88 26 88 56 C70 62 30 62 12 56Z" fill="url(#mu)"/>
        <circle cx="34" cy="34" r="6" fill="#fff"/><circle cx="58" cy="26" r="7" fill="#fff"/><circle cx="72" cy="44" r="5" fill="#fff"/><circle cx="44" cy="50" r="4" fill="#fff"/>
        <circle cx="44" cy="72" r="2" fill="#5D4037"/><circle cx="56" cy="72" r="2" fill="#5D4037"/><path d="M46 78 Q50 81 54 78" stroke="#5D4037" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        `<radialGradient id="mu" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#FF8A80"/><stop offset=".6" stop-color="#E53935"/><stop offset="1" stop-color="#B71C1C"/></radialGradient>`,
      );
    case 'pearl':
      return wrap(
        `<ellipse cx="50" cy="92" rx="30" ry="5" fill="#000" opacity=".12"/>
        <path d="M10 70 C14 88 86 88 90 70 C70 78 30 78 10 70Z" fill="#F8BBD0" stroke="#EC8FB0" stroke-width="2"/>
        <path d="M12 66 C10 30 90 30 88 66 C70 60 30 60 12 66Z" fill="url(#sh)" stroke="#EC8FB0" stroke-width="2"/>
        ${[24, 37, 50, 63, 76].map((x) => `<path d="M50 64 L${x} 38" stroke="#EC8FB0" stroke-width="1.6" opacity=".7"/>`).join('')}
        <circle cx="50" cy="66" r="15" fill="url(#pe)"/><circle cx="45" cy="61" r="4" fill="#fff" opacity=".9"/>`,
        `<radialGradient id="pe" cx="40%" cy="35%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#E8EAF6"/><stop offset="1" stop-color="#B0BEC5"/></radialGradient>
         <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE0EC"/><stop offset="1" stop-color="#F8A8C8"/></linearGradient>`,
      );
    case 'star':
      return wrap(
        `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".12"/>
        <path d="M50 8 L62 36 L92 38 L69 58 L77 88 L50 72 L23 88 L31 58 L8 38 L38 36Z" fill="url(#st)" stroke="#E6A100" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="42" cy="50" r="3" fill="#5D4037"/><circle cx="58" cy="50" r="3" fill="#5D4037"/>
        <path d="M44 60 Q50 65 56 60" stroke="#5D4037" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="58" rx="4" ry="2.5" fill="#FF8A80" opacity=".6"/><ellipse cx="64" cy="58" rx="4" ry="2.5" fill="#FF8A80" opacity=".6"/>`,
        `<radialGradient id="st" cx="45%" cy="35%"><stop offset="0" stop-color="#FFF9C4"/><stop offset=".6" stop-color="#FFD54F"/><stop offset="1" stop-color="#FFB300"/></radialGradient>`,
      );
    case 'bomb':
      return wrap(
        `<ellipse cx="50" cy="92" rx="26" ry="5" fill="#000" opacity=".15"/>
        <circle cx="48" cy="58" r="32" fill="url(#b)"/>
        <rect x="58" y="20" width="16" height="12" rx="3" fill="#5D6D7E" transform="rotate(35 66 26)"/>
        <path d="M70 22 Q78 10 86 12" stroke="#8D6E63" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="44" rx="9" ry="6" fill="#fff" opacity=".35" transform="rotate(-35 36 44)"/>
        <path d="M48 46 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="#FFD54F" opacity=".9"/>`,
        `<radialGradient id="b" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#7B6A62"/><stop offset=".55" stop-color="#3E2C26"/><stop offset="1" stop-color="#1A100C"/></radialGradient>`,
      );
    case 'coin':
      return wrap(
        `<circle cx="50" cy="52" r="42" fill="#E39A0C"/><circle cx="50" cy="48" r="42" fill="url(#co)"/>
        <circle cx="50" cy="48" r="31" fill="none" stroke="#E8A317" stroke-width="5"/>
        <path d="M50 28 l6 13 14 1 -11 9 4 14 -13 -8 -13 8 4 -14 -11 -9 14 -1z" fill="#FFF3C4" stroke="#E8A317" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="34" cy="30" rx="10" ry="5" fill="#fff" opacity=".5" transform="rotate(-35 34 30)"/>`,
        `<radialGradient id="co" cx="40%" cy="30%"><stop offset="0" stop-color="#FFF59D"/><stop offset=".6" stop-color="#FFCA28"/><stop offset="1" stop-color="#F9A825"/></radialGradient>`,
      );
    case 'chest':
      return wrap(
        `<ellipse cx="50" cy="92" rx="38" ry="5" fill="#000" opacity=".15"/>
        <rect x="12" y="44" width="76" height="44" rx="6" fill="#B5652B"/>
        <path d="M12 46 C12 20 88 20 88 46 Z" fill="#D4823F"/>
        <rect x="12" y="42" width="76" height="8" fill="#F2B233"/><rect x="44" y="20" width="12" height="68" fill="#F2B233"/>
        <rect x="42" y="44" width="16" height="16" rx="3" fill="#FFE082" stroke="#C88A00" stroke-width="2"/>
        <path d="M18 60 h20 M62 60 h20 M18 72 h20 M62 72 h20" stroke="#8E4C1C" stroke-width="2" opacity=".5"/>`,
      );
    case 'basket':
      return wrap(
        `<path d="M22 44 Q50 0 78 44" stroke="#A0662F" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M10 44 H90 L80 88 H20Z" fill="#D9934A"/>
        <path d="M14 54 H86 M17 66 H83 M20 78 H80" stroke="#A0662F" stroke-width="4"/>
        <path d="M30 44 L34 88 M50 44 V88 M70 44 L66 88" stroke="#B87838" stroke-width="3"/>
        <rect x="8" y="40" width="84" height="9" rx="4" fill="#B87838"/>`,
      );
  }
}

// ---------- UI icons (viewBox 0 0 24 24, currentColor) ----------

const ICONS: Record<string, string> = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"/>',
  restart: '<path d="M12 5a7 7 0 1 1-6.6 4.7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M3.5 4.5l1.8 5.6 5.4-2" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11.5L12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="currentColor"/>',
  map: '<path d="M3 6.5l5.5-2.5 7 3 5.5-2.5v13l-5.5 2.5-7-3L3 19.5z" fill="currentColor" opacity=".35"/><path d="M8.5 4v13M15.5 7v13M3 6.5l5.5-2.5 7 3 5.5-2.5v13l-5.5 2.5-7-3L3 19.5z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  shop: '<path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" fill="currentColor"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2.5l1.6 2.6 3-.6.6 3 2.6 1.6-1.3 2.9 1.3 2.9-2.6 1.6-.6 3-3-.6L12 21.5l-1.6-2.6-3 .6-.6-3-2.6-1.6 1.3-2.9-1.3-2.9 2.6-1.6.6-3 3 .6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  ad: '<rect x="2.5" y="5" width="19" height="14" rx="3.5" fill="currentColor"/><path d="M10 9v6l5-3z" fill="#fff"/>',
  hint: '<path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V17h6v-1.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z" fill="#FFD54F" stroke="#E6A100" stroke-width="1.4"/><rect x="9" y="18" width="6" height="3.2" rx="1.4" fill="#90A4AE"/><path d="M10 7.5a3 3 0 0 1 3-1.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  undo: '<path d="M9 7H15a5 5 0 0 1 0 10h-4" stroke="#42A5F5" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M9.5 3L5 7.2l4.5 4.2" stroke="#42A5F5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  wand: '<path d="M4 20L15 9" stroke="#7E57C2" stroke-width="3.2" stroke-linecap="round"/><path d="M15 9l1.6-1.6" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M17.5 2.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#FFD54F"/><circle cx="20" cy="11" r="1.2" fill="#FFD54F"/><circle cx="12" cy="4" r="1" fill="#FFD54F"/>',
  key: '<circle cx="8" cy="12" r="4.5" fill="none" stroke="#FFB300" stroke-width="3"/><path d="M12.5 12H21M18 12v3.5M21 12v2.5" stroke="#FFB300" stroke-width="3" stroke-linecap="round"/>',
  freeze: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="#4FC3F7" stroke-width="2.6" stroke-linecap="round"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" stroke="#4FC3F7" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  star: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.6" fill="none"/>',
  gift: '<rect x="3.5" y="9" width="17" height="5" rx="1.2" fill="#FF5DA2"/><rect x="5" y="13.5" width="14" height="7.5" rx="1.2" fill="#FF7FB5"/><rect x="10.8" y="9" width="2.4" height="12" fill="#FFD54F"/><path d="M12 9C10 5 6.5 5 7 7.5 7.4 9.2 12 9 12 9zM12 9c2-4 5.5-4 5-1.5-.4 1.7-5 1.5-5 1.5z" fill="#FFD54F"/>',
  music: '<path d="M9 17.5V6l10-2v11.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.8" fill="currentColor"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  vibro: '<rect x="8" y="3.5" width="8" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4.5 8v8M19.5 8v8M2 10.5v3M22 10.5v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" stroke="currentColor" stroke-width="2" fill="none"/>',
  trash: '<path d="M5 7h14l-1.2 13a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z" fill="currentColor"/><path d="M3.5 7h17M9 7V4.5h6V7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  moves: '<path d="M12 4a8 8 0 1 0 8 8" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  path: '<path d="M4 18c4 0 4-6 8-6s4-6 8-6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="4" cy="18" r="2.6" fill="currentColor"/><circle cx="20" cy="6" r="2.6" fill="currentColor"/>',
  free: '<path d="M7 17a7 7 0 1 1 10 0" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 15v6M9.5 19l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  skull: '<circle cx="12" cy="11" r="7" fill="currentColor"/><rect x="8.5" y="15" width="7" height="5" rx="1.5" fill="currentColor"/><circle cx="9.3" cy="11" r="1.8" fill="#fff"/><circle cx="14.7" cy="11" r="1.8" fill="#fff"/>',
  hat: '<path d="M4 18h16M6.5 18c0-7 2-12 5.5-12s5.5 5 5.5 12" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 1.8-1 1.4-2-.5-1.2.3-2.5 1.6-2.5H17a4 4 0 0 0 4-4C21 7 17 3 12 3z" fill="currentColor"/><circle cx="7.5" cy="11" r="1.5" fill="#fff"/><circle cx="10.5" cy="7" r="1.5" fill="#fff"/><circle cx="15" cy="7.5" r="1.5" fill="#fff"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3.5 17l5-5 4 4 3-3 5 5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/><circle cx="16" cy="9" r="1.8" fill="currentColor"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" fill="currentColor"/>',
  coins: '<circle cx="12" cy="12" r="9" fill="#FFCA28" stroke="#E39A0C" stroke-width="2"/><path d="M12 7.5l1.4 3 3.3.3-2.5 2.2.8 3.2-3-1.7-3 1.7.8-3.2-2.5-2.2 3.3-.3z" fill="#FFF3C4"/>',
};

export function icon(name: string, cls = 'ic'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

export function coinSvg(cls = 'coin-ic'): string {
  return prizeSvg('coin').replace('<svg ', `<svg class="${cls}" `);
}
