import { SUGGESTED_QUERIES } from "../constants"

export default function SuggestionChips({ onSelect, suggestions = [] }) {
  const displaySuggestions = suggestions.length > 0 ? suggestions : SUGGESTED_QUERIES

  return (
    <div style={{ marginTop: 32 }}>
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--charcoal-muted)", letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 14
      }}>Try asking —</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {displaySuggestions.map((q, i) => (
          <button key={i} onClick={() => onSelect(q)} style={{
            background: "#fff", border: "1px solid var(--cream-border)",
            color: "var(--charcoal-light)", borderRadius: 4,
            padding: "7px 16px", fontSize: 12, cursor: "pointer",
            fontFamily: "var(--font-body)", transition: "all 0.18s",
            boxShadow: "var(--shadow-sm)"
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--accent)"
              e.currentTarget.style.color = "var(--accent)"
              e.currentTarget.style.background = "var(--accent-pale)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--cream-border)"
              e.currentTarget.style.color = "var(--charcoal-light)"
              e.currentTarget.style.background = "#fff"
            }}
          >{q}</button>
        ))}
      </div>
    </div>
  )
}
