import React from 'react'

/**
 * Reusable catalog grid for picking a connector or agent template.
 * Used by both MCP Connectors and External Agents.
 */
export function CatalogGrid({ items, onPick, ctaLabel = 'Add' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onPick(item)}
          className="text-left bg-white border border-[#E5E7EB] rounded-xl px-4 py-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg shrink-0 grid place-items-center text-white text-[14px] font-bold"
              style={{ backgroundColor: item.color }}
            >
              {item.name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[14px] text-[#111827] truncate">{item.name}</div>
              <div className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-1">{item.tagline}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-1.5">{item.auth}</div>
            </div>
            <span className="text-[12px] font-semibold text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity self-center">
              {ctaLabel} →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

/**
 * Logo chip — colored square with first letter. Consistent with CatalogGrid.
 */
export function LogoChip({ name, color, size = 32 }) {
  return (
    <div
      className="rounded-lg shrink-0 grid place-items-center text-white font-bold"
      style={{
        backgroundColor: color || '#475569',
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {(name || '?').slice(0, 1)}
    </div>
  )
}

/**
 * Status pill — connected / disconnected / error.
 */
export function StatusPill({ status }) {
  const styles = {
    connected:    { bg: '#DCFCE7', fg: '#166534', dot: '#16A34A', label: 'Connected'    },
    disconnected: { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8', label: 'Disconnected' },
    error:        { bg: '#FEE2E2', fg: '#991B1B', dot: '#DC2626', label: 'Error'        },
    active:       { bg: '#DCFCE7', fg: '#166534', dot: '#16A34A', label: 'Active'       },
    inactive:     { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8', label: 'Inactive'     },
  }
  const s = styles[status] || styles.disconnected
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  )
}
