// app/api/market-discovery/route.js
// Step 2: Market Discovery — identify market categories & topics based on brand's products/services
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";
import { webSearch } from "../../../lib/search.js";

export async function POST(req) {
  const body = await req.json();
  const { industry, products, services } = body;

  if (!industry) {
    return Response.json({ error: "Industry is required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  const productList = (products || []).map((p) => `- ${p.name}: ${p.description}`).join("\n");
  const serviceList = (services || []).map((s) => `- ${s.name}: ${s.description}`).join("\n");

  // Web search for market landscape
  const searchContext = await webSearch(
    `${industry} market landscape categories trends competitive analysis`
  );

  const searchBlock = searchContext
    ? `\n\nHere are recent web search results about the ${industry} market:\n\n${searchContext}\n\nUse these search results to understand the current market landscape. Categories should reflect the real market, not just this one brand's offerings.`
    : "";

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst specializing in competitive landscapes. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Given a brand in the "${industry}" industry with these offerings:

PRODUCTS:
${productList || "(none identified)"}

SERVICES:
${serviceList || "(none identified)"}
${searchBlock}
Identify the broader MARKET categories and topics that are relevant to this industry — not just what this brand does, but what the entire market covers. This should include areas where competitors may be strong even if this brand is weak.

For each category, provide specific topics that real users would search for when looking for solutions in this space.

IMPORTANT:
- Return at most 5 categories, at most 3 topics per category
- Categories should represent the MARKET landscape, not just this brand's product lines
- Include categories where competitors might dominate
- Topics should be specific enough to generate search queries (e.g., "photo retouching and skin correction" not just "editing")

Return this exact JSON structure:
{
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
    result.webSearchUsed = !!searchContext;
    return Response.json(result);
  } catch (e) {
    console.error("Market discovery error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
