import { useState, useRef } from 'react'
import { Paperclip, Send } from 'lucide-react'

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
        <Paperclip size={18} strokeWidth={2} />
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
        <Send size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
