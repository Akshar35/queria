import { useState } from "react"

export default function SqlBadge({ sql }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 14 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "none", border: "1px solid var(--cream-border)",
        color: "var(--charcoal-muted)", borderRadius: 4, padding: "3px 12px",
        fontSize: 10, cursor: "pointer", fontFamily: "var(--font-mono)",
        letterSpacing: 1.5, textTransform: "uppercase", transition: "all 0.2s"
      }}>
        {open ? "▲ hide sql" : "▼ view sql"}
      </button>
      {open && (
        <pre style={{
          marginTop: 10, padding: "14px 18px",
          background: "var(--charcoal)", color: "#7dd3a8",
          borderRadius: 6, fontSize: 11, overflowX: "auto",
          lineHeight: 1.7, fontFamily: "var(--font-mono)"
        }}>{sql}</pre>
      )}
    </div>
  )
}
