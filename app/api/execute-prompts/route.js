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
        const searchContext = await webSearch(p.prompt, 3);
        if (searchContext) searchCount++;

        const systemContent = searchContext
          ? `You are a helpful assistant. Use the following web search results as your primary source:\n\n${searchContext}\n\nBased on these results and your knowledge, answer the user's question thoroughly. Recommend specific tools, products, or services by name. Be specific and mention actual brand names.`
          : "You are a helpful assistant. Answer the user's question thoroughly, recommending specific tools, products, or services by name. Be specific and mention actual brand names.";

        const messages = [
          { role: "system", content: systemContent },
          { role: "user", content: p.prompt },
        ];

        const answer = await callLLM({
          messages,
          providerConfig,
          options: { maxTokens: 1024 },
        });

        return {
          category: p.category,
          topic: p.topic,
          prompt: p.prompt,
          answer,
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
