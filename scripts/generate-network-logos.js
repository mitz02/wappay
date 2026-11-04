/**
 * Generates network logo PNGs for WhatsApp image headers.
 * Run: node scripts/generate-network-logos.js
 * Output: src/modules/whatsapp/assets/networks/*.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const OUT_DIR = path.join(__dirname, '..', 'src', 'modules', 'whatsapp', 'assets', 'networks');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function createCanvas(width, height, bg = [0, 0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  return { width, height, data };
}

function setPixel(canvas, x, y, [r, g, b, a = 255]) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  // alpha blend
  const dstA = canvas.data[i + 3] / 255;
  const srcA = a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  canvas.data[i] = Math.round((r * srcA + canvas.data[i] * dstA * (1 - srcA)) / outA);
  canvas.data[i + 1] = Math.round((g * srcA + canvas.data[i + 1] * dstA * (1 - srcA)) / outA);
  canvas.data[i + 2] = Math.round((b * srcA + canvas.data[i + 2] * dstA * (1 - srcA)) / outA);
  canvas.data[i + 3] = Math.round(outA * 255);
}

function fillRect(canvas, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(canvas, x, y, color);
}

function fillCircle(canvas, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(canvas, x, y, color);
    }
  }
}

function fillEllipse(canvas, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(canvas, x, y, color);
    }
  }
}

function strokeEllipse(canvas, cx, cy, rx, ry, thickness, color) {
  const outer = rx * rx;
  const irx = rx - thickness;
  const iry = ry - thickness;
  const inner = irx * irx;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dOuter = (dx * dx) / outer + (dy * dy) / (ry * ry);
      const dInner = (dx * dx) / (irx * irx) + (dy * dy) / (iry * iry);
      if (dOuter <= 1 && dInner >= 1) setPixel(canvas, x, y, color);
    }
  }
}

function fillRoundRect(canvas, x0, y0, w, h, r, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx0 = Math.max(x0 + r - x, x - (x0 + w - 1 - r), 0);
      const dy0 = Math.max(y0 + r - y, y - (y0 + h - 1 - r), 0);
      if (dx0 * dx0 + dy0 * dy0 <= r * r) setPixel(canvas, x, y, color);
    }
  }
}

// Tiny 5x7 bitmap font for labels
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
};

function drawText(canvas, text, x, y, scale, color) {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(canvas, cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx;
}

function textWidth(text, scale) {
  return text.length * 6 * scale;
}

// ── Brand colors ──────────────────────────────────────
const MTN_YELLOW = [255, 204, 0, 255];
const MTN_BLACK = [0, 0, 0, 255];
const AIRTEL_RED = [255, 26, 26, 255];
const AIRTEL_DARK = [217, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const GLO_GREEN = [0, 168, 89, 255];
const GLO_DARK = [0, 104, 55, 255];
const NINE_GREEN = [0, 87, 63, 255];
const NINE_DARK = [0, 56, 40, 255];
const NINE_LIME = [160, 207, 103, 255];
const DARK_BG = [18, 24, 39, 255];
const CARD_BG = [30, 41, 59, 255];

function drawMtnLogo(size) {
  const c = createCanvas(size, size, [0, 0, 0, 0]);
  const cx = size / 2;
  const cy = size / 2;
  // yellow rounded square bg
  fillRoundRect(c, Math.round(size * 0.08), Math.round(size * 0.18), Math.round(size * 0.84), Math.round(size * 0.64), Math.round(size * 0.12), MTN_YELLOW);
  // black ellipse ring
  strokeEllipse(c, cx, cy, size * 0.34, size * 0.2, size * 0.04, MTN_BLACK);
  // MTN text
  const scale = Math.max(2, Math.round(size / 28));
  const tw = textWidth('MTN', scale);
  drawText(c, 'MTN', Math.round(cx - tw / 2), Math.round(cy - (7 * scale) / 2), scale, MTN_BLACK);
  return c;
}

function drawAirtelLogo(size) {
  const c = createCanvas(size, size, [0, 0, 0, 0]);
  const cx = size / 2;
  const cy = size / 2;
  // red circle
  fillCircle(c, cx, cy, size * 0.42, AIRTEL_RED);
  // darker bottom arc suggestion
  fillCircle(c, cx, cy + size * 0.08, size * 0.42, AIRTEL_DARK);
  // white swoosh (approximate with overlapping circles cut by red)
  fillCircle(c, cx - size * 0.05, cy - size * 0.02, size * 0.22, WHITE);
  fillCircle(c, cx + size * 0.1, cy + size * 0.05, size * 0.18, AIRTEL_RED);
  fillCircle(c, cx + size * 0.12, cy - size * 0.1, size * 0.14, WHITE);
  return c;
}

function drawGloLogo(size) {
  const c = createCanvas(size, size, [0, 0, 0, 0]);
  const cx = size / 2;
  const cy = size / 2;
  fillCircle(c, cx, cy, size * 0.42, GLO_GREEN);
  fillCircle(c, cx, cy + size * 0.06, size * 0.42, GLO_DARK);
  // white "glo" text
  const scale = Math.max(2, Math.round(size / 24));
  const tw = textWidth('glo', scale);
  drawText(c, 'glo', Math.round(cx - tw / 2), Math.round(cy - (7 * scale) / 2), scale, WHITE);
  return c;
}

function draw9MobileLogo(size) {
  const c = createCanvas(size, size, [0, 0, 0, 0]);
  const cx = size / 2;
  const cy = size / 2;
  fillCircle(c, cx, cy, size * 0.42, NINE_GREEN);
  fillCircle(c, cx, cy + size * 0.05, size * 0.42, NINE_DARK);
  // lime accent dot
  fillCircle(c, cx + size * 0.18, cy - size * 0.18, size * 0.1, NINE_LIME);
  // white "9"
  const scale = Math.max(3, Math.round(size / 22));
  const tw = textWidth('9', scale);
  drawText(c, '9', Math.round(cx - tw / 2), Math.round(cy - (7 * scale) / 2), scale, WHITE);
  return c;
}

function compositeBanner() {
  // 800x500 banner with 4 network logos for WhatsApp interactive image header
  const W = 800;
  const H = 500;
  const c = createCanvas(W, H, DARK_BG);

  // subtle gradient bands
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = Math.round(18 + t * 20);
    const g = Math.round(24 + t * 15);
    const b = Math.round(39 + t * 25);
    fillRect(c, 0, y, W, 1, [r, g, b, 255]);
  }

  // title
  const titleScale = 4;
  const title = 'SELECT DATA NETWORK';
  const tw = textWidth(title, titleScale);
  drawText(c, title, Math.round((W - tw) / 2), 48, titleScale, WHITE);

  // subtitle
  const subScale = 2;
  const sub = 'Choose your provider';
  const sw = textWidth(sub, subScale);
  drawText(c, sub, Math.round((W - sw) / 2), 96, subScale, [180, 190, 210, 255]);

  // 4 logo tiles
  const logos = [
    { draw: drawMtnLogo, label: 'MTN' },
    { draw: drawAirtelLogo, label: 'AIRTEL' },
    { draw: drawGloLogo, label: 'GLO' },
    { draw: draw9MobileLogo, label: '9MOBILE' },
  ];

  const tile = 140;
  const gap = 40;
  const totalW = logos.length * tile + (logos.length - 1) * gap;
  const startX = Math.round((W - totalW) / 2);
  const tileY = 160;

  logos.forEach((logo, i) => {
    const x = startX + i * (tile + gap);
    // card bg
    fillRoundRect(c, x - 12, tileY - 12, tile + 24, tile + 48, 16, CARD_BG);
    // logo
    const img = logo.draw(tile);
    // blit centered
    const ox = x;
    const oy = tileY;
    for (let y = 0; y < tile; y++) {
      for (let x2 = 0; x2 < tile; x2++) {
        const si = (y * tile + x2) * 4;
        const a = img.data[si + 3];
        if (a > 0) {
          setPixel(c, ox + x2, oy + y, [img.data[si], img.data[si + 1], img.data[si + 2], a]);
        }
      }
    }
    // label
    const ls = 2;
    const lw = textWidth(logo.label, ls);
    drawText(c, logo.label, Math.round(x + (tile - lw) / 2), tileY + tile + 12, ls, WHITE);
  });

  // footer hint
  const fs2 = 2;
  const footer = 'TAP A BUTTON BELOW';
  const fw = textWidth(footer, fs2);
  drawText(c, footer, Math.round((W - fw) / 2), H - 60, fs2, [255, 196, 107, 255]);

  return c;
}

function blit(src, dst, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      if (src.data[si + 3] > 0) {
        setPixel(dst, dx + x, dy + y, [src.data[si], src.data[si + 1], src.data[si + 2], src.data[si + 3]]);
      }
    }
  }
}

function networkBanner(network) {
  const W = 800;
  const H = 500;
  const c = createCanvas(W, H, DARK_BG);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    fillRect(c, 0, y, W, 1, [Math.round(18 + t * 15), Math.round(24 + t * 12), Math.round(39 + t * 20), 255]);
  }

  const meta = {
    MTN: { draw: drawMtnLogo, label: 'MTN DATA', color: MTN_YELLOW },
    AIRTEL: { draw: drawAirtelLogo, label: 'AIRTEL DATA', color: AIRTEL_RED },
    GLO: { draw: drawGloLogo, label: 'GLO DATA', color: GLO_GREEN },
    '9MOBILE': { draw: draw9MobileLogo, label: '9MOBILE DATA', color: NINE_LIME },
  }[network];

  const scale = 4;
  const tw = textWidth(meta.label, scale);
  drawText(c, meta.label, Math.round((W - tw) / 2), 56, scale, meta.color);

  const subScale = 2;
  const sub = 'Choose a data plan';
  const sw = textWidth(sub, subScale);
  drawText(c, sub, Math.round((W - sw) / 2), 112, subScale, [180, 190, 210, 255]);

  const logo = meta.draw(220);
  blit(logo, c, Math.round((W - 220) / 2), 170);

  return c;
}

function writePng(name, canvas) {
  const png = encodePNG(canvas.width, canvas.height, canvas.data);
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, png);
  console.log(`Wrote ${file} (${png.length} bytes)`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  writePng('data-network-banner.png', compositeBanner());
  writePng('mtn.png', drawMtnLogo(256));
  writePng('airtel.png', drawAirtelLogo(256));
  writePng('glo.png', drawGloLogo(256));
  writePng('9mobile.png', draw9MobileLogo(256));
  writePng('data-mtn.png', networkBanner('MTN'));
  writePng('data-airtel.png', networkBanner('AIRTEL'));
  writePng('data-glo.png', networkBanner('GLO'));
  writePng('data-9mobile.png', networkBanner('9MOBILE'));
}

main();
