// PWA ikonlarını SVG-dən PNG-yə çevirir: `npm run icons`
// Nəticə public/icons/ altında commit olunur — build zamanı sharp lazım deyil.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve(import.meta.dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

const GREEN = '#16a34a';
const RED = '#dc2626';

/** Cüzdan simvolu. `pad` — maskable üçün təhlükəsiz zona (0.1 = 10 % hər tərəfdən). */
function wallet({ rounded, pad = 0 }) {
  const s = 512;
  const inner = s * (1 - 2 * pad);
  const off = s * pad;
  const k = inner / 512; // content scale
  const g = (v) => off + v * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="${GREEN}"/>
  <rect x="${g(96)}" y="${g(128)}" width="${256 * k}" height="${72 * k}" rx="${24 * k}" fill="#bbf7d0"/>
  <rect x="${g(96)}" y="${g(168)}" width="${320 * k}" height="${216 * k}" rx="${40 * k}" fill="#ffffff"/>
  <rect x="${g(296)}" y="${g(236)}" width="${120 * k}" height="${80 * k}" rx="${24 * k}" fill="${GREEN}"/>
  <circle cx="${g(344)}" cy="${g(276)}" r="${18 * k}" fill="#ffffff"/>
</svg>`;
}

/** Qısayol ikonu: rəngli dairə + işarə */
function shortcut(color, sign) {
  const bar = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="${color}"/>
  ${bar(24, 42, 48, 12)}
  ${sign === '+' ? bar(42, 24, 12, 48) : ''}
</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(OUT, file));
  console.log('✓', file);
}

writeFileSync(resolve(OUT, 'favicon.svg'), wallet({ rounded: true }));
console.log('✓ favicon.svg');

await png(wallet({ rounded: true }), 192, 'icon-192.png');
await png(wallet({ rounded: true }), 512, 'icon-512.png');
await png(wallet({ rounded: false, pad: 0.1 }), 512, 'icon-maskable-512.png');
await png(wallet({ rounded: false }), 180, 'apple-touch-icon.png');
await png(shortcut(RED, '-'), 96, 'shortcut-expense.png');
await png(shortcut(GREEN, '+'), 96, 'shortcut-income.png');
