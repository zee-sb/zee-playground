import { createContext, useContext, useEffect, useState, useCallback, useMemo, createElement } from 'react'

// Active tenant context — the gallery (App.jsx) is the source of truth for
// which Staffbase workspace the playground is currently scoped to. Every
// prototype reads from this via useActiveTenant(); useConfigStore() also
// reads it so localStorage + /api/navigator-config calls are keyed
// per-tenant.
//
// URL `?tenant=<branchId>` is canonical. A cookie + this provider's state
// hold the most-recently-picked value as a fallback when the URL is bare
// (e.g. a deep-link to a prototype without the param yet).

const COOKIE_NAME = 'sb_active_tenant'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 days

const TenantContext = createContext({
  branchId: null,
  tenant: null,
  tenants: [],
  loading: false,
  refreshTenants: () => {},
  setActiveTenant: () => {},
  addTenant: async () => null,
  deleteTenant: async () => false,
})

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';').map((c) => c.trim())
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) return decodeURIComponent(c.slice(name.length + 1))
  }
  return null
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function getUrlTenant() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('tenant') || null
}

function setUrlTenant(branchId) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (branchId) url.searchParams.set('tenant', branchId)
  else url.searchParams.delete('tenant')
  window.history.replaceState(null, '', url.toString())
}

async function safeJson(resp) {
  const ct = resp.headers.get('content-type') || ''
  if (!ct.toLowerCase().includes('application/json')) return null
  try { return await resp.json() } catch { return null }
}

export function TenantProvider({ children }) {
  const [tenants, setTenants] = useState([])
  const [branchId, setBranchIdState] = useState(() => getUrlTenant() || getCookie(COOKIE_NAME))
  const [loading, setLoading] = useState(true)

  const refreshTenants = useCallback(async () => {
    setLoading(true)
    let resp
    try {
      resp = await fetch('/api/tenants', { credentials: 'include' })
    } catch {
      setLoading(false)
      return
    }
    setLoading(false)
    if (!resp.ok) return
    const data = await safeJson(resp)
    const list = Array.isArray(data?.tenants) ? data.tenants : []
    setTenants(list)
    // If the active branchId no longer exists, fall back to the first tenant.
    setBranchIdState((current) => {
      if (current && list.some((t) => t.branchId === current)) return current
      const fallback = list[0]?.branchId || null
      if (fallback) {
        setCookie(COOKIE_NAME, fallback)
        setUrlTenant(fallback)
      }
      return fallback
    })
  }, [])

  useEffect(() => { refreshTenants() }, [refreshTenants])

  // Mirror URL → state when the user navigates via back/forward buttons.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPop() {
      const next = getUrlTenant()
      if (next) setBranchIdState(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setActiveTenant = useCallback((nextBranchId) => {
    setBranchIdState(nextBranchId || null)
    if (nextBranchId) {
      setCookie(COOKIE_NAME, nextBranchId)
      setUrlTenant(nextBranchId)
    } else {
      setUrlTenant(null)
    }
  }, [])

  const addTenant = useCallback(async ({ displayName, baseUrl, apiToken, brandColor }) => {
    const resp = await fetch('/api/tenants', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, baseUrl, apiToken, brandColor }),
    })
    const data = await safeJson(resp)
    if (!resp.ok) {
      const err = new Error(data?.message || data?.error || `add_tenant_failed_${resp.status}`)
      err.code = data?.error || `http_${resp.status}`
      throw err
    }
    await refreshTenants()
    if (data?.tenant?.branchId) setActiveTenant(data.tenant.branchId)
    return data?.tenant || null
  }, [refreshTenants, setActiveTenant])

  const deleteTenantCall = useCallback(async (target) => {
    const resp = await fetch(`/api/tenants?branch=${encodeURIComponent(target)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!resp.ok) return false
    await refreshTenants()
    return true
  }, [refreshTenants])

  const tenant = useMemo(
    () => tenants.find((t) => t.branchId === branchId) || null,
    [tenants, branchId],
  )

  const value = useMemo(() => ({
    branchId,
    tenant,
    tenants,
    loading,
    refreshTenants,
    setActiveTenant,
    addTenant,
    deleteTenant: deleteTenantCall,
  }), [branchId, tenant, tenants, loading, refreshTenants, setActiveTenant, addTenant, deleteTenantCall])

  return createElement(TenantContext.Provider, { value }, children)
}

export function useActiveTenant() {
  return useContext(TenantContext)
}
