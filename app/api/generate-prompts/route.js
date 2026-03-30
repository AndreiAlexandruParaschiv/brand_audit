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

  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" });

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst. The current date is ${currentDate}. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `For the industry "${industry}", generate short, natural questions that someone would ask an AI assistant or search engine.

RULES:
- Do NOT mention any specific brand name
- Keep each prompt SHORT — one sentence, under 15 words ideally
- Write as simple, direct questions — not long paragraphs
- Every prompt MUST end with a question mark (?)
- Mix question styles: "what is the best...?", "which ... has the best...?", "what are the top ... for ...?", etc.
- Do not reference any year

Here are the categories and topics to cover:
${categoryList}

Generate exactly 3 prompts per topic.

Good examples:
- "what is the best SUV on the market?"
- "which car manufacturer has the best comfort quality?"
- "what is the best photo editing software for professionals?"
- "what are the top project management tools for small teams?"
- "what video editor do most YouTubers use?"

Return this exact JSON structure:
{
  "prompts": [
    { "category": "Category Name", "topic": "topic name", "prompt": "the short question" }
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
