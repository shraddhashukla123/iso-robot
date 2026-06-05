import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../api/client'

type Row = {
  id: string
  risk_domain: string | null
  title: string
  description: string | null
  tags: string | null
  source_ref: string | null
}

export function RiskLibraryPage({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['risk-library'],
    queryFn: async () => {
      const { data } = await api.get<Row[]>('/risk-library')
      return data
    },
  })
  const seed = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ entries: number; csv_path: string }>('/risk-library/seed-from-poc', {})
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-library'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })
  if (q.isLoading) return <p className="text-slate-500">Loading…</p>
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-slate-600">
          Curated entries from the POC risk domains sheet (also written to <code className="rounded bg-slate-100 px-1 text-xs">data/curated/risk_library_seed.csv</code>).
        </p>
        <button
          type="button"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
        >
          {seed.isPending ? 'Seeding…' : 'Seed from POC'}
        </button>
      </div>
      <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(q.data ?? []).map((r) => (
              <tr key={r.id} className="align-top hover:bg-slate-50/80">
                <td className="px-4 py-2 text-slate-600">{r.risk_domain}</td>
                <td className="max-w-xs px-4 py-2 font-medium">{r.title}</td>
                <td className="max-w-xl px-4 py-2 text-slate-600">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
