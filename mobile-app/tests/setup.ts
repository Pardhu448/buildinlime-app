// Global shims for the node test environment.

// React Native defines __DEV__; upload-manager reads it in a debug log branch.
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

// React Native's FormData is lenient — it accepts a { uri, name, type } part.
// Node's built-in (undici) FormData throws on anything that isn't a string or
// Blob, which would blow up upload-manager's doUpload before it ever reaches the
// (mocked) fetch. Swap in a permissive stub that just records parts.
class LenientFormData {
  parts: Array<[string, unknown]> = []
  append(name: string, value: unknown): void {
    this.parts.push([name, value])
  }
}
;(globalThis as { FormData: unknown }).FormData = LenientFormData
