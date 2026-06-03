import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useJobTracker } from '../hooks/useJobTracker'

type Control = {
  id: string
  document_id: string
  control_text: string | null
  section_ref: string | null
  framework: string | null
  source_page: number | null
  created_at: string
}

type Doc = { id: string; filename: string; path: string }

type Job = { id: string; status: string; type: string }

export function ControlsPage({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient()
  const [docFilter, setDocFilter] = useState('')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const dq = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get<Doc[]>('/documents')
      return data
    },
  })

  const q = useQuery({
    queryKey: ['controls', docFilter],
    queryFn: async () => {
      const params = docFilter ? { document_id: docFilter } : {}
      const { data } = await api.get<Control[]>('/controls', { params })
      return data
    },
    // While extraction runs, backend commits each chunk — poll so rows appear incrementally.
    refetchInterval: activeJobId ? (docFilter ? 1500 : 2500) : false,
  })

  const onJobDone = useCallback(
    (status: 'completed' | 'failed', err: string | null) => {
      void qc.invalidateQueries({ queryKey: ['controls'] })
      void qc.refetchQueries({ queryKey: ['controls'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setActiveJobId(null)
      if (status === 'failed' && err) {
        onError(`Control extraction job failed: ${err}`)
      }
    },
    [qc, onError],
  )

  useJobTracker(activeJobId, onJobDone)

  const extract = useMutation({
    mutationFn: async (document_ids?: string[]) => {
      const { data } = await api.post<Job>('/controls/extract', { document_ids })
      return data
    },
    onSuccess: (job) => {
      setActiveJobId(job.id)
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const pdfDocs = (dq.data ?? []).filter((d) => d.path.toLowerCase().endsWith('.pdf'))
  const docLabel = useMemo(() => {
    const m = new Map((dq.data ?? []).map((d) => [d.id, d.filename]))
    return (id: string) => m.get(id) ?? id
  }, [dq.data])

  if (q.isLoading) return <p className="text-slate-500">Loading…</p>
  const rowCount = q.data?.length ?? 0
  return (
    <div>
      <div className="mb-4 space-y-3 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <p>
          <strong>Document id</strong> is the UUID shown under each file on the Documents page (or pick a PDF
          below). Leave the selector on “All PDFs” and use <strong>Extract all PDFs</strong> to process every
          registered PDF. Extraction runs as a background job.
        </p>
        <p className="text-amber-900/90">
          Flow: Document Intelligence turns the PDF into text → by default the model sees the <strong>whole</strong>{' '}
          document in one call (up to ~100k chars), then dedupes. Larger PDFs are split into fewer, bigger LLM chunks.
          Heuristic keyword lines are <strong>off</strong> unless you set{' '}
          <code className="rounded bg-white/80 px-1">CONTROL_EXTRACTION_HEURISTIC_ON_EMPTY=true</code>. If DI returns
          401, the backend uses local PDF text instead.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-slate-500">Scope</span>
          <select
            className="min-w-[280px] rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm shadow-sm"
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
          >
            <option value="">All PDFs ({pdfDocs.length})</option>
            {pdfDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => extract.mutate(docFilter ? [docFilter] : undefined)}
          disabled={extract.isPending || !!activeJobId || pdfDocs.length === 0}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {activeJobId ? 'Job running…' : extract.isPending ? 'Queueing…' : docFilter ? 'Extract this PDF' : 'Extract all PDFs'}
        </button>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        Showing <strong>{rowCount}</strong> control{rowCount === 1 ? '' : 's'}{' '}
        {docFilter ? (
          <>
            for <strong>{docLabel(docFilter)}</strong> only.
          </>
        ) : (
          <>
            from <strong>all PDFs</strong> (mixed). Choose a file in Scope to see one document.
          </>
        )}
      </p>

      <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Control</th>
              <th className="px-4 py-2">Doc</th>
              <th className="px-4 py-2">§</th>
              <th className="px-4 py-2">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rowCount === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  No controls yet for this scope. Run <strong>Extract this PDF</strong> with the document selected,
                  or <strong>Extract all PDFs</strong>. Previous controls for that PDF are replaced when extraction
                  completes.
                </td>
              </tr>
            ) : null}
            {(q.data ?? []).map((c) => (
              <tr key={c.id} className="align-top hover:bg-slate-50/80">
                <td className="max-w-lg px-4 py-2 text-slate-800">{c.control_text}</td>
                <td className="max-w-[220px] truncate px-4 py-2 text-xs text-slate-700" title={c.document_id}>
                  <span className="font-medium">{docLabel(c.document_id)}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{c.document_id}</span>
                </td>
                <td className="px-4 py-2 text-slate-600">{c.section_ref ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">{c.source_page ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
