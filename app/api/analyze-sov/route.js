// app/api/analyze-sov/route.js
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";

export async function POST(req) {
  const body = await req.json();
  const { brand, results } = body;

  if (!brand?.trim() || !results?.length) {
    return Response.json({ error: "Brand and results are required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  // Build a compact summary of all answers for the LLM to analyze
  const answersSummary = results
    .map(
      (r, i) =>
        `[${i + 1}] Category: ${r.category} | Topic: ${r.topic}\nQ: ${r.prompt}\nA: ${r.answer}`
    )
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content: `You are a brand intelligence analyst specializing in AI Share of Voice measurement. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze the following ${results.length} AI-generated answers to non-branded industry prompts. Count how many times each brand/product is mentioned or recommended across all answers.

The primary brand we are auditing is: "${brand.trim()}"

Here are all the prompt-answer pairs:
${answersSummary}

Compute Share of Voice (SoV) as: (brand_mentions / total_all_brand_mentions) * 100

Instructions:
- Count each distinct mention of a brand in an answer (if "Adobe Photoshop" and "Adobe Illustrator" both appear, that is 2 mentions for Adobe)
- Group sub-brands under their parent company (e.g., "Photoshop" counts as "Adobe")
- Include only the TOP 10 brands by mention count in the overall rankings (skip the rest)
- Sort rankings by shareOfVoice descending
- Mark the primary brand with isPrimary: true
- Provide a category-level breakdown showing SoV per category — include only TOP 5 brands per category
- shareOfVoice values must be decimal numbers (e.g., 25.5)
- Keep the response CONCISE — do not include brands with very few mentions

Return this exact JSON structure:
{
  "brand": "${brand.trim()}",
  "totalPrompts": ${results.length},
  "totalMentions": <total mentions across all brands>,
  "rankings": [
    { "brand": "Brand Name", "mentions": <count>, "shareOfVoice": <percentage>, "isPrimary": true/false }
  ],
  "categoryBreakdown": [
    {
      "category": "Category Name",
      "rankings": [
        { "brand": "Brand Name", "mentions": <count>, "shareOfVoice": <percentage> }
      ]
    }
  ]
}`,
    },
  ];

  try {
    const result = await callLLMJSON({
      messages,
      providerConfig,
      options: { maxTokens: 16384 },
    });
    return Response.json(result);
  } catch (e) {
    console.error("Analyze SoV error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
