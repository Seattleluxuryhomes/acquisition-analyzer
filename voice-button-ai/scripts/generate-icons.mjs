/**
 * Generate the app / extension PNG icons with zero dependencies.
 *
 * Renders a rounded-rect indigo gradient tile with a white microphone glyph
 * into an RGBA buffer, then hand-encodes a PNG (zlib is built into Node).
 * Run:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const SIZES = [16, 48, 128, 192, 512];

/* ----------------------------- tiny renderer ---------------------------- */

function lerp(a, b, t) {
  return a + (b - a) * t;
}
// gradient endpoints (indigo-400 -> indigo-700)
const C0 = [129, 140, 248];
const C1 = [67, 56, 202];
const WHITE = [255, 255, 255];

function render(N) {
  const buf = new Uint8Array(N * N * 4); // RGBA, transparent by default
  const s = N / 128; // design grid is 128px

  // geometry on the 128 grid
  const radius = 28 * s;
  const cx = 64 * s;

  // microphone body capsule
  const bodyTop = 30 * s;
  const bodyBottom = 72 * s;
  const bodyHalfW = 12 * s;
  // cradle annulus
  const cradleCx = 64 * s;
  const cradleCy = 60 * s;
  const cradleR = 26 * s;
  const cradleThick = 7 * s;
  // stem + base
  const stemX = 64 * s;
  const stemTop = 72 * s;
  const stemBottom = 100 * s;
  const stemHalfW = 3.5 * s;
  const baseY = 102 * s;
  const baseHalfW = 16 * s;
  const baseHalfH = 3.5 * s;

  const put = (x, y, [r, g, b], a = 255) => {
    const i = (y * N + x) * 4;
    // simple source-over onto existing
    const ia = a / 255;
    buf[i] = Math.round(lerp(buf[i], r, ia));
    buf[i + 1] = Math.round(lerp(buf[i + 1], g, ia));
    buf[i + 2] = Math.round(lerp(buf[i + 2], b, ia));
    buf[i + 3] = Math.max(buf[i + 3], a);
  };

  const inRoundedRect = (x, y, x0, y0, x1, y1, rad) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.max(x0 + rad - x, 0, x - (x1 - rad));
    const dy = Math.max(y0 + rad - y, 0, y - (y1 - rad));
    return dx * dx + dy * dy <= rad * rad;
  };

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 1) rounded background tile with diagonal gradient
      if (!inRoundedRect(x, y, 0, 0, N - 1, N - 1, radius)) continue;
      const t = (x / N + y / N) / 2;
      put(x, y, [lerp(C0[0], C1[0], t), lerp(C0[1], C1[1], t), lerp(C0[2], C1[2], t)]);

      // 2) white mic glyph (with light anti-aliasing via coverage)
      let white = false;

      // capsule body
      if (
        x >= cx - bodyHalfW &&
        x <= cx + bodyHalfW &&
        y >= bodyTop &&
        y <= bodyBottom
      ) {
        const dxTop = Math.hypot(x - cx, y - (bodyTop + bodyHalfW));
        const dxBot = Math.hypot(x - cx, y - (bodyBottom - bodyHalfW));
        if (
          (y >= bodyTop + bodyHalfW && y <= bodyBottom - bodyHalfW) ||
          dxTop <= bodyHalfW ||
          dxBot <= bodyHalfW
        ) {
          white = true;
        }
      }

      // cradle (lower half of an annulus)
      if (!white && y >= cradleCy) {
        const d = Math.hypot(x - cradleCx, y - cradleCy);
        if (d <= cradleR && d >= cradleR - cradleThick) white = true;
      }

      // stem
      if (!white && x >= stemX - stemHalfW && x <= stemX + stemHalfW && y >= stemTop && y <= stemBottom) {
        white = true;
      }

      // base bar (rounded)
      if (!white && inRoundedRect(x, y, cx - baseHalfW, baseY - baseHalfH, cx + baseHalfW, baseY + baseHalfH, baseHalfH)) {
        white = true;
      }

      if (white) put(x, y, WHITE);
    }
  }

  return buf;
}

/* ------------------------------ PNG encoder ----------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, N) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0

  const stride = N * 4;
  const raw = Buffer.alloc((stride + 1) * N);
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- run --------------------------------- */

for (const N of SIZES) {
  const rgba = render(N);
  const png = encodePng(rgba, N);
  writeFileSync(join(OUT, `icon${N}.png`), png);
  console.log(`  icons/icon${N}.png  (${png.length} bytes)`);
}
console.log('Done.');
