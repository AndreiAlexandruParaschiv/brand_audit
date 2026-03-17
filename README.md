# Brand Audit Tool

An AI-powered off-site brand reputation analysis tool built with Next.js and the OpenAI API. Enter a brand name and optional competitors to get a comprehensive audit covering sentiment, platform reputation, competitive benchmarking, risk assessment, and strategic recommendations.

## Architecture

```
brand_audit/
├── app/
│   ├── layout.js                  # Root layout (HTML shell, metadata)
│   ├── page.js                    # Home page — renders BrandAudit component
│   └── api/
│       └── brand-audit/
│           └── route.js           # POST endpoint — calls OpenAI API
├── components/
│   └── BrandAudit.jsx             # Main UI component (client-side)
├── .env.local                     # API keys (not committed)
├── next.config.js                 # Next.js configuration
└── package.json                   # Dependencies and scripts
```

## How It Works

### Request Flow

```
Browser                    Next.js Server              OpenAI API
  │                            │                          │
  │  1. User enters brand      │                          │
  │     name + competitors     │                          │
  │                            │                          │
  │  2. POST /api/brand-audit  │                          │
  │  ─────────────────────────>│                          │
  │     { args: "Nike, Adidas" }                          │
  │                            │  3. POST /chat/completions
  │                            │  ────────────────────────>│
  │                            │     system prompt +       │
  │                            │     structured JSON schema│
  │                            │                          │
  │                            │  4. JSON response         │
  │                            │  <────────────────────────│
  │                            │                          │
  │  5. Parsed audit data      │                          │
  │  <─────────────────────────│                          │
  │                            │                          │
  │  6. Renders dashboard      │                          │
  │     with visualizations    │                          │
```

### Backend — `app/api/brand-audit/route.js`

- **POST endpoint** that receives `{ args: "BrandName, Competitor1, Competitor2" }`
- Sends a structured prompt to the OpenAI API asking for a complete brand audit as JSON
- The system prompt instructs the model to act as a senior brand strategist
- The user prompt includes the exact JSON schema the model must return
- Parses the model's response and forwards it to the frontend
- Configurable via environment variables: `OPENAI_API_KEY`, `OPENAI_ENDPOINT`, `OPENAI_MODEL`

### Frontend — `components/BrandAudit.jsx`

A single-page React dashboard with a dark theme (Slate/Indigo color palette) that renders:

| Section | What it shows |
|---|---|
| **Input Form** | Brand name field + optional competitors field |
| **Phase Progress** | Animated step indicator (simulated phases while waiting for API) |
| **Executive Summary** | Overall brand health verdict, auto-identified competitors |
| **Sentiment Overview** | Positive/Negative/Neutral percentages + theme breakdowns |
| **Platform Scores** | Bar chart with 1-10 scores for Twitter, LinkedIn, Reddit, Trustpilot, etc. |
| **Competitive Benchmarking** | Table comparing primary brand vs competitors across 6 dimensions |
| **Risk Register** | Severity-coded cards (critical/high/medium/low) with recommended actions |
| **Strategic Roadmap** | Recommendations split into Immediate (0-30d), Short-term (1-3mo), Long-term (3-12mo) |

### API Response Schema

The OpenAI model returns a structured JSON object:

```json
{
  "brand": "Nike",
  "competitors": ["Adidas", "Puma"],
  "auto_identified_competitors": false,
  "executive_summary": "...",
  "sentiment": {
    "positive": 65,
    "negative": 15,
    "neutral": 20,
    "positive_themes": ["..."],
    "negative_themes": ["..."],
    "top_mentions": [{ "platform": "...", "type": "...", "summary": "..." }]
  },
  "platform_scores": [
    { "platform": "Twitter/X", "score": 7, "justification": "..." }
  ],
  "competitor_matrix": [
    { "name": "Nike", "is_primary": true, "overall": 8, "reviews": 7, "social": 9, "news": 8, "community": 7, "employer": 7 }
  ],
  "risks": [
    { "issue": "...", "severity": "high", "urgency": "immediate", "action": "..." }
  ],
  "recommendations": {
    "immediate": [{ "what": "...", "why": "...", "impact": "high", "effort": "low" }],
    "short_term": [{ "what": "...", "why": "...", "impact": "high", "effort": "medium" }],
    "long_term": [{ "what": "...", "why": "...", "impact": "high", "effort": "high" }]
  }
}
```

## Setup

### Prerequisites

- Node.js 18+
- An OpenAI API key

### Installation

```bash
git clone git@github.com:AndreiAlexandruParaschiv/brand_audit.git
cd brand_audit
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```env
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_ENDPOINT=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | Your OpenAI API key |
| `OPENAI_ENDPOINT` | No | `https://api.openai.com/v1` | API base URL (supports Azure or proxies) |
| `OPENAI_MODEL` | No | `gpt-4o` | Model to use for generating audits |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a brand name (e.g., "Nike")
2. Optionally add comma-separated competitors (e.g., "Adidas, Puma")
3. Click **Run Brand Audit**
4. Wait ~30-90 seconds for the AI to generate the full analysis
5. Review the dashboard sections: sentiment, platform scores, competitor matrix, risks, and recommendations

## Limitations

- **Data is AI-generated from training knowledge** — it is not based on live web searches. Results reflect the model's training data, not real-time information.
- **No authentication** — anyone with access to the URL can run audits (and consume API credits).
- **Single API call** — the entire audit is generated in one request, which may hit token limits for very detailed analyses.
