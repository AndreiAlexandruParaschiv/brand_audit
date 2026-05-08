// app/api/execute-prompts/route.js
import { callLLM, extractProviderConfig } from "../../../lib/llm.js";
import { webSearch } from "../../../lib/search.js";

// Ask the LLM to suggest authoritative URLs from its training knowledge.
// This complements Tavily search by surfacing well-known review sites,
// Reddit threads, and YouTube channels that may not score highly enough
// to clear Tavily's relevance filter.
async function suggestSourcesFromLLM(prompt, providerConfig) {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a research assistant. List 6-12 authoritative URLs that would be cited when answering the user's question. Include a mix of: editorial review sites, Reddit threads, YouTube videos/channels, and forum posts. Only include URLs you are confident exist. Return ONLY a JSON array of objects with 'url' and 'title' fields, with no prose, no markdown fences, no other text. Example: [{\"url\":\"https://www.example.com/review\",\"title\":\"Example Review\"}]",
      },
      { role: "user", content: prompt },
    ];
    const text = await callLLM({ messages, providerConfig, options: { maxTokens: 800 } });
    if (!text) return [];
    // Extract first JSON array from the response (defensive against any prose wrap)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.url === "string" && /^https?:\/\//i.test(s.url))
      .map((s) => ({ url: s.url, title: s.title || "", score: null }));
  } catch (e) {
    console.warn("LLM source suggestion failed:", e.message);
    return [];
  }
}

// Dedupe sources by normalized URL (drop scheme/www/query/hash/trailing slash).
function dedupSources(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    if (!s?.url) continue;
    const key = String(s.url)
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export async function POST(req) {
  const body = await req.json();
  const { prompts } = body;

  if (!prompts?.length) {
    return Response.json({ error: "Prompts array is required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);
  const CONCURRENCY = 5;
  const results = [];
  let totalFailed = 0;
  let searchCount = 0;

  // Process prompts in batches of CONCURRENCY
  for (let i = 0; i < prompts.length; i += CONCURRENCY) {
    const batch = prompts.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (p) => {
        // Three parallel Tavily searches: open web, Reddit-only, YouTube-only.
        // Plus one LLM call to surface authoritative URLs from training knowledge.
        const [mainResult, redditResult, youtubeResult, llmSources] = await Promise.all([
          webSearch(p.prompt, 5),
          webSearch(p.prompt, 3, { includeDomains: ["reddit.com"] }),
          webSearch(p.prompt, 3, { includeDomains: ["youtube.com"] }),
          suggestSourcesFromLLM(p.prompt, providerConfig),
        ]);

        // Aggregate context for grounding the answer (Tavily only — LLM-suggested URLs aren't summarized)
        const contextParts = [];
        if (mainResult?.context) contextParts.push(mainResult.context);
        if (redditResult?.context) contextParts.push(`Additional Reddit threads:\n${redditResult.context}`);
        if (youtubeResult?.context) contextParts.push(`Additional YouTube videos:\n${youtubeResult.context}`);
        const searchContext = contextParts.join("\n\n");
        if (searchContext) searchCount++;

        // Aggregate + dedupe all source candidates from all four lookups
        const sources = dedupSources([
          ...(mainResult?.sources ?? []),
          ...(redditResult?.sources ?? []),
          ...(youtubeResult?.sources ?? []),
          ...llmSources,
        ]);

        const systemContent = searchContext
          ? `You are a knowledgeable assistant. Use the following web search results as your primary source of facts:\n\n${searchContext}\n\nAnswer the user's question thoroughly and naturally. Where relevant, reference the source by publication name inline (e.g. "according to Wirecutter" or "Runner's World recommends"). Mention specific brand names, product names, and where to buy. Be helpful and direct.`
          : `You are a knowledgeable assistant. Answer the user's question thoroughly. Mention specific brand names, product names, and where to buy. Be helpful and direct.`;

        const messages = [
          { role: "system", content: systemContent },
          { role: "user", content: p.prompt },
        ];

        const answer = await callLLM({
          messages,
          providerConfig,
          options: { maxTokens: 2048 },
        });

        return {
          category: p.category,
          topic: p.topic,
          prompt: p.prompt,
          answer,
          sources,
        };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        totalFailed++;
        console.error("Prompt execution failed:", r.reason?.message);
      }
    }
  }

  return Response.json({
    results,
    totalRequested: prompts.length,
    totalSucceeded: results.length,
    totalFailed,
    webSearchUsed: searchCount > 0,
    webSearchCount: searchCount,
  });
}
