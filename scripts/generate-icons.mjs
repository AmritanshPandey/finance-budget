/**
 * Draws the app icon straight to PNG — no image toolchain, no binary assets
 * checked in that nobody can regenerate.
 *
 * Full-bleed lime with the glyph inside the maskable safe zone, so one design
 * serves `any` and `maskable` on Android and the square iOS wants.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// Resolved from the --primary / --primary-foreground tokens in globals.css.
const LIME = [174, 240, 58]
const INK = [17, 21, 10]
const SUPERSAMPLE = 3

/** Signed-distance style test for a rounded rectangle. */
function insideRoundedRect(x, y, left, top, w, h, r) {
  const cx = Math.min(Math.max(x, left + r), left + w - r)
  const cy = Math.min(Math.max(y, top + r), top + h - r)
  if (x >= left + r && x <= left + w - r) return y >= top && y <= top + h
  if (y >= top + r && y <= top + h - r) return x >= left && x <= left + w
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/**
 * Three ascending bars: the plan getting bigger. Kept inside the central 60%
 * so a circular Android mask never clips it.
 */
function glyphAt(x, y, size) {
  const barW = size * 0.13
  const gap = size * 0.075
  const groupW = barW * 3 + gap * 2
  const left = (size - groupW) / 2
  const bottom = size * 0.71
  const heights = [0.18, 0.29, 0.42].map((h) => h * size)

  for (let i = 0; i < 3; i++) {
    const bx = left + i * (barW + gap)
    const bh = heights[i]
    if (insideRoundedRect(x, y, bx, bottom - bh, barW, bh, barW / 2)) return true
  }
  return false
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const step = 1 / SUPERSAMPLE

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = px + (sx + 0.5) * step
          const y = py + (sy + 0.5) * step
          if (glyphAt(x, y, size)) hits++
        }
      }
      const a = hits / (SUPERSAMPLE * SUPERSAMPLE)
      const offset = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(LIME[c] * (1 - a) + INK[c] * a)
      }
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function toPng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 means none.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const from = y * size * 4
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, from, from + size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const png = toPng(size, render(size))
  writeFileSync(`public/icons/${name}`, png)
  console.log(`public/icons/${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)}kB`)
}
