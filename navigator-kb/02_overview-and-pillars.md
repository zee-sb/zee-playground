# Navigator — Product Overview & The 5 Pillars

## What Navigator is
**Navigator** is Staffbase's AI assistant for every employee — office and frontline/deskless. It was renamed from "AI Assistant" to "Navigator" on 2026-05-06 (the Slack feedback channel was renamed the same day). It is internally anchored on Jira initiative history **PI-152**.

**Why it exists:** free HR / People Ops / IT from repetitive policy questions, and give every employee — especially frontline — instant clarity, personalized explanations, and a connection to their workplace.

**Positioning:** Navigator is an **orchestration layer over existing systems**, not a replacement. It spans web, mobile, and chat (including WhatsApp). Customer-facing differentiation vs. Microsoft Copilot and similar: native to the Staffbase intranet, includes Assistants/Collections (multi-agent), permission-aware retrieval, and no separate license cost.

## The 5 capability pillars (canonical decomposition)
Every PRD, epic, and roadmap item should be classifiable to exactly one pillar. Different pillars have different bottlenecks.

1. **Knowledge & Answers (RAG)** — accurate, permission-aware retrieval. Index strategy, relevance, reliability. Built on Azure AI Search; converging onto MORI hybrid search. *Bottleneck: depends on the Search platform team.*
2. **Actions & Integrations** — action framework + API orchestration, leaning on Truto for connectivity. Tiered model: **Assist → Trigger → Execute** (Trigger is the default; Execute is selective).
3. **Agent Intelligence (Core Brain)** — prompting, intent routing, tool calling, evaluation. *Bottleneck: evaluation trust (LLM-as-judge is not yet ground truth).*
4. **Employee Experience** — chat UI, rich web/mobile surfaces, cross-channel consistency, feedback + analytics.
5. **Admin & Studio** — agent configuration, knowledge sources, integrations, role/group visibility, analytics, conversation logs. Where customers control and trust the system. "Studio" is built collaboratively, not by a separate team.

## Pillars vs. bets
The 5-pillar model is the canonical decomposition for **capability**. The 7 bets (see `03_strategy-seven-bets-and-2.0.md`) are the **strategic shape** for H2-2026 — they cut across pillars; they do not replace them. When framing work: first identify the pillar (what capability), then the bet (which strategic container).

*Source: AW Confluence "Navigator – the AI Assistant" homepage (6081642955); pillar model per Zee.*
