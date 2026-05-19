// Thin fetch wrappers over /api/navigator-analytics. One module so the URL
// builder + branch param + error handling stay consistent across hooks.

import { useEffect, useState, useCallback, useRef } from 'react'

function buildUrl(action, params = {}, branchId) {
  const qs = new URLSearchParams()
  qs.set('action', action)
  if (branchId) qs.set('branch', branchId)
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue
    qs.set(k, String(v))
  }
  return `/api/navigator-analytics?${qs.toString()}`
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return await res.json()
}

function useApi(action, params, branchId) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null })
  const reloadRef = useRef(0)
  const key = JSON.stringify({ action, params, branchId })

  const refetch = useCallback(() => {
    reloadRef.current += 1
    setState((s) => ({ ...s, isLoading: true, error: null }))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, isLoading: true, error: null }))
    fetchJson(buildUrl(action, params, branchId), controller.signal)
      .then((data) => setState({ data, isLoading: false, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ data: null, isLoading: false, error: err })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadRef.current])

  return { ...state, refetch }
}

export function useAnalyticsOverview({ dateFrom, dateTo, branchId }) {
  return useApi('overview', { dateFrom, dateTo }, branchId)
}

export function useAnalyticsInsights({ dateFrom, dateTo, branchId }) {
  return useApi('insights', { dateFrom, dateTo }, branchId)
}

export function useConversations({ filters, page, pageSize, branchId }) {
  return useApi('list', { ...filters, page, pageSize }, branchId)
}

export function useConversation({ id, branchId }) {
  return useApi('detail', { id }, id ? branchId : null)
}
