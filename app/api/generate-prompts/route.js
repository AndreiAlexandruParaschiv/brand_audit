// app/api/generate-prompts/route.js
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";

export async function POST(req) {
  const body = await req.json();
  const { industry, categories } = body;

  if (!industry || !categories?.length) {
    return Response.json({ error: "Industry and categories are required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  const categoryList = categories
    .map((c) => `Category: ${c.name}\n  Topics: ${c.topics.join(", ")}`)
    .join("\n");

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst specializing in search behavior and consumer intent. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `For the industry "${industry}", generate non-branded search prompts that a real user would ask.

These prompts must NOT mention any specific brand name. They should be natural questions someone would type into a search engine or ask an AI assistant when looking for solutions in this space.

Here are the categories and topics to cover:
${categoryList}

Generate exactly 5 prompts per topic. Each prompt should be a different type of query:
1. A "best of" comparison question
2. A specific use-case question
3. A recommendation-seeking question
4. A "how to" or workflow question
5. An alternative/option exploration question

Return this exact JSON structure:
{
  "prompts": [
    { "category": "Category Name", "topic": "topic name", "prompt": "the non-branded question" }
  ]
}`,
    },
  ];

  try {
    const result = await callLLMJSON({ messages, providerConfig, options: { maxTokens: 4096 } });
    return Response.json(result);
  } catch (e) {
    console.error("Generate prompts error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
