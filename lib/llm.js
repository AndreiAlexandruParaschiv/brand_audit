// lib/llm.js
// Shared LLM caller for Azure OpenAI Chat Completions API

export async function callLLM({ messages, providerConfig = {}, options = {} }) {
  const { maxTokens = 4096 } = options;

  const azureBase = (providerConfig.azureEndpoint?.trim() || process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const apiKey = providerConfig.apiKey?.trim() || process.env.AZURE_OPENAI_KEY;
  const apiVersion = providerConfig.azureApiVersion?.trim() || process.env.AZURE_API_VERSION || "2024-12-01-preview";
  const deployment = providerConfig.azureDeployment?.trim() || process.env.AZURE_COMPLETION_DEPLOYMENT || "gpt-4o";

  if (!apiKey) {
    throw new Error("No API key available. Please enter your API key in the settings panel.");
  }
  if (!azureBase) {
    throw new Error("Azure endpoint is not configured. Please enter it in the settings panel.");
  }

  const url = `${azureBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ max_completion_tokens: maxTokens, messages }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Azure OpenAI request failed.");
  }

  const text = data.choices?.[0]?.message?.content || "";
  if (!text) {
    throw new Error("Empty response from Azure OpenAI.");
  }
  return text;
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
