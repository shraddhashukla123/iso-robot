import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

type Summary = {
  documents: number
  controls: number
  issues: number
  candidate_risks: number
  risk_library: number
  jobs_running: number
}

type JobRow = {
  id: string
  type: string
  status: string
  error: string | null
  created_at: string
}

type SystemStatus = {
  use_llm_fallback: boolean
  azure_openai_configured: boolean
  document_intelligence_configured: boolean
  note: string
}

export function DashboardPage() {
  const q = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const { data } = await api.get<Summary>('/summary')
      return data
    },
  })
  const jobsQ = useQuery({
    queryKey: ['jobs-recent'],
    queryFn: async () => {
      const { data } = await api.get<JobRow[]>('/jobs', { params: { limit: 12 } })
      return data
    },
    refetchInterval: 5000,
  })
  const sysQ = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const { data } = await api.get<SystemStatus>('/system/status')
      return data
    },
  })

  if (q.isLoading) return <p className="text-slate-500">Loading…</p>
  if (q.isError) return <p className="text-red-600">Could not load summary.</p>
  const s = q.data!
  const cards = [
    ['Documents', s.documents],
    ['Controls', s.controls],
    ['Issues', s.issues],
    ['Candidate risks', s.candidate_risks],
    ['Risk library', s.risk_library],
    ['Jobs running', s.jobs_running],
  ] as const

  const sys = sysQ.data

  return (
    <div>
      <p className="mb-6 text-slate-600">Overview of indexed artifacts and background jobs.</p>

      {sys ? (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            !sys.azure_openai_configured || !sys.document_intelligence_configured
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <p className="font-medium">Azure integration</p>
          <p className="mt-1">
            OpenAI configured: <strong>{sys.azure_openai_configured ? 'yes' : 'no'}</strong> · Document
            Intelligence: <strong>{sys.document_intelligence_configured ? 'yes' : 'no'}</strong> · LLM fallback:{' '}
            <strong>{sys.use_llm_fallback ? 'on' : 'off'}</strong>
          </p>
          <p className="mt-2 text-slate-600">{sys.note}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, n]) => (
          <div
            key={label}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow)]"
          >
            <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{n}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent jobs</h2>
        <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Id</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {(jobsQ.data ?? []).map((j) => (
                <tr key={j.id} className="align-top hover:bg-slate-50/80">
                  <td className="px-3 py-2">{j.type}</td>
                  <td className="px-3 py-2 font-medium">{j.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{j.id.slice(0, 8)}…</td>
                  <td className="max-w-xl px-3 py-2 text-xs text-red-700">{j.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
