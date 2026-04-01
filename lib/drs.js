// lib/drs.js
// DRS (Data Retrieval Service) client — submits LLM prompt jobs, polls for completion, downloads results

const DRS_PROVIDERS = {
  chatgpt_free: { provider_id: "brightdata", dataset_id: "chatgpt_free", url: "https://chatgpt.com/" },
  google_aimode: { provider_id: "brightdata", dataset_id: "aimode", url: "https://google.com/aimode" },
  gemini: { provider_id: "brightdata", dataset_id: "gemini", url: "https://gemini.google.com/" },
  // copilot: { provider_id: "brightdata", dataset_id: "copilot", url: "https://copilot.microsoft.com/" },
  // perplexity: { provider_id: "brightdata", dataset_id: "perplexity", url: "https://www.perplexity.ai/" },
  // TODO: Uncomment when configured
  // chatgpt_paid: { provider_id: "openAI", dataset_id: null, url: "https://chatgpt.com/" },
  // google_aio: { provider_id: "google ai overviews", dataset_id: null, url: "https://www.google.com/" },
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
  if (!provider.dataset_id) {
    throw new Error(`Provider "${providerKey}" is not yet fully configured (missing dataset_id).`);
  }
  return provider;
}

export function getAvailableProviders() {
  return Object.entries(DRS_PROVIDERS)
    .filter(([, v]) => v.dataset_id)
    .map(([key]) => key);
}

export async function submitJob({ providerKey, prompts, metadata, country = "US" }) {
  const { apiUrl, apiKey } = getDrsConfig();
  const provider = getProvider(providerKey);

  const body = {
    provider_id: provider.provider_id,
    priority: "HIGH",
    parameters: {
      dataset_id: provider.dataset_id,
      prompts: prompts.map((p, i) => ({
        url: provider.url,
        prompt: p.prompt,
        country,
        index: p.index ?? i,
      })),
      metadata,
    },
  };

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

const DEFAULT_POLL_INTERVAL_MS = 15_000; // 15 seconds between status checks
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes before giving up

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
