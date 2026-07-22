import { promises as fs, createReadStream } from "node:fs"
import { Readable } from "node:stream"
import path from "node:path"
import type { StorageObject, StorageProvider, StorageGetOptions } from "../provider"

// Local-filesystem StorageProvider — the pre-migration behaviour, refactored behind
// the interface. `baseDir` is the `uploads/` root; a key `resources/<id>/<file>`
// resolves to `uploads/resources/<id>/<file>`, byte-identical to the old layout.
//
// Keys are always relative. `resources_raw.storage_path` now holds a key, never an
// absolute path; any row predating the migration must be normalised by the backfill
// (see agentGuides/objectStorageMigration.md §6) — an absolute value will not resolve.
export class LocalFsStorage implements StorageProvider {
  private readonly baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  /** relative key → an absolute path guaranteed inside baseDir (guards `../` escapes). */
  private resolve(key: string): string {
    const full = path.join(this.baseDir, key)
    if (full !== this.baseDir && !full.startsWith(this.baseDir + path.sep)) {
      throw new Error(`storage: refusing a path outside ${this.baseDir}: ${full}`)
    }
    return full
  }

  async put(key: string, body: Buffer, _meta: { contentType: string }): Promise<void> {
    const full = this.resolve(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, body)
  }

  async get(key: string, opts?: StorageGetOptions): Promise<StorageObject | null> {
    const full = this.resolve(key)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      return null
    }
    if (!stat.isFile()) return null
    // Stream rather than read the whole file into a Buffer (the old serve path did
    // the latter — a memory footgun for large files this migration removes for free).
    // `start`/`end` are inclusive, which is exactly fs.createReadStream's contract,
    // so a Range request reads only the requested slice off disk.
    const range = opts?.range
    const readStream = range
      ? createReadStream(full, { start: range.start, end: range.end })
      : createReadStream(full)
    const stream = Readable.toWeb(readStream) as unknown as ReadableStream
    return { stream, size: stat.size }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key)
    await fs.unlink(full).catch(() => {})
    // Best-effort prune of the now-empty per-resource dir (matches the old cleanup,
    // which removed the resource's directory after unlinking its file).
    await fs.rmdir(path.dirname(full)).catch(() => {})
  }

  async list(prefix: string): Promise<{ key: string; size: number; mtime: Date }[]> {
    const out: { key: string; size: number; mtime: Date }[] = []
    const walk = async (dir: string): Promise<void> => {
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(abs)
          continue
        }
        const key = path.relative(this.baseDir, abs).split(path.sep).join("/")
        if (!key.startsWith(prefix)) continue
        const stat = await fs.stat(abs).catch(() => null)
        if (stat) out.push({ key, size: stat.size, mtime: stat.mtime })
      }
    }
    await walk(this.baseDir)
    return out
  }
}
