import { useRef, useState } from "react"
import axios from "axios"
import { API } from "../constants"

export default function CsvUpload({ onUploadSuccess, onReset }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith(".csv")) {
      setError("Please select a .csv file")
      return
    }

    setError("")
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await axios.post(`${API}/upload-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      if (res.data.success) {
        onUploadSuccess(res.data)
      } else {
        setError(res.data.error || "Upload failed")
      }
    } catch {
      setError("Upload failed. Is the backend running?")
    }
    setUploading(false)
    // Reset input so the same file can be re-selected
    fileInputRef.current.value = ""
  }

  const handleReset = async () => {
    try {
      await axios.post(`${API}/reset-dataset`)
      onReset()
    } catch {
      setError("Reset failed")
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current.click()}
        disabled={uploading}
        title="Upload a CSV file to analyse"
        style={{
          background: "none",
          border: "1px solid var(--cream-border)",
          borderRadius: 6, padding: "5px 12px",
          fontSize: 10, cursor: uploading ? "wait" : "pointer",
          fontFamily: "var(--font-mono)", letterSpacing: 1.5,
          textTransform: "uppercase", color: "var(--charcoal-muted)",
          transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cream-border)"; e.currentTarget.style.color = "var(--charcoal-muted)" }}
      >
        {uploading ? "⏳ Uploading..." : "↑ Upload CSV"}
      </button>

      {/* Reset to BMW button */}
      <button
        onClick={handleReset}
        title="Reset to default BMW dataset"
        style={{
          background: "none",
          border: "1px solid var(--cream-border)",
          borderRadius: 6, padding: "5px 10px",
          fontSize: 10, cursor: "pointer",
          fontFamily: "var(--font-mono)", letterSpacing: 1,
          textTransform: "uppercase", color: "var(--charcoal-muted)",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--warning)"; e.currentTarget.style.color = "var(--warning)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cream-border)"; e.currentTarget.style.color = "var(--charcoal-muted)" }}
      >↺ Reset</button>

      {error && <span style={{ color: "var(--warning)", fontSize: 10, fontFamily: "var(--font-mono)" }}>{error}</span>}
    </div>
  )
}
