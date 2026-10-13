import { Texture } from 'pixi.js';
import { PRIZES } from '../config';
import { prizeSvg } from './art';

const cache = new Map<string, Texture>();

async function rasterize(svg: string, size: number): Promise<Texture> {
  const img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  return Texture.from(canvas);
}

function particleSvg(kind: string): string {
  switch (kind) {
    case 'spark':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="32" fill="url(#g)"/></svg>`;
    case 'star':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 2 L38 26 L62 32 L38 38 L32 62 L26 38 L2 32 L26 26Z" fill="#fff"/></svg>`;
    case 'leaf':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M8 56 C8 24 28 8 58 6 C56 36 40 56 8 56Z" fill="#fff"/><path d="M10 54 L46 18" stroke="#000" stroke-opacity=".2" stroke-width="3"/></svg>`;
    case 'flake':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M32 4v56M8 18l48 28M8 46l48-28"/><path d="M24 10l8 8 8-8M24 54l8-8 8 8" fill="none"/></g></svg>`;
    case 'bubble':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" fill="#fff" fill-opacity=".15" stroke="#fff" stroke-width="3"/><ellipse cx="22" cy="20" rx="8" ry="5" fill="#fff" fill-opacity=".8" transform="rotate(-35 22 20)"/></svg>`;
    case 'heart':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 56 C10 40 4 28 8 18 C12 8 26 6 32 18 C38 6 52 8 56 18 C60 28 54 40 32 56Z" fill="#fff"/></svg>`;
    case 'confetti':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="4" width="32" height="56" rx="6" fill="#fff"/></svg>`;
    case 'petal':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="32" rx="16" ry="28" fill="#fff"/></svg>`;
    case 'clamp':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="#8E99A4"/><stop offset=".35" stop-color="#F4F7FA"/><stop offset=".6" stop-color="#C5CED6"/><stop offset="1" stop-color="#7B8792"/></linearGradient></defs>
        <rect x="14" y="4" width="36" height="56" rx="8" fill="url(#m)" stroke="#5F6B76" stroke-width="3"/>
        <rect x="8" y="22" width="48" height="20" rx="6" fill="url(#m)" stroke="#5F6B76" stroke-width="3"/>
        <circle cx="32" cy="32" r="5" fill="#5F6B76"/><path d="M29 32h6" stroke="#C5CED6" stroke-width="2"/></svg>`;
    case 'pin':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="p" cx="35%" cy="30%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9D1D9"/><stop offset="1" stop-color="#7B8792"/></radialGradient></defs>
        <circle cx="32" cy="32" r="26" fill="url(#p)" stroke="#5F6B76" stroke-width="4"/><path d="M20 32h24M32 20v24" stroke="#5F6B76" stroke-width="5" stroke-linecap="round"/></svg>`;
    case 'hand':
      return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M36 50 V18 a7 7 0 0 1 14 0 V44 l4 -2 a7 7 0 0 1 9 4 l2 -1 a7 7 0 0 1 9 4 l1 0 a7 7 0 0 1 9 5 V70 C84 84 74 94 60 94 H52 C44 94 38 90 34 84 L20 64 a7 7 0 0 1 10 -9 Z" fill="#fff" stroke="#3D3D3D" stroke-width="4" stroke-linejoin="round"/>
        <path d="M54 48 V58 M66 50 V60 M76 54 V62" stroke="#BDBDBD" stroke-width="3" stroke-linecap="round"/>
        <rect x="44" y="84" width="34" height="12" rx="4" fill="#FFCA28" stroke="#3D3D3D" stroke-width="4"/></svg>`;
    default:
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#fff"/></svg>`;
  }
}

export async function loadTextures(): Promise<void> {
  const jobs: Promise<void>[] = [];
  const add = (key: string, svg: string, size: number) =>
    jobs.push(rasterize(svg, size).then((t) => void cache.set(key, t)));
  for (const p of PRIZES) add(p, prizeSvg(p), 160);
  add('bomb', prizeSvg('bomb'), 160);
  add('coin', prizeSvg('coin'), 96);
  for (const k of ['spark', 'star', 'leaf', 'flake', 'bubble', 'heart', 'confetti', 'petal', 'clamp', 'pin', 'circle'])
    add(k, particleSvg(k), k === 'clamp' || k === 'pin' ? 96 : 64);
  add('hand', particleSvg('hand'), 160);
  await Promise.all(jobs);
}

export function tex(key: string): Texture {
  return cache.get(key) ?? Texture.WHITE;
}
