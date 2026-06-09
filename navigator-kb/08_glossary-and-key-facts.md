# Navigator — Glossary & Quick-Reference Facts

## Identifiers & links
- **Atlassian site:** mitarbeiterapp.atlassian.net — cloudId `f21a160d-83b9-4390-8be5-c52e332d0043`
- **AW Confluence space** ("AI Assistant"): spaceId `6081642580`, key `AW`. Homepage 6081642955.
- **Initiative Map:** AW 6976798741 · **Strategy (Layer 1):** AW 6918012931 · **Discovery Plan (Layer 2):** AW 6967787581
- **AIW Jira project** ("AI Assistant"): projectId `11832`, key `AIW`. Issue types: Epic, Story, UX Story, UX Debt, Technical Debt, Bug, Task, Spike, Sub-task, Security Vulnerability.
- **PI initiatives:** PI-152 (Bet 01), PI-303 (Bet 00), PI-304 (Bet 02), PI-305 (Bet 03), PI-306 (Bet 04), PI-307 (Bet 05), PI-308 (Bet 06), PI-309 (Bet 07). External: PI-199 (Staffbase MCP), PI-38 (MORI hybrid search), PI-163 (AI Quality Gates).
- **Slack feedback channel:** #feedback-navigator — `C09S7QQP1NF` (renamed from #feedback-ai-assistant on 2026-05-06).
- **Internal team channel:** #team-navigator-internal — `C09DGLJP0Q4` (private).
- **Intranet:** Campsite (campsite.staffbase.com) — Staffbase's real internal intranet, the canonical workspace model.

## Useful JQL
- Open high-priority work: `project = AIW AND status not in (Done,"Won't do") AND priority in (Critical,High) ORDER BY updated DESC`
- Zee's epics: `project = AIW AND issuetype = Epic AND assignee = currentUser()`
- By bet: scope to the PI initiative key, then refine by AIW key.

## Glossary
- **Navigator** — Staffbase's employee AI assistant (formerly "AI Assistant").
- **Studio** — the admin surface (Pillar 5): agent config, knowledge sources, integrations, visibility, analytics, logs.
- **Assistants / Collections** — multi-agent: specialized assistants per topic/audience within a tenant.
- **Concierge** — Bet 04; auto-context scan that grounds Navigator on activation with zero client setup.
- **MORI** — the hybrid-search platform (OpenSearch-based) Navigator 2.0 consumes for retrieval; owned by the Search team (PI-38).
- **Staffbase MCP** — Bet 06; exposes Staffbase capabilities as agentic primitives so Navigator becomes the conversation surface for the whole intranet (consumes PI-199).
- **A2A** — agent-to-agent orchestration (Bet 05).
- **Truto** — connectivity layer leaned on for Actions (Pillar 2).
- **Langfuse** — current eval/observability tooling; LLM-as-judge here is not yet trustworthy as ground truth.
- **Action tiers** — Assist → Trigger → Execute (Trigger is default; Execute selective).
- **Response shapes** — answer / clarify / offer_options / propose_action / refuse / escalate (structured-output field in 2.0).
- **Latency tiers (2.0)** — Instant <400ms / Researching 400–1500ms / Deep 1.5–8s / Acting variable.

## Tech stack constraints
- Model: GPT-4.1-mini today; GPT-5-mini next (per-turn tiering in 2.0). Azure-only.
- Retrieval: Azure AI Search today → converging on MORI hybrid search.
- Two killed bets: live voice (→ push-to-talk), mem0 memory.

## Things people commonly get wrong
- **1M is the goal, not the TAM** (TAM = 6M).
- **Thilo Schmalfuß ≠ Tilo Zemke** — different people.
- **PI-152 is now Bet 01**, not the umbrella initiative.
- **The PRD Master Index is retired** — PRDs live under per-bet folders.
- **mem0 is dead** — don't promise persistent user memory; manage "Navigator learns about me" expectations.
