// Shared helpers used across Electric collection files.

// Retry handler for Electric shape fetch errors.
// Returning (not throwing) causes Electric to retry the shape fetch.
// - 401: session not ready yet → retry after 2s
// - other errors: retry after 5s
export const retryOnError = async (error: Error) => {
  const delay = error.message.includes(`401`) ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

// Electric returns boolean columns as the string "true"/"false".
export const coerceBool = (v: unknown) => v === "true" || v === true

export const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`
