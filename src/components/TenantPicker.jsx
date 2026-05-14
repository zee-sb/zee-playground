import React, { useState } from 'react'
import { Building2, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { useActiveTenant } from '../prototypes/AIAssistant/useActiveTenant'

// Gallery-level Staffbase workspace picker. Owns:
//   - Dropdown listing every registered tenant (from /api/tenants)
//   - "Add tenant…" modal that posts to /api/tenants
//   - "Delete tenant" inline action
// The selected tenant is the source of truth for the whole playground — see
// useActiveTenant for how it's persisted (URL + cookie) and how
// useConfigStore reads it.

export function TenantPicker() {
  const { tenant, tenants, loading, setActiveTenant, deleteTenant } = useActiveTenant()
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F5F5F7] text-[13px] text-[#18181B] transition-colors"
      >
        <Building2 size={14} className="text-[#71717A]" />
        <span className="font-medium">
          {loading ? 'Loading…' : tenant ? tenant.displayName : 'No tenant'}
        </span>
        {tenant?.workspaceUrl && (
          <span className="text-[#A1A1AA] text-[11px]">{tenant.workspaceUrl}</span>
        )}
        <ChevronDown size={14} className="text-[#A1A1AA]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-[320px] bg-white border border-[#E4E4E7] rounded-lg shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#71717A] border-b border-[#F1F5F9]">
              Staffbase workspaces
            </div>
            {tenants.length === 0 && (
              <div className="px-3 py-4 text-[13px] text-[#A1A1AA] text-center">
                No tenants registered yet.
              </div>
            )}
            {tenants.map((t) => (
              <div
                key={t.branchId}
                className={`group flex items-center justify-between px-3 py-2 text-[13px] hover:bg-[#F5F5F7] cursor-pointer ${
                  t.branchId === tenant?.branchId ? 'bg-[#F1F5F9]' : ''
                }`}
                onClick={() => {
                  setActiveTenant(t.branchId)
                  setOpen(false)
                }}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[#18181B]">{t.displayName}</span>
                  {t.workspaceUrl && (
                    <span className="text-[11px] text-[#A1A1AA]">{t.workspaceUrl}</span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!confirm(`Delete tenant "${t.displayName}"? This removes its blueprint, config, and assistants.`)) return
                    deleteTenant(t.branchId)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#FEE2E2] text-[#A1A1AA] hover:text-[#DC2626]"
                  title="Delete tenant"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div className="border-t border-[#F1F5F9]">
              <button
                onClick={() => { setShowAdd(true); setOpen(false) }}
                className="w-full px-3 py-2.5 text-[13px] text-[#3B82F6] hover:bg-[#EFF6FF] flex items-center gap-2 font-medium"
              >
                <Plus size={14} />
                Add tenant…
              </button>
            </div>
          </div>
        </>
      )}

      {showAdd && <AddTenantModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function AddTenantModal({ onClose }) {
  const { addTenant } = useActiveTenant()
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://')
  const [apiToken, setApiToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await addTenant({ displayName, baseUrl: baseUrl.replace(/\/$/, ''), apiToken })
      onClose()
    } catch (e) {
      setErr(e.message || 'Failed to add tenant')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-[#18181B]">Add Staffbase tenant</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-[#F5F5F7] rounded">
            <X size={16} className="text-[#71717A]" />
          </button>
        </div>
        <p className="text-[13px] text-[#71717A] mb-5 leading-relaxed">
          Connect another Staffbase workspace. The API token is verified against
          <code className="px-1 bg-[#F1F5F9] rounded text-[11px]">/branch</code>
          before it's saved (encrypted at rest).
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px] font-medium text-[#52525B] block mb-1">Display name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Acme HQ"
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-[14px] focus:outline-none focus:border-[#3B82F6]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[#52525B] block mb-1">Workspace URL</span>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://acme.staffbase.com"
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-[14px] focus:outline-none focus:border-[#3B82F6] font-mono"
            />
            <span className="text-[11px] text-[#A1A1AA] mt-1 block">
              The intranet root, with or without <code>/api</code> — we add it if missing.
            </span>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[#52525B] block mb-1">API token</span>
            <input
              type="password"
              required
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="base64-encoded id:secret"
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-[14px] focus:outline-none focus:border-[#3B82F6] font-mono"
            />
          </label>
        </div>

        {err && (
          <div className="mt-4 px-3 py-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">
            {err}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#E4E4E7] rounded-lg text-[14px] font-medium hover:bg-[#F5F5F7]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !displayName || !baseUrl || !apiToken}
            className="flex-1 px-4 py-2 bg-[#18181B] text-white rounded-lg text-[14px] font-medium hover:bg-[#27272A] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Verifying…' : 'Add tenant'}
          </button>
        </div>
      </form>
    </div>
  )
}
