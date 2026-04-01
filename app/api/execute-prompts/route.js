// app/api/execute-prompts/route.js
import { submitJob, waitForCompletion, downloadResult, getAvailableProviders } from "../../../lib/drs.js";
import { lookupSiteMetadata } from "../../../lib/llmo.js";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(req) {
  const body = await req.json();
  const { prompts, brand, region } = body;

  if (!prompts?.length) {
    return Response.json({ error: "Prompts array is required." }, { status: 400 });
  }
  if (!brand?.trim()) {
    return Response.json({ error: "Brand is required for site metadata lookup." }, { status: 400 });
  }

  let metadata;
  try {
    metadata = await lookupSiteMetadata(brand);
  } catch (e) {
    console.error("LLMO site lookup error:", e);
    return Response.json({ error: e.message }, { status: 400 });
  }

  const providers = getAvailableProviders();
  const drsPrompts = prompts.map((p, i) => ({ prompt: p.prompt, index: i }));

  try {
    const settled = await Promise.allSettled(
      providers.map(async (providerKey) => {
        const jobId = await submitJob({ providerKey, prompts: drsPrompts, metadata, country: region });
        const completedJob = await waitForCompletion(jobId);
        if (!completedJob.result_url) {
          throw new Error(`DRS job ${jobId} completed but no result_url was returned.`);
        }
        const drsResults = await downloadResult(completedJob.result_url);
        return { providerKey, jobId, drsResults };
      })
    );

    const allResults = [];
    const jobIds = {};
    const succeededProviders = [];

    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        console.error("DRS provider failed:", outcome.reason);
        continue;
      }
      const { providerKey, jobId, drsResults } = outcome.value;
      jobIds[providerKey] = jobId;
      succeededProviders.push(providerKey);

      const resultArray = Array.isArray(drsResults) ? drsResults : [drsResults];
      for (const dr of resultArray) {
        const idx = dr.input?.index ?? 0;
        const originalPrompt = prompts[idx] || {};
        allResults.push({
          provider: providerKey,
          category: originalPrompt.category,
          topic: originalPrompt.topic,
          prompt: originalPrompt.prompt,
          answer: dr.answer_text || "",
          citations: dr.citations || [],
        });
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const debugPath = join(process.cwd(), `drs-results-${timestamp}.json`);
    await writeFile(debugPath, JSON.stringify(allResults, null, 2));
    console.log(`DRS aggregated results written to ${debugPath}`);

    const totalRequested = prompts.length * providers.length;
    return Response.json({
      results: allResults,
      totalRequested,
      totalSucceeded: allResults.length,
      totalFailed: totalRequested - allResults.length,
      providers: succeededProviders,
      jobIds,
    });
  } catch (e) {
    console.error("Execute prompts (DRS) error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
