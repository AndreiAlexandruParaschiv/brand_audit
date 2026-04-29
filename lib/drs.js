// lib/drs.js
// DRS (Data Retrieval Service) client — submits LLM prompt jobs, polls for completion, downloads results

function createBrightDataProvider({ datasetId, url }) {
  return {
    enabled: true,
    buildJobBody({ prompts, metadata, country }) {
      return {
        provider_id: "brightdata",
        priority: "HIGH",
        parameters: {
          dataset_id: datasetId,
          prompts: prompts.map((p, i) => ({
            url,
            prompt: getPromptText(p),
            country,
            index: p.index ?? i,
          })),
          metadata,
        },
      };
    },
  };
}

const DRS_PROVIDERS = {
  chatgpt_free: createBrightDataProvider({ datasetId: "chatgpt_free", url: "https://chatgpt.com/" }),
  google_aimode: createBrightDataProvider({ datasetId: "aimode", url: "https://google.com/aimode" }),
  gemini: createBrightDataProvider({ datasetId: "gemini", url: "https://gemini.google.com/" }),
  copilot: createBrightDataProvider({ datasetId: "copilot", url: "https://copilot.microsoft.com/" }),
  perplexity: createBrightDataProvider({ datasetId: "perplexity", url: "https://www.perplexity.ai/" }),
  google_ai_overviews: {
    enabled: true,
    buildJobBody({ prompts, metadata, country }) {
      return {
        provider_id: "google_ai_overviews",
        priority: "HIGH",
        parameters: {
          site_id: requireMetadata(metadata, "siteId", "google_ai_overviews"),
          operation: "batch_search",
          queries: prompts.map((p) => getPromptText(p)),
          country,
          metadata: {
            imsOrgId: requireMetadata(metadata, "imsOrgId", "google_ai_overviews"),
            brand: requireMetadata(metadata, "brand", "google_ai_overviews"),
          },
        },
      };
    },
  },
  // chatgpt_paid: { enabled: false, ... },
};

function getDrsConfig() {
  const apiUrl = process.env.DRS_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.DRS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("DRS is not configured. Set DRS_API_URL and DRS_API_KEY environment variables.");
  }
  return { apiUrl, apiKey };
}

export function getProvider(providerKey) {
  const provider = DRS_PROVIDERS[providerKey];
  if (!provider) {
    const valid = Object.keys(DRS_PROVIDERS).join(", ");
    throw new Error(`Unknown DRS provider "${providerKey}". Valid providers: ${valid}`);
  }
  if (!provider.enabled) {
    throw new Error(`Provider "${providerKey}" is disabled.`);
  }
  return provider;
}

export function getAvailableProviders() {
  return Object.entries(DRS_PROVIDERS)
    .filter(([, v]) => v.enabled)
    .map(([key]) => key);
}

export async function submitJob({ providerKey, prompts, metadata, country = "US" }) {
  const { apiUrl, apiKey } = getDrsConfig();
  const provider = getProvider(providerKey);
  const body = provider.buildJobBody({ prompts, metadata, country });

  const res = await fetch(`${apiUrl}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data);
    throw new Error(`DRS job submission failed (${res.status}): ${msg}`);
  }

  const jobId = data.jobId || data.job_id || data.id;
  if (!jobId) {
    throw new Error(`DRS job submission returned no jobId. Response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  console.log(`[DRS] Job submitted: ${jobId} (provider=${providerKey}, prompts=${prompts.length})`);
  return jobId;
}

export function normalizeProviderResults({ providerKey, drsResults, prompts }) {
  getProvider(providerKey);
  return toArray(drsResults).map((dr) => {
    const idx = dr.input?.index ?? 0;
    const originalPrompt = prompts[idx] || {};
    return {
      provider: providerKey,
      category: originalPrompt.category,
      topic: originalPrompt.topic,
      prompt: originalPrompt.prompt,
      answer: dr.answer_text || "",
      citations: dr.citations || [],
    };
  });
}

export async function getJobStatus(jobId) {
  const { apiUrl, apiKey } = getDrsConfig();

  const res = await fetch(`${apiUrl}/jobs/${jobId}?include_result_url=true`, {
    headers: { "x-api-key": apiKey },
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data);
    throw new Error(`DRS status check failed (${res.status}): ${msg}`);
  }
  return data;
}

const DEFAULT_POLL_INTERVAL_MS = 30_000; // 30 seconds between status checks
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1_000; // 45 minutes before giving up

export async function waitForCompletion(jobId, { pollInterval = DEFAULT_POLL_INTERVAL_MS, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const status = await getJobStatus(jobId);

    if (status.status === "COMPLETED") {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[DRS] Job completed: ${jobId} (${elapsed}s)`);
      return status;
    }
    if (status.status === "FAILED") {
      throw new Error(`DRS job ${jobId} failed: ${status.error || status.message || "unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`DRS job ${jobId} timed out after ${timeout / 1000}s`);
}

export async function downloadResult(resultUrl) {
  const res = await fetch(resultUrl);
  if (!res.ok) {
    throw new Error(`Failed to download DRS result (${res.status})`);
  }
  const text = await res.text();
  const results = text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  console.log(`[DRS] Result downloaded: ${results.length} entries`);
  return results;
}

function requireMetadata(metadata, field, providerKey) {
  const value = metadata?.[field];
  if (!value) {
    throw new Error(`Provider "${providerKey}" requires metadata.${field} for DRS job submission.`);
  }
  return value;
}

function getPromptText(prompt) {
  return typeof prompt === "string" ? prompt : prompt.prompt;
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
