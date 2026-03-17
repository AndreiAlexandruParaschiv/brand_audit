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

  const systemPrompt = `You are a senior brand strategist and digital reputation analyst.
Conduct a real off-site brand audit. Be specific — cite actual sources, real ratings, and real quotes where possible.
If you cannot find data for a platform, say "No significant presence detected" rather than making up numbers.
Always respond with a valid JSON object only — no markdown fences, no preamble.`;

  const userPrompt = `Conduct a comprehensive off-site brand audit for: ${args}

The first value is the primary brand. Comma-separated values after are competitors.
IMPORTANT: Only use the competitors explicitly provided. Do NOT add extra competitors beyond what was given.
If and ONLY if no competitors were provided at all, identify 2-3 real competitors yourself and set "auto_identified_competitors" to true.

Gather data about:
- Reviews on Trustpilot, G2, Capterra, Google Reviews
- Reddit discussions and sentiment
- Recent press coverage and news
- Glassdoor employer ratings
- LinkedIn and professional mentions
- Competitor reviews and direct comparisons

For each data point, use actual numbers, ratings, and quotes where available.

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
