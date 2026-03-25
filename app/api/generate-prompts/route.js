// app/api/generate-prompts/route.js
import { callLLMJSON, extractProviderConfig } from "../../../lib/llm.js";

export async function POST(req) {
  const body = await req.json();
  const { industry, categories } = body;

  if (!industry || !categories?.length) {
    return Response.json({ error: "Industry and categories are required." }, { status: 400 });
  }

  const providerConfig = extractProviderConfig(body);

  const categoryList = categories
    .map((c) => `Category: ${c.name}\n  Topics: ${c.topics.join(", ")}`)
    .join("\n");

  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" });

  const messages = [
    {
      role: "system",
      content: `You are an expert at simulating how real people talk to AI assistants like ChatGPT or Claude. The current date is ${currentDate}. Always respond with valid JSON only — no markdown fences, no preamble.`,
    },
    {
      role: "user",
      content: `For the industry "${industry}", generate prompts that sound exactly like how a real person would ask an AI chatbot for help. These are NOT search engine queries — they are conversational messages typed into ChatGPT, Claude, or similar.

IMPORTANT RULES:
- Do NOT mention any specific brand name in the prompts
- Write in first person, casual/natural tone — like a real person typing
- Include personal context, real-world scenarios, or constraints (budget, experience level, team size, use case)
- Vary the personas: professional, casual user, student, small business owner, beginner, power user, etc.
- Never reference a year unless it's naturally relevant — the AI already knows the current date
- Avoid formulaic patterns like "What are the best X for Y" — mix up the phrasing

Here are the categories and topics to cover:
${categoryList}

Generate exactly 3 prompts per topic. Each should feel like a DIFFERENT person with a different situation asking for help. Examples of good tone:
- "I need to edit product photos for my online store but I'm not a designer — what tools would make this easy?"
- "my team is looking for something to manage our sprint planning, we're about 15 people and use Slack heavily"
- "I want to start making YouTube videos, what's a good setup for editing that won't cost me a fortune?"

Return this exact JSON structure:
{
  "prompts": [
    { "category": "Category Name", "topic": "topic name", "prompt": "the conversational prompt" }
  ]
}`,
    },
  ];

  try {
    const result = await callLLMJSON({ messages, providerConfig, options: { maxTokens: 4096 } });
    return Response.json(result);
  } catch (e) {
    console.error("Generate prompts error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
