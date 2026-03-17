// app/api/brand-audit/route.js  (Next.js App Router)
// Uses OpenAI Responses API with web_search to gather real data

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
Conduct a real off-site brand audit using web search to gather actual, current data.
Search for real reviews, ratings, news articles, social media mentions, and competitor data.
Be specific — cite actual sources, real ratings, and real quotes you find.
If you cannot find data for a platform, say "No significant presence detected" rather than making up numbers.
Always respond with a valid JSON object only — no markdown fences, no preamble.`;

  const userPrompt = `Conduct a comprehensive off-site brand audit for: ${args}

The first value is the primary brand. Comma-separated values after are competitors.
If no competitors were given, identify 2-3 real competitors yourself.

Use web search extensively to gather REAL data:
- Search for "[brand name] reviews" on Trustpilot, G2, Capterra, Google Reviews
- Search for "[brand name] site:reddit.com" for Reddit discussions
- Search for "[brand name] news" for recent press coverage
- Search for "[brand name] Glassdoor" for employer ratings
- Search for "[brand name] site:linkedin.com" for professional mentions
- Search for competitor reviews and comparisons
- Search for "[brand name] vs [competitor]" for direct comparisons

For each data point, use the actual numbers, ratings, and quotes you find in search results.

Return a JSON object with this exact structure:
{
  "brand": "primary brand name",
  "competitors": ["competitor1", "competitor2"],
  "auto_identified_competitors": true or false,
  "executive_summary": "2-3 sentence overall verdict based on real findings",
  "sentiment": {
    "positive": 60,
    "negative": 20,
    "neutral": 20,
    "positive_themes": ["theme1", "theme2", "theme3"],
    "negative_themes": ["theme1", "theme2"],
    "top_mentions": [
      {"platform": "Reddit", "type": "positive", "summary": "brief description with real quote or data point", "url": "source URL if available"},
      {"platform": "Trustpilot", "type": "mixed", "summary": "brief description with actual rating", "url": "source URL if available"},
      {"platform": "LinkedIn", "type": "positive", "summary": "brief description", "url": "source URL if available"}
    ]
  },
  "platform_scores": [
    {"platform": "Twitter/X", "score": 7, "justification": "based on actual findings"},
    {"platform": "LinkedIn", "score": 8, "justification": "based on actual findings"},
    {"platform": "Reddit", "score": 6, "justification": "based on actual findings"},
    {"platform": "Trustpilot", "score": 7, "justification": "based on actual rating found"},
    {"platform": "Google Reviews", "score": 8, "justification": "based on actual rating found"},
    {"platform": "News/PR", "score": 6, "justification": "based on actual news coverage found"},
    {"platform": "YouTube", "score": 5, "justification": "based on actual findings"},
    {"platform": "Glassdoor", "score": 7, "justification": "based on actual rating found"}
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
    {"issue": "description based on real findings", "severity": "high", "urgency": "immediate", "action": "what to do"},
    {"issue": "description based on real findings", "severity": "medium", "urgency": "short-term", "action": "what to do"},
    {"issue": "description based on real findings", "severity": "low", "urgency": "long-term", "action": "what to do"}
  ],
  "recommendations": {
    "immediate": [
      {"what": "action", "why": "reason linked to real finding", "impact": "high", "effort": "low"}
    ],
    "short_term": [
      {"what": "action", "why": "reason linked to real finding", "impact": "high", "effort": "medium"}
    ],
    "long_term": [
      {"what": "action", "why": "reason linked to real finding", "impact": "high", "effort": "high"}
    ]
  }
}`;

  try {
    const endpoint = process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    const res = await fetch(`${endpoint}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: userPrompt,
        tools: [{ type: "web_search_preview" }],
        text: { format: { type: "text" } },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI API error:", JSON.stringify(data));
      return Response.json({ error: data.error?.message || "OpenAI API request failed." }, { status: res.status });
    }

    // Extract text from Responses API output
    let text = "";
    if (data.output) {
      for (const item of data.output) {
        if (item.type === "message" && item.content) {
          for (const block of item.content) {
            if (block.type === "output_text") {
              text += block.text;
            }
          }
        }
      }
    }

    console.log("OpenAI status:", data.status);
    console.log("OpenAI response length:", text.length);

    if (!text) {
      console.error("Empty response from OpenAI. Full data:", JSON.stringify(data).slice(0, 1000));
      return Response.json({ error: "Empty response from OpenAI." }, { status: 502 });
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json(parsed);
  } catch (e) {
    console.error("Brand audit error:", e);
    return Response.json({ error: e.message || "Failed to generate audit." }, { status: 500 });
  }
}
