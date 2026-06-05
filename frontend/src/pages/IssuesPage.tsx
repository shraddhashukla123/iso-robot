import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { ACTIVE_JOBS_KEY, useActiveJobs, useJobCompletionWatcher } from '../hooks/useActiveJobs'

type Issue = {
  id: string
  title: string | null
  body: string | null
  region_hint: string | null
  issue_scope: string | null
  sector: string | null
  source_document_id: string | null
  origin: string | null
  created_at: string
}

type Doc = { id: string; filename: string; path: string }

type Job = { id: string; status: string; type: string }

type ScopeTab = 'all' | 'internal' | 'external'

function ScopeBadge({ scope }: { scope: string | null }) {
  if (!scope) return <span className="text-slate-400">—</span>
  const s = scope.toLowerCase()
  if (s === 'internal')
    return (
      <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
        Internal
      </span>
    )
  if (s === 'external')
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
        External
      </span>
    )
  return <span className="capitalize text-slate-600">{scope}</span>
}

export function IssuesPage({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // --- generate panel state ---
  const [docForGenerate, setDocForGenerate] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [classifyAfter, setClassifyAfter] = useState(true)
  const [sectorHint, setSectorHint] = useState('')
  const [regionHint, setRegionHint] = useState('')

  // --- table filter state ---
  const [tableDocFilter, setTableDocFilter] = useState('')
  const [scopeTab, setScopeTab] = useState<ScopeTab>('all')
  const [regionFilter, setRegionFilter] = useState('')

  // --- advanced panel toggle ---
  const [showAdvanced, setShowAdvanced] = useState(false)

  // --- global job status (persists across navigation) ---
  const activeJobs = useActiveJobs()
  const isGenerating = activeJobs.some((j) => j.type === 'issues_from_controls' && j.status === 'running')
  const isClassifying = activeJobs.some((j) => j.type === 'classify_issues' && j.status === 'running')

  // When generate job completes, refresh issues list
  useJobCompletionWatcher(
    ['issues_from_controls'],
    useCallback(
      (_jobId, _jobType) => {
        qc.invalidateQueries({ queryKey: ['issues'] })
        qc.invalidateQueries({ queryKey: ['summary'] })
        qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
      },
      [qc],
    ),
    useCallback(
      (_jobId, _jobType, err) => {
        if (err) onError(`Issue generation failed: ${err}`)
        qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
      },
      [qc, onError],
    ),
  )

  // When classify job completes, refresh issues + classifications
  useJobCompletionWatcher(
    ['classify_issues'],
    useCallback(
      (_jobId, _jobType) => {
        qc.invalidateQueries({ queryKey: ['issues'] })
        qc.invalidateQueries({ queryKey: ['classifications-aggregate'] })
        qc.invalidateQueries({ queryKey: ['summary'] })
        qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
      },
      [qc],
    ),
    useCallback(
      (_jobId, _jobType, err) => {
        if (err) onError(`Classification failed: ${err}`)
        qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
      },
      [qc, onError],
    ),
  )

  const dq = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data } = await api.get<Doc[]>('/documents')
      return data
    },
  })

  const q = useQuery({
    queryKey: ['issues', tableDocFilter],
    queryFn: async () => {
      const params: Record<string, string | boolean> = { include_classification: false }
      if (tableDocFilter) params.source_document_id = tableDocFilter
      const { data } = await api.get<Issue[]>('/issues', { params })
      return data
    },
    // Keep refreshing while issues are being generated so new rows appear
    refetchInterval: isGenerating ? 2000 : false,
  })

  const seed = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ risk_sources: number; issues: number; poc_path: string }>(
        '/issues/seed-from-poc',
        {},
      )
      return data
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      // eslint-disable-next-line no-alert
      alert(`Imported ${d.issues} issues from POC (${d.risk_sources} risk-source rows). Path: ${d.poc_path}`)
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post<{ created: number; errors: string[] }>('/issues/import-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      const extra = d.errors.length ? `\nWarnings: ${d.errors.join('; ')}` : ''
      // eslint-disable-next-line no-alert
      alert(`Imported ${d.created} issues from CSV.${extra}`)
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const classifyAll = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Job>('/issues/classify', {})
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY }),
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const reclassifyOne = useMutation({
    mutationFn: async (issueId: string) => {
      const { data } = await api.post<Job>('/issues/classify', { issue_ids: [issueId] })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY }),
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const fromControls = useMutation({
    mutationFn: async () => {
      if (!docForGenerate) throw new Error('Select a PDF first.')
      const { data } = await api.post<Job>('/issues/from-controls', {
        document_id: docForGenerate,
        replace_existing: replaceExisting,
        classify_after: classifyAfter,
        sector_hint: sectorHint.trim() || undefined,
        region_hint: regionHint.trim() || undefined,
      })
      return data
    },
    onSuccess: () => {
      // Auto-filter table to the PDF being generated
      setTableDocFilter(docForGenerate)
      // Immediately refresh the jobs list so the banner appears without waiting for the next poll
      qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
    },
    onError: (e) => onError(apiErrorMessage(e)),
  })

  const pdfDocs = (dq.data ?? []).filter((d) => d.path.toLowerCase().endsWith('.pdf'))

  const docLabel = useMemo(() => {
    const m = new Map((dq.data ?? []).map((d) => [d.id, d.filename]))
    return (id: string) => m.get(id) ?? id
  }, [dq.data])

  const allIssues = q.data ?? []
  const internalCount = allIssues.filter((i) => i.issue_scope?.toLowerCase() === 'internal').length
  const externalCount = allIssues.filter((i) => i.issue_scope?.toLowerCase() === 'external').length

  const uniqueRegions = useMemo(() => {
    const s = new Set<string>()
    for (const i of allIssues) {
      if (i.region_hint) s.add(i.region_hint)
    }
    return Array.from(s).sort()
  }, [allIssues])

  const visibleIssues = useMemo(() => {
    return allIssues.filter((i) => {
      if (scopeTab === 'internal' && i.issue_scope?.toLowerCase() !== 'internal') return false
      if (scopeTab === 'external' && i.issue_scope?.toLowerCase() !== 'external') return false
      if (regionFilter && i.region_hint !== regionFilter) return false
      return true
    })
  }, [allIssues, scopeTab, regionFilter])

  if (q.isLoading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="space-y-5">
      {/* ── Active job banners ── */}
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-500" />
          <div>
            <p className="font-semibold">Generating issues from controls…</p>
            <p className="text-xs text-blue-700">
              Running in the background — you can navigate away. New issues will appear as they are saved.
            </p>
          </div>
        </div>
      )}
      {isClassifying && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 shadow-sm">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-violet-500" />
          <div>
            <p className="font-semibold">Classifying issues (PESTEL / SWOT / TVRA)…</p>
            <p className="text-xs text-violet-700">
              Running in the background. Classifications will appear on the classifications page when done.
            </p>
          </div>
        </div>
      )}

      {/* ── Generate from controls ── */}
      <section className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Generate issues from PDF controls</h2>
        <p className="mb-4 text-xs text-slate-600">
          Pick the PDF whose controls you extracted, add optional hints, then generate. Issue generation and
          classification both run in the background — you can navigate away and come back.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">PDF document</span>
            <select
              value={docForGenerate}
              onChange={(e) => setDocForGenerate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm"
            >
              <option value="">— select PDF —</option>
              {pdfDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">Sector hint (optional)</span>
            <input
              value={sectorHint}
              onChange={(e) => setSectorHint(e.target.value)}
              placeholder="e.g. Maritime, Logistics"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-500">Region hint (optional)</span>
            <input
              value={regionHint}
              onChange={(e) => setRegionHint(e.target.value)}
              placeholder="e.g. GCC, EU"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm"
            />
          </label>
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => fromControls.mutate()}
              disabled={fromControls.isPending || isGenerating || !docForGenerate}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {isGenerating ? '⏳ Generating…' : fromControls.isPending ? 'Starting…' : 'Generate issues'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            Replace prior issues for this PDF
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={classifyAfter} onChange={(e) => setClassifyAfter(e.target.checked)} />
            Auto-classify after generation
          </label>
        </div>
      </section>

      {/* ── Stats strip ── */}
      {allIssues.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatCard label="Total issues" value={allIssues.length} color="slate" />
          <StatCard label="Internal" value={internalCount} color="indigo" />
          <StatCard label="External" value={externalCount} color="amber" />
          <StatCard label="Regions" value={uniqueRegions.length} color="teal" />
        </div>
      )}

      {/* ── Table filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {(['all', 'internal', 'external'] as ScopeTab[]).map((s) => {
            const count = s === 'all' ? allIssues.length : s === 'internal' ? internalCount : externalCount
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScopeTab(s)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  scopeTab === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? 'All' : s === 'internal' ? 'Internal' : 'External'}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${scopeTab === s ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {uniqueRegions.length > 0 && (
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
          >
            <option value="">All regions</option>
            {uniqueRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        <select
          value={tableDocFilter}
          onChange={(e) => setTableDocFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
        >
          <option value="">All PDFs</option>
          {pdfDocs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-slate-500">
          Showing {visibleIssues.length} of {allIssues.length}
        </span>
      </div>

      {/* ── Issues table ── */}
      <div className="overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Scope</th>
              <th className="px-4 py-2">Sector</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Source PDF</th>
              <th className="px-4 py-2">Preview</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {visibleIssues.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  {allIssues.length === 0 ? (
                    <>
                      No issues yet.{' '}
                      <strong>Select a PDF above and click Generate issues</strong> to derive issues from its controls.
                    </>
                  ) : (
                    'No issues match the current filters.'
                  )}
                </td>
              </tr>
            ) : (
              visibleIssues.map((i) => (
                <tr
                  key={i.id}
                  className="cursor-pointer align-top hover:bg-slate-50/80"
                  onClick={() => navigate(`/classifications?issueId=${encodeURIComponent(i.id)}`)}
                  title="Open classifications for this issue"
                >
                  <td className="px-4 py-2 font-medium text-slate-900">{i.title}</td>
                  <td className="px-4 py-2">
                    <ScopeBadge scope={i.issue_scope} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{i.sector ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{i.region_hint ?? '—'}</td>
                  <td
                    className="max-w-[180px] truncate px-4 py-2 text-xs text-slate-500"
                    title={i.source_document_id ?? ''}
                  >
                    {i.source_document_id ? docLabel(i.source_document_id) : '—'}
                  </td>
                  <td className="max-w-sm px-4 py-2 text-xs text-slate-600">
                    {(i.body ?? '').slice(0, 120)}
                    {(i.body?.length ?? 0) > 120 ? '…' : ''}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/classifications?issueId=${encodeURIComponent(i.id)}`)
                        }}
                        className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        View →
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          reclassifyOne.mutate(i.id)
                        }}
                        disabled={reclassifyOne.isPending || isClassifying}
                        className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                      >
                        Re-classify
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Advanced ── */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <span>Advanced options</span>
          <span className="text-slate-400">{showAdvanced ? '▲' : '▼'}</span>
        </button>
        {showAdvanced && (
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-3 text-xs text-slate-500">
              Legacy import flows and manual classification trigger. Not needed when using Generate issues from controls.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => seed.mutate()}
                disabled={seed.isPending}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-60"
              >
                {seed.isPending ? 'Importing…' : 'Import POC sources'}
              </button>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) upload.mutate(f)
                    e.target.value = ''
                  }}
                />
                Upload issues CSV
              </label>
              <button
                type="button"
                onClick={() => classifyAll.mutate()}
                disabled={classifyAll.isPending || isClassifying}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                {isClassifying ? 'Classifying…' : classifyAll.isPending ? 'Starting…' : 'Classify all pending'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const cls: Record<string, string> = {
    slate: 'border-slate-200 bg-white text-slate-900',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    teal: 'border-teal-100 bg-teal-50 text-teal-900',
  }
  return (
    <div className={`rounded-lg border px-4 py-2.5 shadow-sm ${cls[color] ?? cls.slate}`}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] font-medium opacity-70">{label}</p>
    </div>
  )
}
