// app/api/brand-audit/route.js  (Next.js App Router)
// Supports both standard OpenAI (with web search) and Azure OpenAI

export async function POST(req) {
  const { args, apiKey: userApiKey, provider: userProvider, azureEndpoint: userAzureEndpoint, azureDeployment: userAzureDeployment, azureApiVersion: userAzureApiVersion } = await req.json();

  if (!args?.trim()) {
    return Response.json({ error: "Brand name is required." }, { status: 400 });
  }

  // Determine provider: user choice > env detection > default
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_KEY;
  const provider = userProvider || (azureEndpoint && azureKey ? "azure" : "openai");

  let apiKey;
  if (provider === "azure") {
    apiKey = userApiKey?.trim() || azureKey;
  } else {
    apiKey = userApiKey?.trim() || process.env.OPENAI_API_KEY;
  }

  if (!apiKey) {
    return Response.json({ error: "No API key available. Please enter your API key in the settings panel." }, { status: 400 });
  }

  const systemPrompt = `You are a senior brand strategist and digital reputation analyst with 15+ years of experience.
You produce extremely thorough, data-rich brand audits. Be specific and detailed — cite actual platform ratings, review counts, specific news stories, known controversies, real campaign names, and concrete data points.
If you don't have data for a platform, say "No significant presence detected" rather than fabricating numbers.
Always respond with a valid JSON object only — no markdown fences, no preamble.
Your analysis must be COMPREHENSIVE — not surface-level. Executives will read this.`;

  const userPrompt = `Conduct an extremely thorough and comprehensive off-site brand audit for: ${args}

The first value is the primary brand. Comma-separated values after are competitors.
IMPORTANT: Only use the competitors explicitly provided. Do NOT add extra competitors beyond what was given.
If and ONLY if no competitors were provided at all, identify 2-3 real competitors yourself and set "auto_identified_competitors" to true.

You MUST analyze each of these platforms in depth:
- Trustpilot: actual star rating, number of reviews, trend direction, common praise/complaints
- Google Reviews: star rating, review volume, response patterns from the brand
- Reddit: specific subreddits where the brand is discussed, common threads, sentiment
- Twitter/X: brand presence, engagement levels, viral moments, crisis history
- LinkedIn: company page followers, employee advocacy, B2B perception, thought leadership
- YouTube: official channel subscribers, third-party review videos, comment sentiment
- Glassdoor: overall rating, CEO approval %, "recommend to a friend" %, top pros and cons
- News/PR: specific recent stories (last 12 months), tone of coverage, major events
- G2/Capterra (if B2B/SaaS): category ranking, satisfaction score
- Instagram/TikTok: follower count, engagement rate, UGC presence

For EACH platform score justification, include at least one specific data point (e.g., "4.2/5 stars from 12,000 reviews" or "discussed in r/sneakers with mostly positive sentiment").

For top_mentions, include at least 5-6 mentions across different platforms with specific details.

For risks, identify at least 5 specific risks with detailed descriptions referencing actual findings.

For recommendations, provide at least 3 items per time horizon (immediate, short_term, long_term) with specific, actionable steps tied to findings.

For the competitor_matrix, include the primary brand PLUS each competitor with differentiated scores and reasoning.

Return a JSON object with this exact structure:
{
  "brand": "primary brand name",
  "competitors": ["only the ones explicitly provided"],
  "auto_identified_competitors": false,
  "executive_summary": "3-4 sentence comprehensive verdict covering brand health, biggest strength, biggest risk, and competitive position",
  "sentiment": {
    "positive": 60,
    "negative": 20,
    "neutral": 20,
    "positive_themes": ["at least 4-5 specific themes"],
    "negative_themes": ["at least 3-4 specific themes"],
    "top_mentions": [
      {"platform": "platform name", "type": "positive|negative|neutral|mixed", "summary": "specific description with actual data point or quote", "url": "real URL if known"},
      {"platform": "...", "type": "...", "summary": "include at least 5-6 mentions total", "url": "..."}
    ]
  },
  "platform_scores": [
    {"platform": "Twitter/X", "score": 7, "justification": "detailed justification with specific data point"},
    {"platform": "LinkedIn", "score": 8, "justification": "detailed justification with specific data point"},
    {"platform": "Reddit", "score": 6, "justification": "detailed justification with specific data point"},
    {"platform": "Trustpilot", "score": 7, "justification": "detailed justification with actual rating"},
    {"platform": "Google Reviews", "score": 8, "justification": "detailed justification with actual rating"},
    {"platform": "News/PR", "score": 6, "justification": "detailed justification with specific stories"},
    {"platform": "YouTube", "score": 5, "justification": "detailed justification with specific data point"},
    {"platform": "Glassdoor", "score": 7, "justification": "detailed justification with actual rating"},
    {"platform": "Instagram", "score": 7, "justification": "detailed justification with follower/engagement data"},
    {"platform": "TikTok", "score": 6, "justification": "detailed justification with specific data point"}
  ],
  "competitor_matrix": [
    {
      "name": "primary brand",
      "is_primary": true,
      "overall": 7,
      "reviews": 8,
      "social": 7,
      "news": 6,
      "community": 7,
      "employer": 7
    },
    {
      "name": "each competitor gets its own entry",
      "is_primary": false,
      "overall": 6,
      "reviews": 7,
      "social": 6,
      "news": 5,
      "community": 6,
      "employer": 6
    }
  ],
  "risks": [
    {"issue": "specific risk description referencing actual finding", "severity": "critical|high|medium|low", "urgency": "immediate|short-term|long-term", "action": "specific actionable recommendation"},
    {"issue": "provide at least 5 risks total", "severity": "...", "urgency": "...", "action": "..."}
  ],
  "recommendations": {
    "immediate": [
      {"what": "specific action step", "why": "tied to specific finding from audit", "impact": "high|medium|low", "effort": "high|medium|low"},
      {"what": "at least 3 items per category", "why": "...", "impact": "...", "effort": "..."}
    ],
    "short_term": [
      {"what": "specific action step", "why": "tied to specific finding", "impact": "high|medium|low", "effort": "high|medium|low"},
      {"what": "at least 3 items", "why": "...", "impact": "...", "effort": "..."}
    ],
    "long_term": [
      {"what": "specific action step", "why": "tied to specific finding", "impact": "high|medium|low", "effort": "high|medium|low"},
      {"what": "at least 3 items", "why": "...", "impact": "...", "effort": "..."}
    ]
  }
}`;

  try {
    let res;

    if (provider === "azure") {
      // Azure OpenAI — Chat Completions API (no web search available)
      console.log("Azure config received:", { hasEndpoint: !!userAzureEndpoint, hasDeployment: !!userAzureDeployment, hasKey: !!apiKey });
      const azureBase = (userAzureEndpoint?.trim() || process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
      const apiVersion = userAzureApiVersion?.trim() || process.env.AZURE_API_VERSION || "2024-12-01-preview";
      const deployment = userAzureDeployment?.trim() || process.env.AZURE_COMPLETION_DEPLOYMENT || "gpt-4o";

      if (!azureBase) {
        return Response.json({ error: "Azure endpoint is not configured. Please enter it in the settings panel." }, { status: 400 });
      }
      const url = `${azureBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          max_tokens: 16000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Azure OpenAI error:", JSON.stringify(data));
        return Response.json({ error: data.error?.message || "Azure OpenAI request failed." }, { status: res.status });
      }

      const text = data.choices?.[0]?.message?.content || "";
      console.log("Azure finish_reason:", data.choices?.[0]?.finish_reason);
      console.log("Azure response length:", text.length);

      if (!text) {
        return Response.json({ error: "Empty response from Azure OpenAI." }, { status: 502 });
      }

      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return Response.json(parsed);

    } else {
      // Standard OpenAI — Responses API with web search
      const endpoint = process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1";
      const model = process.env.OPENAI_MODEL || "gpt-4o";

      res = await fetch(`${endpoint}/responses`, {
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
    }
  } catch (e) {
    console.error("Brand audit error:", e);
    return Response.json({ error: e.message || "Failed to generate audit." }, { status: 500 });
  }
}
