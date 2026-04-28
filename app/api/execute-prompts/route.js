// app/api/execute-prompts/route.js
import { callLLM, extractProviderConfig } from "../../../lib/llm.js";
import { webSearch } from "../../../lib/search.js";

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
        // Web search for each prompt to ground answers in real data
        const searchResult = await webSearch(p.prompt, 5);
        const searchContext = searchResult?.context;
        const sources = searchResult?.sources ?? [];
        if (searchContext) searchCount++;

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
