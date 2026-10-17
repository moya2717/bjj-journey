// A small reader for .zip files, so a whole exported folder (like myBJJ's "Media") can be
// imported in one go. On iPhone: Files app → long-press the folder → Compress → pick the .zip.
// Handles standard zips (stored or deflated), which is what iPhone, Mac and Windows create.

const u16 = (v, o) => v.getUint16(o, true)
const u32 = (v, o) => v.getUint32(o, true)

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// DOS timestamps from the zip directory: when each file was last modified.
const dosDate = (date, time) => new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63)

// ---------- Writing ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Builds a .zip from [{ name, blob }]. Files are stored as-is (photos are already compressed),
// and each file is read once for its checksum, so even a large photo library never sits in
// memory as one big string.
export async function makeZip(files) {
  const parts = [], directory = []
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  let offset = 0
  for (const { name, blob } of files) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(new Uint8Array(await blob.arrayBuffer())), size = blob.size
    const local = new DataView(new ArrayBuffer(30))
    ;[[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, nameBytes.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => n === 4 ? local.setUint32(o, v, true) : local.setUint16(o, v, true))
    parts.push(local, nameBytes, blob)
    const central = new DataView(new ArrayBuffer(46))
    ;[[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, nameBytes.length, 2], [42, offset, 4]]
      .forEach(([o, v, n]) => n === 4 ? central.setUint32(o, v, true) : central.setUint16(o, v, true))
    directory.push(central, nameBytes)
    offset += 30 + nameBytes.length + size
  }
  const dirSize = directory.reduce((n, p) => n + p.byteLength, 0)
  const end = new DataView(new ArrayBuffer(22))
  ;[[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, dirSize, 4], [16, offset, 4]]
    .forEach(([o, v, n]) => n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true))
  return new Blob([...parts, ...directory, end], { type: 'application/zip' })
}

export const isZip = file => /\.zip$/i.test(file.name) || file.type === 'application/zip'

// Returns [{ path, name, folder, modified, blob() }] for every file in the archive.
export async function readZip(file) {
  const buffer = await file.arrayBuffer(), view = new DataView(buffer)
  let end = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (u32(view, i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error('Not a zip file')
  const count = u16(view, end + 10)
  let p = u32(view, end + 16)
  const entries = []
  for (let n = 0; n < count && u32(view, p) === 0x02014b50; n++) {
    const method = u16(view, p + 10), time = u16(view, p + 12), date = u16(view, p + 14)
    const size = u32(view, p + 20), nameLength = u16(view, p + 28), extraLength = u16(view, p + 30), commentLength = u16(view, p + 32)
    const local = u32(view, p + 42)
    const path = new TextDecoder().decode(new Uint8Array(buffer, p + 46, nameLength))
    p += 46 + nameLength + extraLength + commentLength
    if (path.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store)/.test(path)) continue
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28)
    const parts = path.split('/')
    entries.push({
      path, name: parts.at(-1), folders: parts.slice(0, -1), modified: dosDate(date, time),
      blob: async () => {
        const raw = new Uint8Array(buffer, start, size)
        return new Blob([method === 8 ? await inflate(raw) : raw])
      },
    })
  }
  return entries
}
