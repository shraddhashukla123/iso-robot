import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { API_ORIGIN, api } from '../api/client'

export function ExportPage() {
  const [copied, setCopied] = useState(false)
  const q = useQuery({
    queryKey: ['discovery-export'],
    queryFn: async () => {
      const { data } = await api.get<unknown>('/discovery-export')
      return data
    },
  })
  const text = q.data ? JSON.stringify(q.data, null, 2) : ''
  const downloadUrl = `${API_ORIGIN}/api/v1/discovery-export`
  return (
    <div>
      <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          This page is a <strong>single JSON snapshot</strong> of everything the pipeline has produced: document
          counts, extracted controls, issues (with classifications), candidate risks (with library match results),
          and the risk library catalog. Use it for backups, downstream tools, or handing off to another system —
          not just “copy for fun”.
        </p>
      </div>
      <div className="mb-4 flex gap-2">
        <a
          href={downloadUrl}
          download="discovery-export.json"
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
        >
          Download JSON
        </a>
        <button
          type="button"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          disabled={!text}
        >
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
      {q.isLoading ? <p className="text-slate-500">Loading…</p> : null}
      {q.isError ? <p className="text-red-600">Failed to load export.</p> : null}
      <pre className="max-h-[70vh] overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs shadow-[var(--shadow)]">
        {text || '—'}
      </pre>
    </div>
  )
}
