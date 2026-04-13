import { useState } from 'react'
import { ClipboardList, CheckCircle, FilePenLine } from 'lucide-react'

function InfoCard({ content }) {
  const { title, icon = <ClipboardList size={18} />, rows = [], badge } = content
  return (
    <div className="cw-card">
      <div className="cw-card-header">
        <span className="cw-card-icon">{icon}</span>
        <span className="cw-card-title">{title}</span>
        {badge && (
          <span className={`cw-card-badge cw-badge-${badge.variant || 'info'}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="cw-card-body">
        {rows.map((row, i) => (
          <div key={i} className="cw-card-row">
            <span className="cw-card-label">{row.label}</span>
            {row.badge ? (
              <span className={`cw-card-badge cw-badge-${row.badge.variant || 'neutral'}`}>
                {row.badge.label}
              </span>
            ) : (
              <span className="cw-card-value">{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FormCard({ content, onAction }) {
  const { title, icon = <FilePenLine size={18} />, fields = [], submitLabel = 'Submit' } = content
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach(f => { init[f.id] = f.defaultValue || '' })
    return init
  })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    onAction?.({ type: 'form_submit', formId: content.id, values })
  }

  if (submitted) {
    return (
      <div className="cw-confirm-card">
        <div className="cw-confirm-icon"><CheckCircle size={24} className="text-green-500" /></div>
        <div className="cw-confirm-title">Submitted!</div>
        <div className="cw-confirm-subtitle">Your request has been sent successfully.</div>
      </div>
    )
  }

  return (
    <form className="cw-form-card" onSubmit={handleSubmit}>
      <div className="cw-form-card-header">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span className="cw-form-card-title">{title}</span>
      </div>
      <div className="cw-form-body">
        {fields.map(field => (
          <div key={field.id} className="cw-form-field">
            <label className="cw-form-label">{field.label}</label>
            {field.type === 'select' ? (
              <select
                className="cw-form-select"
                value={values[field.id]}
                onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
              >
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                className="cw-form-input"
                rows={3}
                placeholder={field.placeholder}
                value={values[field.id]}
                onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                style={{ resize: 'none' }}
              />
            ) : (
              <input
                className="cw-form-input"
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={values[field.id]}
                onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <button type="submit" className="cw-form-submit">{submitLabel}</button>
      </div>
    </form>
  )
}

function ConfirmCard({ content }) {
  const { icon = <CheckCircle size={24} className="text-green-500" />, title, subtitle, chips = [] } = content
  return (
    <div className="cw-confirm-card">
      <div className="cw-confirm-icon">{icon}</div>
      <div className="cw-confirm-title">{title}</div>
      {subtitle && <div className="cw-confirm-subtitle">{subtitle}</div>}
      {chips.length > 0 && (
        <div className="cw-confirm-meta">
          {chips.map((chip, i) => (
            <span key={i} className="cw-confirm-chip">{chip}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionCard({ content, onAction }) {
  const { title, description, actions = [] } = content
  return (
    <div className="cw-action-card">
      <div className="cw-action-card-header">
        <div className="cw-action-card-title">{title}</div>
        {description && <div className="cw-action-card-desc">{description}</div>}
      </div>
      <div className="cw-action-list">
        {actions.map((action, i) => (
          <button
            key={i}
            className="cw-action-item"
            onClick={() => onAction?.({ type: 'action_click', actionId: action.id, label: action.label })}
          >
            <div
              className="cw-action-item-icon"
              style={{ background: action.color || '#EDE9FE' }}
            >
              {action.icon}
            </div>
            <span className="cw-action-item-label">{action.label}</span>
            <span className="cw-action-item-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Message({ message, agentAvatar, userInitials = 'Me', userAvatarColor = '#7B5CE3', onAction }) {
  const isUser = message.role === 'user'
  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  function renderContent() {
    switch (message.type) {
      case 'info_card':
        return <InfoCard content={message.content} />
      case 'form':
        return <FormCard content={message.content} onAction={onAction} />
      case 'confirm':
        return <ConfirmCard content={message.content} />
      case 'action':
        return <ActionCard content={message.content} onAction={onAction} />
      default:
        return (
          <div className={`cw-bubble ${isUser ? 'cw-user' : 'cw-ai'}`}>
            {message.text}
          </div>
        )
    }
  }

  return (
    <div className={`cw-msg-row ${isUser ? 'cw-user' : ''}`}>
      {!isUser && (
        <div className="cw-msg-avatar">
          <span>{agentAvatar}</span>
        </div>
      )}
      {isUser && (
        <div
          className="cw-msg-avatar cw-user-avatar"
          style={{ background: `linear-gradient(135deg, ${userAvatarColor}, ${userAvatarColor}cc)` }}
        >
          <span>{userInitials}</span>
        </div>
      )}
      <div className="cw-msg-body">
        {renderContent()}
        {time && <span className="cw-msg-time">{time}</span>}
      </div>
    </div>
  )
}
