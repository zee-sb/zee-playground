import React, { useState } from 'react'
import { Plus, Trash2, X, Wrench, ChevronRight } from 'lucide-react'
import { MCP_CATALOG, toolsForCatalogId } from '../../AIAssistant/configStore'
import { CatalogGrid, LogoChip, StatusPill } from '../components/Catalog'

/**
 * MCP Connectors page — clean, single-purpose.
 *
 *   Top: Configured MCP servers (with tool counts, status pill)
 *   Below: Catalog ("+ Add MCP server") opens a drawer
 *   Per row: click to expand tools; X to remove; toggle to disconnect
 */
export default function MCPConnectorsList({ mcpConnectors = [], assistants = [], onMcpConnectorsChange }) {
  const [showCatalog, setShowCatalog] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // Map MCP id → list of assistants using it (for "Used by" column)
  const usedBy = (mcpId) =>
    assistants.filter(a => (a.mcpConnectorIds || []).includes(mcpId))

  function handleAdd(catalogItem) {
    const newId = `mcp-${catalogItem.id}-${Date.now().toString(36)}`
    const newConnector = {
      id: newId,
      catalogId: catalogItem.id,
      name: `${catalogItem.name}`,
      endpoint: `https://acme.${catalogItem.id}.example.com/api/mcp`,
      authMethod: catalogItem.auth,
      status: 'connected',
      addedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      tools: toolsForCatalogId(catalogItem.id),
    }
    onMcpConnectorsChange((prev) => [newConnector, ...prev])
    setShowCatalog(false)
    setExpandedId(newId)
  }

  function handleToggleStatus(connector) {
    onMcpConnectorsChange((prev) =>
      prev.map(c => c.id === connector.id
        ? { ...c, status: c.status === 'connected' ? 'disconnected' : 'connected' }
        : c
      )
    )
  }

  function handleRemove(connector) {
    if (!window.confirm(`Remove ${connector.name}? Assistants using it will lose those tools.`)) return
    onMcpConnectorsChange((prev) => prev.filter(c => c.id !== connector.id))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">MCP Connectors</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Tool servers your assistants can call. Each MCP exposes typed tools over the Model Context Protocol.
          </p>
        </div>
        <button
          onClick={() => setShowCatalog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1F2937] transition-colors"
        >
          <Plus size={15} />
          Add MCP server
        </button>
      </div>

      {/* Configured list */}
      {mcpConnectors.length === 0 ? (
        <EmptyState
          title="No MCP servers connected"
          subtitle="Add one from the catalog to give your assistants tools."
          ctaLabel="Browse catalog"
          onCta={() => setShowCatalog(true)}
        />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Server</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Tools</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Used by</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {mcpConnectors.map((c) => {
                const catalog = MCP_CATALOG.find(x => x.id === c.catalogId) || {}
                const using = usedBy(c.id)
                const expanded = expandedId === c.id
                return (
                  <React.Fragment key={c.id}>
                    <tr className="border-t border-[#F1F5F9] hover:bg-[#FAFAFA] cursor-pointer" onClick={() => setExpandedId(expanded ? null : c.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <LogoChip name={catalog.name || c.name} color={catalog.color} size={32} />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#111827] truncate">{c.name}</div>
                            <div className="text-[11px] text-[#94A3B8] font-mono truncate max-w-[260px]">{c.endpoint}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        <span className="inline-flex items-center gap-1.5">
                          <Wrench size={12} className="text-[#94A3B8]" />
                          {c.tools?.length || 0} tool{c.tools?.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {using.length === 0 ? (
                          <span className="text-[12px] text-[#94A3B8]">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {using.slice(0, 3).map(a => (
                              <span key={a.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA] font-medium">
                                {a.name}
                              </span>
                            ))}
                            {using.length > 3 && (
                              <span className="text-[11px] text-[#94A3B8]">+{using.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(c) }} className="hover:opacity-80">
                          <StatusPill status={c.status} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(c) }}
                            className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight
                            size={14}
                            className={`text-[#94A3B8] transition-transform ${expanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#FAFAFA]">
                        <td colSpan={5} className="px-4 py-3 border-t border-[#F1F5F9]">
                          <ToolDetail connector={c} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Catalog drawer */}
      {showCatalog && (
        <CatalogDrawer onClose={() => setShowCatalog(false)} title="Add an MCP server">
          <CatalogGrid items={MCP_CATALOG} onPick={handleAdd} ctaLabel="Connect" />
        </CatalogDrawer>
      )}
    </div>
  )
}

function ToolDetail({ connector }) {
  if (!connector.tools || connector.tools.length === 0) {
    return <p className="text-[12px] text-[#94A3B8]">No tools declared. Configure the server endpoint.</p>
  }
  return (
    <div>
      <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Tools exposed</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {connector.tools.map(t => (
          <div key={t.id} className="flex items-start gap-2 px-3 py-2 bg-white rounded border border-[#E5E7EB]">
            <Wrench size={12} className="text-[#3B82F6] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[12px] font-mono font-semibold text-[#111827]">{t.name}</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">{t.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CatalogDrawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[640px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded">
            <X size={18} className="text-[#6B7280]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

function EmptyState({ title, subtitle, ctaLabel, onCta }) {
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl py-12 px-6 text-center">
      <div className="text-[14px] font-semibold text-[#111827]">{title}</div>
      <div className="text-[12px] text-[#6B7280] mt-1 mb-4">{subtitle}</div>
      <button
        onClick={onCta}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1F2937]"
      >
        <Plus size={14} />
        {ctaLabel}
      </button>
    </div>
  )
}
