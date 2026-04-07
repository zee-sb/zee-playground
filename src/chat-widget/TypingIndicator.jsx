export function TypingIndicator({ agentAvatar }) {
  return (
    <div className="cw-typing-row">
      <div className="cw-msg-avatar">
        <span>{agentAvatar}</span>
      </div>
      <div className="cw-typing-bubble">
        <div className="cw-typing-dot" />
        <div className="cw-typing-dot" />
        <div className="cw-typing-dot" />
      </div>
    </div>
  )
}
