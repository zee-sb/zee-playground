# Navigator Concierge — Context Lifecycle

For research and design. The question is not "what do we scrape" but "what does Navigator know, how does it learn it, and how often does that knowledge refresh." Treat the workspace blueprint as a living index with three temporal layers, not a one-time setup payload.

## The three layers

**Setup layer (slow, structural).** Runs once at install, then quarterly. This is the company's *shape* — the things that change only when the company itself changes: spaces, groups, profile schema, channel taxonomy, page IA, launchpad inventory, glossary, brand voice, locales. Most of these come from native Staffbase APIs and admin annotation.

**Refresh layer (medium, behavioral).** Runs daily or weekly, delta-only. This is what the company is *doing right now* — new posts, new pages, active campaigns, search queries, engagement signals. We do not re-read everything; we read the diff and re-cluster topics when enough new signal has landed.

**Live layer (real-time, personal).** Runs per query, no caching. This is who is asking and from where — the user's profile, their group memberships, the page they came from, the language they're typing in, the time of day, their last 7 days of activity.

Most of Navigator's "wrong" answers will trace back to confusion about which layer a piece of context belongs in. A user's department is live (people change roles); the existence of the "Cost Center" custom field is setup; the trending topic in #news-emea is refresh.

## Setup layer — what to ingest and how deep

**Spaces and groups.** Strongly agree this is one of the highest-leverage signals. Spaces tell us how the company is *organized* (BUs, geographies, brands); groups tell us how Comms *segments* its audience. We want: space hierarchy with parent/child relationships and owners, group definitions (static vs dynamic, member counts, the rule if dynamic), and any descriptions the admin already wrote. Most groups will have no description — those become candidates for admin annotation in the setup wizard. We do not need member lists at setup time; member lookups are live.

**Profile schema with sample-based inference.** This is the unlock you flagged. Standard fields (name, email, manager, department) are cheap. Custom fields are where customer-specific meaning lives — "Wave 3", "Cost Center 4502", "Region: EMEA-North", "Persona: Frontline" — and the label alone is rarely enough.

The pattern that works: read the field schema (label, type, cardinality, required/optional), then sample ~50 anonymized profiles per field to surface the value distribution. Low-cardinality fields (10-30 distinct values) are categorical taxonomies — we can show the values to the admin and ask "what does this field mean and how should Navigator use it?" High-cardinality fields are graph or temporal axes — we just note their type. The admin's annotation becomes part of the blueprint. We never store the sample values themselves verbatim — we store the inferred *shape*.

**Channels with semantic descriptions.** Names plus what they're for, audience, posting cadence, whether they're announce-only. Channel descriptions are also a strong topic prior (more on this below).

**Page IA.** The page tree, top 2-3 levels, with owners — not full content. Page bodies are refresh-layer territory and only the canonical ones get deep-indexed.

**Launchpad.** Agree, high-leverage and underrated. Each launchpad item gives us app name, category, icon, deeplink, and which audience sees it. From a launchpad full of "Concur, ServiceNow, Workday, Confluence" we instantly know the SaaS stack, can route "how do I file an expense" to Concur, and can use deeplinks as part of the answer rather than reinventing flows. Audience-scoped launchpads are even better — they tell us which tools matter for frontline vs HQ vs IT.

**Glossary, brand basics, locales.** The vocabulary baseline. Glossary entries can be seeded from admin input plus mined from repeated capitalized tokens across channel names, page titles, and launchpad labels.

## Refresh layer — and the topics question

You're right that we cannot read every news post and every page. We do not need to. Topics are cheap to approximate if we pick the right signals:

- **Channel structure as a topic prior.** Channel names plus descriptions already define ~70% of the topic space for most customers. #benefits, #safety, #it-support, #emea-news — that's topics for free.
- **Search query log clustering.** Top 500–1,000 search queries cover the bulk of employee demand. Clustering these tells us what people are *trying* to find, which is more useful than what was posted.
- **Title-only ingestion of posts and pages.** One line per item, not the body. A monthly tenant with 10,000 posts is a few hundred KB of titles — trivial to cluster.
- **Engagement-weighted body sampling.** Read the full body only for the top 100–200 most-read pages and most-engaged posts. Engagement is a strong filter for "what matters."
- **Native taxonomy where it exists.** Hashtags, categories, content tags — many customers already maintain a taxonomy; we should respect it before inferring our own.
- **Skip:** comments, profile bios, system messages, archived content, low-engagement long tail.

Refresh cadence for topics: re-cluster weekly, or earlier if N% of new content has landed or engagement patterns have shifted materially. The cluster set itself is small and stable; we are not re-running an LLM on every post.

Other refresh signals: new posts (delta), new pages (delta), pinned/featured content, active campaigns, engagement deltas on existing content (to detect "this page is suddenly being read a lot — something changed").

## Live layer — per query

The asking user's profile snapshot, group memberships, recent activity (last 7 days of reads, searches, posts, reactions), current date, timezone, language preference, and where in the app they are. None of this is cached at the workspace level. It's pulled fresh per query because freshness matters more than performance here — Navigator answering "your manager is X" with stale data is worse than waiting 200ms.

## Suggested cadence summary

| Layer | Signal | Cadence |
|---|---|---|
| Live | User profile, group membership, recent activity, app context | Per query |
| Refresh | New posts, new pages (delta), search query log, engagement | Daily |
| Refresh | Topic re-cluster, channel description re-sync | Weekly |
| Setup | Glossary review, profile field re-sample, launchpad audit | Monthly |
| Setup | Spaces, groups, page IA, brand basics — full re-discovery | Quarterly |
| Event | New channel / space / form / launchpad item added by admin | Webhook |

## Depth tradeoffs

The rule of thumb: build a **wide, shallow graph** of "what exists, what it's about, who owns it" — and deep-dive only on retrieval. We do not embed full content for everything. Tier it:

- **Canonical sources** (policies, glossary, HR handbook, IT how-tos): full embedding, freshness tracked, version-aware.
- **News and posts**: title plus first paragraph, topic tag, author, audience.
- **Discussions and comments**: existence only, topic tag.
- **Profile content**: schema only at setup; values only at live.

## What this means for research

We need to validate, with 5–10 admin interviews: do admins actually understand their own profile field schema? Often no — fields were defined by a predecessor and never documented. The co-discovery flow ("here are 3 sample values, tell us what this means") is the right pattern, but the *tolerance* for this kind of admin work is unknown. We also need to test multilingual tenants explicitly — a workspace that is 50% English, 30% German, 20% Spanish breaks topic clustering unless we go language-aware from day one.

## What this means for design

The setup wizard cannot be a single dump. Custom fields, groups, and channels each need their own progressive-disclosure step, with clear "skip and confirm later" paths. We need a freshness indicator on Navigator's answers — when retrieval pulls from inferred topic vs admin-confirmed topic, show that distinction in the trust layer. An admin "context dashboard" is implied: *here's what Navigator knows about you, here's what it inferred, here's what needs your confirmation*. And the launchpad pattern should be visible in answers — if Navigator routes a user to Concur, the answer surfaces the launchpad icon and deeplink, not a reinvented flow.

## Risks to flag

Permission graph must be respected at retrieval, not just at indexing — a user asking "what's the comp band for L5" should not retrieve content they're not entitled to even if it's indexed. PII on profile sampling: sample structure, never values. Multi-tenant isolation is table stakes. Launchpad staleness is real — companies forget to update links — so we need a "this link last verified X ago" signal. And topic clusters need admin-in-the-loop, or we will confidently route "parental leave" questions to a stale 2021 policy page that's still well-indexed.
