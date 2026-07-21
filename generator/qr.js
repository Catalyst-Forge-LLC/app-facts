/**
 * QR PNG helper for the Node generator.
 * Uses vendored qrcode-encoder (MIT) for the matrix; packs PNG with Node zlib
 * so output stays small (the IIFE's toPng uses uncompressed IDAT).
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const vm = require("vm");

let cached = null;

function loadEncoder() {
  if (cached) return cached;
  const src = fs.readFileSync(
    path.join(__dirname, "vendor", "qrcode-encoder.iife.js"),
    "utf8",
  );
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  const api = sandbox.QRCodeEncoder;
  if (!api?.encode) {
    throw new Error("Failed to load vendored qrcode-encoder");
  }
  cached = api;
  return api;
}

// Standard PNG CRC-32
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(pngCrc(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function modulesToPng(modules, scale = 8, margin = 2) {
  const n = modules.length;
  const size = (n + margin * 2) * scale;
  const rowSize = 1 + size;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const my = Math.floor(y / scale) - margin;
    const row = y * rowSize;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const dark = my >= 0 && my < n && mx >= 0 && mx < n && modules[my][mx];
      raw[row + 1 + x] = dark ? 0 : 255;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 0;  // greyscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeQrPng(text, outPath, opts = {}) {
  const api = loadEncoder();
  const modules = api.encode(String(text), { errorCorrection: "M" });
  const png = modulesToPng(modules, opts.moduleSize ?? 8, opts.quietZone ?? 2);
  fs.writeFileSync(outPath, png);
}

module.exports = { writeQrPng };
