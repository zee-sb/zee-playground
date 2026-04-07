export function SuggestionChips({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="cw-suggestions">
      {suggestions.map((chip, i) => (
        <button
          key={i}
          className="cw-suggestion-chip"
          onClick={() => onSelect(typeof chip === 'string' ? chip : chip.label)}
        >
          {typeof chip === 'object' && chip.icon && <span>{chip.icon}</span>}
          {typeof chip === 'string' ? chip : chip.label}
        </button>
      ))}
    </div>
  )
}
