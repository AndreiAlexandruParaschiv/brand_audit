// app/api/analyze-sov/route.js
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";

function buildSovMessages(brand, results) {
  const answersSummary = results
    .map(
      (r, i) =>
        `[${i + 1}] Category: ${r.category} | Topic: ${r.topic}\nQ: ${r.prompt}\nA: ${r.answer}`
    )
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are a brand intelligence analyst specializing in AI Share of Voice measurement. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `Analyze the following ${results.length} AI-generated answers to non-branded industry prompts. Count how many times each brand/product is mentioned or recommended across all answers.

The primary brand we are auditing is: "${brand}"

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
  "brand": "${brand}",
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
}

export async function POST(req) {
  const body = await req.json();
  const { brand, results } = body;

  if (!brand?.trim() || !results?.length) {
    return Response.json({ error: "Brand and results are required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);
  const trimmedBrand = brand.trim();

  const resultsByProvider = {};
  for (const r of results) {
    const key = r.provider || "unknown";
    (resultsByProvider[key] = resultsByProvider[key] || []).push(r);
  }

  const providerKeys = Object.keys(resultsByProvider);

  try {
    const settled = await Promise.allSettled(
      providerKeys.map(async (providerKey) => {
        const providerResults = resultsByProvider[providerKey];
        const messages = buildSovMessages(trimmedBrand, providerResults);
        const analysis = await callLLMJSON({
          messages,
          providerConfig,
          options: { maxTokens: 16384 },
        });
        return { providerKey, analysis };
      })
    );

    const providerAnalyses = {};
    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        console.error("SoV analysis failed for a provider:", outcome.reason);
        continue;
      }
      const { providerKey, analysis } = outcome.value;
      providerAnalyses[providerKey] = analysis;
    }

    return Response.json({ providerAnalyses });
  } catch (e) {
    console.error("Analyze SoV error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
