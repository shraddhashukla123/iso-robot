import axios, { AxiosError } from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api/v1'

/** Origin without /api/v1 — for static file URLs (document preview). */
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
  headers: { Accept: 'application/json' },
})

export function documentFileUrl(docId: string, opts: { download?: boolean } = {}): string {
  const base = `${API_ORIGIN}/api/v1/documents/${encodeURIComponent(docId)}/file`
  return opts.download ? `${base}?download=1` : base
}

export type ApiErr = { detail: string; code?: string }

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErr>
    const d = ax.response?.data
    if (d && typeof d.detail === 'string') return d.detail
    return ax.message
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}
