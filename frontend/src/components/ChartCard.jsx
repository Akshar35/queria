import { useRef, useState } from "react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { toPng, toJpeg } from "html-to-image"
import CustomTooltip from "./CustomTooltip"
import { COLORS } from "../constants"

export default function ChartCard({ chartConfig, data, index }) {
  const { type, title } = chartConfig
  const cardRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const keys = data.length > 0 ? Object.keys(data[0]) : []
  const numericKeys = keys.filter(k => typeof data[0]?.[k] === "number" && k !== "year")
  const yKeys = (chartConfig.yKeys?.length > 0 ? chartConfig.yKeys : numericKeys).filter(k => k !== "year")
  const stringKey = keys.find(k => typeof data[0]?.[k] === "string") || keys[0]
  const firstNumKey = numericKeys[0]
  const axisStyle = { fill: "var(--charcoal-light)", fontSize: 11, fontFamily: "var(--font-body)", fontWeight: 500 }
  const legendStyle = { fontSize: 12, color: "var(--charcoal)", fontFamily: "var(--font-body)", fontWeight: 600 }

  const isMultiSeries = chartConfig.xKey === "year" && stringKey && stringKey !== "year"
  const pivotedData = isMultiSeries ? (() => {
    const groups = {}
    data.forEach(row => {
      const x = row[chartConfig.xKey]
      if (!groups[x]) groups[x] = { year: x }
      const valueKey = yKeys.find(k => k !== chartConfig.xKey) || yKeys[0]
      groups[x][row[stringKey]] = row[valueKey]
    })
    return { rows: Object.values(groups), categories: [...new Set(data.map(d => d[stringKey]))] }
  })() : null

  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div style={{
          height: 280, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: "var(--charcoal-muted)", border: "1px dashed var(--cream-border)",
          borderRadius: 6, margin: "10px 0"
        }}>
          <span style={{ fontSize: 24, marginBottom: 8 }}>📊</span>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>No data to display</p>
        </div>
      )
    }
    if (type === "line") {
      const chartData = pivotedData ? pivotedData.rows : data
      const lineKeys = pivotedData ? pivotedData.categories : yKeys.filter(k => k !== "year")
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-border)" />
            <XAxis dataKey={chartConfig.xKey || stringKey} tick={axisStyle} />
            <YAxis tick={axisStyle} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={legendStyle} />
            {lineKeys.filter(k => k !== "year").map((k, i) => (
              <Line key={k} type="monotone" dataKey={k}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey={firstNumKey} nameKey={stringKey}
              cx="50%" cy="50%" outerRadius={105} innerRadius={40}
              label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
              labelLine={true}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (type === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-border)" />
            <XAxis dataKey={chartConfig.xKey || keys[0]} tick={axisStyle} name={chartConfig.xKey || keys[0]} />
            <YAxis dataKey={chartConfig.yKey || keys[1]} tick={axisStyle} name={chartConfig.yKey || keys[1]} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={data} fill={COLORS[0]} fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      )
    }

    // Default: bar
    const barData = pivotedData ? pivotedData.rows : data
    const barKeys = pivotedData ? pivotedData.categories : yKeys
    const barXKey = chartConfig.xKey || stringKey || keys[0]
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 52 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-border)" />
          <XAxis dataKey={barXKey} tick={{ ...axisStyle, fontSize: 9 }}
            angle={-40} textAnchor="end" interval={0} />
          <YAxis tick={axisStyle} width={55} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} />
          {barKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const fileName = title.replace(/\s+/g, "_").toLowerCase()

  const exportCSV = () => {
    const exportData = type === "bar" || type === "line"
      ? (pivotedData ? pivotedData.rows : data)
      : data
    const headers = Object.keys(exportData[0] || {})
    const rows = exportData.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportImage = async (format) => {
    if (!cardRef.current || exporting) return
    setExporting(true)
    try {
      const fn = format === "jpeg" ? toJpeg : toPng
      const dataUrl = await fn(cardRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,          // retina quality
        style: { boxShadow: "none" }
      })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${fileName}.${format}`
      a.click()
    } catch (e) {
      console.error("Image export failed", e)
    }
    setExporting(false)
  }

  return (
    <div ref={cardRef} style={{
      background: "#fff", border: "1px solid var(--cream-border)",
      borderRadius: 8, padding: "20px 24px",
      boxShadow: "var(--shadow-sm)",
      animation: `fadeUp 0.4s ease ${index * 0.12}s both`,
      transition: "box-shadow 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 14, background: COLORS[index % COLORS.length], borderRadius: 2 }} />
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
            color: "var(--charcoal-light)", textTransform: "uppercase", letterSpacing: 2
          }}>{title}</p>
        </div>
        {/* Export buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["PNG", () => exportImage("png")], ["JPEG", () => exportImage("jpeg")], ["CSV", exportCSV]].map(([label, fn]) => (
            <button key={label} onClick={fn} disabled={exporting} title={`Export as ${label}`}
              style={{
                background: "none", border: "1px solid var(--cream-border)",
                borderRadius: 4, padding: "3px 8px", cursor: exporting ? "wait" : "pointer",
                fontSize: 9, color: "var(--charcoal-muted)", fontFamily: "var(--font-mono)",
                letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cream-border)"; e.currentTarget.style.color = "var(--charcoal-muted)" }}
            >↓ {label}</button>
          ))}
        </div>
      </div>
      {renderChart()}
    </div>
  )
}
