/**
 * generate-fixtures.mjs
 *
 * Generates minimal PNG (and one JPEG) test fixtures for OCR testing.
 * Zero external dependencies -- builds raw image binary data using only
 * Node.js built-ins (zlib for deflate, fs, path, Buffer).
 *
 * Output directory: example/src/fixtures/
 *
 * Generated files:
 *   no-text.png        -- solid white 200x200
 *   hello-world.png    -- white 200x50 with a black horizontal bar (text-like)
 *   two-paragraphs.png -- white 200x120 with two separated black bars
 *   rotated-text.png   -- white 200x200 with a diagonal black stripe
 *   portrait-exif.jpg  -- minimal valid JFIF, solid gray 8x16
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "example", "src", "fixtures");

mkdirSync(FIXTURES_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// PNG helpers (builds a valid PNG from scratch)
// ---------------------------------------------------------------------------

function crc32(buf) {
  // Standard CRC-32 used by PNG
  let table = crc32._table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    crc32._table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  // type: 4-char string, data: Buffer
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Build a minimal PNG from raw RGBA pixel data.
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba  width*height*4 bytes (RGBA)
 */
function buildPng(width, height, rgba) {
  // Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT -- filter type 0 (None) for every row, then deflate
  const rowLen = width * 4;
  const raw = Buffer.alloc(height * (1 + rowLen));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowLen)] = 0; // filter byte
    rgba.copy(raw, y * (1 + rowLen) + 1, y * rowLen, (y + 1) * rowLen);
  }
  const compressed = deflateSync(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", iend),
  ]);
}

/** Create an RGBA buffer filled with a single color. */
function solidRgba(w, h, r, g, b, a = 255) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return buf;
}

/** Draw a filled rectangle onto an RGBA buffer. */
function drawRect(rgba, imgW, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && px < imgW && py >= 0) {
        const idx = (py * imgW + px) * 4;
        if (idx + 3 < rgba.length) {
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = a;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 1. no-text.png  --  solid white 200x200
// ---------------------------------------------------------------------------
{
  const w = 200,
    h = 200;
  const rgba = solidRgba(w, h, 255, 255, 255);
  const png = buildPng(w, h, rgba);
  const out = join(FIXTURES_DIR, "no-text.png");
  writeFileSync(out, png);
  console.log(`wrote ${out}  (${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// 2. hello-world.png  --  white 200x50 with a black bar (simulates one line)
// ---------------------------------------------------------------------------
{
  const w = 200,
    h = 50;
  const rgba = solidRgba(w, h, 255, 255, 255);
  // Black bar across the middle (text-like region)
  drawRect(rgba, w, 20, 18, 160, 14, 0, 0, 0);
  const png = buildPng(w, h, rgba);
  const out = join(FIXTURES_DIR, "hello-world.png");
  writeFileSync(out, png);
  console.log(`wrote ${out}  (${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// 3. two-paragraphs.png  --  white 200x120 with two black bars
// ---------------------------------------------------------------------------
{
  const w = 200,
    h = 120;
  const rgba = solidRgba(w, h, 255, 255, 255);
  // First paragraph block
  drawRect(rgba, w, 15, 10, 170, 12, 0, 0, 0);
  drawRect(rgba, w, 15, 26, 140, 12, 0, 0, 0);
  // Gap (paragraph separator)
  // Second paragraph block
  drawRect(rgba, w, 15, 60, 170, 12, 0, 0, 0);
  drawRect(rgba, w, 15, 76, 120, 12, 0, 0, 0);
  drawRect(rgba, w, 15, 92, 155, 12, 0, 0, 0);
  const png = buildPng(w, h, rgba);
  const out = join(FIXTURES_DIR, "two-paragraphs.png");
  writeFileSync(out, png);
  console.log(`wrote ${out}  (${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// 4. rotated-text.png  --  white 200x200 with a diagonal dark stripe
// ---------------------------------------------------------------------------
{
  const w = 200,
    h = 200;
  const rgba = solidRgba(w, h, 255, 255, 255);
  // Diagonal stripe from top-left to bottom-right
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - y);
      if (d < 8) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 255;
      }
    }
  }
  const png = buildPng(w, h, rgba);
  const out = join(FIXTURES_DIR, "rotated-text.png");
  writeFileSync(out, png);
  console.log(`wrote ${out}  (${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// 5. portrait-exif.jpg  --  minimal valid JFIF, solid gray 8x16
//    Builds a bare-bones baseline JPEG by hand (SOI, APP0, DQT, SOF0,
//    DHT, SOS, scan data, EOI).  The image is a uniform gray 8x16 so the
//    DCT coefficients are trivial: DC = mid-gray, all ACs = 0.
// ---------------------------------------------------------------------------
{
  const w = 8;
  const h = 16;

  // helpers
  const u8 = (...bytes) => Buffer.from(bytes);
  const u16be = (v) => Buffer.from([(v >> 8) & 0xff, v & 0xff]);

  // SOI
  const soi = u8(0xff, 0xd8);

  // APP0 (JFIF marker)
  const app0Payload = Buffer.concat([
    Buffer.from("JFIF\0", "ascii"),
    u8(1, 1), // version
    u8(0), // units = no units
    u16be(1),
    u16be(1), // density
    u8(0, 0), // no thumbnail
  ]);
  const app0 = Buffer.concat([u8(0xff, 0xe0), u16be(app0Payload.length + 2), app0Payload]);

  // DQT -- single all-ones quantization table (id 0)
  const dqtPayload = Buffer.alloc(65);
  dqtPayload[0] = 0; // precision=0 (8-bit), table id=0
  for (let i = 1; i <= 64; i++) dqtPayload[i] = 1;
  const dqt = Buffer.concat([u8(0xff, 0xdb), u16be(dqtPayload.length + 2), dqtPayload]);

  // SOF0 -- baseline, 1 component (grayscale)
  const sof0Payload = Buffer.concat([
    u8(8), // precision
    u16be(h),
    u16be(w),
    u8(1), // number of components
    u8(1, 0x11, 0), // component id=1, sampling 1x1, quant table 0
  ]);
  const sof0 = Buffer.concat([u8(0xff, 0xc0), u16be(sof0Payload.length + 2), sof0Payload]);

  // DHT -- minimal Huffman tables (DC table 0 and AC table 0)
  // DC table: only code for category 0 (value 0 means DC diff = 0)
  //   bits: category-length counts [1,0,0,...] -> one 1-bit code
  //   values: [0]
  const dcBits = Buffer.alloc(16);
  dcBits[0] = 1; // one code of length 1
  const dcVals = u8(0);
  const dcTable = Buffer.concat([u8(0x00), dcBits, dcVals]); // class=0 id=0

  // AC table: only the EOB symbol (0x00) meaning "all remaining ACs are 0"
  const acBits = Buffer.alloc(16);
  acBits[0] = 1;
  const acVals = u8(0x00); // EOB
  const acTable = Buffer.concat([u8(0x10), acBits, acVals]); // class=1 id=0

  const dhtPayload = Buffer.concat([dcTable, acTable]);
  const dht = Buffer.concat([u8(0xff, 0xc4), u16be(dhtPayload.length + 2), dhtPayload]);

  // SOS
  const sosPayload = Buffer.concat([
    u8(1), // number of components
    u8(1, 0x00), // component 1, DC table 0 / AC table 0
    u8(0, 63, 0), // spectral selection 0..63, successive approx 0
  ]);
  const sos = Buffer.concat([u8(0xff, 0xda), u16be(sosPayload.length + 2), sosPayload]);

  // Scan data for 2 MCUs (each 8x8 block):
  // DC diff = 0 -> category 0 -> 1-bit code "0"
  // AC: EOB      -> 1-bit code "0"
  // So each MCU is 2 bits: "00".  Two MCUs = 4 bits "0000" = 0x00 padded to byte.
  // Byte-align and pad remaining bits with 1s: 0b00_00_1111 = 0x0F
  const scanData = u8(0x0f);

  // EOI
  const eoi = u8(0xff, 0xd9);

  const jpeg = Buffer.concat([soi, app0, dqt, sof0, dht, sos, scanData, eoi]);
  const out = join(FIXTURES_DIR, "portrait-exif.jpg");
  writeFileSync(out, jpeg);
  console.log(`wrote ${out}  (${jpeg.length} bytes)`);
}

console.log("\nDone. All fixtures written to", FIXTURES_DIR);
