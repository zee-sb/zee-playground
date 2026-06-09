# Navigator — Customers & Feedback Themes

*Live source: Slack #feedback-navigator (C09S7QQP1NF). Themes below synthesized from the channel as of 2026-06-09. Cluster by theme, not date; always cite customer + message TS; cross-reference against PRDs before treating anything as a new ask.*

## Key accounts
- **VOICES** — first Navigator GA customer and reference deployment (also the Staffbase event, Apr 29–30 2026, Arena Berlin). Power user **Steven Stober** runs structured stress tests. Retrieval/citation triage page: AW 6852444191.
- **DHL** — strategic enterprise account; roadmap calls via Max Kersting / Manuel Ahmad Hamann.
- **Vet Partners** — P3 named rollout; Amanda France runs customer-side check-ins.
- **Activation backlog: 70+ customers on the waitlist marked "unable to activate"** — operational issue Jasmina flagged. Felix Starzer built Zendesk waitlist automation (ticket_form_id 5513861882386, custom field 34446878875666 = `ai_waitinglist_navigator`).
- Other named accounts active in feedback: Seeburger, Heraeus, Getinge, Bentley, Brussels Airlines, Alaska Airlines, Varsity Brands, Dell, In-N-Out, Morley, Mr. Carwash, Ensemble, BASF, MAN T&B, ebm-papst, STIHL, Nordzucker, NETZSCH, best secret, DRK Karlsruhe, Hirschtec (partner), VWSK.

## Recurring themes Zee should track
1. **Retrieval reliability & consistency** — identical queries returning different result sets (Ensemble); content added to a page still not surfaced (ebm-papst "Gehaltsnachweis"); index/update-frequency questions (ebm-papst, Seeburger). *Pillar 1 / Bet 07.*
2. **Source & file delivery** — file sources not clickable; broken/missing PDF links; "page doesn't exist" errors on first click then works on retry (Morley, Seeburger, VWSK). *Pillar 1/4.*
3. **Permission / visibility correctness** — can't open a PDF listed as a source despite permissions (VWSK); birthdays visible in profiles not surfaced (Bentley); "does an Assistant retrieve ONLY from its configured sources?" (DRK Karlsruhe, Juliane). *Pillar 1/5.*
4. **Source-hiding from end users** — customers want uploaded PDFs hidden and replaced with a custom footnote/CTA (Mr. Carwash). Recurring; was previously discussed as planned.
5. **Knowledge-source scoping controls** — include/exclude pages, news channels (individual + all-at-once), spaces-access hiding when spaces aren't used, exclude content older than date X (Anni, multi-customer). → maps to **Granular Controls V2 / NAV-1071**.
6. **Configuration / Studio UX** — Navigator not appearing in Studio Content tab despite "activated"; activation-in-progress stuck (versigent, verizon, best secret); "Customize Navigator" redirect inconsistency + branding colors not reflected in backend (Hirschtec). *Pillar 5.*
7. **Activation friction** — AI Hub tile not clickable to request activation (Philipp Schneider, multiple customers).
8. **Language / localization** — Navigator stuck in English regardless of user/device language (kampfdemo); slogan/conversation-starters not translating; multilingual *name* requested (only slogan is multilingual today); legal-hint translation (Slovak, VWSK). *Bet 01.*
9. **Analytics / feedback signal integrity** — message-level thumbs-down doesn't roll up to conversation summary ("Reported Issue: None" despite negative feedback) (Seeburger, ebm-papst); request for search within statistics + mark-as-solved + custom topic clustering (Seeburger); wipe analytics before launch date (Morley). *Bet 03.*
10. **Scope/behavior change** — general-knowledge questions blocked since ~mid-May ("I specialize in work-related topics"); customers want a changelog/docs (Seeburger).
11. **External / third-party connectivity** — Navigator as relay/orchestrator for external chatbots respecting source ACLs (BASF EC); crawl external URLs linked from the platform / daily-lunch use case (Seeburger); links to third-party tools in responses (diakonie demo); Workday integration not returning vacation days (STIHL). *Pillar 2 / Bet 05.*
12. **Conversation starters ↔ assistants routing** — route to the proper assistant when a conversation starter is clicked (Anni / NA pilot).
13. **Personalization expectations** — "Navigator learns from interactions" claim (vegetarian → meat-free suggestions) with no visible setting; clarify what's stored and for how long (Hirschtec). *Note: mem0 was killed — manage this expectation carefully.*
14. **Media metadata** — access to metadata of media files (MAN T&B).
15. **Voice** — change voice gender / disable voice (Morley). *Note: live voice is being retired in favor of push-to-talk.*
16. **Performance / incidents** — intermittent slowness and "Thinking…" hangs during demos (Jon Lam; Laura Turner dell/in-n-out); Mr. Carwash open bug (Anni chasing ETA).

## How to use this
When asked "what are customers saying," pull the live channel (read ≥50 messages, follow threads with reactions). Many items already have PRDs in flight (e.g. source scoping → NAV-1071; routing & language → Bet 01; analytics signal → Bet 03) — tag them to the existing PRD rather than logging a new ask.
