const fs = require('fs');
const path = require('path');

const size = 256;
const pixels = Buffer.alloc(size * size * 4);

function roundedRectangle(x, y, width, height, radius, red, green, blue) {
  const right = x + width;
  const bottom = y + height;
  for (let row = Math.max(0, Math.floor(y)); row < Math.min(size, Math.ceil(bottom)); row += 1) {
    for (let column = Math.max(0, Math.floor(x)); column < Math.min(size, Math.ceil(right)); column += 1) {
      const closestX = Math.max(x + radius, Math.min(column + 0.5, right - radius));
      const closestY = Math.max(y + radius, Math.min(row + 0.5, bottom - radius));
      if ((column + 0.5 - closestX) ** 2 + (row + 0.5 - closestY) ** 2 > radius ** 2) continue;
      // ICO bitmaps are stored bottom-up in BGRA order.
      const offset = ((size - 1 - row) * size + column) * 4;
      pixels[offset] = blue;
      pixels[offset + 1] = green;
      pixels[offset + 2] = red;
      pixels[offset + 3] = 255;
    }
  }
}

// Scaled directly from logo.svg's 200 × 200 geometry and colors.
roundedRectangle(0, 0, 256, 256, 55.04, 28, 41, 66);
roundedRectangle(27.72, 57.04, 82.61, 141.92, 8.96, 152, 245, 193);
roundedRectangle(145.67, 57.04, 82.61, 141.92, 8.96, 43, 103, 212);

const infoHeader = Buffer.alloc(40);
infoHeader.writeUInt32LE(40, 0);
infoHeader.writeInt32LE(size, 4);
infoHeader.writeInt32LE(size * 2, 8); // XOR and AND bitmap heights.
infoHeader.writeUInt16LE(1, 12);
infoHeader.writeUInt16LE(32, 14);
infoHeader.writeUInt32LE(pixels.length, 20);

const andMask = Buffer.alloc((size / 8) * size);
const iconHeader = Buffer.alloc(22);
iconHeader.writeUInt16LE(1, 2);
iconHeader.writeUInt16LE(1, 4);
iconHeader.writeUInt16LE(1, 10);
iconHeader.writeUInt16LE(32, 12);
iconHeader.writeUInt32LE(infoHeader.length + pixels.length + andMask.length, 14);
iconHeader.writeUInt32LE(22, 18);

const outputPath = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.concat([iconHeader, infoHeader, pixels, andMask]));
