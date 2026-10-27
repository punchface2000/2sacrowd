// Inline SVG illustrations. Fixed colors on purpose: they look the same in light and dark.

export const HONEY_JAR = `
<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="50" cy="113" rx="34" ry="5" fill="rgba(0,0,0,.2)"/>
  <path d="M25 40 Q17 48 17 64 L17 96 Q17 108 30 108 L70 108 Q83 108 83 96 L83 64 Q83 48 75 40 Z" fill="#f5a623"/>
  <path d="M17 78 L17 96 Q17 108 30 108 L70 108 Q83 108 83 96 L83 78 Q50 70 17 78 Z" fill="#e08a12"/>
  <rect x="23" y="20" width="54" height="20" rx="7" fill="#b9722b"/>
  <rect x="23" y="20" width="54" height="7" rx="3.5" fill="#d28a42"/>
  <path d="M31 40 q-3 16 5 16 q8 0 5 -16 z" fill="#ffd36b"/>
  <path d="M60 40 q-2 10 3 10 q5 0 3 -10 z" fill="#ffd36b"/>
  <rect x="30" y="62" width="40" height="30" rx="8" fill="#fff4d6"/>
  <path d="M50 67 l7 4 v8 l-7 4 l-7 -4 v-8 z" fill="#f5a623"/>
  <path d="M24 52 Q22 70 24 90" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;

export const BEE = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><clipPath id="beebody"><ellipse cx="58" cy="58" rx="30" ry="23"/></clipPath></defs>
  <g class="bee-wings">
    <ellipse cx="52" cy="30" rx="13" ry="21" transform="rotate(-18 52 30)" fill="#d6ecff" fill-opacity=".9" stroke="#8fb9e0" stroke-width="2"/>
    <ellipse cx="70" cy="32" rx="12" ry="19" transform="rotate(16 70 32)" fill="#d6ecff" fill-opacity=".85" stroke="#8fb9e0" stroke-width="2"/>
  </g>
  <path d="M86 58 l11 3 l-11 5 z" fill="#2b2118"/>
  <ellipse cx="58" cy="58" rx="30" ry="23" fill="#ffd23f"/>
  <g clip-path="url(#beebody)" fill="#2b2118">
    <rect x="50" y="30" width="9" height="60"/>
    <rect x="68" y="30" width="9" height="60"/>
  </g>
  <ellipse cx="58" cy="58" rx="30" ry="23" fill="none" stroke="#2b2118" stroke-width="3"/>
  <circle cx="30" cy="54" r="17" fill="#ffd23f" stroke="#2b2118" stroke-width="3"/>
  <path d="M22 40 q-6 -10 -12 -10 M30 38 q0 -11 -3 -15" stroke="#2b2118" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <circle cx="24" cy="52" r="6" fill="#fff" stroke="#2b2118" stroke-width="1.5"/>
  <circle cx="36" cy="52" r="6" fill="#fff" stroke="#2b2118" stroke-width="1.5"/>
  <circle cx="25.5" cy="53.5" r="2.6" fill="#2b2118"/>
  <circle cx="34.5" cy="53.5" r="2.6" fill="#2b2118"/>
  <path d="M17 42 L28 48 M43 42 L32 48" stroke="#2b2118" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M23 63 q7 -6 14 0" stroke="#2b2118" stroke-width="2.6" stroke-linecap="round" fill="none"/>
</svg>`;

/** Bear arm with a paw at the top. The arm is as long as `h` px, the hand is a fixed size. */
let pawId = 0;
export function pawSvg(w: number, h: number): string {
  const id = `paw${++pawId}`;
  const cx = w / 2;
  const armW = w * 0.46;
  const handR = w * 0.4;
  const handY = handR + 8;
  const toe = w * 0.085;
  const pad = '#efc4a4';
  const dark = '#5e3a24';
  const L = cx - armW / 2;
  // fur tufts along the wrist where the arm meets the hand
  const tuftY = handY + handR * 0.82;
  const tufts = [-0.62, -0.2, 0.22, 0.62]
    .map((k) => `<path d="M${cx + k * handR - 7} ${tuftY} q7 12 14 0" fill="url(#${id}g)"/>`)
    .join('');
  // claws peek out above each toe
  const claw = (x: number, y: number) =>
    `<path d="M${x - 3} ${y - toe * 0.7} q3 -9 6 0 z" fill="#f6efe6" stroke="${dark}" stroke-width="1"/>`;
  const toes: [number, number, number][] = [
    [-0.56, -0.42, 1],
    [-0.2, -0.68, 1.08],
    [0.2, -0.68, 1.08],
    [0.56, -0.42, 1],
  ];
  return `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#a06c48"/><stop offset=".45" stop-color="#8a5a3b"/><stop offset="1" stop-color="#6b4229"/>
    </linearGradient>
  </defs>
  <rect x="${L}" y="${handY}" width="${armW}" height="${h - handY}" rx="${armW / 2}" fill="url(#${id}g)" stroke="${dark}" stroke-width="2"/>
  ${tufts}
  ${toes.map(([dx, dy]) => claw(cx + dx * handR, handY + dy * handR - toe * 0.5)).join('')}
  <circle cx="${cx}" cy="${handY}" r="${handR}" fill="url(#${id}g)" stroke="${dark}" stroke-width="2"/>
  <path d="M${cx - handR * 0.55} ${handY + handR * 0.25} q${handR * 0.55} ${-handR * 0.62} ${handR * 1.1} 0 q${-handR * 0.05} ${handR * 0.48} ${-handR * 0.55} ${handR * 0.5} q${-handR * 0.5} 0 ${-handR * 0.55} ${-handR * 0.5} z" fill="${pad}"/>
  ${toes
    .map(
      ([dx, dy, k]) =>
        `<ellipse cx="${cx + dx * handR}" cy="${handY + dy * handR}" rx="${toe * k}" ry="${toe * k * 1.15}" fill="${pad}"/>`,
    )
    .join('')}
  <ellipse cx="${cx - handR * 0.35}" cy="${handY - handR * 0.1}" rx="${handR * 0.12}" ry="${handR * 0.07}" fill="#fff" fill-opacity=".25"/>
</svg>`;
}

/** Small crown for the winner screen. */
export const CROWN = `
<svg viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 44 L10 12 L26 28 L40 6 L54 28 L70 12 L74 44 Z" fill="#ffc83d" stroke="#b07a10" stroke-width="3" stroke-linejoin="round"/>
  <rect x="6" y="40" width="68" height="8" rx="3" fill="#f5a623" stroke="#b07a10" stroke-width="3"/>
  <circle cx="40" cy="30" r="5" fill="#ef5b5b"/><circle cx="22" cy="34" r="3.5" fill="#4c8dff"/><circle cx="58" cy="34" r="3.5" fill="#3ecf8e"/>
</svg>`;

/** Paw print icon, uses currentColor. */
export const PAW_PRINT = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="currentColor">
    <ellipse cx="32" cy="43" rx="16" ry="13"/>
    <ellipse cx="13" cy="28" rx="6.5" ry="8" transform="rotate(-18 13 28)"/>
    <ellipse cx="25" cy="17" rx="6.5" ry="8.5" transform="rotate(-6 25 17)"/>
    <ellipse cx="39" cy="17" rx="6.5" ry="8.5" transform="rotate(6 39 17)"/>
    <ellipse cx="51" cy="28" rx="6.5" ry="8" transform="rotate(18 51 28)"/>
  </g>
</svg>`;

export const SWEAT = `
<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 2 C12 2 3 14 3 21 a9 9 0 0 0 18 0 C21 14 12 2 12 2 z" fill="#6fc3ff"/>
  <path d="M8 20 a4 4 0 0 0 4 5" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;

/** Bear face for the title and the winner screen. */
export const BEAR = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="22" cy="24" r="14" fill="#8a5a3b"/><circle cx="22" cy="24" r="7" fill="#e0b79a"/>
  <circle cx="78" cy="24" r="14" fill="#8a5a3b"/><circle cx="78" cy="24" r="7" fill="#e0b79a"/>
  <circle cx="50" cy="54" r="38" fill="#8a5a3b"/>
  <ellipse cx="50" cy="65" rx="17" ry="13" fill="#e0b79a"/>
  <ellipse cx="50" cy="58" rx="6.5" ry="4.5" fill="#2b2118"/>
  <path d="M50 62 v6 M50 68 q-5 5 -9 2 M50 68 q5 5 9 2" stroke="#2b2118" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <circle cx="36" cy="46" r="4.2" fill="#2b2118"/><circle cx="64" cy="46" r="4.2" fill="#2b2118"/>
  <circle cx="37.2" cy="44.8" r="1.4" fill="#fff"/><circle cx="65.2" cy="44.8" r="1.4" fill="#fff"/>
</svg>`;
