# AI Share of Voice Pipeline — Design Spec

## Overview

Replace the current single-call brand audit with a 4-step pipeline that discovers a brand's products/services, generates non-branded industry prompts, executes them against an LLM, and analyzes which brands appear in the answers to compute Share of Voice (SoV).

The old brand audit format (sentiment, platform_scores, competitor_matrix, risks, recommendations) is fully superseded by this SoV pipeline.

## Pipeline Steps

### Step 1: Brand Discovery (`POST /api/discover`)

**Input:** `{ brand, apiKey?, provider?, azureEndpoint?, azureDeployment?, azureApiVersion? }`

**LLM task:** Given a brand name, identify its industry, products, services, and organize them into categories with topics. The prompt explicitly caps output at **max 5 categories, max 3 topics per category** to control downstream prompt volume.

**Output:**
```json
{
  "brand": "Adobe",
  "industry": "Creative Software & Digital Experience",
  "products": [
    { "name": "Photoshop", "description": "Professional image editing" }
  ],
  "services": [
    { "name": "Creative Cloud", "description": "Subscription creative suite" }
  ],
  "categories": [
    {
      "name": "Photo Editing",
      "topics": ["photo retouching", "RAW processing", "batch editing"]
    }
  ]
}
```

Products and services are displayed in the UI but only `industry` and `categories` are passed to Step 2.

### Step 2: Generate Prompts (`POST /api/generate-prompts`)

**Input:** `{ industry, categories, apiKey?, provider?, ... }`

**LLM task:** For each topic across all categories, generate 5 non-branded industry prompts — questions a user might naturally ask without mentioning any brand.

**Output:**
```json
{
  "prompts": [
    {
      "category": "Photo Editing",
      "topic": "photo retouching",
      "prompt": "What is the best software for professional photo retouching?"
    }
  ]
}
```

**Limits:** With 5 categories x 3 topics x 5 prompts = 75 prompts max.

### Step 3: Execute Prompts (`POST /api/execute-prompts`)

**Input:** `{ prompts: [{ category, topic, prompt }], apiKey?, provider?, ... }`

**Execution:** Each prompt is fired as an independent LLM call. To avoid rate limits, prompts execute in batches of 5 concurrent calls (semaphore pattern). This prevents cross-contamination between answers and gives accurate SoV measurement.

**Partial failure handling:** Failed prompts are skipped (not retried). The response includes both successful results and a count of failures. Step 4 proceeds with whatever results succeeded. The UI shows "X of Y prompts completed" to communicate partial success.

**Output:**
```json
{
  "results": [
    {
      "category": "Photo Editing",
      "topic": "photo retouching",
      "prompt": "What is the best software for professional photo retouching?",
      "answer": "The top options include Adobe Photoshop, Capture One, and Affinity Photo..."
    }
  ],
  "totalRequested": 75,
  "totalSucceeded": 72,
  "totalFailed": 3
}
```

### Step 4: Analyze SoV (`POST /api/analyze-sov`)

**Input:** `{ brand, results: [...], apiKey?, provider?, ... }`

**LLM task:** Analyze all answers to count brand mentions, compute share of voice percentages, and rank competitors. Break down by category.

**SoV formula:** `shareOfVoice = (brand_mentions / total_all_brand_mentions) * 100`

**Output:**
```json
{
  "brand": "Adobe",
  "totalPrompts": 72,
  "totalMentions": 195,
  "rankings": [
    { "brand": "Adobe", "mentions": 52, "shareOfVoice": 26.7, "isPrimary": true },
    { "brand": "Canva", "mentions": 28, "shareOfVoice": 14.4 },
    { "brand": "Figma", "mentions": 15, "shareOfVoice": 7.7 }
  ],
  "categoryBreakdown": [
    {
      "category": "Photo Editing",
      "rankings": [
        { "brand": "Adobe", "mentions": 12, "shareOfVoice": 55.0 },
        { "brand": "Capture One", "mentions": 6, "shareOfVoice": 27.3 }
      ]
    }
  ]
}
```

## Shared Infrastructure

### `lib/llm.js` — Shared LLM caller

Extract common OpenAI/Azure calling logic into a shared helper.

**Interface:**
```js
callLLM({
  messages: [{ role, content }],
  providerConfig: { provider, apiKey, azureEndpoint, azureDeployment, azureApiVersion, model },
  options: { maxTokens? }  // defaults to 4096
}) → Promise<string>  // returns raw text content
```

**Responsibilities:**
- Provider detection: user-supplied `provider` > env var detection (`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_KEY`) > defaults to "openai"
- API key resolution: user-supplied `apiKey` > env var (`OPENAI_API_KEY` or `AZURE_OPENAI_KEY`)
- Model resolution: user-supplied `model` > env var (`OPENAI_MODEL`) > "gpt-4o"
- URL construction with trailing slash stripping for Azure endpoints
- Auth headers: `Authorization: Bearer` for OpenAI, `api-key` for Azure
- Azure API version: from config > env var (`AZURE_API_VERSION`) > "2024-12-01-preview"
- Response parsing: extracts text content from response, strips markdown fences
- Error handling: throws `Error` with descriptive message on API failures

**API choice:** All steps use **Chat Completions API** (`/v1/chat/completions` for OpenAI, `/openai/deployments/{name}/chat/completions` for Azure). The existing Responses API with `web_search_preview` is dropped — SoV measurement needs the LLM's intrinsic knowledge, not web-augmented answers.

Each route calls `callLLM()` and does its own `JSON.parse()` on the returned string, wrapped in try/catch for malformed LLM output.

### Provider config passthrough

All endpoints accept: `apiKey`, `provider`, `azureEndpoint`, `azureDeployment`, `azureApiVersion`. These are passed from the frontend (stored in localStorage) on every request. Server-side env vars serve as fallbacks (handled within `lib/llm.js`).

`azureApiVersion` has no UI control — server-side default is sufficient.

## UI Design

### Component: `components/BrandAudit.jsx` (rewritten)

Single component, same file. Dark theme with Slate/Indigo palette preserved.

### Input form

- Brand name field only (competitors field removed — competitors are discovered via SoV)
- Settings panel unchanged (provider/key config)
- "Run Analysis" button

### Progressive step display

Each step renders its section when complete:

| Step | UI Section | Content |
|------|-----------|---------|
| Discovery | **Brand Profile** | Industry badge, products list, services list, categories with topic tags |
| Prompts | **Generated Prompts** | Collapsible sections per category, each showing its prompts |
| Execution | **Prompt Results** | Progress counter (X/Y completed), then answers grouped by category |
| Analysis | **Share of Voice** | Ranked competitor bars with SoV %, category breakdown table |

### Progress indicator

4-step indicator (replaces current 6 simulated phases). Each step shows:
- Gray circle: pending
- Spinning/animated: in progress
- Green checkmark: complete

### State management

```
brand: string
step: -1 | 0 | 1 | 2 | 3 (current pipeline step, -1 = idle)
discovery: object | null
prompts: object | null
results: object | null
analysis: object | null
error: string | null
loading: boolean
```

The `brand` value from user input is carried across all 4 API calls by the frontend (Step 4 needs it for SoV analysis). Each step's output is stored in state and passed as input to the next step.

## File Changes

| Action | File |
|--------|------|
| Create | `lib/llm.js` |
| Create | `app/api/discover/route.js` |
| Create | `app/api/generate-prompts/route.js` |
| Create | `app/api/execute-prompts/route.js` |
| Create | `app/api/analyze-sov/route.js` |
| Rewrite | `components/BrandAudit.jsx` |
| Delete | `app/api/brand-audit/route.js` |

## Naming Convention

All new JSON schemas use camelCase (e.g., `isPrimary`, `shareOfVoice`, `categoryBreakdown`), consistent with JavaScript conventions. The old snake_case fields (`is_primary`, `auto_identified_competitors`) are not carried forward.
