import { writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { execSync } from "child_process";
import { join } from "path";

const SIZE = 256;
const ICON_DIR = join(import.meta.dirname, "..", "src-tauri", "icons");

// 16x16 pixel art grid (upscaled to SIZE)
const GRID = 16;
const CELL = SIZE / GRID;

// Color palette
const TRANSPARENT = [0, 0, 0, 0];
const BG_DARK = [10, 12, 19, 255];
const WALL_WHITE = [232, 234, 240, 255];
const WALL_SHADE = [180, 186, 210, 255];
const ROOF_PINK = [255, 47, 160, 255];
const ROOF_DARK = [200, 30, 130, 255];
const DOOR = [36, 40, 56, 255];
const WINDOW_GLOW = [182, 255, 63, 255];
const GROUND = [18, 26, 38, 255];
const GROUND_LIGHT = [39, 51, 73, 255];

// 16x16 pixel art of a voxel house (0=transparent)
const PAL = [
  TRANSPARENT,    // 0
  BG_DARK,        // 1
  WALL_WHITE,     // 2
  WALL_SHADE,     // 3
  ROOF_PINK,      // 4
  ROOF_DARK,      // 5
  DOOR,           // 6
  WINDOW_GLOW,    // 7
  GROUND,         // 8
  GROUND_LIGHT,   // 9
];

// prettier-ignore
const ART = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0],
  [0,0,0,0,0,4,4,4,4,5,5,0,0,0,0,0],
  [0,0,0,0,4,4,4,4,4,5,5,5,0,0,0,0],
  [0,0,0,4,4,4,4,4,4,5,5,5,5,0,0,0],
  [0,0,0,2,2,2,2,2,3,3,3,3,3,0,0,0],
  [0,0,0,2,7,2,7,2,3,7,3,7,3,0,0,0],
  [0,0,0,2,7,2,7,2,3,7,3,7,3,0,0,0],
  [0,0,0,2,2,2,2,2,3,3,3,3,3,0,0,0],
  [0,0,0,2,2,6,6,2,3,3,3,3,3,0,0,0],
  [0,0,0,2,2,6,6,2,3,3,3,3,3,0,0,0],
  [0,0,9,8,8,8,8,8,8,8,8,8,8,9,0,0],
  [0,9,8,8,8,8,8,8,8,8,8,8,8,8,9,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA data (width * height * 4)
  // Build raw image data with filter byte per row
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * 4 + 1) + 1 + x * 4;
      raw[di] = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  const compressed = deflateSync(raw);

  const chunks = [];

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(makeChunk("IHDR", ihdr));

  // IDAT
  chunks.push(makeChunk("IDAT", compressed));

  // IEND
  chunks.push(makeChunk("IEND", Buffer.alloc(0)));

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ...chunks]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function renderIcon(size) {
  const cell = size / GRID;
  const pixels = new Uint8Array(size * size * 4);

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const color = PAL[ART[gy][gx]];
      const x0 = Math.round(gx * cell);
      const y0 = Math.round(gy * cell);
      const x1 = Math.round((gx + 1) * cell);
      const y1 = Math.round((gy + 1) * cell);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4;
          pixels[i] = color[0];
          pixels[i + 1] = color[1];
          pixels[i + 2] = color[2];
          pixels[i + 3] = color[3];
        }
      }
    }
  }

  return createPNG(size, size, pixels);
}

// Generate master icon at 1024px
const master = renderIcon(1024);
const masterPath = join(ICON_DIR, "icon.png");
writeFileSync(masterPath, master);
console.log("Generated icon.png (1024x1024)");

// Generate specific sizes with sips
const sizes = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
  ["StoreLogo.png", 50],
];

for (const [name, size] of sizes) {
  const png = renderIcon(size >= 64 ? size : 64);
  const tmpPath = join(ICON_DIR, `_tmp_${name}`);
  const outPath = join(ICON_DIR, name);
  writeFileSync(tmpPath, png);
  if (size < 64) {
    execSync(`sips -z ${size} ${size} "${tmpPath}" --out "${outPath}" 2>/dev/null`);
    execSync(`rm "${tmpPath}"`);
  } else {
    execSync(`mv "${tmpPath}" "${outPath}"`);
  }
  console.log(`Generated ${name} (${size}x${size})`);
}

// Generate .ico (multi-size)
// Use sips to create icns from the 1024px master
execSync(`sips -s format icns "${masterPath}" --out "${join(ICON_DIR, "icon.icns")}" 2>/dev/null`);
console.log("Generated icon.icns");

// For .ico, create from 256px png using sips + manual ICO header
const ico256 = renderIcon(256);
const ico48 = renderIcon(48);
const ico32 = renderIcon(32);
const ico16 = renderIcon(16);

function createICO(pngs) {
  // ICO format: header + entries + PNG data
  const count = pngs.length;
  const headerSize = 6 + count * 16;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(count * 16);
  let offset = headerSize;

  for (let i = 0; i < count; i++) {
    const png = pngs[i];
    const size = png.size;
    entries[i * 16] = size >= 256 ? 0 : size; // width (0 = 256)
    entries[i * 16 + 1] = size >= 256 ? 0 : size; // height
    entries[i * 16 + 2] = 0; // color palette
    entries[i * 16 + 3] = 0; // reserved
    entries.writeUInt16LE(1, i * 16 + 4); // color planes
    entries.writeUInt16LE(32, i * 16 + 6); // bits per pixel
    entries.writeUInt32LE(png.data.length, i * 16 + 8); // data size
    entries.writeUInt32LE(offset, i * 16 + 12); // data offset
    offset += png.data.length;
  }

  return Buffer.concat([header, entries, ...pngs.map((p) => p.data)]);
}

const ico = createICO([
  { size: 256, data: ico256 },
  { size: 48, data: ico48 },
  { size: 32, data: ico32 },
  { size: 16, data: ico16 },
]);
writeFileSync(join(ICON_DIR, "icon.ico"), ico);
console.log("Generated icon.ico");

console.log("\nDone! All icons generated.");
