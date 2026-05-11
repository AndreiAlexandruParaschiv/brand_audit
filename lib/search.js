// lib/search.js
// Web search via Tavily API — returns null if not configured (graceful fallback).
// Supports a backup API key: when the primary key returns a hard failure
// (auth / quota / non-2xx / network), the backup is automatically retried so
// audits don't stop mid-run when the primary's monthly quota is exhausted.

const MIN_SCORE = 0.4;

// Inner: one Tavily attempt with a specific key. Returns the processed
// {context, sources} shape on success, or a {error} sentinel on failure
// so the caller can decide whether to retry with the backup key.
async function tavilyAttempt(apiKey, query, maxResults, options) {
  const body = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: "advanced",
  };
  if (Array.isArray(options.includeDomains) && options.includeDomains.length) {
    body.include_domains = options.includeDomains;
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: { status: res.status, message: text } };
    }

    const data = await res.json();
    const raw = data.results;
    if (!raw?.length) return { ok: true, empty: true, sources: [], context: "" };

    const filtered = raw.filter((r) => typeof r.score !== "number" || r.score >= MIN_SCORE);
    const results = filtered.length ? filtered : raw;

    return {
      ok: true,
      empty: false,
      context: results.map((r, i) => `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join("\n\n"),
      sources: results.map((r) => ({
        url: r.url,
        title: r.title,
        score: typeof r.score === "number" ? r.score : null,
      })).filter((s) => !!s.url),
    };
  } catch (e) {
    return { error: { status: 0, message: e.message } };
  }
}

export async function webSearch(query, maxResults = 5, options = {}) {
  const primaryKey = process.env.TAVILY_API_KEY;
  const backupKey = process.env.TAVILY_API_KEY_BACKUP;

  if (!primaryKey && !backupKey) return null;

  // Try primary first if configured. Any hard failure cascades to backup.
  if (primaryKey) {
    const r = await tavilyAttempt(primaryKey, query, maxResults, options);
    if (r.ok) {
      if (r.empty) return null;
      return { context: r.context, sources: r.sources };
    }
    console.warn(`Tavily primary failed (${r.error.status}): ${r.error.message?.slice(0, 200) || ""}`);
  }

  // Fallback path: try backup key if available.
  if (backupKey) {
    const r = await tavilyAttempt(backupKey, query, maxResults, options);
    if (r.ok) {
      if (r.empty) return null;
      console.info("Tavily: served from backup key");
      return { context: r.context, sources: r.sources };
    }
    console.warn(`Tavily backup failed (${r.error.status}): ${r.error.message?.slice(0, 200) || ""}`);
  }

  return null;
}
