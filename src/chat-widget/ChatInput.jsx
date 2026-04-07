import { useState, useRef } from 'react'

export function ChatInput({ onSend, placeholder = 'Ask anything...' }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e) {
    setValue(e.target.value)
    // Auto-resize
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 80) + 'px'
    }
  }

  return (
    <div className="cw-input-bar">
      <button className="cw-input-attach" title="Attach">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <textarea
        ref={textareaRef}
        className="cw-input-field"
        placeholder={placeholder}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKey}
        rows={1}
      />
      <button
        className="cw-input-send"
        onClick={handleSend}
        disabled={!value.trim()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
