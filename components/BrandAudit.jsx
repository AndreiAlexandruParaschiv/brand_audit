// components/BrandAudit.jsx
// Usage: <BrandAudit /> anywhere in your Next.js app

"use client";
import { useState } from "react";

const PHASES = [
  "Brand Mention Discovery",
  "Platform Reputation Analysis",
  "Competitor Analysis",
  "Gap Analysis",
  "Strategic Recommendations",
  "Report Generation",
];

export default function BrandAudit() {
  const [brand, setBrand] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(-1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("openai_api_key") || "";
    }
    return "";
  });

  const saveApiKey = (val) => {
    setApiKey(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem("openai_api_key", val.trim());
      } else {
        localStorage.removeItem("openai_api_key");
      }
    }
  };

  const runAudit = async () => {
    if (!brand.trim()) return;
    setLoading(true);
    setReport(null);
    setError(null);
    setCurrentPhase(0);

    const args = competitors.trim()
      ? `${brand.trim()}, ${competitors.trim()}`
      : brand.trim();

    // Simulate phase progression while waiting for API
    const phaseTimer = setInterval(() => {
      setCurrentPhase(p => {
        if (p >= PHASES.length - 1) { clearInterval(phaseTimer); return p; }
        return p + 1;
      });
    }, 4000);

    try {
      const res = await fetch("/api/brand-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args, apiKey: apiKey.trim() || undefined }),
      });

      clearInterval(phaseTimer);
      setCurrentPhase(PHASES.length - 1);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();
      setReport(data);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setCurrentPhase(-1);
    }
  };

  const scoreColor = s => s >= 8 ? "#22c55e" : s >= 6 ? "#f59e0b" : "#ef4444";
  const severityColor = s => ({ critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e" }[s] || "#94a3b8");
  const impactColor = s => ({ high: "#22c55e", medium: "#f59e0b", low: "#94a3b8" }[s] || "#94a3b8");

  const card = { background: "#1e293b", borderRadius: 12, padding: 22, border: "1px solid #334155", marginBottom: 20 };
  const sectionTitle = { fontSize: 14, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#0f172a", minHeight: "100vh", padding: 24, color: "#e2e8f0" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f8fafc", margin: 0 }}>🔍 Brand Audit Tool</h1>
            <p style={{ color: "#94a3b8", marginTop: 6, fontSize: 14 }}>Off-site brand reputation, visibility & competitive analysis</p>
          </div>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            style={{ background: apiKey.trim() ? "#1e3a2e" : "#1e293b", border: `1px solid ${apiKey.trim() ? "#22c55e44" : "#334155"}`, borderRadius: 8, padding: "8px 14px", color: apiKey.trim() ? "#22c55e" : "#94a3b8", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
          >
            {apiKey.trim() ? "API Key Set" : "Set API Key"}
          </button>
        </div>

        {/* API Key Panel */}
        {showApiKey && (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 18, border: "1px solid #334155", marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
              OPENAI API KEY <span style={{ color: "#475569" }}>(stored in your browser only, never sent to our servers)</span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="password"
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                placeholder="sk-proj-..."
                style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "monospace" }}
              />
              {apiKey.trim() && (
                <button
                  onClick={() => saveApiKey("")}
                  style={{ background: "#450a0a", border: "1px solid #dc262644", borderRadius: 8, padding: "8px 14px", color: "#fca5a5", fontSize: 12, cursor: "pointer" }}
                >
                  Clear
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0" }}>
              Your key is saved in localStorage and sent only to this app's backend to call OpenAI. It is never logged or stored server-side.
            </p>
          </div>
        )}

        {/* Input */}
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>PRIMARY BRAND *</label>
            <input
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Nike, Airbnb, Notion..."
              onKeyDown={e => e.key === "Enter" && !loading && runAudit()}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
              COMPETITORS <span style={{ color: "#475569" }}>(optional, comma-separated)</span>
            </label>
            <input
              value={competitors}
              onChange={e => setCompetitors(e.target.value)}
              placeholder="e.g. Adidas, Puma"
              onKeyDown={e => e.key === "Enter" && !loading && runAudit()}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={runAudit}
            disabled={loading || !brand.trim()}
            style={{ background: loading || !brand.trim() ? "#334155" : "#6366f1", color: loading || !brand.trim() ? "#64748b" : "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 15, fontWeight: 600, cursor: loading || !brand.trim() ? "not-allowed" : "pointer" }}
          >
            {loading ? "Auditing..." : "Run Brand Audit"}
          </button>
        </div>

        {/* Phase progress */}
        {loading && (
          <div style={card}>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 14px" }}>Running audit phases...</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PHASES.map((ph, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: i < currentPhase ? "#22c55e" : i === currentPhase ? "#6366f1" : "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                    {i < currentPhase ? "✓" : i === currentPhase ? "…" : ""}
                  </div>
                  <span style={{ fontSize: 13, color: i <= currentPhase ? "#e2e8f0" : "#475569" }}>{ph}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 10, padding: 16, color: "#fca5a5", marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Report */}
        {report && (
          <div>
            {/* Executive Summary */}
            <div style={card}>
              <h2 style={sectionTitle}>Executive Summary</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "#cbd5e1", margin: 0 }}>{report.executive_summary}</p>
              {report.auto_identified_competitors && (
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
                  ℹ️ Auto-identified competitors: {report.competitors?.join(", ")}
                </p>
              )}
            </div>

            {/* Sentiment */}
            <div style={card}>
              <h2 style={sectionTitle}>Sentiment Overview</h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                {[["Positive", report.sentiment?.positive, "#22c55e"],
                  ["Negative", report.sentiment?.negative, "#ef4444"],
                  ["Neutral", report.sentiment?.neutral, "#64748b"]].map(([label, val, color]) => (
                  <div key={label} style={{ flex: 1, background: "#0f172a", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color }}>{val}%</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 12, color: "#22c55e", margin: "0 0 6px" }}>POSITIVE THEMES</p>
                  {report.sentiment?.positive_themes?.map((t, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#cbd5e1", padding: "3px 0" }}>✓ {t}</div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 6px" }}>NEGATIVE THEMES</p>
                  {report.sentiment?.negative_themes?.map((t, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#cbd5e1", padding: "3px 0" }}>✗ {t}</div>
                  ))}
                </div>
              </div>
              {report.sentiment?.top_mentions?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>KEY MENTIONS</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.sentiment.top_mentions.map((m, i) => (
                      <div key={i} style={{ background: "#0f172a", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                        <span style={{ color: m.type === "positive" ? "#22c55e" : m.type === "negative" ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{m.platform}</span>
                        <span style={{ color: "#475569" }}> · {m.type} · </span>
                        <span style={{ color: "#94a3b8" }}>{m.summary}</span>
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1", marginLeft: 6, textDecoration: "none" }}>↗</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Platform Scores */}
            <div style={card}>
              <h2 style={sectionTitle}>Platform Reputation Scores</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {report.platform_scores?.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 130, fontSize: 13, color: "#94a3b8", flexShrink: 0 }}>{p.platform}</div>
                    <div style={{ flex: 1, background: "#0f172a", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${p.score * 10}%`, height: "100%", background: scoreColor(p.score), borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 28, fontSize: 14, fontWeight: 700, color: scoreColor(p.score), textAlign: "right" }}>{p.score}</div>
                    <div style={{ fontSize: 12, color: "#475569", flex: 2 }}>{p.justification}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Matrix */}
            {report.competitor_matrix?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Competitive Benchmarking</h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Brand", "Overall", "Reviews", "Social", "News/PR", "Community", "Employer"].map(h => (
                          <th key={h} style={{ textAlign: h === "Brand" ? "left" : "center", padding: "8px 10px", color: "#64748b", borderBottom: "1px solid #334155", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.competitor_matrix?.map((c, i) => (
                        <tr key={i} style={{ background: c.is_primary ? "#1e3a5f20" : "transparent" }}>
                          <td style={{ padding: "9px 10px", color: c.is_primary ? "#818cf8" : "#cbd5e1", fontWeight: c.is_primary ? 600 : 400 }}>
                            {c.name} {c.is_primary && <span style={{ fontSize: 10, color: "#6366f1", background: "#1e1b4b", padding: "1px 5px", borderRadius: 3 }}>PRIMARY</span>}
                          </td>
                          {["overall", "reviews", "social", "news", "community", "employer"].map(k => (
                            <td key={k} style={{ textAlign: "center", padding: "9px 10px", color: scoreColor(c[k]), fontWeight: 600 }}>{c[k]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Risk Register */}
            <div style={card}>
              <h2 style={sectionTitle}>Risk Register</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {report.risks?.map((r, i) => (
                  <div key={i} style={{ background: "#0f172a", borderRadius: 8, padding: 14, borderLeft: `3px solid ${severityColor(r.severity)}` }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, background: severityColor(r.severity) + "22", color: severityColor(r.severity), padding: "2px 8px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase" }}>{r.severity}</span>
                      <span style={{ fontSize: 11, color: "#64748b", padding: "2px 8px", background: "#1e293b", borderRadius: 4 }}>{r.urgency}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 4px" }}>{r.issue}</p>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>→ {r.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div style={card}>
              <h2 style={sectionTitle}>Strategic Roadmap</h2>
              {[["🚨 Immediate (0–30 days)", report.recommendations?.immediate, "#ef4444"],
                ["📅 Short-term (1–3 months)", report.recommendations?.short_term, "#f59e0b"],
                ["🎯 Long-term (3–12 months)", report.recommendations?.long_term, "#22c55e"]].map(([title, items, color]) => (
                <div key={title} style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 13, color, margin: "0 0 10px", fontWeight: 600 }}>{title}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items?.map((rec, i) => (
                      <div key={i} style={{ background: "#0f172a", borderRadius: 8, padding: 14 }}>
                        <p style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, margin: "0 0 4px" }}>{rec.what}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>{rec.why}</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ fontSize: 11, color: impactColor(rec.impact), background: impactColor(rec.impact) + "22", padding: "2px 7px", borderRadius: 4 }}>Impact: {rec.impact}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8", background: "#1e293b", padding: "2px 7px", borderRadius: 4 }}>Effort: {rec.effort}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
