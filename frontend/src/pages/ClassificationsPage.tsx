import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { ACTIVE_JOBS_KEY, useActiveJobs, useJobCompletionWatcher } from '../hooks/useActiveJobs'
import { useJobTracker } from '../hooks/useJobTracker'

// ---------------------------------------------------------------------------
// Types matching GET /api/v1/classifications/aggregate
// ---------------------------------------------------------------------------

type PestelItem = {
  id: string
  issue_id: string
  title: string
  description: string
  impact: 'extreme' | 'high' | 'medium'
  direction: 'positive' | 'negative' | 'mixed' | 'neutral'
  confidence: number
}
type SwotItem = {
  code: string
  issue_id: string
  title: string
  description?: string
  confidence: number
  tags: string[]
}
type TvraRow = {
  id: string
  issue_id: string
  type: 'threat' | 'vulnerability'
  label: string
  title: string
  actor: string
  vectors: string[]
  likelihood: 'high' | 'medium' | 'low'
  impact: 'extreme' | 'high' | 'medium'
  confidence: number
  maps_to: string[]
}
type GeoItem = {
  issue_id: string
  title: string
  description: string
  confidence: number
  severity: 'extreme' | 'high' | 'medium'
  tags: string[]
}

type Agent = { id: string; label: string; status: string }
type FocusedIssue = {
  id: string
  title: string | null
  has_classification: boolean
  missing?: boolean
}

type Aggregate = {
  focused_issue?: FocusedIssue | null
  counts: { pestel: number; swot: number; tvra: number; geo_global: number }
  summary: {
    sources: number
    classified: number
    signals: number
    llm: number
    heuristic: number
    industry: string
    region: string
  }
  agents: Agent[]
  pestel: Record<'Political' | 'Economic' | 'Social' | 'Technological' | 'Environmental' | 'Legal', PestelItem[]>
  swot: Record<'strengths' | 'weaknesses' | 'opportunities' | 'threats', SwotItem[]>
  tvra: TvraRow[]
  geo_global: Record<'geopolitical' | 'enforcement' | 'best_practice' | 'global_risk', GeoItem[]>
}

// ---------------------------------------------------------------------------
// Tiny presentational primitives
// ---------------------------------------------------------------------------

function ImpactPill({ value }: { value: PestelItem['impact'] | TvraRow['impact'] | GeoItem['severity'] }) {
  const v = value.toLowerCase()
  const cls =
    v === 'extreme'
      ? 'bg-red-100 text-red-800'
      : v === 'high'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-700'
  const label = v === 'extreme' ? 'Extreme impact' : v === 'high' ? 'High impact' : 'Med impact'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
}

function LikelihoodPill({ value }: { value: TvraRow['likelihood'] }) {
  const cls =
    value === 'high'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
      : value === 'medium'
        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
        : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {value === 'medium' ? 'Med' : value}
    </span>
  )
}

function ConfidenceBar({ value, color = 'violet' }: { value: number; color?: 'violet' | 'green' | 'red' | 'blue' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const stop =
    color === 'green'
      ? 'from-emerald-400 to-emerald-600'
      : color === 'red'
        ? 'from-rose-400 to-rose-600'
        : color === 'blue'
          ? 'from-sky-400 to-sky-600'
          : 'from-violet-400 to-violet-600'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold tabular-nums text-slate-700">{pct}% conf</span>
      <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full bg-gradient-to-r ${stop}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DirectionArrow({ direction }: { direction: PestelItem['direction'] }) {
  if (direction === 'positive') {
    return <span className="text-emerald-600">▲</span>
  }
  if (direction === 'negative') {
    return <span className="text-rose-600">▼</span>
  }
  if (direction === 'mixed') {
    return <span className="text-amber-500">◆</span>
  }
  return <span className="text-slate-400">•</span>
}

function Chip({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'red' | 'green' | 'blue' }) {
  const cls =
    tone === 'red'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : tone === 'blue'
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-slate-50 text-slate-700'
  return <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>
}

function AgentBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 text-sm text-slate-700">
      <span className="mr-2 text-violet-600">✦</span>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PESTEL_META: Record<keyof Aggregate['pestel'], { letter: string; color: string; subtitle: string }> = {
  Political: { letter: 'P', color: 'bg-rose-500', subtitle: 'Political' },
  Economic: { letter: 'E', color: 'bg-emerald-500', subtitle: 'Economic' },
  Social: { letter: 'S', color: 'bg-sky-500', subtitle: 'Social' },
  Technological: { letter: 'T', color: 'bg-indigo-500', subtitle: 'Technological' },
  Environmental: { letter: 'E', color: 'bg-teal-500', subtitle: 'Environmental' },
  Legal: { letter: 'L', color: 'bg-amber-500', subtitle: 'Legal & Regulatory' },
}

type TabId = 'pestel' | 'swot' | 'tvra' | 'geo'

export function ClassificationsPage({ onError }: { onError?: (msg: string) => void }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const issueId = searchParams.get('issueId')
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('pestel')
  const [industry, setIndustry] = useState('Logistics & Supply Chain')
  const [region, setRegion] = useState('GCC (UAE, KSA, Qatar)')
  const [autoAdd, setAutoAdd] = useState(50)
  const [hil, setHil] = useState(true)
  const [reclassifyJobId, setReclassifyJobId] = useState<string | null>(null)

  const onReclassifyDone = useCallback(
    (status: 'completed' | 'failed', err: string | null) => {
      qc.invalidateQueries({ queryKey: ['classifications-aggregate'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
      setReclassifyJobId(null)
      if (status === 'failed' && err) onError?.(`Re-classification failed: ${err}`)
    },
    [qc, onError],
  )

  useJobTracker(reclassifyJobId, onReclassifyDone)

  const reclassify = useMutation({
    mutationFn: async () => {
      if (!issueId) throw new Error('No issue selected')
      const { data } = await api.post<{ id: string; status: string; type: string }>(
        '/issues/classify',
        { issue_ids: [issueId] },
      )
      return data
    },
    onSuccess: (job) => {
      setReclassifyJobId(job.id)
      qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
    },
    onError: (e) => onError?.(apiErrorMessage(e)),
  })

  // Global classify job watcher — auto-refresh aggregate when any classify job completes
  const activeJobs = useActiveJobs()
  const isClassifying = activeJobs.some((j) => j.type === 'classify_issues' && j.status === 'running')

  useJobCompletionWatcher(
    ['classify_issues'],
    useCallback(
      (_jobId, _jobType) => {
        qc.invalidateQueries({ queryKey: ['classifications-aggregate'] })
        qc.invalidateQueries({ queryKey: ACTIVE_JOBS_KEY })
      },
      [qc],
    ),
  )

  const q = useQuery<Aggregate>({
    queryKey: ['classifications-aggregate', industry, region, issueId ?? ''],
    queryFn: async () => {
      const params: Record<string, string> = { industry, region }
      if (issueId) params.issue_id = issueId
      const { data } = await api.get<Aggregate>('/classifications/aggregate', { params })
      return data
    },
  })

  const clearIssueFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('issueId')
    setSearchParams(next, { replace: true })
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'pestel' as TabId, label: 'PESTEL+', icon: '◍', count: q.data?.counts.pestel ?? 0 },
        { id: 'swot' as TabId, label: 'SWOT', icon: '◈', count: q.data?.counts.swot ?? 0 },
        { id: 'tvra' as TabId, label: 'Threats & Vulnerabilities', icon: '◌', count: q.data?.counts.tvra ?? 0 },
        { id: 'geo' as TabId, label: 'Geopolitical & Global', icon: '◎', count: q.data?.counts.geo_global ?? 0 },
      ],
    [q.data],
  )

  if (q.isLoading) return <p className="text-slate-500">Loading classifications…</p>
  if (q.isError) {
    onError?.('Failed to load classifications aggregate')
    return <p className="text-red-600">Failed to load.</p>
  }
  const data = q.data!
  const totalSignals = data.summary.signals.toLocaleString()
  const fi = data.focused_issue

  return (
    <div>
      {/* ── Background classify-in-progress banner ── */}
      {isClassifying && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 shadow-sm">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-violet-500" />
          <div>
            <p className="font-semibold">Classification in progress…</p>
            <p className="text-xs text-violet-700">
              PESTEL / SWOT / TVRA charts are being computed in the background. This page will refresh automatically
              when done.
            </p>
          </div>
        </div>
      )}

      {issueId ? (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm shadow-sm">
          {fi?.missing ? (
            <div className="border-red-200 bg-red-50 text-red-900">
              <p className="font-medium">Issue not found</p>
              <p className="mt-1 text-red-800/90">No issue matches this id. Remove the filter or pick another issue from the Issues page.</p>
              <button
                type="button"
                onClick={clearIssueFilter}
                className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-900 hover:bg-red-50"
              >
                Clear issue filter
              </button>
            </div>
          ) : fi && !fi.has_classification ? (
            <div className="border-amber-200 bg-amber-50 text-amber-950">
              <p className="font-medium">Filtered issue — classification pending</p>
              <p className="mt-1 text-amber-900/90">
                Charts appear after this issue is classified. Click <strong>Re-classify now</strong> or go to Issues
                and run <strong>Classify all pending</strong>.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reclassify.mutate()}
                  disabled={reclassify.isPending || !!reclassifyJobId}
                  className="rounded-lg border border-amber-400 bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {reclassifyJobId ? 'Classifying…' : reclassify.isPending ? 'Queuing…' : 'Re-classify now'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/issues')}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100/80"
                >
                  Go to Issues
                </button>
                <button
                  type="button"
                  onClick={clearIssueFilter}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Show all issues
                </button>
              </div>
            </div>
          ) : fi ? (
            <div className="border-emerald-200 bg-emerald-50 text-emerald-950">
              <p className="font-medium">Showing classifications for one issue</p>
              <p className="mt-1 text-emerald-900/90">{fi.title ?? fi.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reclassify.mutate()}
                  disabled={reclassify.isPending || !!reclassifyJobId}
                  className="rounded-lg border border-emerald-400 bg-white px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {reclassifyJobId ? 'Re-classifying…' : reclassify.isPending ? 'Queuing…' : 'Re-classify'}
                </button>
                <button
                  type="button"
                  onClick={clearIssueFilter}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-950 hover:bg-emerald-100/80"
                >
                  Clear filter · view portfolio
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
              <p className="font-medium">Issue filter in URL</p>
              <p className="mt-1 text-sm text-slate-600">If this message stays, clear the filter or reload after upgrading the API.</p>
              <button
                type="button"
                onClick={clearIssueFilter}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                Clear issue filter
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Top toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            {data.agents.map((a, i) => (
              <span
                key={a.id}
                title={`${a.label} — ${a.status}`}
                className="grid h-7 w-7 place-items-center rounded-full ring-2 ring-white text-[11px] font-semibold text-white"
                style={{
                  background: [
                    'linear-gradient(135deg,#7c3aed,#a855f7)',
                    'linear-gradient(135deg,#0ea5e9,#3b82f6)',
                    'linear-gradient(135deg,#10b981,#22c55e)',
                    'linear-gradient(135deg,#f59e0b,#f97316)',
                    'linear-gradient(135deg,#ef4444,#db2777)',
                  ][i % 5],
                }}
              >
                {a.label[0]}
              </span>
            ))}
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-800">{data.agents.length} agents · idle</p>
            <p className="text-xs text-slate-500">contextual · agentic · real-time</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <span className="text-base">🏭</span>
            <select
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value)
                qc.invalidateQueries({ queryKey: ['classifications-aggregate'] })
              }}
              className="bg-transparent text-xs font-medium outline-none"
            >
              {['Logistics & Supply Chain', 'Banking & Financial Services', 'Energy & Utilities', 'Healthcare', 'Manufacturing', 'Public Sector', 'Telecom & Media'].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <span>🌐</span>
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value)
                qc.invalidateQueries({ queryKey: ['classifications-aggregate'] })
              }}
              className="bg-transparent text-xs font-medium outline-none"
            >
              {['GCC (UAE, KSA, Qatar)', 'EU & UK', 'North America', 'APAC', 'Global'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">10 regs in scope</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
            <span className="text-xs font-medium text-slate-600">Auto-add ≥</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={autoAdd}
              onChange={(e) => setAutoAdd(Number(e.target.value))}
              className="accent-violet-600"
            />
            <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-700">{autoAdd}%</span>
          </div>
          <button
            type="button"
            onClick={() => setHil((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              hil ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'
            }`}
            title="Human-in-the-loop review"
          >
            <span>👤</span> HIL {hil ? 'on' : 'off'}
          </button>
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-500" title="Settings">
            ⚙
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold ${
                tab === t.id ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pestel' ? (
        <PestelTab data={data} signals={totalSignals} />
      ) : tab === 'swot' ? (
        <SwotTab data={data} />
      ) : tab === 'tvra' ? (
        <TvraTab data={data} />
      ) : (
        <GeoTab data={data} />
      )}

      {/* Footer CTA */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/risk-discovery')}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
        >
          Discover risks from these issues →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: PESTEL+
// ---------------------------------------------------------------------------

function PestelTab({ data, signals }: { data: Aggregate; signals: string }) {
  const categories = Object.entries(data.pestel) as [keyof Aggregate['pestel'], PestelItem[]][]
  const factorsDerived = data.counts.pestel
  return (
    <div>
      <AgentBanner>
        <strong>PESTEL Scanner Agent</strong> · {data.summary.sources} sources · {signals} signals processed · {factorsDerived} factors derived
        <p className="mt-1 text-xs text-slate-600">
          PESTEL+ extends classic PESTEL with <strong>geopolitical enforcement</strong>, <strong>global best practices</strong>, and <strong>technology disruption</strong>. Each factor carries a confidence score, supporting sources, and reasoning the analyst can audit.
        </p>
      </AgentBanner>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map(([name, items]) => {
          const meta = PESTEL_META[name]
          const threats = items.filter((i) => i.direction === 'negative' || i.direction === 'mixed').length
          const opps = items.filter((i) => i.direction === 'positive').length
          return (
            <section key={name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="mb-3 flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-md text-sm font-bold text-white ${meta.color}`}>
                  {meta.letter}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{meta.subtitle}</p>
                  <p className="text-[11px] text-slate-500">
                    {items.length} factors · {threats} threats · {opps} opps
                  </p>
                </div>
              </header>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    No factors derived yet
                  </p>
                ) : (
                  items.slice(0, 8).map((it) => (
                    <article key={it.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="mb-1 flex items-start gap-2">
                        <DirectionArrow direction={it.direction} />
                        <p className="flex-1 text-xs font-medium leading-snug text-slate-800">{it.title}</p>
                      </div>
                      {it.description ? (
                        <p className="mb-2 line-clamp-3 text-[11px] leading-relaxed text-slate-600">{it.description}</p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <ImpactPill value={it.impact} />
                        <ConfidenceBar value={it.confidence} />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: SWOT
// ---------------------------------------------------------------------------

function SwotTab({ data }: { data: Aggregate }) {
  const totalAssets = data.summary.sources
  const ext = data.counts.pestel
  return (
    <div>
      <AgentBanner>
        <strong>SWOT Synthesizer</strong> cross-references {totalAssets} assets, {Math.max(1, Math.round(totalAssets / 5))} processes, and {ext} external factors
      </AgentBanner>
      <div className="grid gap-4 md:grid-cols-2">
        <SwotQuadrant title="Strengths" subtitle="internal+positive" icon="+" tone="green" items={data.swot.strengths} />
        <SwotQuadrant title="Weaknesses" subtitle="internal+negative" icon="-" tone="red" items={data.swot.weaknesses} />
        <SwotQuadrant title="Opportunities" subtitle="external+positive" icon="↑" tone="blue" items={data.swot.opportunities} />
        <SwotQuadrant title="Threats" subtitle="external+negative" icon="!" tone="rose" items={data.swot.threats} />
      </div>
    </div>
  )
}

function SwotQuadrant({
  title,
  subtitle,
  icon,
  tone,
  items,
}: {
  title: string
  subtitle: string
  icon: string
  tone: 'green' | 'red' | 'blue' | 'rose'
  items: SwotItem[]
}) {
  const palette = {
    green: { badge: 'bg-emerald-500', under: 'bg-emerald-400', conf: 'green' as const },
    red: { badge: 'bg-rose-500', under: 'bg-rose-400', conf: 'red' as const },
    blue: { badge: 'bg-sky-500', under: 'bg-sky-400', conf: 'blue' as const },
    rose: { badge: 'bg-rose-500', under: 'bg-rose-500', conf: 'red' as const },
  }[tone]
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-md text-sm font-bold text-white ${palette.badge}`}>{icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-[11px] text-slate-500">
              {subtitle} · {items.length} items
            </p>
          </div>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">✦ auto</span>
      </header>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            No items derived. {title === 'Strengths' ? 'Heuristic fallback leaves strengths empty until LLM runs.' : 'Run Classify on Issues.'}
          </p>
        ) : (
          items.slice(0, 8).map((it) => (
            <article key={it.code} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs">
                  <span className="mr-2 inline-flex rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-600">
                    {it.code}
                  </span>
                  <span className="font-medium text-slate-800">{it.title}</span>
                </p>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{Math.round(it.confidence * 100)}%</span>
              </div>
              {it.description ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{it.description}</p>
              ) : null}
              <div className={`mt-1.5 h-0.5 w-full rounded ${palette.under}`} />
              {it.tags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {it.tags.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tab: TVRA
// ---------------------------------------------------------------------------

function TvraTab({ data }: { data: Aggregate }) {
  return (
    <div>
      <AgentBanner>
        <strong>TVRA Agent</strong> · CISA KEV · NVD · MITRE ATT&CK · CMDB · OT IDS · {data.tvra.length} threats/vulns mapped to risk register
      </AgentBanner>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Actor / Vector</th>
              <th className="px-3 py-2">CVE / TTP</th>
              <th className="px-3 py-2">Likelihood</th>
              <th className="px-3 py-2">Impact</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Maps to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.tvra.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                  No TVRA rows derived. Run Classify on Issues.
                </td>
              </tr>
            ) : (
              data.tvra.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700">{r.id}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        r.type === 'threat'
                          ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-2">
                    <p className="truncate text-xs font-medium text-slate-800" title={r.title}>{r.actor || '—'}</p>
                    <p className="truncate text-[11px] text-slate-500" title={r.label}>{r.label}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.vectors.length === 0 ? (
                        <span className="text-[11px] text-slate-400">—</span>
                      ) : (
                        r.vectors.map((v) => (
                          <Chip key={v} tone={v.toUpperCase().startsWith('CVE') ? 'red' : 'slate'}>
                            {v}
                          </Chip>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <LikelihoodPill value={r.likelihood} />
                  </td>
                  <td className="px-3 py-2">
                    <ImpactPill value={r.impact} />
                  </td>
                  <td className="px-3 py-2">
                    <ConfidenceBar value={r.confidence} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.maps_to.length === 0 ? (
                        <span className="text-[11px] text-slate-400">—</span>
                      ) : (
                        r.maps_to.map((m) => (
                          <Chip key={m} tone="blue">
                            {m}
                          </Chip>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Geo & Global
// ---------------------------------------------------------------------------

function GeoTab({ data }: { data: Aggregate }) {
  return (
    <div>
      <AgentBanner>
        <strong>Beyond PESTEL</strong> — geopolitical, enforcement, global best practice & emerging risks
        <p className="mt-1 text-xs text-slate-600">Macro forces classical PESTEL misses. Continuously refreshed by the Discovery agent mesh.</p>
      </AgentBanner>
      <div className="grid gap-4 md:grid-cols-2">
        <GeoQuadrant title="Geopolitical" items={data.geo_global.geopolitical} />
        <GeoQuadrant title="Enforcement" items={data.geo_global.enforcement} />
        <GeoQuadrant title="Best Practice" items={data.geo_global.best_practice} />
        <GeoQuadrant title="Global Risk" items={data.geo_global.global_risk} />
      </div>
    </div>
  )
}

function GeoQuadrant({ title, items }: { title: string; items: GeoItem[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">No items.</p>
        ) : (
          items.map((it, idx) => (
            <article key={`${it.issue_id}-${idx}`} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-sm font-medium leading-snug text-slate-900">{it.title}</p>
              {it.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{it.description}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <ImpactPill value={it.severity} />
                <ConfidenceBar value={it.confidence} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
