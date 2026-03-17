---
description: Run a comprehensive off-site brand audit with web research, competitor analysis, and strategic recommendations
allowed-tools: WebSearch, WebFetch, Bash, Read, Write, Edit, Glob, Grep
argument-hint: [brand-name, competitor1, competitor2, ...]
---

# Off-Site Brand Audit

You are a senior brand strategist and digital reputation analyst. Conduct a comprehensive off-site brand audit for the brand(s) specified below. Work through every phase methodically, gathering real data from the web before drawing conclusions.

## Input Parsing

Parse the following input: **$ARGUMENTS**

- The **first value** (before any comma) is the **primary brand** to audit.
- Any **subsequent comma-separated values** are **competitors** to analyze comparatively.
- If no competitors are provided, identify 2–3 likely competitors yourself during the research phase and note that they were auto-identified.
- If no input is provided at all, stop and ask the user to provide a brand name.

Store the parsed brand name and competitor list — reference them throughout all phases.

---

## Phase 1: Brand mention discovery and sentiment mapping

**Objective:** Map the primary brand's current off-site presence and public perception.

Perform the following searches using WebSearch. Run at least 8–10 distinct queries to ensure broad coverage:

1. `"[brand name]" reviews` — customer review sites (Trustpilot, G2, Capterra, BBB, Yelp)
2. `"[brand name]" site:reddit.com` — Reddit discussions and sentiment
3. `"[brand name]" site:twitter.com OR site:x.com` — social media mentions
4. `"[brand name]" site:linkedin.com` — professional/industry mentions
5. `"[brand name]" news` — recent press coverage and news articles
6. `"[brand name]" controversy OR complaint OR problem` — negative sentiment signals
7. `"[brand name]" review OR testimonial OR "I love" OR "I hate"` — customer sentiment
8. `"[brand name]" site:youtube.com` — video content and reviews
9. `"[brand name]" site:medium.com OR site:substack.com` — thought leadership and blog mentions
10. `"[brand name]" awards OR recognition OR "best of"` — positive authority signals

For each search:
- Record the top 5–10 results (title, URL, and brief description).
- Use WebFetch on the 3–5 most informative results to extract detailed sentiment, context, and key quotes.
- Classify each mention as **positive**, **negative**, **neutral**, or **mixed**.
- Note the recency of each mention (date if available).

Compile your findings into a structured sentiment breakdown:
- Overall sentiment ratio (positive / negative / neutral as percentages)
- Key themes in positive mentions
- Key themes in negative mentions
- Most influential or high-visibility mentions (by platform authority)

---

## Phase 2: Platform-by-platform reputation analysis

**Objective:** Assess brand reputation on each major platform individually.

For each platform where the brand has meaningful presence, use WebSearch and WebFetch to gather data, then produce a mini-assessment covering:

### Social media platforms
- **X/Twitter**: Volume of mentions, sentiment tone, engagement patterns, any viral moments
- **LinkedIn**: Company page presence, employee advocacy, industry authority, B2B perception
- **Instagram/TikTok** (if relevant): Visual brand presence, UGC content, hashtag usage
- **YouTube**: Brand channel presence, third-party review videos, comment sentiment
- **Reddit**: Subreddit discussions, community perception, common complaints or praise

### Review and rating platforms
- **Google Reviews / Google Business**: Star rating, review volume, response patterns
- **Trustpilot**: Overall score, recent trend direction, common themes
- **G2 / Capterra** (if B2B/SaaS): Category ranking, satisfaction scores, feature sentiment
- **Glassdoor**: Employer brand rating, CEO approval, "recommend to a friend" percentage
- **BBB / Yelp** (if applicable): Rating, complaint volume, resolution patterns

### Media and authority
- **News coverage**: Tone and frequency of press mentions in the last 12 months
- **Industry publications**: Presence in trade media, analyst reports, thought leadership
- **Wikipedia**: Whether a page exists, neutrality of content, any flagged issues

For each platform, assign a **reputation score from 1–10** with a one-sentence justification.

---

## Phase 3: Competitor brand presence analysis

**Objective:** Benchmark the primary brand against competitors on the same dimensions.

For each competitor identified in the input parsing phase:

1. Run parallel WebSearch queries:
   - `"[competitor name]" reviews`
   - `"[competitor name]" site:reddit.com`
   - `"[competitor name]" news`
   - `"[competitor name]" awards OR recognition`
   - `"[competitor name]" vs "[primary brand]"` — direct comparison content

2. Use WebFetch on the most informative 2–3 results per competitor to extract substantive data.

3. For each competitor, assess:
   - Overall sentiment (positive/negative/neutral ratio)
   - Strongest platforms (where they dominate)
   - Weakest platforms (where they underperform)
   - Unique brand positioning or messaging themes
   - Share of voice relative to the primary brand (qualitative estimate: higher, similar, lower)

4. Build a **competitive comparison matrix** as a Markdown table with rows for each brand and columns for:
   - Overall Sentiment Score (1–10)
   - Review Platform Strength (1–10)
   - Social Media Presence (1–10)
   - News/PR Visibility (1–10)
   - Community Engagement (1–10)
   - Employer Brand (1–10)

---

## Phase 4: Gap analysis and threat identification

**Objective:** Identify specific vulnerabilities, blind spots, and competitive threats.

Based on all data gathered in Phases 1–3, analyze:

1. **Reputation gaps**: Platforms where the brand is absent but competitors are strong
2. **Sentiment vulnerabilities**: Recurring negative themes that could escalate
3. **Competitive threats**: Areas where competitors are pulling ahead in perception
4. **Missed opportunities**: Positive trends or platforms the brand is not leveraging
5. **Crisis risk factors**: Any simmering issues that could become PR problems
6. **SEO brand protection**: Whether the brand controls page 1 of Google for its own name, or if competitors/negative content ranks prominently

For each finding, rate the **severity** (critical / high / medium / low) and **urgency** (immediate / short-term / long-term).

---

## Phase 5: Strategic recommendations

**Objective:** Provide actionable, prioritized brand improvement strategies.

Generate recommendations organized into three time horizons:

### Immediate actions (0–30 days)
- Quick wins to address critical reputation issues
- Review response strategies for negative mentions
- Platform profiles that need updating or claiming
- Content that should be published to address gaps

### Short-term initiatives (1–3 months)
- Platform-specific growth strategies for weak areas
- Content and PR campaigns to shift narrative on negative themes
- Community engagement programs (Reddit AMAs, social listening setup)
- Review generation strategies for underperforming review platforms
- Employer brand improvements if Glassdoor scores are low

### Long-term brand building (3–12 months)
- Thought leadership and authority-building programs
- Strategic partnerships or co-marketing to boost visibility
- Brand monitoring and reputation management system recommendations
- Competitive positioning adjustments based on gap analysis
- Measurement framework: KPIs to track brand health over time

Each recommendation must include:
- **What** to do (specific action)
- **Why** it matters (linked to a specific finding from the audit)
- **Expected impact** (high / medium / low)
- **Estimated effort** (high / medium / low)

---

## Phase 6: Report generation

**Objective:** Compile everything into a polished, executive-ready brand audit report.

Create a file called `brand-audit-report-[brand-name].md` in the current working directory using the Write tool. The report must include:

1. **Executive Summary** (1 paragraph): Overall brand health verdict, biggest strength, biggest risk, and the single most important recommendation.

2. **Brand Health Scorecard**: A summary table with the primary brand's scores across all dimensions (from Phase 2), plus competitor comparison scores (from Phase 3).

3. **Detailed Findings by Platform**: The full platform-by-platform analysis from Phase 2, with specific data points, quotes, and URLs as evidence.

4. **Competitive Landscape**: The comparison matrix and narrative analysis from Phase 3.

5. **Risk Register**: The gap analysis and threat identification from Phase 4, formatted as a table with columns for Issue, Severity, Urgency, and Recommended Action.

6. **Strategic Roadmap**: The full set of recommendations from Phase 5, organized by time horizon.

7. **Methodology Note**: Brief description of search queries used, platforms analyzed, and date of analysis.

Format the report with clear Markdown headings, tables, bold key findings, and horizontal rules between sections. Ensure all data points reference their source URLs.

After writing the file, confirm the filename and location to the user and provide a brief verbal summary of the top 3 findings and the single most critical recommendation.

---

## Execution instructions

- Work through all six phases sequentially. Do not skip any phase.
- Do all steps without waiting for user confirmation between phases.
- Be thorough in your web research — the value of this audit depends on real, current data.
- If a search returns no useful results for a platform, note it as "No significant presence detected" rather than fabricating data.
- Always distinguish between facts found during research and your own analytical inferences.
- If you encounter rate limits or tool errors, note the limitation and continue with available data.
- Aim for maximum information density in the final report — executives will read this.
