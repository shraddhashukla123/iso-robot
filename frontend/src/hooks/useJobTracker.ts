import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '../api/client'

export type JobRow = {
  id: string
  type: string
  status: string
  error: string | null
}

export function useJobTracker(
  jobId: string | null,
  onSettled: (status: 'completed' | 'failed', error: string | null) => void,
) {
  const qc = useQueryClient()
  const settledRef = useRef(false)

  useEffect(() => {
    settledRef.current = false
  }, [jobId])

  const q = useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data } = await api.get<JobRow>(`/jobs/${jobId}`)
      return data
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === 'completed' || s === 'failed') return false
      return 1200
    },
  })

  useEffect(() => {
    const d = q.data
    if (!d || settledRef.current) return
    if (d.status === 'completed') {
      settledRef.current = true
      onSettled('completed', null)
      qc.removeQueries({ queryKey: ['job', jobId] })
    } else if (d.status === 'failed') {
      settledRef.current = true
      onSettled('failed', d.error)
      qc.removeQueries({ queryKey: ['job', jobId] })
    }
  }, [q.data, jobId, onSettled, qc])

  return q
}
