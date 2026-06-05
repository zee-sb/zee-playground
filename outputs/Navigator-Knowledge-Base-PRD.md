# PRD — Staffbase Knowledge Base

*Navigator's curated, governed knowledge source*

| | |
|---|---|
| **Owner** | Zyad Abuzeid |
| **Initiative** | PI-309 (Bet 07 — Search ⇄ Navigator) |
| **Pillar** | Knowledge & Answers (RAG) |
| **Bet** | 07 — Search ⇄ Navigator |
| **Status** | 🔴 Draft |
| **Linked Jira Epic** | AIW-XXX *(to be created)* |
| **Depends on** | Project Moriarty (MORI) hybrid search; Staffbase MCP (Bet 06) |
| **Related PRDs** | SharePoint Knowledge Connector (external-source precedent); Search Granular Controls (messy-content precedent) |
| **Updated** | 2026-06-03 |

> Working title. "Staffbase Knowledge Base" is used throughout; final naming is an open question (see §11). This document is written for management and cross-functional review — engineering depth lives in the linked epic and stories.

---

## 1. Context / Problem

Navigator's answer quality is capped by what it retrieves, and today it retrieves from the raw intranet. That corpus was built for humans browsing pages, not for a machine answering questions, and it fights us in three ways:

**The content is structurally hostile to ingestion.** Intranet pages are assembled from widgets, dynamic elements, and embedded apps. Visibility and permission rules are attached at the page and group level. When we ingest this as-is, we get fragments of UI chrome, half-rendered widget content, and ambiguous permission scope — which produces low-confidence retrieval and answers that are wrong, partial, or leak content a user shouldn't see.

**The content is dirty.** Customers carry years of accumulated intranet content: pages that contradict each other (three different answers to "what's our parental leave policy?"), pages last edited in 2021 that everyone still reads, and duplicate content scattered across teams. A retrieval system can't tell which version is authoritative — so it surfaces whichever scores highest, not whichever is true. Every wrong answer costs us trust, and trust is the only currency that grows MAU.

**The authoritative content often isn't in pages at all.** Policies, benefits guides, and handbooks frequently live as PDFs and documents — cleaner, more canonical, and today under-used as a knowledge source.

The cost of not solving this is direct. We have committed to growing AI MAU from **20K today to 1M by end of 2026** against a **6M** intranet TAM — a **50×** gap. You don't cross that gap on a corpus that makes the assistant look unreliable. Bad answers are the fastest way to kill adoption, and our messiest-content customers are often our largest accounts (DHL, VOICES).

**The signal we already have, and underuse:** every customer's existing intranet search produces page analytics (views, recency, traffic over the last 1–3 months) and a query log (what employees searched for, including searches that returned nothing). That data is enough to bootstrap curation intelligently instead of asking customers to start from a blank list.

---

## 2. What this is (and what it isn't)

The Staffbase Knowledge Base is **the governed corpus that the search layer queries** — the set of content a customer has confirmed as trustworthy, cleaned of widget noise, deduplicated, conflict-checked, and permission-resolved. Navigator answers from the Knowledge Base; it does not answer from the raw intranet.

It is **not a new retrieval engine.** Retrieval, chunking, embeddings, reranking, and multilingual analyzers are owned by MORI. The Knowledge Base decides *what is allowed into the index and whether it can be trusted*; MORI decides *how to find the best chunk for a query*. Clean boundary, no duplicated stack.

The product surface — the thing customers actually see and the thing we sell — is **the curation and governance tooling**: how content gets in cleanly, how conflicts and staleness get caught, and how the corpus stays healthy over time. The store itself is plumbing.

```
Employee question
      │
      ▼
  Navigator (conversation, multi-turn, actions)
      │  searchKnowledgeBase()
      ▼
  MORI hybrid search  ──────────►  STAFFBASE KNOWLEDGE BASE
  (BM25 + semantic +               (governed corpus: approved,
   rerank, multilingual)            cleaned, deduped, conflict-
                                     checked, permission-resolved)
                                          ▲
                                          │  curation + hygiene tooling
                                          │  (the product surface)
                          ┌───────────────┴───────────────┐
                   Staffbase content              External sources
                   (pages, news, PDFs)            (SharePoint, Confluence,
                                                   Drive — future)
```

---

## 3. Goals

1. **Lift answer trustworthiness on real questions.** Navigator correctly answers the top 500 historical search queries for a given customer at a materially higher rate from the Knowledge Base than from the raw intranet. *(Target: define baseline at first design partner, then ≥30 pt improvement in answerable-and-correct rate.)*
2. **Make setup fast enough that it doesn't gate activation.** A customer reaches a "good enough to answer" corpus in **one working session (≤2 hours of admin time)**, using suggested content rather than manual curation.
3. **Catch the dangerous content before it reaches an employee.** Surface and resolve high-traffic stale/conflicting content during setup, so the most-relied-upon answers are the most trustworthy.
4. **Reduce wrong/"I don't know" answers** (a leading MAU driver) without adding retrieval latency that MORI doesn't already carry.
5. **Lay a source-agnostic foundation** so external sources (SharePoint, Confluence, Drive) plug into the same governance layer later without re-architecture.

---

## 4. Non-Goals

- **Building our own retrieval/index/ranking stack.** Owned by MORI. We consume `searchKnowledgeBase`. *(Avoids duplicating a funded team's work.)*
- **Becoming a horizontal enterprise-search product.** We are not competing with Glean/standalone RAG on retrieval quality. Our moat is being inside the intranet, comms workflow, and permission model — not better embeddings. *(Wrong fight, crowded and well-funded.)*
- **Mandatory manual curation as the primary path.** If the default experience is "here are 10,000 pages, pick the good ones," we've recreated the labor the AI was supposed to remove. Manual selection is the exception, not the cost of entry. *(Directly protects the activation goal.)*
- **Authoring or editing source content.** The Knowledge Base curates and governs what exists; it does not become a CMS or fix the source pages. Owners fix content at the source. *(Separate problem, separate surface.)*
- **External sources in v1.** SharePoint et al. are designed-for, not built-in v1. *(Sequencing, not exclusion — see §9.)*
- **Replacing the intranet search experience for humans.** This is the corpus Navigator queries, not a redesign of employee-facing site search. *(MORI/Search team scope.)*

---

## 5. User Stories

**Admin / Comms / Knowledge owner (setup)**
- As an intranet admin, I want Navigator to *propose* the content that answers most employee questions — ranked from my existing page and search analytics — so I can approve a strong starting corpus in one sitting instead of building a library by hand.
- As an admin, I want to see which of my high-traffic pages are stale or contradict each other, so I can fix or retire the dangerous content before employees ask about it.
- As an admin, I want my policy and benefits PDFs treated as first-class, trusted sources, so the authoritative documents drive answers rather than out-of-date wiki pages.
- As an admin, I want to confirm that the Knowledge Base respects existing visibility/permission rules, so no employee gets an answer from content they shouldn't see.

**Knowledge owner (ongoing)**
- As a content owner, I want to be notified when content I own goes stale or when employees keep asking something it can't answer, so the corpus stays healthy without a periodic manual audit.
- As an admin, I want a view of "questions employees asked that we couldn't answer well," so I know what content to add next.

**Employee (outcome, indirect)**
- As an employee, I want Navigator's answers to be correct and current, so I trust it enough to ask again instead of falling back to messaging a colleague or HR.

**CSM / internal**
- As a CSM onboarding a customer, I want a guided flow that turns their existing intranet into a working Knowledge Base in one call, so activation isn't blocked on the customer doing homework.

---

## 6. Solution Overview

Four capabilities, in the order an admin experiences them.

### 6.1 Suggest, don't ask (analytics-driven candidate set)
On connect, we read the customer's existing page analytics and search logs and produce a ranked candidate set rather than a flat list. Two signals drive it:

- **Supply signal** — page traffic and recency identifies what's *canonical*: the pages employees actually use.
- **Demand signal** — the query log, especially **failed searches** (zero results, no click, repeated/rephrased queries), identifies *gaps*: questions employees have that current content doesn't answer. This is where Navigator would otherwise embarrass itself, and almost no one mines it.

The admin is presented with "here are the ~40 pages and documents that answer ~80% of what your people ask" and approves the shortlist. Curation becomes *confirmation*, not *construction*.

### 6.2 Content hygiene (the headline feature)
For the candidate set we run:
- **Widget/chrome stripping** — extract the real prose from widget-assembled pages; drop UI scaffolding.
- **Deduplication and conflict detection** — cluster overlapping content and flag contradictions ("these three pages disagree on parental leave").
- **Staleness detection** — flag content past a freshness threshold or orphaned by ownership.
- **Risk ranking** — cross traffic × staleness/conflict. *High-traffic + stale/conflicting = top of the cleanup queue*, because that's where the most people are relying on something wrong. This single view ("1,400 people read this last month; last updated 2021; conflicts with X") is the most persuasive thing we can show an admin and largely sells the product on its own.

### 6.3 PDFs and documents as first-class, higher-trust sources
Documents (PDFs, handbooks, policy files) are ingested as canonical units and default to higher trust than widget-heavy pages. This sidesteps much of the page-noise problem and aligns trust with where authoritative content actually lives.

### 6.4 Governance and the closing loop
- Every Knowledge Base entry has a **human owner**.
- Owners are notified on staleness and on **unanswered-question signals** from Navigator's own query stream.
- An admin "content gaps" view turns failed questions into a prioritized add-list, so the corpus improves continuously instead of decaying like the intranet did.

### Retrieval boundary (explicit)
The Knowledge Base exposes its governed corpus to MORI. MORI owns chunking, embeddings, reranking, multilingual analyzers, and access-control enforcement at query time. Navigator calls `searchKnowledgeBase`. We add no parallel retrieval path.

---

## 7. How it fits the Staffbase product

- **Pillar:** This is the spine of Pillar 1 (Knowledge & Answers / RAG). It's the missing governance layer between raw intranet content and reliable answers.
- **Bet:** Sits inside Bet 07 (Search ⇄ Navigator) and is the corpus half of the Search–Navigator unification; MORI is the retrieval half.
- **Studio:** The curation and governance tooling lives as a surface in Studio (Pillar 5, Admin & Studio), alongside knowledge sources and analytics. It is a flagship capability inside Navigator/Studio — **not a separately licensed SKU and not a separate configuration product.** That keeps it consistent with our "no separate license cost, native to the intranet" positioning against Copilot.
- **Concierge (Bet 04):** The setup flow should be delivered *through* the Concierge first-run wizard, not as a parallel onboarding. Concierge runs the connect-and-suggest step; the Knowledge Base is what it produces.
- **Staffbase MCP (Bet 06):** Longer term, Knowledge Base entries and their governance state become agentic primitives exposed via Staffbase MCP.

---

## 8. Onboarding customers

The whole point is that setup is *assisted and fast*, delivered by Concierge and co-piloted by a CSM on a single call.

1. **Connect** — point at the existing intranet workspace. No new content required. *(Minutes.)*
2. **Suggest** — we read page + search analytics and present the ranked candidate shortlist (supply + failed-search demand). *(Automatic.)*
3. **Triage the risk queue** — admin reviews the high-traffic stale/conflicting items first; resolve, retire, or accept. *(The persuasive moment.)*
4. **Confirm the corpus** — approve the shortlist; PDFs/documents fold in as trusted sources. *(One sitting.)*
5. **Validate** — replay the customer's own top historical questions against the new Knowledge Base and show the answerable-and-correct rate. *(Proof before go-live; see §10 — the search log doubles as the eval set.)*
6. **Go live + close the loop** — Navigator answers from the Knowledge Base; owners get staleness and gap notifications; the content-gaps view drives the next additions.

**Cold-start is covered:** ranking is bootstrapped from analytics the customer already has pre-Navigator. **Caveat to design around:** people type 2–3 keyword searches but ask Navigator full questions, so historical keyword logs under-predict the conversational long tail. Use them to bootstrap v1, then replace the demand model with Navigator's own query stream as soon as it exists.

---

## 9. Value — now and in the future

**Now (this is the wedge):**
- **Unblocks the MAU goal at the root.** Trustworthy answers are the precondition for the 20K → 1M climb. This is the quality foundation everything else compounds on.
- **De-risks our largest accounts.** DHL/VOICES-scale customers have the messiest content and the most scrutiny; risk-ranked cleanup is exactly what they need to trust a rollout.
- **A demoable "aha."** The traffic × staleness view ("1,400 readers, last updated 2021, conflicts with another page") lands in seconds with execs and buyers.
- **Faster activation.** Suggest-don't-ask plus Concierge means setup stops being homework, which helps work down the 70+ activation backlog.

**Future:**
- **Source-agnostic knowledge layer.** The same governance model accepts SharePoint, Confluence, and Drive. "Clean Staffbase content" and "bring in external content" become one architecture — a meaningful expansion of where Navigator can answer from, and a competitive answer to "but our knowledge isn't all in Staffbase."
- **Governance as a differentiator.** Conflict/staleness detection and ownership-routing are content *governance*, not retrieval — a defensible capability that horizontal RAG tools don't touch because they sit outside the workflow.
- **A standing evaluation asset.** The query-log-as-eval-set becomes a permanent, per-customer ground-truth harness — directly useful for the broader Navigator evaluation/metrics-trust problem.
- **Feeds Staffbase MCP.** A clean, owned, permissioned corpus is the substrate for exposing intranet knowledge as agentic primitives.

---

## 10. Success Metrics

**Leading (days–weeks)**
- Answerable-and-correct rate on the customer's top-500 historical queries, Knowledge Base vs. raw-intranet baseline. *(Target ≥30 pt lift; measured via the query-log eval harness at each design partner.)*
- Time-to-first-good-corpus: admin time from connect to confirmed corpus. *(Target ≤2 hours / one session.)*
- % of high-traffic stale/conflict items triaged during setup. *(Target ≥80% of the flagged risk queue.)*
- Navigator "couldn't answer / not confident" rate post-cutover. *(Target: down vs. pre-Knowledge-Base.)*

**Lagging (weeks–months)**
- Navigator MAU and return-usage at Knowledge-Base customers vs. raw-intranet customers (contribution to the 1M EOY goal).
- Answer-feedback (thumbs / citation-trust) trend.
- Activation throughput against the 70+ backlog where Concierge + Knowledge Base is used.
- Reduction in retrieval/citation issues logged (e.g., the VOICES triage page).

**Measurement method:** the historical search query log is the per-customer evaluation set — real questions in employees' own words — replayed against the Knowledge Base. This makes "is it actually better?" measurable on day one rather than an LLM-judge guess.

---

## 11. Risks & Open Questions

| # | Risk / question | Owner | Blocking? |
|---|---|---|---|
| 1 | **Unit of a Knowledge Base entry** — page? document? chunk? Q&A pair? Decides how conflict detection, attribution, and ownership work; PDFs and widget-pages don't share a natural unit. | Eng + PM | **Blocking** — needed before spec |
| 2 | **MORI interface and timeline** — does `searchKnowledgeBase` accept a governed/filtered corpus, and is Phase 3 ("connect search with the AI Assistant") committed on paper? | PM ↔ MORI (Anna/Marvin) | **Blocking** |
| 3 | **Analytics availability & quality** — how good is pre-Navigator page/search data at the messiest customers (DHL)? Thin data degrades suggest-don't-ask back into manual selection. | PM + Data | Blocking for those accounts |
| 4 | **Permission resolution** — where do visibility rules get enforced, at curation time, query time, or both? Must not leak restricted content. | Eng + Security | Blocking |
| 5 | **Conflict detection accuracy** — false "conflicts" erode admin trust in the tool itself. What precision bar ships? | Eng + Data | Non-blocking, design-time |
| 6 | **Keyword-vs-conversational gap** — historical keyword logs under-predict conversational questions. Bootstrap plan + swap to Navigator query stream. | PM | Non-blocking |
| 7 | **Naming / positioning** — "Knowledge Base" as a feature in Studio vs. a named product. Avoid implying a separate SKU/config product. | PM + PMM | Non-blocking |
| 8 | **Overlap with existing Knowledge Source config** in Studio — is this a replacement, an evolution, or a new surface? | PM | Blocking for scope |

---

## 12. Rollout Plan

- **Phase 0 — Validation (cheapest test first).** Take one design partner's messiest content set (VOICES or DHL). Manually run the hygiene pass: how much auto-cleans, how much needs a human, how many real conflicts surface, how good is the analytics signal. This number tells us whether this is a feature, a layer, or a product — and sets the §3 baselines. *No build.*
- **Phase 1 — Closed alpha (1–2 design partners).** Analytics-driven suggestion + hygiene/risk queue + PDF ingestion, delivered through Concierge, corpus served to MORI. Validate against the partner's top-500 query eval set.
- **Phase 2 — Beta.** Add ownership/closing-loop notifications and the content-gaps view; widen to more activation-backlog customers; harden permission resolution.
- **Phase 3 — GA inside Studio.** Default path for new Navigator activations via Concierge.
- **Phase 4 — External sources.** SharePoint/Confluence/Drive into the same governance layer.

**Phasing principle:** keep the v1 P0 ruthlessly tight — connect, suggest, hygiene/risk-triage, confirm, serve-to-MORI. Ownership loop, gaps view, and external sources are explicitly later.

---

*Prepared for management / business review. Published under **Bet 07 — Search ⇄ Navigator (PRDs)** in the AW space. Next steps on request: create the AIW epic and story breakdown, reconcile with the existing SharePoint Knowledge Connector PRD, or produce an exec slide version.*
