// Generates the PNG icons from public/favicon.svg:  npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const BG = '#f5a623';
const svg = readFileSync('public/favicon.svg');

// maskable: full-bleed background, artwork scaled into the safe zone (~64%)
const inner = readFileSync('public/favicon.svg', 'utf8').match(/<g[\s\S]*<\/g>/)[0];
const maskable = Buffer.from(
  `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="${BG}"/>` +
    `<g transform="translate(92 92) scale(.64)">${inner}</g></svg>`,
);

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192x192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512x512.png');
await sharp(maskable).resize(512, 512).png().toFile('public/pwa-maskable-512x512.png');
// apple-touch-icon: iOS wants a square image with a solid background (no transparency)
await sharp(svg).resize(180, 180).flatten({ background: BG }).png().toFile('public/apple-touch-icon.png');
console.log('icons written to public/');
