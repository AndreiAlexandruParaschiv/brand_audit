// lib/llm.js
// Shared LLM caller for OpenAI and Azure OpenAI Chat Completions API

export async function callLLM({ messages, providerConfig = {}, options = {} }) {
  const { maxTokens = 4096 } = options;

  // Provider detection: user-supplied > env detection > default
  const azureEnvEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureEnvKey = process.env.AZURE_OPENAI_KEY;
  const provider = providerConfig.provider || (azureEnvEndpoint && azureEnvKey ? "azure" : "openai");

  // API key resolution
  let apiKey;
  if (provider === "azure") {
    apiKey = providerConfig.apiKey?.trim() || azureEnvKey;
  } else {
    apiKey = providerConfig.apiKey?.trim() || process.env.OPENAI_API_KEY;
  }

  if (!apiKey) {
    throw new Error("No API key available. Please enter your API key in the settings panel.");
  }

  let res;

  if (provider === "azure") {
    const azureBase = (providerConfig.azureEndpoint?.trim() || azureEnvEndpoint || "").replace(/\/+$/, "");
    const apiVersion = providerConfig.azureApiVersion?.trim() || process.env.AZURE_API_VERSION || "2024-12-01-preview";
    const deployment = providerConfig.azureDeployment?.trim() || process.env.AZURE_COMPLETION_DEPLOYMENT || "gpt-4o";

    if (!azureBase) {
      throw new Error("Azure endpoint is not configured. Please enter it in the settings panel.");
    }

    const url = `${azureBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ max_tokens: maxTokens, messages }),
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

  } else {
    const endpoint = process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1";
    const model = providerConfig.model || process.env.OPENAI_MODEL || "gpt-4o";

    res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "OpenAI API request failed.");
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) {
      throw new Error("Empty response from OpenAI.");
    }
    return text;
  }
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
    provider: body.provider,
    azureEndpoint: body.azureEndpoint,
    azureDeployment: body.azureDeployment,
    azureApiVersion: body.azureApiVersion,
  };
}
