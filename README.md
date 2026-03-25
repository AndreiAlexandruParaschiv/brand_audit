# Brand Discovery Flow

An AI-powered off-site brand visibility and Share of Voice analysis tool built with Next.js. Enter a brand name to run a 5-step pipeline: discover the brand's products and services, research the broader market landscape, generate targeted prompts, execute them against an LLM with web search, and compute competitive Share of Voice rankings.

## Architecture

```
brand_audit/
├── app/
│   ├── layout.js                            # Root layout (HTML shell, metadata)
│   ├── page.js                              # Home page — renders BrandAudit component
│   └── api/
│       ├── discover/route.js                # Step 1: Brand Discovery (products, services)
│       ├── market-discovery/route.js        # Step 2: Market Discovery (categories, topics)
│       ├── generate-prompts/route.js        # Step 3: Generate search prompts per topic
│       ├── execute-prompts/route.js         # Step 4: Execute prompts against LLM
│       └── analyze-sov/route.js             # Step 5: Compute Share of Voice rankings
├── components/
│   └── BrandAudit.jsx                       # Main UI component (client-side)
├── lib/
│   ├── llm.js                               # Shared LLM caller (Bedrock primary, Azure fallback)
│   └── search.js                            # Web search via Tavily API
├── .env.local                               # API keys (not committed)
├── next.config.js                           # Next.js configuration
└── package.json                             # Dependencies and scripts
```

## How It Works

### Pipeline Flow

The tool runs a 5-step pipeline with progressive rendering — each step's results appear as soon as they're ready:

```
Browser                    Next.js Server              LLM / Search
  │                            │                          │
  │  1. Enter brand name       │                          │
  │                            │                          │
  │  2. POST /api/discover     │                          │
  │  ─────────────────────────>│  ── web search + LLM ──>│
  │  Brand profile displayed   │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  3. POST /api/market-discovery                        │
  │  ─────────────────────────>│  ── web search + LLM ──>│
  │  Categories displayed      │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  4. POST /api/generate-prompts                        │
  │  ─────────────────────────>│  ───────── LLM ─────────>│
  │  Prompts list displayed    │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  5. POST /api/execute-prompts                         │
  │  ─────────────────────────>│  ── web search + LLM ──>│
  │  Q&A results displayed     │<─────────────────────────│
  │<───────────────────────────│                          │
  │                            │                          │
  │  6. POST /api/analyze-sov  │                          │
  │  ─────────────────────────>│  ───────── LLM ─────────>│
  │  SoV rankings displayed    │<─────────────────────────│
  │<───────────────────────────│                          │
```

### Backend — 5-Step API Pipeline

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `POST /api/discover` | **Brand Discovery** — identifies the brand's industry, products, and services |
| 2 | `POST /api/market-discovery` | **Market Discovery** — researches the broader market landscape to find categories and topics, including areas where competitors may dominate |
| 3 | `POST /api/generate-prompts` | Generates 3 brand-agnostic prompts per topic (best-of, recommendation, alternatives) |
| 4 | `POST /api/execute-prompts` | Executes all generated prompts against the LLM (with web search grounding) |
| 5 | `POST /api/analyze-sov` | Counts brand mentions across all answers and computes Share of Voice percentages |

### LLM Provider Support (`lib/llm.js`)

The LLM caller supports two providers with automatic fallback:

1. **AWS Bedrock (Claude)** — primary, used when `AWS_BEARER_TOKEN_BEDROCK` is set
2. **Azure OpenAI** — fallback, configured via Azure endpoint + API key

### Frontend — `components/BrandAudit.jsx`

A single-page React dashboard with a light theme. All result sections are collapsible (click header to toggle):

| Section | What it shows |
|---|---|
| **Brand Name Input** | Text input with submit button, compact loading state |
| **Pipeline Progress** | 5-step indicator with green checkmarks, blue spinner, web-grounded badges |
| **Brand Profile** | Industry tag, two-column products/services list with descriptions |
| **Market Categories & Topics** | 3-column card grid with blue bullet points per category |
| **Generated Prompts** | Expandable accordion, prompts grouped by topic within each category |
| **Prompt Results** | Q&A cards grouped by topic, question header + answer body |
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
BEDROCK_REGION=us-west-2
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
| `BEDROCK_REGION` | No | `us-west-2` | AWS region for Bedrock |
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
3. Watch the 5-step pipeline execute with real-time progress
4. Review results: brand profile, market categories, prompts, Q&A answers, and Share of Voice rankings

### Web Search Grounding (Optional)

When `TAVILY_API_KEY` is configured, the pipeline uses live web search to ground results in real-time data:

- **Brand Discovery** — searches for the brand's current products and services
- **Market Discovery** — searches for industry market landscape and trends
- **Execute Prompts** — searches for each prompt before asking the LLM, so brand mentions reflect actual web presence

Without Tavily configured, the pipeline falls back to LLM training knowledge only. A "web-grounded" badge appears in the pipeline progress when search is active.

## Limitations

- **Without web search, data is LLM training knowledge only** — configure `TAVILY_API_KEY` for real-time web grounding
- **No authentication** — anyone with access to the URL can run audits (and consume API credits)
- **Sequential pipeline** — each step must complete before the next begins
