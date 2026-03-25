// app/api/execute-prompts/route.js
import { callLLM, extractProviderConfig } from "../../../lib/llm.js";

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

  // Process prompts in batches of CONCURRENCY
  for (let i = 0; i < prompts.length; i += CONCURRENCY) {
    const batch = prompts.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (p) => {
        const messages = [
          {
            role: "system",
            content:
              "You are a helpful assistant. Answer the user's question thoroughly, recommending specific tools, products, or services by name. Be specific and mention actual brand names.",
          },
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
  });
}
