# Brand Discovery Flow

An AI-powered off-site brand visibility and Share of Voice analysis tool built with Next.js. Enter a brand name to get a multi-step discovery pipeline that identifies products, services, and categories, generates targeted prompts, executes them against an LLM, and computes competitive Share of Voice rankings.

## Architecture

```
brand_audit/
├── app/
│   ├── layout.js                        # Root layout (HTML shell, metadata)
│   ├── page.js                          # Home page — renders BrandAudit component
│   └── api/
│       ├── discover/route.js            # Step 1: Brand discovery (products, services, categories)
│       ├── generate-prompts/route.js    # Step 2: Generate search prompts per category/topic
│       ├── execute-prompts/route.js     # Step 3: Execute prompts against LLM
│       └── analyze-sov/route.js         # Step 4: Compute Share of Voice rankings
├── components/
│   └── BrandAudit.jsx                   # Main UI component (client-side)
├── lib/
│   └── llm.js                           # Shared LLM caller (Bedrock primary, Azure fallback)
├── .env.local                           # API keys (not committed)
├── next.config.js                       # Next.js configuration
└── package.json                         # Dependencies and scripts
```

## How It Works

### Pipeline Flow

The tool runs a 4-step pipeline with progressive rendering — each step's results appear as soon as they're ready:

```
Browser                    Next.js Server              LLM Provider
  │                            │                          │
  │  1. Enter brand name       │                          │
  │                            │                          │
  │  2. POST /api/discover     │                          │
  │  ─────────────────────────>│  ───────────────────────>│
  │  Brand profile displayed   │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  3. POST /api/generate-prompts                        │
  │  ─────────────────────────>│  ───────────────────────>│
  │  Prompts list displayed    │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  4. POST /api/execute-prompts                         │
  │  ─────────────────────────>│  ───────────────────────>│
  │  Raw results displayed     │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  5. POST /api/analyze-sov  │                          │
  │  ─────────────────────────>│  ───────────────────────>│
  │  SoV rankings displayed    │<─────────────────────────│
  │<───────────────────────────│                          │
```

### Backend — 4-Step API Pipeline

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `POST /api/discover` | Identifies the brand's industry, products, services, and relevant categories/topics |
| 2 | `POST /api/generate-prompts` | Generates 3 brand-agnostic prompts per topic (best-of, recommendation, alternatives) |
| 3 | `POST /api/execute-prompts` | Executes all generated prompts against the LLM |
| 4 | `POST /api/analyze-sov` | Counts brand mentions across all answers and computes Share of Voice percentages |

### LLM Provider Support (`lib/llm.js`)

The LLM caller supports two providers with automatic fallback:

1. **AWS Bedrock (Claude)** — primary, used when `AWS_BEARER_TOKEN_BEDROCK` is set
2. **Azure OpenAI** — fallback, configured via Azure endpoint + API key

### Frontend — `components/BrandAudit.jsx`

A single-page React dashboard with a light theme that renders:

| Section | What it shows |
|---|---|
| **Brand Name Input** | Text input with submit button, compact loading state |
| **Pipeline Progress** | Step indicator with green checkmarks, blue spinner for active step |
| **Brand Profile** | Industry tag, two-column products/services list with descriptions |
| **Categories & Topics** | 3-column card grid with blue bullet points per category |
| **Generated Prompts** | Expandable accordion grouped by category |
| **Prompt Results** | Expandable accordion showing LLM answers per category |
| **Share of Voice** | Overall rankings with bar charts, category breakdown table |

## Setup

### Prerequisites

- Node.js 18+
- An AWS Bedrock bearer token (Claude) or Azure OpenAI API key

### Installation

```bash
git clone git@github.com:AndreiAlexandruParaschiv/brand_audit.git
cd brand_audit
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```env
# Primary: AWS Bedrock (Claude)
AWS_BEARER_TOKEN_BEDROCK=your-bearer-token
AWS_REGION=us-west-2
BEDROCK_MODEL=us.anthropic.claude-opus-4-6-v1

# Fallback: Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
AZURE_API_VERSION=2024-12-01-preview
AZURE_COMPLETION_DEPLOYMENT=gpt-4o

# Web Search (optional — enables real-time data grounding)
TAVILY_API_KEY=tvly-your-key-here
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_BEARER_TOKEN_BEDROCK` | No | — | Bearer token for AWS Bedrock (enables Claude as primary) |
| `AWS_REGION` | No | `us-west-2` | AWS region for Bedrock |
| `BEDROCK_MODEL` | No | `us.anthropic.claude-opus-4-6-v1` | Bedrock model ID |
| `AZURE_OPENAI_ENDPOINT` | No | — | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_KEY` | No | — | Azure OpenAI API key |
| `AZURE_API_VERSION` | No | `2024-12-01-preview` | Azure API version |
| `AZURE_COMPLETION_DEPLOYMENT` | No | `gpt-4o` | Azure deployment name |
| `TAVILY_API_KEY` | No | — | Tavily API key for web search grounding (free tier: 1,000 searches/month at [tavily.com](https://tavily.com)) |

API keys can also be configured at runtime via the Settings panel in the UI (stored in browser localStorage).

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a brand name (e.g., "Adobe")
2. Click **Discover Opportunities** (or press Enter)
3. Watch the 4-step pipeline execute with real-time progress
4. Review results: brand profile, categories, prompts, raw answers, and Share of Voice rankings

### Web Search Grounding (Optional)

When `TAVILY_API_KEY` is configured, the pipeline uses live web search to ground results in real-time data:

- **Discover step** — searches for the brand's current products and services
- **Execute Prompts step** — searches for each prompt before asking the LLM, so brand mentions reflect actual web presence

Without Tavily configured, the pipeline falls back to LLM training knowledge only. A "web-grounded" badge appears in the pipeline progress when search is active.

## Limitations

- **Without web search, data is LLM training knowledge only** — configure `TAVILY_API_KEY` for real-time web grounding
- **No authentication** — anyone with access to the URL can run audits (and consume API credits)
- **Sequential pipeline** — each step must complete before the next begins
