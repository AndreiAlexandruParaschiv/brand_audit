// app/api/market-discovery/route.js
// Step 2: Market Discovery — identify market categories & topics based on brand's products/services
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";
import { webSearch } from "../../../lib/search.js";

export async function POST(req) {
  const body = await req.json();
  const { industry, products, services, region } = body;
  const regionCode = region || "US";

  if (!industry) {
    return Response.json({ error: "Industry is required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  const productList = (products || []).map((p) => `- ${p.name}: ${p.description}`).join("\n");
  const serviceList = (services || []).map((s) => `- ${s.name}: ${s.description}`).join("\n");

  // Web search for market landscape, region-specific
  const searchContext = await webSearch(
    `${industry} market landscape categories trends competitive analysis ${regionCode}`
  );

  const searchBlock = searchContext
    ? `\n\nHere are recent web search results about the ${industry} market in ${regionCode}:\n\n${searchContext}\n\nUse these search results to understand the current market landscape. Categories should reflect the real market, not just this one brand's offerings.`
    : "";

  const regionInstruction = regionCode !== "Global"
    ? `Focus on the ${regionCode} market — include competitors and categories relevant to the ${regionCode} region specifically.`
    : "Consider the global market landscape across all regions.";

  const messages = [
    {
      role: "system",
      content: `You are a market research analyst specializing in competitive landscapes. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Given a brand in the "${industry}" industry operating in the ${regionCode} market with these offerings:

PRODUCTS:
${productList || "(none identified)"}

SERVICES:
${serviceList || "(none identified)"}
${searchBlock}
Identify the broader MARKET categories and sub-topics relevant to this industry in the ${regionCode} market — not just what this brand does, but what the entire market covers. ${regionInstruction}

IMPORTANT:
- Return at most 5 categories, at most 3 topics per category
- Categories are the main market segments (e.g., "Performance Athletic Footwear", "Creative Design & Image Editing Software")
- Topics are SUB-CATEGORIES within each category — short noun phrases, NOT questions or prompts (e.g., "Marathon Running Shoes", "Trail Running Footwear", "Photo Retouching & Compositing", "Vector Illustration & Branding")
- Topics should be 2-5 words, written as category labels, not as search queries
- Include categories where competitors in ${regionCode} might dominate

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
