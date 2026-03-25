// components/BrandAudit.jsx
"use client";
import { useState } from "react";

const STEPS = [
  "Brand Discovery",
  "Generating Prompts",
  "Executing Prompts",
  "Analyzing Share of Voice",
];

export default function BrandAudit() {
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [discovery, setDiscovery] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Provider settings (same localStorage pattern as before)
  const [provider, setProvider] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("audit_provider") || "openai";
    return "openai";
  });
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("audit_api_key") || "";
    return "";
  });
  const [azureEndpoint, setAzureEndpoint] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("audit_azure_endpoint") || "";
    return "";
  });
  const [azureDeployment, setAzureDeployment] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("audit_azure_deployment") || "gpt-4o";
    return "gpt-4o";
  });

  const saveProvider = (val) => { setProvider(val); if (typeof window !== "undefined") localStorage.setItem("audit_provider", val); };
  const saveApiKey = (val) => { setApiKey(val); if (typeof window !== "undefined") { if (val.trim()) localStorage.setItem("audit_api_key", val.trim()); else localStorage.removeItem("audit_api_key"); } };
  const saveAzureEndpoint = (val) => { setAzureEndpoint(val); if (typeof window !== "undefined") { if (val.trim()) localStorage.setItem("audit_azure_endpoint", val.trim()); else localStorage.removeItem("audit_azure_endpoint"); } };
  const saveAzureDeployment = (val) => { setAzureDeployment(val); if (typeof window !== "undefined") localStorage.setItem("audit_azure_deployment", val); };

  const providerConfig = () => ({
    apiKey: apiKey.trim() || undefined,
    provider,
    ...(provider === "azure" ? {
      azureEndpoint: azureEndpoint.trim() || undefined,
      azureDeployment: azureDeployment.trim() || undefined,
    } : {}),
  });

  const callAPI = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...providerConfig() }),
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
    setPrompts(null);
    setResults(null);
    setAnalysis(null);
    setError(null);
    setExpandedCategories({});

    try {
      // Step 1: Discover
      setCurrentStep(0);
      const disc = await callAPI("/api/discover", { brand: brand.trim() });
      setDiscovery(disc);

      // Step 2: Generate Prompts
      setCurrentStep(1);
      const prm = await callAPI("/api/generate-prompts", {
        industry: disc.industry,
        categories: disc.categories,
      });
      setPrompts(prm);

      // Step 3: Execute Prompts
      setCurrentStep(2);
      const execResults = await callAPI("/api/execute-prompts", { prompts: prm.prompts });
      setResults(execResults);

      // Step 4: Analyze SoV
      setCurrentStep(3);
      const sov = await callAPI("/api/analyze-sov", {
        brand: brand.trim(),
        results: execResults.results,
      });
      setAnalysis(sov);

      setCurrentStep(4); // all done
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Styles
  const card = { background: "#141c2e", borderRadius: 14, padding: 28, border: "1px solid #1e293b", marginBottom: 24 };
  const sectionTitle = { fontSize: 17, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, margin: "0 0 20px" };
  const tag = (bg, color) => ({ display: "inline-block", fontSize: 12, padding: "3px 10px", borderRadius: 5, fontWeight: 600, background: bg, color, marginRight: 6, marginBottom: 6 });
  const sovBarColor = (sov) => sov >= 30 ? "#22c55e" : sov >= 15 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#0a0f1a", minHeight: "100vh", padding: "32px 24px", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", margin: 0 }}>AI Share of Voice</h1>
            <p style={{ color: "#8892a8", marginTop: 8, fontSize: 15 }}>Discover how AI recommends your brand vs competitors</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: apiKey.trim() ? "#1e3a2e" : "#1e293b", border: `1px solid ${apiKey.trim() ? "#22c55e44" : "#334155"}`, borderRadius: 8, padding: "8px 14px", color: apiKey.trim() ? "#22c55e" : "#94a3b8", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
            {apiKey.trim() ? `${provider === "azure" ? "Azure" : "OpenAI"} Key Set` : "Settings"}
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 18, border: "1px solid #334155", marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>PROVIDER</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["openai", "OpenAI"], ["azure", "Azure OpenAI"]].map(([val, label]) => (
                  <button key={val} onClick={() => saveProvider(val)} style={{ background: provider === val ? "#6366f1" : "#0f172a", border: `1px solid ${provider === val ? "#6366f1" : "#334155"}`, borderRadius: 8, padding: "8px 16px", color: provider === val ? "#fff" : "#94a3b8", fontSize: 13, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                {provider === "azure" ? "AZURE API KEY" : "OPENAI API KEY"} <span style={{ color: "#475569" }}>(stored in your browser only)</span>
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="password" value={apiKey} onChange={e => saveApiKey(e.target.value)} placeholder={provider === "azure" ? "Your Azure OpenAI key..." : "sk-proj-..."} style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "monospace" }} />
                {apiKey.trim() && <button onClick={() => saveApiKey("")} style={{ background: "#450a0a", border: "1px solid #dc262644", borderRadius: 8, padding: "8px 14px", color: "#fca5a5", fontSize: 12, cursor: "pointer" }}>Clear</button>}
              </div>
              <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0" }}>Your key is saved in localStorage and sent only to this app's backend.</p>
            </div>
            {provider === "azure" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>AZURE ENDPOINT</label>
                <input value={azureEndpoint} onChange={e => saveAzureEndpoint(e.target.value)} placeholder="https://your-resource.openai.azure.com" style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>DEPLOYMENT NAME</label>
                  <input value={azureDeployment} onChange={e => saveAzureDeployment(e.target.value)} placeholder="gpt-4o" style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>BRAND NAME *</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Adobe, Nike, Notion..." onKeyDown={e => e.key === "Enter" && !loading && runPipeline()} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={runPipeline} disabled={loading || !brand.trim()} style={{ background: loading || !brand.trim() ? "#334155" : "#6366f1", color: loading || !brand.trim() ? "#64748b" : "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 15, fontWeight: 600, cursor: loading || !brand.trim() ? "not-allowed" : "pointer" }}>
            {loading ? "Analyzing..." : "Run SoV Analysis"}
          </button>
        </div>

        {/* Step Progress */}
        {currentStep >= 0 && (
          <div style={card}>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 14px" }}>Pipeline Progress</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < currentStep ? "#22c55e" : i === currentStep && loading ? "#6366f1" : "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#fff" }}>
                    {i < currentStep ? "\u2713" : i === currentStep && loading ? "\u2026" : ""}
                  </div>
                  <span style={{ fontSize: 13, color: i <= currentStep ? "#e2e8f0" : "#475569" }}>{s}</span>
                  {i === 2 && currentStep === 2 && loading && prompts && (
                    <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>({prompts.prompts?.length} prompts)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 10, padding: 16, color: "#fca5a5", marginBottom: 20 }}>{error}</div>
        )}

        {/* Step 1: Discovery Results */}
        {discovery && (
          <div style={card}>
            <h2 style={sectionTitle}>Brand Profile</h2>
            <div style={{ marginBottom: 16 }}>
              <span style={tag("#1e1b4b", "#a5b4fc")}>{discovery.industry}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Products</p>
                {discovery.products?.map((p, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>{p.description}</span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Services</p>
                {discovery.services?.map((s, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Categories & Topics</p>
              {discovery.categories?.map((c, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600 }}>{c.name}: </span>
                  {c.topics?.map((t, j) => (
                    <span key={j} style={tag("#0f172a", "#94a3b8")}>{t}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Generated Prompts */}
        {prompts && (
          <div style={card}>
            <h2 style={sectionTitle}>Generated Prompts <span style={{ fontSize: 13, color: "#64748b", fontWeight: 400, textTransform: "none" }}>({prompts.prompts?.length} total)</span></h2>
            {discovery?.categories?.map((cat, ci) => {
              const catPrompts = prompts.prompts?.filter(p => p.category === cat.name) || [];
              if (!catPrompts.length) return null;
              const isExpanded = expandedCategories[cat.name];
              return (
                <div key={ci} style={{ marginBottom: 12 }}>
                  <button onClick={() => toggleCategory(cat.name)} style={{ background: "#0d1424", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 16px", color: "#e2e8f0", fontSize: 14, cursor: "pointer", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>{cat.name}</strong> <span style={{ color: "#64748b" }}>({catPrompts.length} prompts)</span></span>
                    <span style={{ color: "#64748b" }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {catPrompts.map((p, pi) => (
                        <div key={pi} style={{ fontSize: 14, color: "#b0bac9", lineHeight: 1.6 }}>
                          <span style={{ color: "#475569", marginRight: 8 }}>{p.topic}</span> {p.prompt}
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
            <h2 style={sectionTitle}>Prompt Results <span style={{ fontSize: 13, color: "#64748b", fontWeight: 400, textTransform: "none" }}>({results.totalSucceeded}/{results.totalRequested} completed{results.totalFailed > 0 ? `, ${results.totalFailed} failed` : ""})</span></h2>
            {discovery?.categories?.map((cat, ci) => {
              const catResults = results.results?.filter(r => r.category === cat.name) || [];
              if (!catResults.length) return null;
              const key = `results_${cat.name}`;
              const isExpanded = expandedCategories[key];
              return (
                <div key={ci} style={{ marginBottom: 12 }}>
                  <button onClick={() => toggleCategory(key)} style={{ background: "#0d1424", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 16px", color: "#e2e8f0", fontSize: 14, cursor: "pointer", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span><strong>{cat.name}</strong> <span style={{ color: "#64748b" }}>({catResults.length} answers)</span></span>
                    <span style={{ color: "#64748b" }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                      {catResults.map((r, ri) => (
                        <div key={ri} style={{ background: "#0d1424", borderRadius: 8, padding: "12px 16px" }}>
                          <p style={{ fontSize: 14, color: "#818cf8", margin: "0 0 8px", fontWeight: 600 }}>{r.prompt}</p>
                          <p style={{ fontSize: 14, color: "#b0bac9", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.answer}</p>
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
            <h2 style={sectionTitle}>Share of Voice</h2>
            <div style={{ marginBottom: 8, fontSize: 13, color: "#64748b" }}>
              Based on {analysis.totalPrompts} prompts | {analysis.totalMentions} total brand mentions
            </div>

            {/* Overall Rankings */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Overall Rankings</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analysis.rankings?.map((r, i) => (
                  <div key={i} style={{ background: r.isPrimary ? "#1e3a5f22" : "#0d1424", borderRadius: 10, padding: "14px 20px", border: r.isPrimary ? "1px solid #6366f133" : "1px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 28, fontSize: 14, color: "#64748b", fontWeight: 700, flexShrink: 0 }}>#{i + 1}</div>
                      <div style={{ width: 160, fontSize: 15, color: r.isPrimary ? "#a5b4fc" : "#e2e8f0", fontWeight: 600, flexShrink: 0 }}>
                        {r.brand} {r.isPrimary && <span style={{ fontSize: 10, color: "#818cf8", background: "#1e1b4b", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>YOU</span>}
                      </div>
                      <div style={{ flex: 1, background: "#1a2236", borderRadius: 5, height: 10, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(r.shareOfVoice, 100)}%`, height: "100%", background: sovBarColor(r.shareOfVoice), borderRadius: 5, transition: "width 0.5s ease" }} />
                      </div>
                      <div style={{ width: 60, fontSize: 15, fontWeight: 700, color: sovBarColor(r.shareOfVoice), textAlign: "right" }}>{r.shareOfVoice.toFixed(1)}%</div>
                      <div style={{ width: 60, fontSize: 13, color: "#64748b", textAlign: "right" }}>{r.mentions} mentions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            {analysis.categoryBreakdown?.length > 0 && (
              <div>
                <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Category Breakdown</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 12px", color: "#8892a8", borderBottom: "1px solid #1e293b", fontWeight: 600 }}>Category</th>
                        <th style={{ textAlign: "left", padding: "10px 12px", color: "#8892a8", borderBottom: "1px solid #1e293b", fontWeight: 600 }}>Top Brands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.categoryBreakdown.map((cb, i) => (
                        <tr key={i}>
                          <td style={{ padding: "12px 12px", color: "#e2e8f0", fontWeight: 600, verticalAlign: "top", borderBottom: "1px solid #1e293b12" }}>{cb.category}</td>
                          <td style={{ padding: "12px 12px", borderBottom: "1px solid #1e293b12" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {cb.rankings?.slice(0, 5).map((r, j) => (
                                <span key={j} style={tag(r.brand.toLowerCase() === brand.trim().toLowerCase() ? "#1e1b4b" : "#0f172a", r.brand.toLowerCase() === brand.trim().toLowerCase() ? "#a5b4fc" : "#94a3b8")}>
                                  {r.brand} {r.shareOfVoice.toFixed(0)}%
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
          </div>
        )}
      </div>
    </div>
  );
}
