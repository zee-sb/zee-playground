import React, { useMemo, useState } from 'react'
import { ArrowLeft, Save, Trash2, Wrench, Bot, BookOpen, Users, Check, MapPin, ShieldCheck, Globe } from 'lucide-react'
import { assistantVisibleTo } from '../../AIAssistant/configStore'
import { LogoChip } from '../components/Catalog'

/**
 * Assistant detail editor (v7).
 *
 * One unified Connectors picker — replaces the previous trio of MCP /
 * External Agent / Knowledge Base sections. Each connector is rendered with
 * a kind chip (MCP / Agent / Knowledge) so the admin can still scan by type.
 */
export default function AssistantDetail({
  assistant,
  isNew = false,
  connectors = [],
  tenant = { groups: [], roles: [], locations: [] },
  demoUsers = [],
  onBack,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState(assistant.name || '')
  const [icon, setIcon] = useState(assistant.icon || '✨')
  const [description, setDescription] = useState(assistant.description || '')
  const [instructions, setInstructions] = useState(assistant.instructions || '')
  const [connectorIds, setConnectorIds] = useState(assistant.connectorIds || [])
  const [audience, setAudience] = useState(assistant.audience || { everyone: true, groups: [], roles: [], locations: [] })
  const [status, setStatus] = useState(assistant.status || 'active')

  function toggle(arr, id) { return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] }
  function setEveryone(everyone) { setAudience(prev => ({ ...prev, everyone })) }
  function toggleGroup(g) { setAudience(prev => ({ ...prev, groups: toggle(prev.groups || [], g) })) }
  function toggleRole(r) { setAudience(prev => ({ ...prev, roles: toggle(prev.roles || [], r) })) }
  function toggleLocation(l) { setAudience(prev => ({ ...prev, locations: toggle(prev.locations || [], l) })) }

  const availableGroups = Array.from(new Set([
    ...((tenant.groups) || []),
    ...((demoUsers || []).map(u => u.group).filter(Boolean)),
  ])).sort()

  const visibleUsers = demoUsers.filter(u => assistantVisibleTo({ audience }, u))

  // Bucket connectors by kind for visual organization, but stored as one list.
  const grouped = useMemo(() => ({
    mcp:   connectors.filter((c) => c.kind === 'mcp'),
    agent: connectors.filter((c) => c.kind === 'agent'),
    kb:    connectors.filter((c) => c.kind === 'kb'),
  }), [connectors])

  function handleSave() {
    onSave({
      ...assistant,
      name: name.trim() || 'Untitled assistant',
      icon,
      description,
      instructions,
      connectorIds,
      audience: {
        everyone: !!audience.everyone,
        groups: audience.groups || [],
        roles: audience.roles || [],
        locations: audience.locations || [],
      },
      status,
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 hover:bg-[#F3F4F6] rounded text-[#6B7280]">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-[#94A3B8]">
            {isNew ? 'New Assistant' : 'Assistant'}
          </div>
          <h1 className="text-[20px] font-bold text-[#111827] truncate">{name || 'Untitled assistant'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => { if (window.confirm(`Delete ${name}?`)) onDelete(assistant) }}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#111827] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1F2937]"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          {/* Identity */}
          <Section title="Identity">
            <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                className="w-14 h-14 text-[28px] text-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] focus:bg-white outline-none"
              />
              <div className="space-y-2">
                <Field label="Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="HR Assistant"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none" />
                </Field>
                <Field label="Description">
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary shown in lists and welcome chips"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none" />
                </Field>
              </div>
            </div>
            <Field label="System instructions">
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4}
                placeholder="How should this assistant behave? When should it call tools or hand off to an external agent?"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none resize-y leading-relaxed" />
            </Field>
          </Section>

          {/* Unified connectors */}
          <Section
            title="Connectors"
            description="Everything this assistant can call — MCP tool servers, A2A agents, and knowledge bases. Same underlying protocol; the kind decides how the orchestrator dispatches."
          >
            {connectors.length === 0 ? (
              <EmptyHint text="No connectors configured. Open the Connectors tab to add one." />
            ) : (
              <div className="space-y-4">
                {grouped.mcp.length > 0 && (
                  <KindGroup label="MCP servers" icon={<Wrench size={11} />} color="#7C3AED" items={grouped.mcp}
                    selectedIds={connectorIds}
                    onToggle={(id) => setConnectorIds((p) => toggle(p, id))}
                    meta={(c) => `${c.tools?.length || 0} tools`} />
                )}
                {grouped.agent.length > 0 && (
                  <KindGroup label="A2A agents" icon={<Bot size={11} />} color="#F59E0B" items={grouped.agent}
                    selectedIds={connectorIds}
                    onToggle={(id) => setConnectorIds((p) => toggle(p, id))}
                    meta={(c) => `${c.protocol || 'native'} · ${(c.capabilities || []).length} skills`} />
                )}
                {grouped.kb.length > 0 && (
                  <KindGroup label="Knowledge bases" icon={<BookOpen size={11} />} color="#2563EB" items={grouped.kb}
                    selectedIds={connectorIds}
                    onToggle={(id) => setConnectorIds((p) => toggle(p, id))}
                    meta={(c) => `${c.source || 'Knowledge'} · ${c.articleCount || 0} docs`} />
                )}
              </div>
            )}
          </Section>
        </div>

        {/* Right column — status + audience */}
        <div className="space-y-6">
          <Section title="Status">
            <div className="flex gap-2">
              {['active', 'draft', 'archived'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-colors ${
                    status === s ? 'bg-[#111827] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Audience"
            icon={<Users size={14} className="text-[#3B82F6]" />}
            description="Who can use this assistant. Excluded users won't see it in their chat."
          >
            <div className="flex gap-2 mb-3">
              <button onClick={() => setEveryone(true)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  audience.everyone ? 'bg-[#111827] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                }`}>
                <Globe size={13} /> Everyone in workspace
              </button>
              <button onClick={() => setEveryone(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  !audience.everyone ? 'bg-[#111827] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                }`}>
                Specific audience
              </button>
            </div>

            <div className={audience.everyone ? 'opacity-40 pointer-events-none' : ''}>
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">
                  <ShieldCheck size={11} className="text-[#00C7B2]" /> Groups
                </div>
                {availableGroups.length === 0 ? (
                  <div className="text-[11px] text-[#94A3B8] italic px-2 py-1.5 bg-[#F9FAFB] border border-dashed border-[#E5E7EB] rounded">
                    No groups yet. Run discovery in the Setup tab to sync Staffbase groups.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableGroups.map(g => {
                      const selected = (audience.groups || []).includes(g)
                      return (
                        <button key={g} onClick={() => toggleGroup(g)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            selected ? 'bg-[#00C7B2] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:border-[#CBD5E1]'
                          }`}>
                          {g}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#475569]">
              <div className="font-semibold text-[#111827]">
                Visible to {visibleUsers.length} of {demoUsers.length} demo users
              </div>
              <div className="text-[#6B7280] mt-0.5 truncate">
                {visibleUsers.length === 0
                  ? 'No one will see this assistant.'
                  : visibleUsers.map(u => u.name.split(' ')[0]).join(', ')}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, description, children }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111827]">
            {icon}
            {title}
          </h3>
          {description && <p className="text-[11px] text-[#6B7280] mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function KindGroup({ label, icon, color, items, selectedIds, onToggle, meta }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-[#94A3B8] mb-1.5">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="space-y-1">
        {items.map((c) => {
          const selected = selectedIds.includes(c.id)
          const disabled = c.status !== 'connected'
          return (
            <button key={c.id} onClick={() => onToggle(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                selected ? 'bg-[#EFF6FF] border border-[#BFDBFE]' : 'bg-white border border-[#E5E7EB] hover:border-[#CBD5E1]'
              } ${disabled ? 'opacity-60' : ''}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#CBD5E1]'}`}>
                {selected && <Check size={11} className="text-white" />}
              </div>
              <LogoChip name={c.name} color={color} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#111827] truncate">{c.name}</div>
                <div className="text-[11px] text-[#94A3B8] truncate">{meta(c)}</div>
              </div>
              {disabled && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                  {c.status}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyHint({ text }) {
  return <div className="text-[12px] text-[#94A3B8] italic px-3 py-3 bg-[#F9FAFB] rounded-lg">{text}</div>
}
