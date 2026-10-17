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
