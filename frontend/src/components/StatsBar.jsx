export default function StatsBar({ stats }) {
  if (!stats) return null

  const isBMW = !stats.category_col  // BMW data uses static keys

  // Build stat cards adaptively
  const items = []

  // Total row count — always present
  items.push({ label: "Total Records", value: stats.total?.toLocaleString(), mono: true })

  // Distinct categories (e.g., BMW Models, departments, cities...)
  if (stats.categories !== undefined) {
    const baseLabel = stats.category_col.replace(/_/g, " ")
    const label = `Unique ${baseLabel}${stats.categories !== 1 && !baseLabel.toLowerCase().endsWith('s') ? 's' : ''}`
    items.push({ label, value: stats.categories, mono: true })
  } else if (isBMW && stats.models !== undefined) {
    items.push({ label: "BMW Models", value: stats.models, mono: true })
  }

  // Year / date range
  if (stats.year_range) {
    const label = stats.year_col
      ? `${stats.year_col.replace(/_/g, " ")} range`
      : "Year Range"
    items.push({
      label,
      value: `${stats.year_range.min_yr} – ${stats.year_range.max_yr}`,
      mono: false
    })
  }

  // Primary numeric range (price, salary, etc.)
  if (stats.value_range) {
    const col = stats.value_col || "value"
    const isPound = ["price", "salary", "income", "revenue", "cost", "tax"].some(k =>
      col.toLowerCase().includes(k)
    )
    const fmt = n => n == null ? "?" : (isPound ? `£${Number(n).toLocaleString()}` : Number(n).toLocaleString())
    items.push({
      label: col.replace(/_/g, " ") + " range",
      value: `${fmt(stats.value_range.min_p)} – ${fmt(stats.value_range.max_p)}`,
      mono: false
    })
  } else if (isBMW && stats.price_range) {
    items.push({
      label: "Price Range",
      value: `£${(stats.price_range.min_p)?.toLocaleString()} – £${(stats.price_range.max_p)?.toLocaleString()}`,
      mono: false
    })
  }

  // Pad to 4 cards
  while (items.length < 4) {
    items.push({ label: "Dataset", value: stats.dataset || "—", mono: false })
    break
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: 12, marginBottom: 40
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: "#fff", border: "1px solid var(--cream-border)",
          borderRadius: 8, padding: "18px 20px",
          boxShadow: "var(--shadow-sm)",
          animation: `countUp 0.5s ease ${i * 0.1}s both`
        }}>
          <p style={{
            fontFamily: item.mono ? "var(--font-mono)" : "var(--font-display)",
            fontSize: item.mono ? 26 : 18,
            fontWeight: 700, color: "var(--accent)",
            lineHeight: 1.2
          }}>{item.value}</p>
          <p style={{
            fontSize: 10, color: "var(--charcoal-muted)",
            textTransform: "uppercase", letterSpacing: 1.5,
            marginTop: 6, fontFamily: "var(--font-mono)"
          }}>{item.label}</p>
        </div>
      ))}
    </div>
  )
}
