// lib/search.js
// Web search via Tavily API — returns null if not configured (graceful fallback)

export async function webSearch(query, maxResults = 5) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "advanced",
      }),
    });

    if (!res.ok) {
      console.warn(`Tavily search failed (${res.status}):`, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const raw = data.results;
    if (!raw?.length) return null;

    // Keep only results with a meaningful relevance score; fall back to all if none qualify.
    const MIN_SCORE = 0.4;
    const results = raw.filter((r) => typeof r.score !== "number" || r.score >= MIN_SCORE).length
      ? raw.filter((r) => typeof r.score !== "number" || r.score >= MIN_SCORE)
      : raw;

    return {
      context: results.map((r, i) => `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join("\n\n"),
      sources: results.map((r) => ({
        url: r.url,
        title: r.title,
        score: typeof r.score === "number" ? r.score : null,
      })).filter((s) => !!s.url),
    };
  } catch (e) {
    console.warn("Web search error:", e.message);
    return null;
  }
}
