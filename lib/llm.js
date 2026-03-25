// lib/llm.js
// Shared LLM caller — Bedrock (Claude) primary, Azure OpenAI fallback

// --- Bedrock (Claude) via InvokeModel ---
async function callBedrock({ messages, maxTokens }) {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const region = process.env.AWS_REGION || "us-west-2";
  const model = process.env.BEDROCK_MODEL || "us.anthropic.claude-opus-4-6-v1";

  if (!token) return null; // signal to fall back

  // Convert from OpenAI message format to Claude Messages API format
  // Extract system message if present
  let system;
  const claudeMessages = [];
  for (const m of messages) {
    if (m.role === "system") {
      system = m.content;
    } else {
      claudeMessages.push({ role: m.role, content: m.content });
    }
  }

  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`;

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    messages: claudeMessages,
  };
  if (system) body.system = system;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.message || data.error?.message || JSON.stringify(data);
    throw new Error(`Bedrock request failed (${res.status}): ${errMsg}`);
  }

  // Claude response format: { content: [{ type: "text", text: "..." }] }
  const text = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "";
  if (!text) {
    throw new Error("Empty response from Bedrock Claude.");
  }
  return text;
}

// --- Azure OpenAI (fallback) ---
async function callAzure({ messages, maxTokens, providerConfig }) {
  const azureBase = (providerConfig.azureEndpoint?.trim() || process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const apiKey = providerConfig.apiKey?.trim() || process.env.AZURE_OPENAI_KEY;
  const apiVersion = providerConfig.azureApiVersion?.trim() || process.env.AZURE_API_VERSION || "2024-12-01-preview";
  const deployment = providerConfig.azureDeployment?.trim() || process.env.AZURE_COMPLETION_DEPLOYMENT || "gpt-4o";

  if (!apiKey) throw new Error("No API key available. Please enter your API key in the settings panel.");
  if (!azureBase) throw new Error("Azure endpoint is not configured. Please enter it in the settings panel.");

  const url = `${azureBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ max_completion_tokens: maxTokens, messages }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Azure OpenAI request failed.");

  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response from Azure OpenAI.");
  return text;
}

// --- Main entry point ---
export async function callLLM({ messages, providerConfig = {}, options = {} }) {
  const { maxTokens = 4096 } = options;

  // Try Bedrock first (if configured)
  try {
    const result = await callBedrock({ messages, maxTokens });
    if (result) return result;
  } catch (e) {
    console.warn("Bedrock failed, falling back to Azure:", e.message);
  }

  // Fallback to Azure
  return callAzure({ messages, maxTokens, providerConfig });
}

// Helper: call LLM and parse JSON from response
export async function callLLMJSON({ messages, providerConfig, options }) {
  const text = await callLLM({ messages, providerConfig, options });
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}\nResponse was: ${clean.slice(0, 200)}`);
  }
}

// Helper: extract provider config from request body
export function extractProviderConfig(body) {
  return {
    apiKey: body.apiKey,
    azureEndpoint: body.azureEndpoint,
    azureDeployment: body.azureDeployment,
    azureApiVersion: body.azureApiVersion,
  };
}
