import { Readable } from "node:stream"
import { Storage } from "@google-cloud/storage"
import type { StorageObject, StorageProvider } from "../provider"

export interface GcsStorageConfig {
  bucket: string
  /** Usually supplied by ADC; only needed when it can't be inferred. */
  projectId?: string
  /** Path to a service-account key. Omit under ADC (the VM's attached service account). */
  keyFilename?: string
  /** Emulator endpoint (fake-gcs-server) for tests; omit against real GCS. */
  apiEndpoint?: string
}

// Google Cloud Storage StorageProvider. Under ADC — the intended production path, a
// GCE VM whose attached service account the SDK reads from the metadata server — no
// credentials are passed. Keys are used as object names verbatim (`resources/<id>/<file>`).
export class GcsStorage implements StorageProvider {
  private readonly storage: Storage
  private readonly bucketName: string

  constructor(config: GcsStorageConfig) {
    this.bucketName = config.bucket
    this.storage = new Storage({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
      apiEndpoint: config.apiEndpoint,
    })
  }

  private file(key: string) {
    return this.storage.bucket(this.bucketName).file(key)
  }

  async put(key: string, body: Buffer, meta: { contentType: string }): Promise<void> {
    // resumable: false — these bodies are already buffered in memory, so a single
    // upload request is cheaper than negotiating a resumable session.
    await this.file(key).save(body, {
      contentType: meta.contentType,
      resumable: false,
    })
  }

  async get(key: string): Promise<StorageObject | null> {
    const file = this.file(key)
    let size: number
    try {
      const [metadata] = await file.getMetadata()
      size = Number(metadata.size ?? 0)
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
    // Stream rather than buffer the whole object into memory; pipes into a Response.
    const stream = Readable.toWeb(file.createReadStream()) as unknown as ReadableStream
    return { stream, size }
  }

  async delete(key: string): Promise<void> {
    // ignoreNotFound makes delete idempotent, matching the provider contract.
    await this.file(key).delete({ ignoreNotFound: true })
  }

  async list(prefix: string): Promise<{ key: string; size: number; mtime: Date }[]> {
    // getFiles auto-paginates, returning every object under the prefix.
    const [files] = await this.storage.bucket(this.bucketName).getFiles({ prefix })
    return files.map((file) => ({
      key: file.name,
      size: Number(file.metadata.size ?? 0),
      mtime: file.metadata.updated ? new Date(file.metadata.updated) : new Date(0),
    }))
  }
}

/** True for GCS "object does not exist" responses. */
function isNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  return (err as { code?: number }).code === 404
}
