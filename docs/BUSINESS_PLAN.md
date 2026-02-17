# MONEY PRINTER 3000 — Business Plan

**Last updated:** 2026-02-16
**Status:** Active — Week 1
**Budget:** $5,000
**Timeline:** 3 weeks
**Team:** Senior engineers (PM + backend + frontend agents)

---

## Mission

Use AI influencers to generate UGC videos that convert on TikTok Shop. Dogfood the product to generate affiliate revenue, capture a performance feedback loop, and build the SaaS offering simultaneously.

## The Dual Flywheel

**Flywheel 1 (Revenue):** Kalodata finds winning products → App generates UGC → Post to TikTok Shop → Earn affiliate commissions → Data flows back

**Flywheel 2 (Product):** Every video generated is a real user session → Every TikTok post is a conversion test → Performance data trains product intelligence → Better product attracts paying users

**Strategy: Run flywheel 1 aggressively to fund and inform flywheel 2.**

---

## Budget Allocation ($5,000)

| Bucket | Amount | Purpose |
|--------|--------|---------|
| Video generation (API costs) | $2,100 | ~300 videos across 30-40 products |
| Kalodata subscription | $200 | Product intelligence + competitor analysis |
| TikTok Shop deposits/samples | $500 | Product samples for authenticity signals |
| Infrastructure (Vercel/Railway/Redis) | $200 | 3 weeks of hosting |
| ElevenLabs pro tier | $100 | Higher rate limits, more voices |
| Reserve / contingency | $400 | Failed runs, re-generations, unexpected costs |
| Engineering team | $1,500 | Part-time senior contractors, or $0 if salaried |

---

## Week 1: Revenue Engine (Ship the money printer)

**Goal:** First affiliate revenue within 7 days. 100 videos generated, 50 posted.

### Day 1-2: Product Selection Sprint (Kalodata)

This is where 80% of revenue is determined — not the video quality.

**Kalodata workflow:**
1. Filter TikTok Shop for products with: commission rate >15%, GMV trending up (7-day), <50 affiliate creators (low competition), product price $20-80 (impulse buy range)
2. Cross-reference with category performance: supplements, skincare, beauty tools, kitchen gadgets, fitness accessories
3. Build a **Top 30 product hitlist** ranked by: `(commission_rate × avg_daily_GMV × inverse_creator_count)`
4. For each product, capture from Kalodata: top-performing video hooks, avg watch time, conversion rate benchmarks, peak posting times

**Deliverable:** Spreadsheet with 30 products, each with target commission, reference video URLs, and 2-3 hook angles sourced from Kalodata's top-performing content.

### Day 3-5: Batch Generation Sprint

**Fix Tier 0 bugs first** (B0.27 cost double-charge is literally burning money). Then batch-generate:

- 30 products × 3 tone variations = 90 videos (Wave 1)
- Use Kalodata reference videos as inputs to R1.3 (reference video intelligence)
- Prioritize tones based on category: `big-sis` for skincare, `hype-man` for fitness, `trusted-expert` for supplements
- Budget: 90 videos × $7 = $630

**Critical engineering for this week:**
1. **Fix B0.27** (stop bleeding money on retries) — 2 hours
2. **Fix B0.28** (rollback for B-roll failures) — 1 hour
3. **Auto-approve mode** for analysis + script stages when confidence is high (hook score >10, all validations pass) — 4 hours
4. **Queue dashboard** — Simple page showing all active/queued projects with status — 4 hours

### Day 5-7: Post + Measure

- Create 3-5 TikTok accounts (different personas/niches)
- Post 50 best videos (curate from the 90, reject obvious quality issues)
- Schedule: 3 posts/day/account, staggered across peak hours (Kalodata tells you when)
- Set up tracking: map each video to its product + project in the app

**Week 1 Revenue Target:** $0-200 (TikTok takes 3-7 days to attribute sales, videos need 48-72 hours)

---

## Week 2: Optimize + Scale (Double down on winners)

**Goal:** Identify top 5 products, generate 150 more videos, first meaningful revenue.

### Day 8-10: Performance Analysis

Use Kalodata + R2.0 analytics:

**Key metrics:**
- **View-through rate** — Which hooks are people watching past 3 seconds?
- **Conversion rate** — Which products are actually selling?
- **Revenue per video** — `(commission × units_sold)` per video
- **Cost per revenue dollar** — `$7 video cost / revenue generated`

**Expected pattern:** 10% of videos will drive 80% of revenue. Identify winners by product AND creative approach.

**Kill list:** Drop products with <1% conversion rate after 5 days. Reallocate budget.

### Day 10-12: Winner Multiplication

For the top 5 products:
- Generate 10 variations each (different hooks, tones, influencers, scene presets) = 50 videos
- A/B test hooks: question vs. shock vs. social proof vs. transformation
- Test posting times based on Kalodata peak engagement windows
- Budget: 50 videos × $7 = $350

**Engineering priority this week:**

| Priority | Item | Why Now |
|----------|------|---------|
| 1st | R1.5.26 - Scripting validation | Bad scripts waste $7 each |
| 2nd | R1.5.27 - LLM retry in BaseAgent | Pipeline failures on LLM timeouts cost re-runs |
| 3rd | Hook variant generation | Quick win: generate 5 hook variants per winning product |
| 4th | Kalodata integration stub | Import product data from Kalodata CSV into product entity |

### Day 12-14: Scale Posting

- Post all 50 winner variations
- Re-post top 3 performing videos with minor caption tweaks
- Total posted: ~100 videos live across 3-5 accounts

**Week 2 Revenue Target:** $500-1,500

---

## Week 3: Feedback Loop + SaaS Foundation

**Goal:** Prove the revenue model, capture the feedback loop, lay SaaS groundwork.

### Day 15-17: Data-Driven Generation

2 weeks of performance data available. Build the feedback signal:
- Which hook templates convert highest per category?
- Which tones work for which product types?
- Which influencer personas get the best watch-through?
- What's the optimal video length / pacing?

Feed insights back into generation:
- Weight ScriptingAgent template selection toward proven winners
- Default tone selection based on category performance data
- Adjust energy arcs based on watch-through patterns

**Generate Wave 3:** 100 videos, informed by 2 weeks of data. Expected 30-50% higher conversion rate vs. Week 1.
Budget: 100 videos × $7 = $700

### Day 17-19: SaaS Packaging

**Engineering priority:**
1. **Landing page** — Show real results: "X videos generated, $Y revenue, Z% conversion rate"
2. **Onboarding flow** — Simplified: paste product URL → select influencer → approve script → get video
3. **Pricing page** — Usage-based: $X per video or $Y/month for Z videos. Anchor against $500-2,000 agency UGC
4. **Waitlist / early access** — Capture emails from TikTok creators who see AI content and DM asking "how?"

### Day 19-21: Distribution

- Post results on Twitter/X (AI UGC is a hot topic)
- Post in TikTok Shop seller communities (Reddit, Discord, Facebook groups)
- DM top TikTok Shop affiliates with results
- Create "making of" TikTok showing the tool in action (meta-content)

**Week 3 Revenue Target:** $1,000-3,000

---

## Revenue Projections (Conservative)

| Week | Videos Live | Avg Revenue/Video | Total Revenue | Cumulative |
|------|------------|-------------------|---------------|------------|
| 1 | 50 | $2 | $100 | $100 |
| 2 | 150 | $5 | $750 | $850 |
| 3 | 250 | $8 | $2,000 | $2,850 |
| Week 4+ (organic) | 250 (still earning) | $4 (decay) | $1,000/wk | $3,850+ |

**Break-even:** ~Week 2-3 on API costs. Full budget recovery by Week 4.

---

## What Not to Build (YAGNI for 3 weeks)

| Tempting Feature | Why Skip |
|-----------------|----------|
| Multi-user auth (R4.1) | You're the only user for 3 weeks |
| Campaign dashboard (R2.6) | Spreadsheet is fine at 30 products |
| Batch CLI mode (R3.1) | Queue 15 projects from UI is fast enough |
| TikTok auto-publishing (R4.2) | Manual posting lets you curate quality |
| FFmpeg self-hosted render (R3.3) | Creatomate at $0.50/render is fine at this volume |
| Full Kalodata API integration | CSV import + manual curation is faster to ship |

---

## Prioritization Framework

When deciding what to build next, apply this filter in order:

1. **Is it losing us money right now?** → Fix immediately (Tier 0 bugs like cost double-charge)
2. **Does it increase video output volume?** → High priority (batch throughput, auto-approve, retry logic)
3. **Does it increase conversion rate?** → High priority (better hooks, data-driven tone selection, validation)
4. **Does it reduce cost per video?** → Medium priority (only after volume + conversion are solid)
5. **Does it attract SaaS users?** → Week 3 priority (only after we have real results to show)
6. **Is it nice to have?** → Backlog (polish, UI improvements, advanced features)

**The meta-rule:** Every engineering hour should either make money or save money. If it does neither, it waits.

---

## Success Metrics

| Metric | Week 1 | Week 2 | Week 3 |
|--------|--------|--------|--------|
| Videos generated | 90 | 150 | 100 |
| Videos posted | 50 | 100 | 100 |
| Pipeline success rate | 70% | 85% | 90% |
| Avg cost per video | $7.00 | $6.50 | $6.50 |
| Affiliate revenue | $100 | $750 | $2,000 |
| Cost per revenue dollar | $3.50 | $0.87 | $0.33 |
| Top product conversion rate | 1% | 3% | 5% |
| Waitlist signups | 0 | 0 | 50+ |

---

## Key Tools & Data Sources

| Tool | Purpose | How We Use It |
|------|---------|---------------|
| **Kalodata** | TikTok Shop analytics | Product selection, competitor analysis, peak timing, trending hooks |
| **TikTok Creative Center** | Trending content | Reference videos for R1.3 video intelligence |
| **R2.0 Analytics (internal)** | Performance tracking | Map our videos to revenue, identify winner patterns |
| **Supabase `generation_log`** | Pipeline observability | Debug failures, optimize pipeline reliability |

---

*This plan is a living document. Update weekly based on actual performance data. Revenue projections are conservative — adjust targets based on Week 1 actuals.*
