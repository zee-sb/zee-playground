# Navigator — Team, Roster & Collaborators

*Roster confirmed by Zee 2026-06-01 from #team-navigator-internal (C09DGLJP0Q4, private). Structure per AW page 6781370400.*

## The squad (who's on the team)
| Person | Discipline | Owns / focus | Slack |
|---|---|---|---|
| **Zee (Zyad Abuzeid)** | Principal PM, owner | All 5 pillars | U09PVV3JT0W |
| **Thilo Schmalfuß** | Engineer — de facto **backend tech lead** | Conversation logs (NAV-216), Aggregated Analytics (NAV-537), local dev, Langfuse automation | UC0PF0ZEE |
| **Willi Mentzel** | Senior Backend Engineer | Anonymization (NAV-403), BE/API tests. *Vacation 2026-06-05 → 06-22* | U014FV8PS30 |
| **Jacek Gajek** | External Kotlin/Backend Dev | Koog adoption (NAV-1020), Structured Output (text+sources) plan | U08DN4ARPQS |
| **Leah Peschel** | Fullstack Engineer | — | U044THJQUHL |
| **Maxim Zhogov** | Frontend Engineer | Search Summary, session/link/source handling | U09PUA3JYUD |
| **Christian Stehr** | Frontend Engineer | New Navigator UX mobile/desktop (NAV-511), Search-in-Navigator | U03LFR0NUH1 |
| **Filip Pižl** | Staff Product Designer (Pull) | Studio UX, permissions, agent-config concepts | UG8V3C7NC |
| **Friedrich Schubert** | Senior Product Designer | Pull / Navigator / Search; runs retro cadence | UH8C1MWKT |
| **Samer Fatayri** | Engineer | Evaluation/quality (Langfuse evals) | U087QDHJKPA |

**Discipline split for assigning work:** BE = Thilo (lead), Willi, Jacek · Fullstack = Leah · FE = Maxim, Christian · Design/UX = Filip, Friedrich · Evals/quality = Samer · PM = Zee.

**Explicitly NOT on the squad (stakeholders / other teams):** Jasmina (activation ops), Matang Dave (created the channel, U07U15M8FDM), Khaled Garbaya (agent-framework/architecture), Sergii Vorobei (ServiceNow discovery), **Tilo Zemke** (tilo@, U3ZAAJLE6 — ⚠️ distinct person from Thilo Schmalfuß, don't confuse).

## Team structure & capability gaps
**Today:** ~9–10 people. Target Phase 1: **~12**. Three additions Zee is pushing for:
- **ML / Data Scientist** 🔴 critical — fix evaluation (current LLM-as-judge via Langfuse is structurally inaccurate; resolution rate can't be trusted as ground truth). Builds human annotation, custom eval model, automated scoring.
- **Platform / Search Engineer** 🟠 high — internalize the external dependency on the Search team for retrieval/indexing/ingestion.
- **AI / Integrations Engineer** 🟡 medium — actions framework + external connectors (ServiceNow, SharePoint, Confluence). Plan now, hire next.

Intentionally NOT adding: separate eval team (folded into ML hire), separate integrations team, more UX, junior PM. Principle: "hire for breadth first, depth second."

## GTM / customer-facing — who funnels what
- **Le Linh Nguyen** (UC2BU3S5N) — Seeburger, Heraeus, etc.
- **Manuel Ahmad Hamann** (U04GVMAT97Z) — customer calls (Alaska Airlines, Varsity Brands); joins external roadmap calls (DHL).
- **Laura Turner** (U08JV968TC6) — demo prep (NA Voices, In-N-Out, Dell).
- **Tom Paulsen** (U08UJHLFJR5) — Lindner. **Tommy Carey** (U09ALFA9C3Y) — Brussels Airlines.
- **Steven Stober** (U035TEQ40LQ) — VOICES customer testing & sub-assistant routing feedback.
- **Alexander Jahn** (UK23LAC4R) — Getinge. **Ann Brückner-Trinks** (U0115U94LSY) — visibility/permission escalations.
- **Annemarie "Anni" Ellmers** — co-owns the monthly "Navigator Progress" Campsite post with Zee; relays NA pilot/customer feedback.
- **Jasmina Grase** — customer-facing rollout co-owner; co-signs launch comms with Zee; flags activation-backlog and customer-Slack escalations.

*Stakeholders & cross-team: Igor (RFC reviewer, structured-response envelope), Toni Oehme (AI Assistant Insights dashboard), Rabea Jürgensen (Product OKRs), Felix Starzer (Zendesk waitlist automation), Lottie + CS team (activation welcome emails).*
