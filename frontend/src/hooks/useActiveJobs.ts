import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '../api/client'

export type ActiveJob = {
  id: string
  type: string
  status: string
  error: string | null
  created_at: string
  updated_at: string
}

/** Shared query key used by all consumers so they share a single cache entry. */
export const ACTIVE_JOBS_KEY = ['jobs-active'] as const

/**
 * Fetches recent jobs and polls aggressively while any are running.
 * Call this once in a top-level component (Shell) so polling continues
 * across page navigations.
 */
export function useActiveJobsPoller() {
  return useQuery<ActiveJob[]>({
    queryKey: ACTIVE_JOBS_KEY,
    queryFn: async () => {
      const { data } = await api.get<ActiveJob[]>('/jobs', { params: { limit: 30 } })
      return data
    },
    refetchInterval: (query) => {
      const jobs = query.state.data ?? []
      return jobs.some((j) => j.status === 'running') ? 1500 : 10_000
    },
    staleTime: 0,
  })
}

/**
 * Read-only view of the cached jobs list — no extra network calls.
 * Any component can call this; Shell's poller keeps the data fresh.
 */
export function useActiveJobs() {
  const { data } = useQuery<ActiveJob[]>({
    queryKey: ACTIVE_JOBS_KEY,
    enabled: false, // don't fetch — just read from cache
  })
  return data ?? []
}

/**
 * Fires callbacks when jobs of the given types transition from running → completed/failed.
 * Works without knowing specific job IDs — detects the transition from the polled list.
 */
export function useJobCompletionWatcher(
  jobTypes: string[],
  onCompleted: (jobId: string, jobType: string) => void,
  onFailed?: (jobId: string, jobType: string, error: string | null) => void,
) {
  const qc = useQueryClient()
  const prevStatusRef = useRef<Record<string, string>>({})

  // Use stable refs so the effect doesn't re-run when the callbacks change
  const onCompletedRef = useRef(onCompleted)
  const onFailedRef = useRef(onFailed)
  onCompletedRef.current = onCompleted
  onFailedRef.current = onFailed

  const jobs = useQuery<ActiveJob[]>({
    queryKey: ACTIVE_JOBS_KEY,
    enabled: false,
  }).data

  useEffect(() => {
    if (!jobs) return
    for (const job of jobs) {
      if (!jobTypes.includes(job.type)) continue
      const prev = prevStatusRef.current[job.id]
      if (prev === 'running' && job.status === 'completed') {
        onCompletedRef.current(job.id, job.type)
      } else if (prev === 'running' && job.status === 'failed') {
        onFailedRef.current?.(job.id, job.type, job.error)
      }
    }
    // Snapshot current status for transition detection on next poll
    prevStatusRef.current = Object.fromEntries(jobs.map((j) => [j.id, j.status]))
  }, [jobs]) // jobTypes is defined at call-site as a literal — stable enough

  return qc
}
