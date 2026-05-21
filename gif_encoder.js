// Robust animated GIF89a encoder — pure JS, no workers, no CORS
// Fixed LZW implementation with correct bit tracking and safe byte writing
(function(global) {
'use strict';

// ── ByteArray helper ─────────────────────────────────────────────────────────
function ByteArray() {
  this.data = [];
}
ByteArray.prototype.writeByte = function(b) { this.data.push(b & 0xff); };
ByteArray.prototype.writeBytes = function(arr) { for (let i = 0; i < arr.length; i++) this.data.push(arr[i] & 0xff); };
ByteArray.prototype.writeStr = function(s) { for (let i = 0; i < s.length; i++) this.data.push(s.charCodeAt(i) & 0xff); };
ByteArray.prototype.writeShort = function(v) { this.data.push(v & 0xff); this.data.push((v >> 8) & 0xff); };

// ── LZW encoder (correct implementation) ────────────────────────────────────
function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoi       = clearCode + 1;
  const out       = new ByteArray();

  let bitBuf  = 0;
  let bitLen  = 0;
  const outBits = [];

  function emitBits(val, n) {
    bitBuf |= val << bitLen;
    bitLen += n;
    while (bitLen >= 8) {
      outBits.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitLen  -= 8;
    }
  }

  let codeSize = minCodeSize + 1;
  let nextCode = eoi + 1;
  let maxCode  = 1 << codeSize;

  // Initialize string table
  let table = new Map();

  function reset() {
    table    = new Map();
    codeSize = minCodeSize + 1;
    nextCode = eoi + 1;
    maxCode  = 1 << codeSize;
  }

  emitBits(clearCode, codeSize);

  let str = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const c   = pixels[i];
    const key = (str << 8) | c;
    if (table.has(key)) {
      str = table.get(key);
    } else {
      emitBits(str, codeSize);
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode <<= 1;
        }
      } else {
        emitBits(clearCode, codeSize);
        reset();
      }
      str = c;
    }
  }
  emitBits(str, codeSize);
  emitBits(eoi, codeSize);
  if (bitLen > 0) outBits.push(bitBuf & 0xff);

  // Write as GIF sub-blocks (max 255 bytes each)
  for (let i = 0; i < outBits.length; ) {
    const len = Math.min(255, outBits.length - i);
    out.writeByte(len);
    for (let j = 0; j < len; j++) out.writeByte(outBits[i++]);
  }
  out.writeByte(0); // block terminator
  return out.data;
}

// ── Palette quantiser ────────────────────────────────────────────────────────
function buildPalette(frames, maxColors) {
  // Collect all unique 5-bit-per-channel colours across all frames
  const seen = new Map();
  for (const { rgba } of frames) {
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i] >> 3, g = rgba[i+1] >> 3, b = rgba[i+2] >> 3;
      const key = (r << 10) | (g << 5) | b;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
  const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors);
  const palette = sorted.map(([k]) => [((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3]);
  while (palette.length < maxColors) palette.push([0, 0, 0]);
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

// ── Public API ───────────────────────────────────────────────────────────────
function GifEncoder(w, h) {
  this.w = w;
  this.h = h;
  this.frames = []; // { rgba: Uint8ClampedArray, delay: number (1/100s) }
}

GifEncoder.prototype.addFrame = function(imageData, delayMs) {
  // Copy pixel data so it isn't mutated later
  const copy = new Uint8ClampedArray(imageData.data);
  this.frames.push({ rgba: copy, delay: Math.max(2, Math.round(delayMs / 10)) });
};

GifEncoder.prototype.getBlob = function() {
  const w = this.w, h = this.h;
  const PAL_SIZE_EXP = 7; // 2^(7+1) = 256 colours
  const MAX_COLORS   = 256;

  const palette = buildPalette(this.frames, MAX_COLORS);

  // Pre-build a nearest-colour cache
  const cache = new Map();
  function lookup(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (cache.has(key)) return cache.get(key);
    const idx = nearestIdx(r, g, b, palette);
    cache.set(key, idx);
    return idx;
  }

  const out = new ByteArray();

  // GIF header
  out.writeStr('GIF89a');
  out.writeShort(w);
  out.writeShort(h);
  out.writeByte(0x80 | PAL_SIZE_EXP); // global CT flag + size
  out.writeByte(0);  // background colour index
  out.writeByte(0);  // pixel aspect ratio
  for (const [r, g, b] of palette) { out.writeByte(r); out.writeByte(g); out.writeByte(b); }

  // Netscape loop extension (infinite)
  out.writeByte(0x21); out.writeByte(0xff); out.writeByte(0x0b);
  out.writeStr('NETSCAPE2.0');
  out.writeByte(3); out.writeByte(1);
  out.writeShort(0); // loop count 0 = infinite
  out.writeByte(0);  // block terminator

  for (const frame of this.frames) {
    const rgba = frame.rgba;

    // Graphic Control Extension
    out.writeByte(0x21); out.writeByte(0xf9); out.writeByte(0x04);
    out.writeByte(0x00); // disposal: do not dispose
    out.writeShort(frame.delay);
    out.writeByte(0); out.writeByte(0); // transparent colour index + terminator

    // Image descriptor
    out.writeByte(0x2c);
    out.writeShort(0); out.writeShort(0); // left, top
    out.writeShort(w); out.writeShort(h);
    out.writeByte(0x00); // no local CT, not interlaced

    // Map pixels to palette indices
    const indices = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      indices[i] = lookup(rgba[i*4], rgba[i*4+1], rgba[i*4+2]);
    }

    // LZW compress + write
    const minCode = Math.max(2, PAL_SIZE_EXP + 1);
    out.writeByte(minCode);
    const compressed = lzwEncode(indices, minCode);
    out.writeBytes(compressed);
  }

  out.writeByte(0x3b); // GIF trailer
  return new Blob([new Uint8Array(out.data)], { type: 'image/gif' });
};

global.GifEncoder = GifEncoder;
})(window);
