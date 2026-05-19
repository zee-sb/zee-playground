// URL-synced filter state — single source of truth = URL searchParams so
// back/forward and deep-links work, and Overview→Conversations drill-downs
// preserve filters via the URL.

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const FILTER_KEYS = [
  'search', 'topic', 'language', 'device', 'mode',
  'reported_issue', 'resolution_state', 'low_score',
  'dateFrom', 'dateTo',
]

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
  }
}

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const out = {}
    for (const k of FILTER_KEYS) {
      const v = searchParams.get(k)
      if (v != null) out[k] = v
    }
    if (!out.dateFrom || !out.dateTo) {
      const def = defaultRange()
      out.dateFrom = out.dateFrom || def.dateFrom
      out.dateTo = out.dateTo || def.dateTo
    }
    return out
  }, [searchParams])

  const page = useMemo(() => {
    const n = Number.parseInt(searchParams.get('page'), 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }, [searchParams])

  const setFilter = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === false) next.delete(k)
        else next.set(k, String(v))
      }
      // Any filter change resets pagination.
      if (Object.keys(patch).some((k) => k !== 'page')) next.delete('page')
      return next
    }, { replace: false })
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const k of [...FILTER_KEYS, 'page']) next.delete(k)
      return next
    }, { replace: false })
  }, [setSearchParams])

  const setPage = useCallback((p) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!p || p <= 1) next.delete('page')
      else next.set('page', String(p))
      return next
    }, { replace: false })
  }, [setSearchParams])

  return { filters, page, setFilter, setPage, clearFilters }
}
