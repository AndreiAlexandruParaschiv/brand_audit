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

Single-page Next.js 14 (App Router) application that generates AI-powered brand audits via OpenAI or Azure OpenAI APIs.

**Request flow:** Browser → `POST /api/brand-audit` → OpenAI/Azure API → structured JSON → rendered dashboard

### Key files

- `app/api/brand-audit/route.js` — API route that constructs a system+user prompt pair, calls OpenAI Responses API (with `web_search_preview` tool) or Azure Chat Completions API, parses the JSON response. The entire audit schema is defined inline in the user prompt.
- `components/BrandAudit.jsx` — Single client component ("use client") containing all UI: input form, settings panel, phase progress animation, and all report visualization sections. Uses inline styles exclusively (no CSS framework). Dark theme with Slate/Indigo palette.
- `app/page.js` — Renders `<BrandAudit />` only.
- `app/layout.js` — Minimal HTML shell with metadata.

### Dual provider support

The API route supports two providers selected at runtime:
- **OpenAI** (default): Uses `/responses` endpoint with `web_search_preview` tool. Auth via `Authorization: Bearer` header.
- **Azure OpenAI**: Uses `/openai/deployments/{name}/chat/completions` endpoint. Auth via `api-key` header. No web search.

Provider is determined by: user UI selection → env var detection (`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_KEY`) → defaults to OpenAI.

### Client-side settings

API keys and provider config are stored in `localStorage` (keys: `audit_provider`, `audit_api_key`, `audit_azure_endpoint`, `audit_azure_deployment`) and sent per-request to the backend. Server-side env vars are used as fallbacks.

## Environment Variables

Configure in `.env.local` (not committed):

| Variable | Provider | Description |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | API key |
| `OPENAI_ENDPOINT` | OpenAI | Base URL (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | OpenAI | Model name (default: `gpt-4o`) |
| `AZURE_OPENAI_ENDPOINT` | Azure | Resource endpoint URL |
| `AZURE_OPENAI_KEY` | Azure | API key |
| `AZURE_API_VERSION` | Azure | API version (default: `2024-12-01-preview`) |
| `AZURE_COMPLETION_DEPLOYMENT` | Azure | Deployment name (default: `gpt-4o`) |
