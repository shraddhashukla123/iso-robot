import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, apiErrorMessage, documentFileUrl } from '../api/client'

type Doc = {
  id: string
  filename: string
  path: string
  sha256: string
  mime_type: string | null
  size_bytes: number
  status: string
  created_at: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

export function DocumentsPage({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<Doc | null>(null)

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [preview])

  const q = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get<Doc[]>('/documents')
      return data
    },
  })
  const scan = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/documents/scan', {})
      return data as { scanned: number; added: number; updated: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const previewUrl = preview ? documentFileUrl(preview.id) : ''
  const downloadUrl = preview ? documentFileUrl(preview.id, { download: true }) : ''
  const isPdf = preview ? (preview.mime_type === 'application/pdf' || preview.filename.toLowerCase().endsWith('.pdf')) : false
  const isHtml = preview
    ? preview.mime_type?.startsWith('text/html') ||
      preview.filename.toLowerCase().endsWith('.html') ||
      preview.filename.toLowerCase().endsWith('.htm')
    : false

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-slate-600">
          PDF and HTML files registered from disk. Click the file name to preview; use the Download icon for the original file.
        </p>
        <button
          type="button"
          onClick={() => scan.mutate()}
          disabled={scan.isPending}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {scan.isPending ? 'Scanning…' : 'Scan / refresh'}
        </button>
      </div>
      <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(q.data ?? []).map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setPreview(d)}
                    className="text-left font-medium text-[var(--color-accent)] hover:underline"
                    title="Preview"
                  >
                    {d.filename}
                  </button>
                  <p className="mt-0.5 max-w-md truncate font-mono text-xs text-slate-400" title={d.path}>
                    {d.id}
                  </p>
                </td>
                <td className="px-4 py-2 text-slate-600">{d.mime_type ?? '—'}</td>
                <td className="px-4 py-2">{d.status}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">{formatSize(d.size_bytes)}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview(d)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Preview
                    </button>
                    <a
                      href={documentFileUrl(d.id, { download: true })}
                      download={d.filename}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(null)
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--color-border)] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">{preview.filename}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {preview.mime_type ?? '—'} · {formatSize(preview.size_bytes)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open in new tab
                </a>
                <a
                  href={downloadUrl}
                  download={preview.filename}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download
                </a>
                <button
                  type="button"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                  onClick={() => setPreview(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-[60vh] flex-1 bg-slate-100">
              {isPdf || isHtml ? (
                <iframe
                  title={preview.filename}
                  src={previewUrl}
                  className="h-[75vh] w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-slate-600">
                    Inline preview is not supported for {preview.mime_type ?? 'this file type'}.
                  </p>
                  <a
                    href={downloadUrl}
                    download={preview.filename}
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Download instead
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
