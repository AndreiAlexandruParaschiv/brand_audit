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
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      console.warn(`Tavily search failed (${res.status}):`, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const results = data.results;
    if (!results?.length) return null;

    return results
      .map((r) => `[${r.title}]\n${r.content}`)
      .join("\n\n");
  } catch (e) {
    console.warn("Web search error:", e.message);
    return null;
  }
}
