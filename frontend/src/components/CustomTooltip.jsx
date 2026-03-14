export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const filtered = payload.filter(p => p.name !== "year")
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--cream-border)",
      borderRadius: 6, padding: "10px 14px", fontSize: 12,
      fontFamily: "var(--font-body)", boxShadow: "var(--shadow-md)"
    }}>
      {label && <p style={{ color: "var(--charcoal-muted)", marginBottom: 6, fontSize: 11, fontFamily: "var(--font-mono)" }}>{label}</p>}
      {filtered.map((p, i) => (
        <p key={i} style={{ color: p.color || "var(--accent)", fontWeight: 500, marginTop: 2 }}>
          {p.name}: <span style={{ color: "var(--charcoal)" }}>
            {typeof p.value === "number"
              ? (() => {
                  const isPrice = p.name.toLowerCase().includes('price') || p.name.toLowerCase().includes('tax')
                  return isPrice ? `£${p.value.toLocaleString()}` : p.value.toLocaleString()
                })()
              : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}
