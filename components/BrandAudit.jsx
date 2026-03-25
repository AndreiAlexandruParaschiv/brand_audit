// components/BrandAudit.jsx
"use client";
import { useState } from "react";

const STEPS = [
  "Brand Discovery",
  "Market Discovery",
  "Generating Prompts",
  "Executing Prompts",
  "Analyzing Share of Voice",
];

export default function BrandAudit() {
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [discovery, setDiscovery] = useState(null);
  const [market, setMarket] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});

  const callAPI = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  const runPipeline = async () => {
    if (!brand.trim()) return;
    setLoading(true);
    setDiscovery(null);
    setMarket(null);
    setPrompts(null);
    setResults(null);
    setAnalysis(null);
    setError(null);
    setExpandedCategories({});
    setCollapsedSections({});

    try {
      // Step 1: Brand Discovery
      setCurrentStep(0);
      const disc = await callAPI("/api/discover", { brand: brand.trim() });
      setDiscovery(disc);

      // Step 2: Market Discovery
      setCurrentStep(1);
      const mkt = await callAPI("/api/market-discovery", {
        industry: disc.industry,
        products: disc.products,
        services: disc.services,
      });
      setMarket(mkt);

      // Step 3: Generate Prompts
      setCurrentStep(2);
      const prm = await callAPI("/api/generate-prompts", {
        industry: disc.industry,
        categories: mkt.categories,
      });
      setPrompts(prm);

      // Step 4: Execute Prompts
      setCurrentStep(3);
      const execResults = await callAPI("/api/execute-prompts", { prompts: prm.prompts });
      setResults(execResults);

      // Step 5: Analyze SoV
      setCurrentStep(4);
      const sov = await callAPI("/api/analyze-sov", {
        brand: brand.trim(),
        results: execResults.results,
      });
      setAnalysis(sov);

      setCurrentStep(5);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isSectionOpen = (key) => !collapsedSections[key];

  const card = { background: "#ffffff", borderRadius: 12, padding: 28, border: "1px solid #e2e8f0", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const sectionTitle = { fontSize: 13, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, margin: 0 };
  const tag = (bg, color) => ({ display: "inline-block", fontSize: 13, padding: "5px 14px", borderRadius: 20, fontWeight: 500, background: bg, color, marginRight: 6, marginBottom: 6 });
  const sovBarColor = (sov) => sov >= 30 ? "#16a34a" : sov >= 15 ? "#d97706" : "#dc2626";
  const subtleText = { color: "#64748b", fontSize: 13 };
  const labelStyle = { display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", background: "#edf2f7", minHeight: "100vh", padding: "32px 24px", color: "#1e293b" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #a0aec0; }
        input:focus { border-color: #93c5fd !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.08) !important; }
      `}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: -0.3 }}>Brand Discovery Flow</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "6px 0 0" }}>Off-site brand visibility, AI share of voice & competitive landscape</p>
        </div>

        {/* Input */}
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Brand Name <span style={{ color: "#ef4444" }}>*</span></label>
            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Adobe, Nike, Notion..." onKeyDown={e => e.key === "Enter" && !loading && runPipeline()} style={{ width: "100%", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "12px 14px", color: "#0f172a", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          </div>
          {loading ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 18px", color: "#64748b", fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="8" cy="8" r="6" stroke="#94a3b8" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/>
              </svg>
              Analyzing...
            </div>
          ) : (
            <button onClick={runPipeline} disabled={!brand.trim()} style={{ background: !brand.trim() ? "#e2e8f0" : "#3b82f6", color: !brand.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 15, fontWeight: 600, cursor: !brand.trim() ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
              Discover Opportunities
            </button>
          )}
        </div>

        {/* Step Progress */}
        {currentStep >= 0 && (
          <div style={card}>
            <p style={{ fontSize: 15, color: "#334155", margin: "0 0 18px", fontWeight: 700 }}>Pipeline Progress</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {STEPS.map((s, i) => {
                const completed = i < currentStep;
                const active = i === currentStep && loading;
                const pending = !completed && !active;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: completed ? "#16a34a" : active ? "#3b82f6" : "#edf2f7",
                      border: pending ? "2px solid #cbd5e1" : "none",
                      boxSizing: "border-box",
                    }}>
                      {completed ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : active ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                          <circle cx="8" cy="8" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                          <path d="M13.5 8a5.5 5.5 0 0 0-5.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{i + 1}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 15, color: pending ? "#94a3b8" : "#1e293b", fontWeight: completed || active ? 600 : 400 }}>{s}</span>
                    {i === 0 && currentStep > 0 && discovery?.webSearchUsed && (
                      <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 6px", marginLeft: 4 }}>web-grounded</span>
                    )}
                    {i === 1 && currentStep > 1 && market?.webSearchUsed && (
                      <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 6px", marginLeft: 4 }}>web-grounded</span>
                    )}
                    {i === 3 && currentStep === 3 && loading && prompts && (
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>({prompts.prompts?.length} prompts)</span>
                    )}
                    {i === 3 && currentStep > 3 && results?.webSearchUsed && (
                      <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 6px", marginLeft: 4 }}>web-grounded</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 16, color: "#dc2626", marginBottom: 20, fontSize: 14 }}>{error}</div>
        )}

        {/* Step 1: Brand Profile */}
        {discovery && (
          <div style={card}>
            <button onClick={() => toggleSection("profile")} style={{ background: "none", border: "none", padding: 0, margin: "0 0 " + (isSectionOpen("profile") ? "18px" : "0"), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <h2 style={sectionTitle}>Brand Profile</h2>
              <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", transform: isSectionOpen("profile") ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
            </button>
            {isSectionOpen("profile") && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <span style={tag("#dbeafe", "#1e40af")}>{discovery.industry}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <p style={{ ...labelStyle, marginBottom: 12 }}>Products</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {discovery.products?.map((p, i) => (
                        <div key={i} style={{ paddingLeft: 14, borderLeft: "2px solid #e2e8f0" }}>
                          <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{p.name}</span>{" "}
                          <span style={{ fontSize: 14, color: "#64748b" }}>{p.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ ...labelStyle, marginBottom: 12 }}>Services</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {discovery.services?.map((s, i) => (
                        <div key={i} style={{ paddingLeft: 14, borderLeft: "2px solid #e2e8f0" }}>
                          <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{s.name}</span>{" "}
                          <span style={{ fontSize: 14, color: "#64748b" }}>{s.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Market Categories & Topics */}
        {market && (
          <div style={card}>
            <button onClick={() => toggleSection("categories")} style={{ background: "none", border: "none", padding: 0, margin: "0 0 " + (isSectionOpen("categories") ? "18px" : "0"), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <h3 style={sectionTitle}>Market Categories & Topics</h3>
              <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", transform: isSectionOpen("categories") ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
            </button>
            {isSectionOpen("categories") && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {market.categories?.map((c, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "18px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>{c.name}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {c.topics?.map((t, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 6 }} />
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Generated Prompts */}
        {prompts && (
          <div style={card}>
            <button onClick={() => toggleSection("prompts")} style={{ background: "none", border: "none", padding: 0, margin: "0 0 " + (isSectionOpen("prompts") ? "18px" : "0"), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <h2 style={sectionTitle}>Generated Prompts <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({prompts.prompts?.length} total)</span></h2>
              <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", transform: isSectionOpen("prompts") ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
            </button>
            {isSectionOpen("prompts") && market?.categories?.map((cat, ci) => {
              const catPrompts = prompts.prompts?.filter(p => p.category === cat.name) || [];
              if (!catPrompts.length) return null;
              const isExpanded = expandedCategories[cat.name];
              // Group prompts by topic
              const topicGroups = {};
              catPrompts.forEach(p => { (topicGroups[p.topic] = topicGroups[p.topic] || []).push(p); });
              return (
                <div key={ci} style={{ marginBottom: 8 }}>
                  <button onClick={() => toggleCategory(cat.name)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", color: "#1e293b", fontSize: 14, cursor: "pointer", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>{cat.name}</strong> <span style={{ color: "#94a3b8", fontWeight: 400 }}>({catPrompts.length} prompts)</span></span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "14px 0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
                      {Object.entries(topicGroups).map(([topic, tPrompts], ti) => (
                        <div key={ti}>
                          <p style={{ fontSize: 11, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, margin: "0 0 8px", paddingLeft: 2 }}>{topic}</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {tPrompts.map((p, pi) => (
                              <div key={pi} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
                                {p.prompt}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 3: Execution Results */}
        {results && (
          <div style={card}>
            <button onClick={() => toggleSection("results")} style={{ background: "none", border: "none", padding: 0, margin: "0 0 " + (isSectionOpen("results") ? "18px" : "0"), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <h2 style={sectionTitle}>Prompt Results <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({results.totalSucceeded}/{results.totalRequested} completed{results.totalFailed > 0 ? `, ${results.totalFailed} failed` : ""})</span></h2>
              <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", transform: isSectionOpen("results") ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
            </button>
            {isSectionOpen("results") && market?.categories?.map((cat, ci) => {
              const catResults = results.results?.filter(r => r.category === cat.name) || [];
              if (!catResults.length) return null;
              const key = `results_${cat.name}`;
              const isExpanded = expandedCategories[key];
              // Group results by topic
              const topicGroups = {};
              catResults.forEach(r => { (topicGroups[r.topic] = topicGroups[r.topic] || []).push(r); });
              return (
                <div key={ci} style={{ marginBottom: 8 }}>
                  <button onClick={() => toggleCategory(key)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", color: "#1e293b", fontSize: 14, cursor: "pointer", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>{cat.name}</strong> <span style={{ color: "#94a3b8", fontWeight: 400 }}>({catResults.length} answers)</span></span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "14px 0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
                      {Object.entries(topicGroups).map(([topic, tResults], ti) => (
                        <div key={ti}>
                          <p style={{ fontSize: 11, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, margin: "0 0 10px", paddingLeft: 2 }}>{topic}</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {tResults.map((r, ri) => (
                              <div key={ri} style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                                <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>Q</span>
                                  <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{r.prompt}</span>
                                </div>
                                <div style={{ padding: "12px 16px 12px 36px" }}>
                                  <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r.answer}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 4: SoV Analysis */}
        {analysis && (
          <div style={card}>
            <button onClick={() => toggleSection("sov")} style={{ background: "none", border: "none", padding: 0, margin: "0 0 " + (isSectionOpen("sov") ? "18px" : "0"), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <h2 style={sectionTitle}>Share of Voice</h2>
              <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", transform: isSectionOpen("sov") ? "rotate(0)" : "rotate(-90deg)" }}>{"\u25BC"}</span>
            </button>
            {isSectionOpen("sov") && (
              <>
                <div style={{ marginBottom: 12, ...subtleText }}>
                  Based on {analysis.totalPrompts} prompts &middot; {analysis.totalMentions} total brand mentions
                </div>

                {/* Overall Rankings */}
                <div style={{ marginBottom: 28 }}>
                  <p style={{ ...labelStyle, marginBottom: 14 }}>Overall Rankings</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.rankings?.map((r, i) => (
                  <div key={i} style={{ background: r.isPrimary ? "#eff6ff" : "#f8fafc", borderRadius: 10, padding: "14px 18px", border: r.isPrimary ? "1px solid #bfdbfe" : "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 28, fontSize: 14, color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>#{i + 1}</div>
                      <div style={{ width: 160, fontSize: 14, color: r.isPrimary ? "#2563eb" : "#1e293b", fontWeight: 600, flexShrink: 0 }}>
                        {r.brand} {r.isPrimary && <span style={{ fontSize: 10, color: "#2563eb", background: "#dbeafe", padding: "2px 6px", borderRadius: 4, marginLeft: 6, border: "1px solid #bfdbfe" }}>YOU</span>}
                      </div>
                      <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 5, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(r.shareOfVoice, 100)}%`, height: "100%", background: sovBarColor(r.shareOfVoice), borderRadius: 5, transition: "width 0.5s ease" }} />
                      </div>
                      <div style={{ width: 60, fontSize: 15, fontWeight: 700, color: sovBarColor(r.shareOfVoice), textAlign: "right" }}>{r.shareOfVoice.toFixed(1)}%</div>
                      <div style={{ width: 70, fontSize: 13, color: "#94a3b8", textAlign: "right" }}>{r.mentions} mentions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            {analysis.categoryBreakdown?.length > 0 && (
              <div>
                <p style={{ ...labelStyle, marginBottom: 14 }}>Category Breakdown</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b", borderBottom: "2px solid #e2e8f0", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Category</th>
                        <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b", borderBottom: "2px solid #e2e8f0", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Top Brands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.categoryBreakdown.map((cb, i) => (
                        <tr key={i}>
                          <td style={{ padding: "12px 12px", color: "#1e293b", fontWeight: 600, verticalAlign: "top", borderBottom: "1px solid #f1f5f9" }}>{cb.category}</td>
                          <td style={{ padding: "12px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {cb.rankings?.slice(0, 5).map((r, j) => (
                                <span key={j} style={tag(r.brand.toLowerCase() === brand.trim().toLowerCase() ? "#dbeafe" : "#f1f5f9", r.brand.toLowerCase() === brand.trim().toLowerCase() ? "#2563eb" : "#475569")}>
                                  {r.brand} {(r.shareOfVoice ?? 0).toFixed(1)}%
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
