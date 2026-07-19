import path from "node:path"
import { GcsStorage } from "./drivers/gcs"
import { LocalFsStorage } from "./drivers/local"
import type { StorageProvider } from "./provider"

export type { StorageObject, StorageProvider } from "./provider"

// Singleton, resolved from env on first use (mirrors connection.ts). Deliberately
// lazy — never constructed at module load — so the `/` prerender at build time does
// not instantiate a driver, and STORAGE_DRIVER can go unset in CI's build job.
let cached: StorageProvider | undefined

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`storage: ${name} is required when STORAGE_DRIVER=gcs`)
  return value
}

export function getStorage(): StorageProvider {
  if (cached) return cached
  const driver = process.env.STORAGE_DRIVER ?? "local"
  switch (driver) {
    case "local": {
      // Base dir is `uploads/` under cwd by default; keys `resources/…` land in
      // `uploads/resources/…`, byte-identical to the pre-migration layout.
      // LOCAL_STORAGE_DIR overrides it — for a deploy with a mounted disk elsewhere,
      // and for tests that need an isolated base.
      const baseDir = process.env.LOCAL_STORAGE_DIR
        ? path.resolve(process.env.LOCAL_STORAGE_DIR)
        : path.resolve(process.cwd(), "uploads")
      cached = new LocalFsStorage(baseDir)
      return cached
    }
    case "gcs":
      // Credentials come from ADC (the GCE VM's attached service account in prod);
      // only the bucket is mandatory. GCS_KEY_FILENAME / STORAGE_EMULATOR_HOST are
      // opt-in for local dev and the fake-gcs-server test emulator respectively.
      cached = new GcsStorage({
        bucket: requireEnv("GCS_BUCKET"),
        projectId: process.env.GCS_PROJECT_ID,
        keyFilename: process.env.GCS_KEY_FILENAME,
        apiEndpoint: process.env.STORAGE_EMULATOR_HOST,
      })
      return cached
    default:
      throw new Error(`storage: unknown STORAGE_DRIVER=${driver} (expected 'local' or 'gcs')`)
  }
}
