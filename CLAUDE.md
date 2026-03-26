# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm start        # Start production server
```

No test framework is configured. No linter is configured.

## Architecture

Single-page Next.js 14 (App Router) application that runs a 5-step AI pipeline to measure brand Share of Voice in LLM-generated responses.

**Pipeline flow:** Brand Discovery → Market Discovery → Generate Prompts → Execute Prompts → Analyze SoV

### Key files

- `app/api/discover/route.js` — Step 1: Brand Discovery. Identifies brand's industry, products, and services. Uses web search (Tavily) for up-to-date info.
- `app/api/market-discovery/route.js` — Step 2: Market Discovery. Takes products/services as input, researches the broader market landscape to find categories and topics (including areas where competitors may dominate). Uses web search.
- `app/api/generate-prompts/route.js` — Step 3: Generates 3 conversational, LLM-style prompts per topic with varied personas and real-world scenarios. Injects current date.
- `app/api/execute-prompts/route.js` — Step 4: Executes all prompts against the LLM with web search grounding. Processes in batches of 5 concurrent. Returns Q&A results.
- `app/api/analyze-sov/route.js` — Step 5: Counts brand mentions across all answers, computes Share of Voice percentages overall and per category. Top 10 brands overall, top 5 per category.
- `lib/llm.js` — Shared LLM caller. Bedrock (Claude) primary, Azure OpenAI fallback. Handles message format conversion.
- `lib/search.js` — Web search via Tavily API. Returns null if not configured (graceful fallback).
- `components/BrandAudit.jsx` — Single client component ("use client") containing all UI: input form, pipeline progress, collapsible result sections. Uses inline styles exclusively (no CSS framework). Light theme with blue accents.
- `app/page.js` — Renders `<BrandAudit />` only.
- `app/layout.js` — Minimal HTML shell with metadata.

### LLM provider support

Two providers with automatic fallback:
- **AWS Bedrock (Claude)** — primary, used when `AWS_BEARER_TOKEN_BEDROCK` is set. Uses Claude Messages API format.
- **Azure OpenAI** — fallback, uses Chat Completions endpoint with `api-key` header.

### Web search grounding

When `TAVILY_API_KEY` is set, three pipeline steps use live web search:
- Brand Discovery — searches for brand products/services
- Market Discovery — searches for industry market landscape
- Execute Prompts — searches for each prompt before LLM call

If Tavily is unavailable or fails, each step falls back to LLM knowledge only. No crash, no interruption.

### Frontend

All credentials are server-side env vars only (no client-side settings panel). The UI has collapsible sections, prompts/results grouped by topic, and Q&A cards for execution results.

## Environment Variables

Configure in `.env.local` (not committed):

| Variable | Provider | Description |
|---|---|---|
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock | Bearer token (primary LLM provider) |
| `BEDROCK_REGION` | Bedrock | AWS region (default: `us-west-2`) |
| `BEDROCK_MODEL` | Bedrock | Model ID |
| `AZURE_OPENAI_ENDPOINT` | Azure | Resource endpoint URL (fallback LLM) |
| `AZURE_OPENAI_KEY` | Azure | API key |
| `AZURE_API_VERSION` | Azure | API version |
| `AZURE_COMPLETION_DEPLOYMENT` | Azure | Deployment name |
| `TAVILY_API_KEY` | Tavily | Web search API key (optional, enables real-time grounding) |
