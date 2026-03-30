// app/api/discover/route.js
// Step 1: Brand Discovery — identify products, services, and industry
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";
import { webSearch } from "../../../lib/search.js";

export async function POST(req) {
  const body = await req.json();
  const { brand, region } = body;
  const regionCode = region || "US";

  if (!brand?.trim()) {
    return Response.json({ error: "Brand name is required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  // Web search for up-to-date brand info, region-specific
  const searchContext = await webSearch(`${brand.trim()} company products services overview ${regionCode}`);

  const searchBlock = searchContext
    ? `\n\nHere are recent web search results about "${brand.trim()}":\n\n${searchContext}\n\nUse these search results to provide accurate, up-to-date information. Prefer facts from the search results over your training data when they conflict.`
    : "";

  const regionInstruction = regionCode !== "Global"
    ? `Focus specifically on the ${regionCode} market — products, services, and positioning relevant to customers in ${regionCode}.`
    : "Consider the brand's global presence across all markets.";

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze the brand "${brand.trim()}" in the ${regionCode} market and identify:
1. The industry it operates in
2. Its main products available in ${regionCode} (with brief descriptions)
3. Its main services available in ${regionCode} (with brief descriptions)

${regionInstruction}
${searchBlock}
Return this exact JSON structure:
{
  "brand": "${brand.trim()}",
  "industry": "industry name",
  "products": [
    { "name": "Product Name", "description": "Brief description" }
  ],
  "services": [
    { "name": "Service Name", "description": "Brief description" }
  ]
}`,
    },
  ];

  try {
    const result = await callLLMJSON({ messages, providerConfig, options: { maxTokens: 2048 } });
    result.webSearchUsed = !!searchContext;
    return Response.json(result);
  } catch (e) {
    console.error("Discover error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
