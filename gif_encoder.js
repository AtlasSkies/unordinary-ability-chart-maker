// Minimal animated GIF encoder — no workers, no CORS, pure JS
// Based on the LZW GIF spec. Encodes 8-bit palette GIF frames.
// Usage: new GifEncoder(width, height) → addFrame(imageData, delay) → getBlob()

(function(global) {
'use strict';

// ── LZW compressor ──────────────────────────────────────────────────────────
function lzwEncode(pixels, colorDepth) {
  const minCode = Math.max(2, colorDepth);
  const clearCode = 1 << minCode;
  const eoi = clearCode + 1;
  let next = eoi + 1;
  let bits = minCode + 1;

  const out = [];
  function writeBits(val, n) {
    buf = (buf | (val << bufBits)) >>> 0;
    bufBits += n;
    while (bufBits >= 8) { out.push(buf & 0xff); buf >>>= 8; bufBits -= 8; }
  }
  let buf = 0, bufBits = 0;

  let table = new Map();
  const resetTable = () => { table = new Map(); next = eoi + 1; bits = minCode + 1; };
  resetTable();

  writeBits(clearCode, bits);
  let str = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const c = pixels[i];
    const key = str + ',' + c;
    if (table.has(key)) {
      str = table.get(key);
    } else {
      writeBits(str, bits);
      if (next > (1 << bits)) bits++;
      if (next < 4096) { table.set(key, next++); } else { writeBits(clearCode, bits); resetTable(); }
      str = c;
    }
  }
  writeBits(str, bits);
  writeBits(eoi, bits);
  if (bufBits > 0) out.push(buf & 0xff);
  return out;
}

// ── Median-cut palette quantiser (256 colours) ─────────────────────────────
function quantize(rgba, maxColors) {
  // Build a simple 5-bit per channel histogram palette
  const seen = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] >> 3, g = rgba[i+1] >> 3, b = rgba[i+2] >> 3;
    const key = (r << 10) | (g << 5) | b;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  // Sort by frequency, take top maxColors
  const sorted = [...seen.entries()].sort((a,b) => b[1]-a[1]).slice(0, maxColors);
  const palette = sorted.map(([k]) => [
    ((k >> 10) & 31) << 3,
    ((k >>  5) & 31) << 3,
    ( k        & 31) << 3
  ]);
  if (palette.length < maxColors) {
    while (palette.length < maxColors) palette.push([0,0,0]);
  }
  return palette;
}

function nearestIdx(r, g, b, palette) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
    const d = dr*dr + dg*dg + db*db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ── GIF byte builder ────────────────────────────────────────────────────────
function writeBytes(arr) { return new Uint8Array(arr); }

function block(data) {
  const chunks = [];
  for (let i = 0; i < data.length; i += 255) {
    const slice = data.slice(i, i+255);
    chunks.push(slice.length, ...slice);
  }
  chunks.push(0);
  return chunks;
}

function GifEncoder(w, h) {
  this.w = w; this.h = h;
  this.frames = [];
}

GifEncoder.prototype.addFrame = function(imageData, delayMs) {
  this.frames.push({ imageData, delay: Math.round(delayMs / 10) }); // GIF delay in 1/100s
};

GifEncoder.prototype.getBlob = function() {
  const w = this.w, h = this.h;
  const bytes = [];
  const push = (...args) => bytes.push(...args);
  const pushStr = s => { for (let i=0;i<s.length;i++) bytes.push(s.charCodeAt(i)); };

  // --- Build a global palette from the first frame ---
  const firstRgba = this.frames[0].imageData.data;
  const palette = quantize(firstRgba, 256);
  const palSize = 7; // 2^(7+1)=256 colours

  // Header
  pushStr('GIF89a');
  push(w & 0xff, w >> 8, h & 0xff, h >> 8);
  push(0x80 | palSize, 0x00, 0x00); // global CT flag, bg idx, aspect
  for (const [r,g,b] of palette) push(r,g,b);

  // Application Extension (loop)
  push(0x21, 0xff, 0x0b);
  pushStr('NETSCAPE2.0');
  push(0x03, 0x01, 0x00, 0x00, 0x00); // loop count 0 = infinite

  for (const frame of this.frames) {
    const rgba = frame.imageData.data;
    // Map pixels to palette indices
    const indices = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      indices[i] = nearestIdx(rgba[i*4], rgba[i*4+1], rgba[i*4+2], palette);
    }

    // Graphic Control Extension (delay)
    push(0x21, 0xf9, 0x04, 0x00);
    push(frame.delay & 0xff, frame.delay >> 8);
    push(0x00, 0x00);

    // Image descriptor
    push(0x2c);
    push(0,0, 0,0, w & 0xff, w >> 8, h & 0xff, h >> 8, 0x00);

    // LZW compressed data
    const minCode = Math.max(2, palSize + 1);
    push(minCode);
    const compressed = lzwEncode(indices, minCode);
    push(...block(compressed));
  }

  push(0x3b); // trailer
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
};

global.GifEncoder = GifEncoder;
})(window);
