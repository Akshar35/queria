import { useState, useRef, useEffect } from "react"
import axios from "axios"
import "./index.css"

import { API } from "./constants"
import Sidebar from "./components/Sidebar"
import StatsBar from "./components/StatsBar"
import DashboardBlock from "./components/DashboardBlock"
import SuggestionChips from "./components/SuggestionChips"
import CsvUpload from "./components/CsvUpload"

export default function App() {
  const [question, setQuestion] = useState("")
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [datasetInfo, setDatasetInfo] = useState({ 
    name: "bmw.csv", 
    is_default: true,
    description: "Type a plain English question about your data and get instant, interactive charts — no SQL required.",
    suggestions: []
  })
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const loadingMessages = [
    "Querying database...",
    "Building your charts...",
    "Analyzing data...",
    "Generating insights..."
  ]
  const bottomRef = useRef(null)

  const fetchSessions = () => {
    setLoadingSessions(true)
    axios.get(`${API}/sessions`)
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }

  const fetchStats = () => {
    axios.get(`${API}/stats`).then(r => setStats(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchStats()
    fetchSessions()
    axios.get(`${API}/dataset-info`).then(r => setDatasetInfo(r.data)).catch(() => {})
  }, [])

  const handleUploadSuccess = (uploadResult) => {
    setDatasetInfo({ 
      name: uploadResult.filename, 
      is_default: false,
      description: uploadResult.description,
      suggestions: uploadResult.suggestions
    })
    setHistory([])
    setStats({})
    setTimeout(fetchStats, 500)
  }

  const handleReset = () => {
    axios.post(`${API}/reset-dataset`).then(() => {
      axios.get(`${API}/dataset-info`).then(r => setDatasetInfo(r.data))
      setHistory([])
      setStats({})
      setTimeout(fetchStats, 500)
    })
  }

  const loadSession = async (id) => {
    setCurrentSessionId(id)
    setLoading(true)
    try {
      const res = await axios.get(`${API}/sessions/${id}/messages`)
      const mappedHistory = []
      let currentItem = null
      for (const msg of res.data) {
        if (msg.role === "user") {
          currentItem = { id: msg.id, question: msg.content.question, loading: false }
          mappedHistory.push(currentItem)
        } else if (msg.role === "assistant" && currentItem) {
          if (msg.content.error) {
            currentItem.success = false
            currentItem.cannot_answer = msg.content.cannot_answer || false
            currentItem.message = msg.content.error
            currentItem.sql = msg.content.sql
          } else {
            currentItem.success = true
            currentItem.sql = msg.content.sql
            currentItem.data = msg.content.data || []
            currentItem.charts = msg.content.charts || []
            currentItem.summary = msg.content.summary
            currentItem.rowCount = msg.content.data ? msg.content.data.length : 0
          }
        }
      }
      setHistory(mappedHistory)
    } catch (e) {
      console.error("Failed to load session", e)
    }
    setLoading(false)
  }

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Delete this chat?")) return
    try {
      await axios.delete(`${API}/sessions/${id}`)
      fetchSessions()
      if (currentSessionId === id) {
        setCurrentSessionId(null)
        setHistory([])
      }
    } catch (e) {
      console.error("Failed to delete session", e)
    }
  }


  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % loadingMessages.length)
      }, 2000)
    } else {
      setLoadingMsgIndex(0)
    }
    return () => clearInterval(interval)
  }, [loading])

  const handleQuery = async (q) => {
    const text = q || question.trim()
    if (!text || loading) return

    setQuestion("")
    setLoading(true)

    // Local greeting detection for loader type
    const greetings = ["hi", "hello", "hey", "how are you", "what can you do", "help"]
    const isGreeting = greetings.some(g => text.toLowerCase().startsWith(g))

    const tempId = Date.now()
    setHistory(prev => [...prev, { 
      id: tempId, question: text, loading: true, loadingType: isGreeting ? "greeting" : "sql" 
    }])

    try {
      const payload = { question: text }
      if (currentSessionId) payload.session_id = currentSessionId
      const res = await axios.post(`${API}/query`, payload)
      const d = res.data
      
      if (!currentSessionId && d.session_id) {
        setCurrentSessionId(d.session_id)
        fetchSessions()
      }
      
      setHistory(prev => prev.map(item => 
        item.id === tempId ? { 
          ...item, loading: false,
          success: d.success, cannot_answer: d.cannot_answer,
          message: d.message, sql: d.sql, data: d.data,
          charts: d.charts, summary: d.summary, rowCount: d.row_count,
          is_greeting: d.is_greeting, response: d.response
        } : item
      ))
    } catch {
      setHistory(prev => prev.map(item => 
        item.id === tempId ? { 
          ...item, loading: false, success: false, 
          message: "Failed to connect to the server." 
        } : item
      ))
    } finally {
      setLoading(false)
    }
  }

  // Determine if we should show suggestions below the last message
  const lastItem = history[history.length - 1]
  const showSuggestionsBelow = lastItem && !lastItem.loading && (lastItem.is_greeting || !lastItem.success)

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        loadingSessions={loadingSessions}
        onSelectSession={(id) => { loadSession(id); setIsSidebarOpen(false) }}
        onDeleteSession={handleDeleteSession}
        onNewSession={() => { setCurrentSessionId(null); setHistory([]); setIsSidebarOpen(false) }}
      />


      <div style={{
        flex: 1,
        marginLeft: isSidebarOpen ? 260 : 0,
        transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative", minHeight: "100vh"
      }}>
        <div className="grid-bg" />

        {/* Header */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(245,240,232,0.92)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--cream-border)",
          padding: "0 48px", height: 58,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                background: "none", border: "1px solid var(--cream-border)",
                borderRadius: 6, padding: "6px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--charcoal)", transition: "all 0.2s"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--charcoal)", letterSpacing: "-0.5px" }}>Queria</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--charcoal-muted)", letterSpacing: 3, textTransform: "uppercase" }}>Analytics Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Dataset badge */}
            <div style={{
              background: datasetInfo.is_default ? "var(--accent-pale)" : "#fef3e2",
              border: `1px solid ${datasetInfo.is_default ? "var(--accent-border)" : "#f0c070"}`,
              borderRadius: 4, padding: "2px 10px",
              fontSize: 9, fontFamily: "var(--font-mono)",
              color: datasetInfo.is_default ? "var(--accent)" : "#8a5a00",
              letterSpacing: 1.5, textTransform: "uppercase"
            }}>
              📊 {datasetInfo.name}
            </div>

            {/* CSV Upload */}
            <CsvUpload onUploadSuccess={handleUploadSuccess} onReset={handleReset} />

            {/* Live dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px rgba(42,110,74,0.5)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--charcoal-muted)", letterSpacing: 2, textTransform: "uppercase" }}>live</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px", position: "relative", zIndex: 1 }}>
          <StatsBar stats={stats} />

          {/* Empty state */}
          {history.length === 0 && (
            <div style={{ animation: "fadeUp 0.6s ease both" }}>
              <div style={{ maxWidth: 620 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--charcoal-muted)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>Conversational Analytics</p>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 700, color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-1px" }}>
                  Ask anything.<br />
                  <em style={{ color: "var(--accent)", fontStyle: "italic" }}>Understand everything.</em>
                </h1>
                <p style={{ marginTop: 18, fontSize: 15, color: "var(--charcoal-light)", lineHeight: 1.7, maxWidth: 480 }}>
                  {datasetInfo.description}
                </p>
              </div>
              <SuggestionChips onSelect={handleQuery} suggestions={datasetInfo.suggestions} />
            </div>
          )}

          {/* Chat history */}
          <div style={{ marginTop: history.length > 0 ? 0 : 48 }}>
            {history.map(item => (
              <div key={item.id}>
                {/* User bubble */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
                  <div style={{
                    background: "var(--charcoal)", color: "var(--cream)",
                    borderRadius: "16px 16px 4px 16px",
                    padding: "10px 18px", fontSize: 13,
                    fontFamily: "var(--font-body)", maxWidth: "60%",
                    boxShadow: "var(--shadow-sm)"
                  }}>{item.question}</div>
                </div>

                {item.loading ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 32, paddingLeft: 4 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "var(--accent)",
                        animation: `pulse 1.2s ease ${i * 0.2}s infinite`
                      }} />
                    ))}
                    <span style={{ color: "var(--charcoal-muted)", fontSize: 11, marginLeft: 10, fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}>
                      {item.loadingType === "greeting" ? "Thinking..." : loadingMessages[loadingMsgIndex]}
                    </span>
                  </div>
                ) : (
                  <DashboardBlock item={item} />
                )}
              </div>
            ))}
            
            {showSuggestionsBelow && (
              <div style={{ marginTop: -20, marginBottom: 40, animation: "fadeUp 0.4s ease both" }}>
                <SuggestionChips onSelect={handleQuery} suggestions={datasetInfo.suggestions} />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Chat input */}
          <div style={{
            position: "sticky", bottom: 24, zIndex: 50,
            background: "rgba(245,240,232,0.95)", backdropFilter: "blur(16px)",
            border: "1px solid var(--cream-border)", borderRadius: 10,
            padding: "10px 12px", display: "flex", gap: 10,
            boxShadow: "var(--shadow-lg)"
          }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuery()}
              placeholder={`Ask a question about ${datasetInfo.is_default ? "your vehicles" : datasetInfo.name}...`}
              disabled={loading}
              style={{
                flex: 1, background: "#fff",
                border: "1px solid var(--cream-border)", borderRadius: 6,
                padding: "10px 16px", color: "var(--charcoal)", fontSize: 14,
                fontFamily: "var(--font-body)", outline: "none",
                transition: "border 0.2s", boxShadow: "var(--shadow-sm)"
              }}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--cream-border)"}
            />
            <button
              onClick={() => handleQuery()}
              disabled={loading || !question.trim()}
              style={{
                background: loading || !question.trim() ? "var(--cream-border)" : "var(--charcoal)",
                color: loading || !question.trim() ? "var(--charcoal-muted)" : "var(--cream)",
                border: "none", borderRadius: 6, padding: "10px 28px",
                fontSize: 11, fontWeight: 600, cursor: loading || !question.trim() ? "not-allowed" : "pointer",
                fontFamily: "var(--font-mono)", letterSpacing: 2,
                textTransform: "uppercase", transition: "all 0.2s"
              }}
            >{loading ? "..." : "Ask"}</button>
          </div>
        </main>
      </div>
    </div>
  )
}