import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useJobTracker } from '../hooks/useJobTracker'

type Candidate = {
  id: string
  title: string | null
  description: string | null
  domain: string | null
  confidence: number | null
  issue_ids: string[]
  match_status: string | null
  library_risk_id: string | null
  match_rationale: string | null
  bm25_score: number | null
}

function MatchBadge({ status }: { status: string | null }) {
  const s = (status ?? '—').toLowerCase()
  const cls =
    s === 'existing'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : s === 'new'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : s === 'ambiguous'
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

export function RiskDiscoveryPage({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient()
  const [jobId, setJobId] = useState<string | null>(null)

  const onDone = useCallback(
    (status: 'completed' | 'failed', err: string | null) => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setJobId(null)
      if (status === 'failed' && err) {
        onError(`Risk discovery failed: ${err}`)
      }
    },
    [qc, onError],
  )
  useJobTracker(jobId, onDone)

  const q = useQuery({
    queryKey: ['candidates'],
    queryFn: async () => {
      const { data } = await api.get<Candidate[]>('/candidate-risks')
      return data
    },
  })
  const run = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ id: string }>('/risk-discovery/run', {})
      return data
    },
    onSuccess: (d) => setJobId(d.id),
    onError: (e) => onError(apiErrorMessage(e)),
  })
  if (q.isLoading) return <p className="text-slate-500">Loading…</p>
  return (
    <div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="mb-2">
          Builds <strong>candidate risks</strong> from your issues (and their classifications), then matches each to
          the risk library (BM25 + Azure OpenAI, or BM25-only heuristics if OpenAI returns 401). Requires issues +
          seeded risk library. The button starts a <strong>background job</strong>; this table refreshes when the job
          finishes.
        </p>
      </div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-slate-600">
          {(q.data?.length ?? 0) === 0 && !jobId ? 'No candidates yet — run discovery.' : ''}
        </p>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending || !!jobId}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {jobId ? 'Running job…' : run.isPending ? 'Starting…' : 'Run discovery'}
        </button>
      </div>
      <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Confidence</th>
              <th className="px-4 py-2">Match</th>
              <th className="px-4 py-2">Library id</th>
              <th className="px-4 py-2">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(q.data ?? []).map((r) => (
              <tr key={r.id} className="align-top hover:bg-slate-50/80">
                <td className="max-w-md px-4 py-2">
                  <p className="font-medium text-slate-900">{r.title}</p>
                  <p className="mt-1 text-slate-600">{r.description}</p>
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.confidence != null ? Math.round(r.confidence * 100) + '%' : '—'}
                </td>
                <td className="px-4 py-2">
                  <MatchBadge status={r.match_status} />
                </td>
                <td className="max-w-[120px] truncate px-4 py-2 font-mono text-xs text-slate-500">
                  {r.library_risk_id ?? '—'}
                </td>
                <td className="max-w-lg px-4 py-2 text-slate-600">{r.match_rationale ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
