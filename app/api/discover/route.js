// app/api/discover/route.js
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";

export async function POST(req) {
  const body = await req.json();
  const { brand } = body;

  if (!brand?.trim()) {
    return Response.json({ error: "Brand name is required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze the brand "${brand.trim()}" and identify:
1. The industry it operates in
2. Its main products (with brief descriptions)
3. Its main services (with brief descriptions)
4. Organize its offerings into categories, each with specific topics that users might search for

IMPORTANT: Return at most 5 categories, and at most 3 topics per category. Topics should be specific enough to generate search queries about (e.g., "photo retouching" not just "editing").

Return this exact JSON structure:
{
  "brand": "${brand.trim()}",
  "industry": "industry name",
  "products": [
    { "name": "Product Name", "description": "Brief description" }
  ],
  "services": [
    { "name": "Service Name", "description": "Brief description" }
  ],
  "categories": [
    {
      "name": "Category Name",
      "topics": ["specific topic 1", "specific topic 2", "specific topic 3"]
    }
  ]
}`,
    },
  ];

  try {
    const result = await callLLMJSON({ messages, providerConfig, options: { maxTokens: 2048 } });
    return Response.json(result);
  } catch (e) {
    console.error("Discover error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
