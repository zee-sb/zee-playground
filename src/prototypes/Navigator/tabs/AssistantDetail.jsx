import React, { useState } from 'react'
import { ArrowLeft, Save, Trash2, Wrench, Bot, BookOpen, Users, Check, MapPin, ShieldCheck, Globe } from 'lucide-react'
import { MCP_CATALOG, AGENT_CATALOG, assistantVisibleTo } from '../../AIAssistant/configStore'
import { LogoChip, StatusPill } from '../components/Catalog'

/**
 * Assistant detail editor — name, description, instructions, sub-agent linking,
 * knowledge bases, audience. Audience is what the Employee chat actually
 * respects: roles + locations drawn from `tenant`, scoped against demoUsers.
 */
export default function AssistantDetail({
  assistant,
  isNew = false,
  mcpConnectors = [],
  externalAgents = [],
  knowledgeBases = [],
  tenant = { roles: [], locations: [] },
  demoUsers = [],
  onBack,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState(assistant.name || '')
  const [icon, setIcon] = useState(assistant.icon || '✨')
  const [description, setDescription] = useState(assistant.description || '')
  const [instructions, setInstructions] = useState(assistant.instructions || '')
  const [mcpConnectorIds, setMcpConnectorIds] = useState(assistant.mcpConnectorIds || [])
  const [externalAgentIds, setExternalAgentIds] = useState(assistant.externalAgentIds || [])
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState(assistant.knowledgeBaseIds || [])
  const [audience, setAudience] = useState(assistant.audience || { everyone: true, roles: [], locations: [] })
  const [status, setStatus] = useState(assistant.status || 'active')

  function toggle(arr, id) {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
  }

  function setEveryone(everyone) {
    setAudience(prev => ({ ...prev, everyone }))
  }
  function toggleRole(r) {
    setAudience(prev => ({ ...prev, roles: toggle(prev.roles || [], r) }))
  }
  function toggleLocation(l) {
    setAudience(prev => ({ ...prev, locations: toggle(prev.locations || [], l) }))
  }

  // Live preview — how many demo users would actually see this assistant?
  const visibleUsers = demoUsers.filter(u => assistantVisibleTo({ audience }, u))

  function handleSave() {
    onSave({
      ...assistant,
      name: name.trim() || 'Untitled assistant',
      icon,
      description,
      instructions,
      mcpConnectorIds,
      externalAgentIds,
      knowledgeBaseIds,
      audience: {
        everyone: !!audience.everyone,
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
              onClick={() => {
                if (window.confirm(`Delete ${name}?`)) onDelete(assistant)
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#111827] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1F2937]"
          >
            <Save size={13} />
            Save
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
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="HR Assistant"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none"
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary shown in lists and welcome chips"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none"
                  />
                </Field>
              </div>
            </div>

            <Field label="System instructions">
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder="How should this assistant behave? When should it call tools or hand off to an external agent?"
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:border-[#3B82F6] outline-none resize-y leading-relaxed"
              />
            </Field>
          </Section>

          {/* External Agents — sub-agent links */}
          <Section
            title="External agents"
            icon={<Bot size={14} className="text-[#3B82F6]" />}
            description="Specialist agents this assistant can hand off to."
          >
            {externalAgents.length === 0 ? (
              <EmptyHint text="No external agents configured yet. Add one in External Agents." />
            ) : (
              <Picker
                items={externalAgents}
                catalog={AGENT_CATALOG}
                selectedIds={externalAgentIds}
                onToggle={(id) => setExternalAgentIds(prev => toggle(prev, id))}
                getMeta={(a) => a.capabilities?.slice(0, 3).join(' · ') || 'No capabilities declared'}
              />
            )}
          </Section>

          {/* MCP Connectors — sub-agent links */}
          <Section
            title="MCP connectors"
            icon={<Wrench size={14} className="text-[#3B82F6]" />}
            description="Tool servers this assistant can call."
          >
            {mcpConnectors.length === 0 ? (
              <EmptyHint text="No MCP servers configured yet. Add one in MCP Connectors." />
            ) : (
              <Picker
                items={mcpConnectors}
                catalog={MCP_CATALOG}
                selectedIds={mcpConnectorIds}
                onToggle={(id) => setMcpConnectorIds(prev => toggle(prev, id))}
                getMeta={(c) => `${c.tools?.length || 0} tools`}
              />
            )}
          </Section>

          {/* Knowledge Bases */}
          <Section
            title="Knowledge bases"
            icon={<BookOpen size={14} className="text-[#3B82F6]" />}
            description="Sources the assistant grounds answers in."
          >
            {knowledgeBases.length === 0 ? (
              <EmptyHint text="No knowledge bases configured yet." />
            ) : (
              <div className="space-y-1">
                {knowledgeBases.map(kb => {
                  const selected = knowledgeBaseIds.includes(kb.id)
                  return (
                    <button
                      key={kb.id}
                      onClick={() => setKnowledgeBaseIds(prev => toggle(prev, kb.id))}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selected ? 'bg-[#EFF6FF] border border-[#BFDBFE]' : 'bg-white border border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#CBD5E1]'}`}>
                        {selected && <Check size={11} className="text-white" />}
                      </div>
                      <BookOpen size={14} className="text-[#94A3B8]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827] truncate">{kb.name}</div>
                        <div className="text-[11px] text-[#94A3B8]">{kb.source} · {kb.articleCount} articles</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right column — targeting & status */}
        <div className="space-y-6">
          <Section title="Status">
            <div className="flex gap-2">
              {['active', 'inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    status === s ? 'bg-[#111827] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {s === 'active' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Audience"
            icon={<Users size={14} className="text-[#3B82F6]" />}
            description="Who can use this assistant. Excluded users won't see it in their chat."
          >
            {/* Everyone toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setEveryone(true)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  audience.everyone
                    ? 'bg-[#111827] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                }`}
              >
                <Globe size={13} />
                Everyone in workspace
              </button>
              <button
                onClick={() => setEveryone(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  !audience.everyone
                    ? 'bg-[#111827] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#475569] hover:bg-[#F9FAFB]'
                }`}
              >
                Specific audience
              </button>
            </div>

            {/* Role + location checklists, dimmed when "everyone" is on */}
            <div className={audience.everyone ? 'opacity-40 pointer-events-none' : ''}>
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">
                  <ShieldCheck size={11} className="text-[#7B5CE3]" />
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(tenant.roles || []).map(r => {
                    const selected = (audience.roles || []).includes(r)
                    return (
                      <button
                        key={r}
                        onClick={() => toggleRole(r)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          selected ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:border-[#CBD5E1]'
                        }`}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">
                  <MapPin size={11} className="text-[#2563EB]" />
                  Locations
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(tenant.locations || []).map(l => {
                    const selected = (audience.locations || []).includes(l)
                    return (
                      <button
                        key={l}
                        onClick={() => toggleLocation(l)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          selected ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E5E7EB] text-[#475569] hover:border-[#CBD5E1]'
                        }`}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Visibility footer — concrete count of demo users reached */}
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

function Picker({ items, catalog, selectedIds, onToggle, getMeta }) {
  return (
    <div className="space-y-1">
      {items.map(item => {
        const cat = catalog.find(c => c.id === item.catalogId)
        const selected = selectedIds.includes(item.id)
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selected ? 'bg-[#EFF6FF] border border-[#BFDBFE]' : 'bg-white border border-[#E5E7EB] hover:border-[#CBD5E1]'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#CBD5E1]'}`}>
              {selected && <Check size={11} className="text-white" />}
            </div>
            <LogoChip name={cat?.name || item.name} color={cat?.color} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#111827] truncate">{item.name}</div>
              <div className="text-[11px] text-[#94A3B8] truncate">{getMeta(item)}</div>
            </div>
            <StatusPill status={item.status === 'connected' ? 'connected' : 'disconnected'} />
          </button>
        )
      })}
    </div>
  )
}

function EmptyHint({ text }) {
  return (
    <div className="text-[12px] text-[#94A3B8] italic px-3 py-3 bg-[#F9FAFB] rounded-lg">{text}</div>
  )
}
