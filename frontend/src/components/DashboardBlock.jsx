import ChartCard from "./ChartCard"
import SqlBadge from "./SqlBadge"

export default function DashboardBlock({ item }) {
  // Greeting response
  if (item.is_greeting) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid var(--cream-border)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: "0 8px 8px 0",
        padding: "20px 24px", marginBottom: 28,
        boxShadow: "var(--shadow-sm)",
        animation: "fadeUp 0.4s ease both"
      }}>
        {item.response.split('\n').map((line, i) => (
          <p key={i} style={{
            fontSize: 14, lineHeight: 1.8,
            color: line.startsWith('-') ? "var(--charcoal)" : "var(--charcoal-light)",
            fontFamily: "var(--font-body)",
            marginBottom: line === '' ? 8 : 2,
            fontWeight: line.includes('**') ? 600 : 400
          }}>
            {line.replace(/\*\*/g, '')}
          </p>
        ))}
      </div>
    )
  }

  if (!item.success) {
    return (
      <div style={{
        background: "#fff8f5", border: "1px solid #e8cfc0",
        borderRadius: 8, padding: "20px 24px", marginBottom: 28,
        boxShadow: "var(--shadow-sm)"
      }}>
        <p style={{ color: "var(--warning)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          ⚠ {item.cannot_answer ? "Cannot Answer" : "Query Error"}
        </p>
        <p style={{ color: "var(--charcoal-light)", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>{item.message}</p>
      </div>
    )
  }

  const bullets = item.summary
  ? item.summary.split('\n').map(s => s.replace(/^[•\-–]\s*/, '').trim()).filter(Boolean)
  : []

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Query label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 2, height: 18, background: "var(--accent)", borderRadius: 1 }} />
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--charcoal-muted)", letterSpacing: 2, textTransform: "uppercase"
        }}>
          {item.question} · <span style={{ color: "var(--accent)" }}>{item.rowCount} rows</span>
        </p>
      </div>

      {/* Summary */}
      {bullets.length > 0 && (
        <div style={{
          background: "var(--accent-pale)",
          border: "1px solid var(--accent-border)",
          borderLeft: "4px solid var(--accent)",
          borderRadius: "0 10px 10px 0",
          padding: "18px 24px", marginBottom: 20
        }}>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
            color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12
          }}>💡 Key Insights</p>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{
                fontSize: 16, color: "var(--charcoal)",
                lineHeight: 1.7, fontFamily: "Georgia, 'Times New Roman', serif",
                fontWeight: 500
              }}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts */}
      <div style={{
        display: "grid", gap: 16,
        gridTemplateColumns: item.charts.length > 1 ? "1fr 1fr" : "1fr"
      }}>
        {item.charts.map((chart, i) => (
          <ChartCard key={i} chartConfig={chart} data={item.data} index={i} />
        ))}
      </div>

      <SqlBadge sql={item.sql} />

      {/* Divider */}
      <div style={{
        marginTop: 32, height: 1,
        background: "linear-gradient(90deg, var(--cream-border), transparent)"
      }} />
    </div>
  )
}
