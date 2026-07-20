import { describe } from "vitest"
import { GcsStorage } from "%/infrastructure/storage/drivers/gcs"
import { runStorageConformance } from "./storage-conformance"

// The GCS driver runs the SAME conformance suite as the local driver, against a
// fake-gcs-server emulator. Skipped unless STORAGE_EMULATOR_HOST + GCS_BUCKET are set,
// so local `pnpm test` and CI stay offline by default (bring up the emulator to run
// this leg — see agentGuides/objectStorageMigration.md §8).
const emulator = process.env.STORAGE_EMULATOR_HOST
const bucket = process.env.GCS_BUCKET

const describeOrSkip = emulator && bucket ? describe : describe.skip

describeOrSkip("GcsStorage (emulator)", () => {
  const storage = new GcsStorage({
    bucket: bucket ?? "test-bucket",
    projectId: process.env.GCS_PROJECT_ID ?? "test-project",
    apiEndpoint: emulator,
  })
  runStorageConformance("gcs", () => storage)
})
