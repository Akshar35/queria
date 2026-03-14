export default function Sidebar({ isOpen, onClose, sessions, currentSessionId, onSelectSession, onDeleteSession, onNewSession, loadingSessions }) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.2)", zIndex: 199,
            backdropFilter: "blur(2px)", animation: "fadeIn 0.2s"
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        width: 260, borderRight: "1px solid var(--cream-border)",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
        height: "100%", position: "fixed", left: 0, top: 0,
        padding: "24px 20px", overflowY: "auto", zIndex: 200,
        display: "flex", flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isOpen ? "var(--shadow-lg)" : "none"
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 32 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--charcoal)", letterSpacing: "-0.5px" }}>Queria</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--charcoal-muted)", letterSpacing: 2, textTransform: "uppercase" }}>Sessions</span>
        </div>

        {/* New Chat button */}
        <button onClick={onNewSession} style={{
          background: "var(--accent)", color: "#fff", border: "none",
          borderRadius: 6, padding: "10px 16px", fontSize: 12,
          fontWeight: 600, fontFamily: "var(--font-body)", cursor: "pointer",
          marginBottom: 24, transition: "background 0.2s",
          boxShadow: "var(--shadow-sm)"
        }}>+ New Chat</button>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--charcoal-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Recent</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Loading skeleton */}
          {loadingSessions && sessions.length === 0 && (
            [0, 1, 2].map(i => (
              <div key={i} style={{
                height: 38, borderRadius: 6,
                background: "linear-gradient(90deg, var(--cream-border) 25%, #f0ece4 50%, var(--cream-border) 75%)",
                backgroundSize: "200% 100%",
                animation: `shimmer 1.4s ease ${i * 0.15}s infinite`
              }} />
            ))
          )}

          {/* Session list */}
          {!loadingSessions && sessions.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--charcoal-muted)", fontFamily: "var(--font-body)", fontStyle: "italic", paddingLeft: 4 }}>
              No sessions yet. Ask a question to start!
            </p>
          )}

          {sessions.map(s => {
            const isActive = currentSessionId === s.id
            const title = s.title?.length > 28 ? s.title.slice(0, 28) + "…" : (s.title || "Untitled")
            return (
              <div key={s.id} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <button onClick={() => onSelectSession(s.id)} title={s.title} style={{
                  flex: 1,
                  background: isActive ? "var(--accent-pale)" : "transparent",
                  border: "1px solid", borderColor: isActive ? "var(--accent-border)" : "transparent",
                  borderRadius: 6, padding: "10px 12px", textAlign: "left",
                  fontSize: 13, color: isActive ? "var(--accent)" : "var(--charcoal-light)",
                  fontFamily: "var(--font-body)", cursor: "pointer",
                  transition: "all 0.2s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 8,
                  paddingRight: 40
                }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "var(--accent-pale)"; e.currentTarget.style.color = "var(--accent)" } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--charcoal-light)" } }}
                >
                  <span style={{ fontSize: 13 }}>💬</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                </button>
                
                <button 
                  onClick={(e) => onDeleteSession(s.id, e)}
                  title="Delete Chat"
                  style={{
                    position: "absolute", right: 8,
                    background: "none", border: "none", color: "var(--charcoal-muted)",
                    cursor: "pointer", padding: "4px", borderRadius: "4px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                    opacity: isActive ? 1 : 0.6
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(196, 77, 86, 0.1)"; e.currentTarget.style.color = "var(--warning)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--charcoal-muted)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            )
          })}

        </div>
      </div>
    </>
  )
}
