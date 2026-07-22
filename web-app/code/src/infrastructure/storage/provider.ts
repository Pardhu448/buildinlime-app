// Storage provider seam — the ONLY place resource bytes enter or leave the server.
//
// Closes ARCHITECTURE.md §12.1 ("file storage is the local filesystem") by putting
// every fs.* call behind an interface. `handleFileUpload` / `serveResourceFile`
// (fileStorage.ts) and the purge job talk to a StorageProvider; swapping the driver
// (local disk → Google Cloud Storage) becomes a config change, not a code change.
//
// Keys, not paths. A storage KEY is a forward-slash string like
// `resources/<resourceId>/<safeFilename>`. The local driver resolves it under an
// `uploads/` base dir (so `resources/…` lands in `uploads/resources/…`, byte-identical
// to the pre-migration layout); the GCS driver uses it as an object name verbatim.
//
// See agentGuides/objectStorageMigration.md. Step 1 shipped the interface + the local
// driver; the GCS driver is step 2.

export interface StorageObject {
  /** Web ReadableStream of the object's bytes, for piping into a Response. */
  stream: ReadableStream
  /**
   * Full byte length of the object as reported by the store — the whole file,
   * NOT the length of a ranged slice (callers may prefer the DB's own count).
   */
  size: number
}

/** Inclusive byte range `[start, end]` — the same convention as the HTTP Range header. */
export interface ByteRange {
  start: number
  end: number
}

export interface StorageGetOptions {
  /**
   * When set, the returned stream carries only bytes `[start, end]` (inclusive)
   * rather than the whole object — drives HTTP Range / 206 responses so video and
   * audio can seek without downloading the entire file. `size` is still the full
   * object length regardless.
   */
  range?: ByteRange
}

export interface StorageProvider {
  /** Write `body` at `key`. Idempotent — overwriting the same key is fine. */
  put: (key: string, body: Buffer, meta: { contentType: string }) => Promise<void>
  /** Stream the object back (optionally a byte range), or `null` if the key does not exist. */
  get: (key: string, opts?: StorageGetOptions) => Promise<StorageObject | null>
  /** Best-effort delete. A missing key is success, never an error. */
  delete: (key: string) => Promise<void>
  /**
   * Keys under a prefix, for the orphan sweep. Keys are returned relative to the
   * store root (i.e. in the same space `put`/`get` accept), not as absolute paths.
   */
  list: (prefix: string) => Promise<{ key: string; size: number; mtime: Date }[]>
}
