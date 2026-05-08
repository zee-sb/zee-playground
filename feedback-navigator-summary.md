# #feedback-navigator — 90-day synthesis (2026-02-05 → 2026-05-06)

**Source:** Slack `#feedback-navigator` (`C09S7QQP1NF`, formerly `#feedback-ai-assistant`, renamed today)
**Scope:** All channel posts in the last 90 days, plus thread context where reactions/eyes flagged tracking
**Lens:** Frequency + customer impact (named enterprise accounts weighted higher)

> Quick read: three things are on fire right now. (1) Visibility/permission leaks — multiple customers report Navigator returning content users shouldn't see; this is a trust/security issue that must clear before broader activation. (2) Source & link delivery is unreliable across the board — broken links, missing files, PDFs found-then-lost, "couldn't find" responses for content that demonstrably exists. (3) Sub-assistant routing keeps defaulting to the base assistant even when a specialized one is the better match — Steven Stöber's VOICES workaround is informative but shouldn't be the customer's job.

---

## P0 — Permission & visibility leaks (security/trust)

Multiple independent reports of Navigator returning content the requesting user should not have access to. This is the single highest-stakes theme in the channel.

| Customer | Reporter | Date | Detail |
|---|---|---|---|
| **Heraeus** (beta) | Le Linh Nguyen | 2026-05-05 | Navigator "sometimes disregarding visibility restrictions, providing replies based on content the test user wasn't supposed to have access to." Reported at VOICES. |
| **Fox / Foxcorp** | Claudia Weber | 2026-04-16 & 2026-03-31 | AI agent returning info from widgets targeted to other audiences (e.g. Houston-only PROMO codes surfaced to non-Houston admins). Zendesk ticket 343901. Links open to "page not loading" empty pages — but the restricted info appears in the answer text. |
| **ISTA International** | Pia Heinrich | 2026-04-01 | Navigator activated and visible to *all* users — customer hadn't realized it was on. They self-served visibility, but raises a broader "default state" concern. |
| **Internal — unpublished content** | Erica Wilk | 2026-04-15 | Unpublished pages still returning answers in Navigator. Likely indexing-lag issue but indistinguishable from a leak from the customer's POV in a demo. |
| **Visibility-setting bug** | Annemarie Ellmers | 2026-04-15 | On slug `connect`, can't add new users to Navigator visibility — error message blocks the operation. |

**Why this is P0:** This is the only category where the failure mode is "we showed someone something they were never supposed to see." Everything else is annoyance or capability gap. Heraeus and Fox are paying enterprises actively testing; if either of these escalates publicly the beta narrative breaks.

**Suggested next action:** Get an authoritative read on whether these are indexing-lag (eventually consistent) or true authorization bypass. Treat the answer differently. If authorization, this is a P0 ticket, not a roadmap item. If indexing, document the lag SLO and add it to the activation playbook.

---

## P1 — Source & link delivery (the most-reported theme by far)

Most frequent class of complaint in the channel. Splits into three sub-modes:

### 1a. Links returned but not clickable / wrong target

- **Getinge** (Alexander Jahn, 2026-05-06) — files/links not delivered on first run; when confirmed, the resulting links/files are not clickable. Conversation starter "Travel & Expense" links to wrong page.
- **Laura Turner / NA Voices demo** (2026-05-06) — broken sources blocking the demo video finalization.
- **Fox** (Claudia Weber, 2026-04-16, 2026-03-31) — when the answer *is* a URL, it's served as text, not a link. Customer wrote routing into the assistant prompt; didn't help.
- **Katryna Weiss** (2026-03-30) — incomplete URLs returned for benefits/handbook prompts.
- **Manuel Hamann** (2026-04-01) — broken links generic.
- **Cabonline** (Manuel Hamann, 2026-03-31) — issues opening linked content, e.g. videos linked from file manager.

### 1b. "Couldn't find anything" when the content demonstrably exists

- **Mission Pet Health** (Katryna Weiss, 2026-03-11) — Navigator says it can't find content for prompts like "Submit a WAG shoutout!", "Company Updates", "2026 Teammate Benefits" despite pages, headers, and news channels containing the exact info. Should serve the link — not say "no" or "maybe try here."
- **SNCF demo** (Karl Chawalla, 2026-03-06) — uploaded a document inside a page; Navigator can't find it; generic search can. Specific section retrieval not working.
- **Rob Waller** (2026-02-24) — demo-fitness regression. Same demo cloned from last year; Navigator now answers "sorry, I could not find verified information" to questions it answered fine before. Broad SE-team thread (21 replies).
- **Faraz Hussain** (2026-02-26) — same generic "I couldn't find specific information…" for *every* question across instances. 61-reply thread, indicates a knowledge backend issue.
- **Badger Infrastructure** (Jeffrey Cipriano, 2026-03-23) — visibility set correctly, but Navigator returns no real responses.

### 1c. PDFs / file content unreliable

- **Sebastian (Jet) Jethon** (2026-04-15) — same shift-schedule PDF: first try "I can find it but cannot access," second try succeeds. Inconsistent file extraction (loom recording in thread).
- **Manuel Hamann** (2026-04-21) — uploaded PDFs cited as sources but unclear if end users can actually open them.
- **Steven Stöber / VOICES** (2026-04-26) — Navigator includes PDFs in sources that are in file storage but not placed on any published page.
- **Sunidhi Thakur** (2026-05-05) — customer wants PDF forms (photo consent, building access) AI-readable; needs guidance on document structure.

**Why this is P1:** This is the bread-and-butter promise of Navigator. A failure here at demo time costs deals (Laura Turner, Karl Chawalla, Adrian.M, Angel Perez all ran into this in the past 30 days). The combined frequency is roughly 2× any other category.

**Suggested next action:** This is at least three different bugs masquerading as one symptom. Splitting them in the PRD/Jira hierarchy will help engineering scope. The "say no instead of serving the link" pattern (Katryna's point) is the cheapest behavioral fix and would dampen many of these complaints by itself.

---

## P1 — Sub-assistant routing reliability

Default assistant takes over instead of routing to the appropriate specialized assistant. Echoes our internal hypothesis from Q1.

- **Steven Stöber / VOICES** (2026-04-26) — Staffbase product sub-assistant *not* triggered for product questions. Default answered instead. Two changes fixed it on Steven's side: (a) reformatted product PDFs into linear, repeated-key-fields, Q&A-block structure (less brochure layout); (b) added explicit routing rules to base prompt that named Staffbase product terms (Employee AI, Navigator, On Air, Live, Content Pro, Tasks). His diagnosis: "Without very explicit routing rules in the base prompt, the default assistant seems to keep control even when a more specific sub-assistant would be a better match."
- **Laura Turner / NA Voices** (2026-05-06) — even with assistants set up, the badge showing which assistant answered is "hit or miss" for the same question.
- **Cabonline** (Manuel Hamann, 2026-03-31) — assistant misinterprets intent, pulls answers from unrelated sources; doesn't specify which app it refers to (Driver / Booking / Hello).

**Why this is P1:** This is a core value prop of Navigator's multi-assistant model. If specialization doesn't reliably engage, customers can't justify the configuration overhead, and we degrade into "ChatGPT for our intranet."

**Suggested next action:** Steven has effectively prototyped the fix — bake routing instructions into the base prompt by default and document the AI-readable PDF structure as a published best practice (this also unlocks Sunidhi's question above). The PDF-versions Steven offered to upload are gold; capture them.

---

## P1 — Stability & demo readiness

Several incidents in the window. These are not "feedback" per se, but they shape the customer-facing perception and consume Zee/Thilo bandwidth.

| Date | Event | Impact |
|---|---|---|
| 2026-02-26 → 2026-03-12 | "Couldn't find anything" knowledge regression (Faraz thread, 61 replies) | Search API down extended into Würth, Sklavenitis, NA Voices demos. Thilo built an Azure Search workaround for individual demos. |
| 2026-03-02 | `<!here>` Navigator demo guidance — "do not ask about people or holidays" | Public ask on the GTM team; the workaround pattern itself is feedback that capability promises were front-running reality. |
| 2026-04-14 | All-stages outage (`inc-1243-ai-assistant-is-down-on-all-stages`) | VOICES go-live testing window. Steven Stöber lost a day. |
| 2026-04-24 | Hybrid search down on prod-us1 / all stages (`inc-1273`) | Navigator unusable for summaries until fixed. |
| 2026-04-29 | Open-search incident, prod-de1, ~1 min | Brief. |

**Suggested next action:** The pattern is clear — incidents land directly in the demo path because the channel doubles as both feedback and demo support. Worth proposing a separate `#navigator-incidents` channel so feedback themes don't get drowned out by outage triage.

---

## P2 — Configuration & admin UX (Seeburger is the dominant voice)

Seeburger is doing serious depth-testing and has filed four distinct asks in the last 72 hours alone. Treating them as one customer-validated mini-roadmap:

- **Knowledge source management is "awful"** (2026-05-04) — admins can't get an overview of accessed sources. Asks for: page list with title, space, visibility, owner, last-modified; sortable; bulk add (currently the menu closes after each selection — can't add all Benefits pages in one go).
- **Targetable conversation starters** (2026-05-04) — example: "What does the cantine offer for lunch today?" only relevant for HQ users; should not show to others.
- **Slogan limit too short** — 50 characters insufficient (2026-05-05).
- **Personalization placeholders don't work** (2026-05-05) — they're trying, expectation is they'd render.

Adjacent asks from other accounts:

- **Chriscelle** (2026-04-24) — knowledge segmentation by user group / persona (Leadership vs IC, Frontline vs Desk) for orgs not using Spaces.
- **CEF** (Will Latter, 2026-04-23) — different experiences per country/audience; icon location configurable (static header option).
- **Bentley** (Robert Beck, 2026-04-29) — uploaded transparent logo still shows background color in Branding settings (Zendesk 345155).
- **Julia Patschake** (2026-05-05) — once activated in AI Hub, no toggle to deactivate.
- **Adrian.M** (2026-02-24) — conversation starters created but not showing on the app (15-reply troubleshooting thread).
- **Annemarie Ellmers** (2026-04-15) — visibility setting can't add new users on slug `connect`.
- **Julien Levrel** (2026-04-22) — failing to save Navigator settings on connect.staffbase.com.

**Suggested next action:** Seeburger's combined feedback is essentially a PRD for an admin-centric configuration overhaul. Worth a 30-min call (Le Linh can broker) to capture the full picture before scoping. Cross-reference against the AW PRDs that already exist for these — several of the targetable-CS and persona-segmentation asks may already have specs in flight.

---

## P2 — Cross-channel & content-source coverage

Repeated questions on what Navigator does (and doesn't) reach. Useful for sequencing the next integration.

- **Lindner** (Tom Paulsen, 2026-05-05) — mobile-only activation, or test on mobile only. Direct VOICES ask.
- **Brussels Airlines** (Tommy Carey, 2026-04-29) — SharePoint integration timeline.
- **DrinkPAK** (Stephanie Klein, 2026-04-17) — Will Navigator follow Staffbase-embedded SharePoint links?
- **Veronica Mayer** (2026-04-08) — search through auto-generated video subtitles, especially Townhalls / Live recordings. "A lot of information hidden in those videos."
- **Felix Starzer / Marcelo** (2026-02-18) — Navigator as a *push* surface: anniversary bot pushes message, AI handles follow-up Qs. Different from current pull pattern.
- **Laura Turner — In-N-Out, Dell** (2026-04-29) — ServiceNow forms in Navigator. Thilo released a fix 2026-04-30.
- **Jon Lam** (2026-04-01) — when do forms surface broadly?
- **BCW** (Veronica Mayer, 2026-02-06) — find right colleague via CSV-only profile data; PDF + image search; content structure best practices.

**Suggested next action:** "Mobile-only" and "differentiate per country" together suggest persona/segment-awareness is becoming the most-asked capability gap — it shows up in both this section and P2-Configuration. Worth treating as a single roadmap theme rather than splitting.

---

## P3 — Mobile UI / surface conflicts

Pattern: as Navigator's footprint grew (especially after the 2026-04-16 mobile UX release), it started colliding with other UI elements.

- **Jon Lam** (2026-03-12) — Navigator overlays Shorts comment button.
- **Felix Starzer** (2026-02-09) — Navigator over comment send button (precursor to above).
- **Emmanuel Opoku** (2026-02-23) — Navigator overlays Shorts fullscreen player (19-reply thread).
- **Rob Waller** (2026-04-21) — new mobile layout blocks Live chat input. "Ask me anything" implies you're asking about the live event; users can't comment on the event itself.
- **Lilli Petzsch / VOICES** (2026-03-31) — Navigator button covers the post widget button.
- **Karl Chawalla / Adrian.M** (2026-04-15) — no Orbs / shortcuts; Navigator acting as a downbar menu.
- **Steven Stöber** (2026-04-20) — long answers keep the text moving while generating; can't scroll up to read the start until generation completes.

**Suggested next action:** Single mobile-UX sweep, scoped against the 4-16 release. Worth aligning with the team that owns Shorts and Live so the contention rules are explicit, not emergent.

---

## P3 — Language & internationalization

Frequent but lower stakes than P0–P2. Real users feel the friction in EU rollouts.

- **Mixed-language outputs:** Wiebke Sohrens (2026-02-20), Kai Timmer (2026-02-06), Erica Wilk (2026-02-13 — answer EN, link label DE), Søren Mothes (2026-04-16), Laura Turner (2026-05-06 — Spanish without prompt).
- **Spanish (Spain) vs LatAm voice:** Adrian.M (2026-02-24, 2026-04-15) — affecting Spanish AE demos.
- **Audio quality issues:** Steven Stöber (2026-04-14) — voice unstable, choppy, switches to English accent mid-German.
- **UI strings leak across languages:** Cabonline (2026-03-31) "Thinking" stays in English; Max Rugen (2026-04-16) French welcome message too long, suggests fallback to slogan/name.

**Suggested next action:** Bundle into a single "language fidelity" workstream. Most are config / prompt-engineering rather than core engineering — fast fixes if prioritized.

---

## P3 — Knowledge freshness & content-shape sensitivity

Less frequent but conceptually important.

- **Lutz Gerlach** (2026-04-21) — Navigator doesn't recognize "phased out" benefits even when the source page states the EOL date. Self-corrects when challenged, but the correction doesn't persist across sessions.
- **Helen Rottluff** (2026-03-24) — pulled stale Hackathon data; mentioned people no longer at company.
- **Steven Stöber** (2026-04-14) — VOICES day-mapping (Day 1 vs Day 2) sometimes wrong; umlauts (Ö/Ä/Ü) cause "person doesn't exist" failures.
- **Lilli Petzsch** (2026-04-09) — new Page Designer with accordion → poor responses; without accordion → good. Content-shape sensitivity.
- **Gebrüder Weiss** (Manuel Hamann, 2026-04-02) — predefined Q&A; outdated Spaces content; trusted-source prioritization; couldn't find employee contact info.
- **P3 Veterinarian Partners** (Lindsey Mayer, 2026-04-23) — case-sensitive search (CoVET vs CoVet). Ask: configurable case-insensitivity.
- **Hanna Labs** (2026-03-18) — jailbreak: tricked into answering unrelated questions.

**Suggested next action:** "Trust the freshest source" is the unifying theme across Lutz, Helen, and Gebrüder Weiss. Worth checking whether our retrieval already weighs `lastModified` — if not, that's likely a one-line ranking change that addresses three customer complaints.

---

## Cross-cutting themes (where the same root cause shows up across categories)

1. **Content-shape sensitivity** — Steven's PDF reformatting (P1 routing), Lilli's accordion observation (P3 knowledge), Sunidhi's "AI-readable" question (P1 sources), and Gebrüder Weiss's prioritization ask all point at the same gap: we have no published guidance on how to author content that Navigator handles well. A best-practices doc would be cheap and would compound across categories.
2. **"Targeting awareness"** — the visibility/persona/conversation-starter/per-country requests all share a logical model: Navigator should know *who* is asking and adjust both *what it returns* and *what it offers*. Worth tracking as a single capability theme regardless of where the individual asks land in the roadmap.
3. **The channel doubles as incident triage and feedback intake** — themes get diluted by outage updates and "please enable for X" asks. Worth proposing a split or a tag convention so the qualitative signal is searchable.

---

## Suggested next steps for Zee

- **This week:** Get an authoritative answer on the visibility leaks (P0). Heraeus and Fox both deserve a direct response, not a generic one.
- **Before next sprint planning:** Cross-reference this synthesis against the existing AW PRDs (knowledge admin UX, targetable CS, persona segmentation likely already drafted). Tag each item with its corresponding PRD or "needs PRD."
- **Ahead of the next GTM sync:** Steven Stöber's routing fix + AI-readable PDF guidance is reusable today — ask him to share the two PDF versions so they become the canonical demo asset.
- **For Filip:** Worth bringing up the channel-rename + the channel-as-incident-triage observation. The signal-to-noise drop in the last 30 days is real.

Sources: all messages and threads from `#feedback-navigator` between 2026-02-05 and 2026-05-06. Direct links can be reconstructed from the message timestamps cited above (format: `https://staffbasehq.slack.com/archives/C09S7QQP1NF/p<TS-without-decimal>`).
