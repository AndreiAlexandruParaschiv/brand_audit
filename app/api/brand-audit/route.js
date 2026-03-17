// app/api/brand-audit/route.js  (Next.js App Router)
// For Pages Router, use: pages/api/brand-audit.js  (see note at bottom)

export async function POST(req) {
  const { args } = await req.json();

  if (!args?.trim()) {
    return Response.json({ error: "Brand name is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const systemPrompt = `You are a senior brand strategist and digital reputation analyst.
You will conduct a simulated off-site brand audit using your training knowledge.
Be specific, use plausible data points, and be honest when data is uncertain.
Always respond with a valid JSON object only — no markdown fences, no preamble.`;

  const userPrompt = `Conduct a full off-site brand audit for: ${args}

The first value is the primary brand. Comma-separated values after are competitors.
If no competitors were given, identify 2-3 real competitors yourself.

Return a JSON object with this exact structure:
{
  "brand": "primary brand name",
  "competitors": ["competitor1", "competitor2"],
  "auto_identified_competitors": true or false,
  "executive_summary": "2-3 sentence overall verdict",
  "sentiment": {
    "positive": 60,
    "negative": 20,
    "neutral": 20,
    "positive_themes": ["theme1", "theme2", "theme3"],
    "negative_themes": ["theme1", "theme2"],
    "top_mentions": [
      {"platform": "Reddit", "type": "positive", "summary": "brief description"},
      {"platform": "Trustpilot", "type": "mixed", "summary": "brief description"},
      {"platform": "LinkedIn", "type": "positive", "summary": "brief description"}
    ]
  },
  "platform_scores": [
    {"platform": "Twitter/X", "score": 7, "justification": "one sentence"},
    {"platform": "LinkedIn", "score": 8, "justification": "one sentence"},
    {"platform": "Reddit", "score": 6, "justification": "one sentence"},
    {"platform": "Trustpilot", "score": 7, "justification": "one sentence"},
    {"platform": "Google Reviews", "score": 8, "justification": "one sentence"},
    {"platform": "News/PR", "score": 6, "justification": "one sentence"},
    {"platform": "YouTube", "score": 5, "justification": "one sentence"},
    {"platform": "Glassdoor", "score": 7, "justification": "one sentence"}
  ],
  "competitor_matrix": [
    {
      "name": "brand name",
      "is_primary": true,
      "overall": 7,
      "reviews": 8,
      "social": 7,
      "news": 6,
      "community": 7,
      "employer": 7
    }
  ],
  "risks": [
    {"issue": "description", "severity": "high", "urgency": "immediate", "action": "what to do"},
    {"issue": "description", "severity": "medium", "urgency": "short-term", "action": "what to do"},
    {"issue": "description", "severity": "low", "urgency": "long-term", "action": "what to do"}
  ],
  "recommendations": {
    "immediate": [
      {"what": "action", "why": "reason", "impact": "high", "effort": "low"}
    ],
    "short_term": [
      {"what": "action", "why": "reason", "impact": "high", "effort": "medium"}
    ],
    "long_term": [
      {"what": "action", "why": "reason", "impact": "high", "effort": "high"}
    ]
  }
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json(parsed);
  } catch (e) {
    console.error("Brand audit error:", e);
    return Response.json({ error: "Failed to generate audit." }, { status: 500 });
  }
}

/* ─── Pages Router alternative ──────────────────────────────────────────────
   If you're using pages/api/brand-audit.js instead, replace the export with:

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { args } = req.body;
  // ... same logic above ...
  return res.status(200).json(parsed);
}
──────────────────────────────────────────────────────────────────────────── */
