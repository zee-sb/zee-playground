import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfigStore } from '../../AIAssistant/useConfigStore'
import { useActiveTenant } from '../../AIAssistant/useActiveTenant'

const SESSION_CACHE_KEY = 'staffbase.navigator.health.session'

function loadSessionCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveSessionCache(value) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(value)) }
  catch { /* ignore quota */ }
}

// Cheap signature of the live config so we know when to refetch.
function signatureOf(config) {
  if (!config) return '0'
  const a = (config.experts || []).map((x) => `${x.id}:${x.status}:${(x.connectionIds||[]).join(',')}:${x.audience?.everyone ? 'e' : (x.audience?.groups||[]).join(',')}`).join('|')
  const c = (config.connections || []).map((x) => `${x.id}:${x.kind}:${x.status}`).join('|')
  const f = (config.workflows || []).map((x) => `${x.id}:${x.status}:${(x.trigger||'').slice(0,40)}`).join('|')
  return `${a}#${c}#${f}`
}

// Subscribe to Navigator health for the active branch.
//
// Returns: { issues, summary, loading, error, refresh, deep, setDeep, applyAutoFix }
//   - Refetches automatically when the config signature changes (300ms debounce).
//   - `setDeep(true)` enables the LLM-judged scope-overlap check; result is
//     cached server-side by (branchId, revision) so toggling is cheap.
//   - `applyAutoFix(action, payload)` dispatches a closed-set fix through the
//     existing useConfigStore setters; the next signature change refetches.
export function useNavigatorHealth({ initialDeep = false } = {}) {
  const { branchId } = useActiveTenant()
  const { config, setExperts, setConnections, setWorkflows } = useConfigStore({ branchId })
  const [issues, setIssues] = useState(() => loadSessionCache()?.issues || [])
  const [summary, setSummary] = useState(() => loadSessionCache()?.summary || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deep, setDeep] = useState(initialDeep)

  const sig = signatureOf(config)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  const fetchHealth = useCallback(async () => {
    if (typeof window === 'undefined') return
    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const url = `/api/navigator-config?action=health${deep ? '&deep=true' : ''}${branchId ? `&branch=${encodeURIComponent(branchId)}` : ''}`
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`health check failed: ${res.status}`)
      const data = await res.json()
      setIssues(Array.isArray(data.issues) ? data.issues : [])
      setSummary(data.summary || null)
      saveSessionCache({ issues: data.issues || [], summary: data.summary || null })
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [deep, branchId])

  // Refetch on mount + signature change (debounced).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fetchHealth()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [sig, fetchHealth])

  // applyAutoFix — closed action set. Dispatches via the existing setters so
  // the config push + revision bump + downstream refetch all happen
  // automatically.
  const applyAutoFix = useCallback((action, payload) => {
    if (!action || !payload) return
    // Auto-fix action names are kept as-is for back-compat with health-check
    // action strings on the server. They map to the renamed setters.
    if (action === 'patchAssistant' || action === 'patchExpert') {
      setExperts((prev) => prev.map((a) => a.id === payload.id ? { ...a, ...payload.patch } : a))
      return
    }
    if (action === 'patchFlow' || action === 'patchWorkflow') {
      setWorkflows((prev) => prev.map((f) => f.id === payload.id ? { ...f, ...payload.patch } : f))
      return
    }
    if (action === 'setConnectorStatus' || action === 'setConnectionStatus') {
      setConnections((prev) => prev.map((c) => c.id === payload.id ? { ...c, status: payload.status } : c))
      return
    }
    if (action === 'setFlowStatus' || action === 'setWorkflowStatus') {
      setWorkflows((prev) => prev.map((f) => f.id === payload.id ? { ...f, status: payload.status } : f))
      return
    }
    if (action === 'removeFromAssistant' || action === 'removeFromExpert') {
      setExperts((prev) => prev.map((a) => {
        if (a.id !== payload.id) return a
        // Coerce legacy `connectorIds` field name on the payload too.
        const field = payload.field === 'connectorIds' ? 'connectionIds' : payload.field
        const arr = (a[field] || []).filter((x) => x !== payload.value)
        return { ...a, [field]: arr }
      }))
      return
    }
    console.warn('[useNavigatorHealth] unknown autoFix action:', action)
  }, [setExperts, setWorkflows, setConnections])

  return {
    issues,
    summary,
    loading,
    error,
    deep,
    setDeep,
    refresh: fetchHealth,
    applyAutoFix,
  }
}
