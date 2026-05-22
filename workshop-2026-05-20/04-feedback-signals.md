# #feedback-navigator — Signal Summary (Feb 23 → May 19, 2026)

Channel: [#feedback-navigator](https://staffbasehq.slack.com/archives/C09S7QQP1NF) (renamed from `#feedback-ai-assistant` on 2026-05-06).

Classified ~12 weeks of customer-facing posts into **Positive / Neutral / Negative**. Excluded: join/leave events, internal incident updates, canvas-edit Slackbot noise, and Closed-Beta-enablement admin chatter (Willi/Thilo/Anni feature-flag housekeeping) — those aren't customer signals.

> Two caveats. (1) "Customer signal" here includes both customers-direct and CSM/Sales-relayed messages. (2) Sentiment is judged on the *signal carried*, not the messenger's tone — a polite "FYI we found a bug" is a negative signal because the underlying customer experience was bad.

---

## Headline counts

| Sentiment | Count | Share |
|---|---|---|
| **Positive** | 8 | ~9% |
| **Neutral** (questions, roadmap, capability inquiries) | 17 | ~19% |
| **Negative** (bugs, demo failures, missing features, wrong answers) | 64 | ~72% |
| **Total customer-facing posts** | ~89 | |

**The shape of it:** the channel is a triage queue, not a sentiment channel — most posts exist *because* something went wrong. That's true of any feedback channel, but two things stand out:

1. **Positive signals are concentrated in the "prospect saw a demo" moment**, not in "employee uses it in production." That's a strong indicator we have an *activation/configuration* problem more than a *capability* problem — the demo magic doesn't survive contact with a real tenant.
2. **A meaningful slice of negative signals are infrastructure/availability** (search outages Feb 26 → Mar 9, Azure issues Apr 14, hybrid search Apr 24). Those aren't feature gaps — they're production stability eating customer trust.

---

## ✅ Positive signals (8)

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 1 | 2026-04-23 | **CEF** (via Will Latter) | "The Navigator update went down very well. We're discussing getting on the waiting list." |
| 2 | 2026-04-24 | **Chriscelle (CS)** on behalf of customers | "Loving the Navigator's flexibility now." (Followed by an expansion ask, see Neutral #N9) |
| 3 | 2026-05-07 | **EBZ Gruppe admin** (via Maika) | "At first glance, I like it very much… the results are good (though not perfect), the performance is also quite good (it has improved), and it's pretty hard to trick" |
| 4 | 2026-05-07 | **EBZ Gruppe colleague** (via Maika) | The "jam recipe" anecdote — colleague tried to trick the bot and lost the bet. Net positive on guardrails. |
| 5 | 2026-02-24 | **Rob Waller** relaying prospects | "It's been a great feature that prospects LOVE!" (Caveat: same post then reported regression — see Negative #34) |
| 6 | 2026-04-26 | **VOICES / Steven Stöber** | After reformatting PDFs into linear text + adding explicit routing logic to the base prompt, sub-assistant routing started working. Net positive on tunability. |
| 7 | 2026-03-11 | **Jasmina Grase** (internal, customer-facing implication) | "Navigator is back on for our beta customers and Campsite. Next up — sales demos." |
| 8 | 2026-03-11 | **Mission Pet Health** (implied via Katryna's expansion ask) | The customer is engaged enough to push for behavioral changes — they want it to *serve* content, not just decline. Engagement signal. |

**What positives have in common:** they're either (a) a *first impression* in a controlled demo, or (b) a *power user* who has invested time in tuning (Steven Stöber, EBZ admin). Almost no positives are "untouched out-of-the-box production usage."

---

## 🟡 Neutral signals — questions, asks, capability inquiries (17)

Mostly admins, CSMs, and AEs asking "is X possible / when will Y land / how should we configure Z." These are *interest* signals — the customer is engaged enough to ask. Treat them as soft demand signals for the roadmap.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| N1 | 2026-05-19 | **BASF EC** (via Pia) | Which file formats are supported? (Asks for .docx, .pptx, .xlsx, external URLs, SharePoint) |
| N2 | 2026-05-18 | **Customer demo** (via Kevin Kleist) | ServiceNow forms in Navigator — best practice for demos? |
| N3 | 2026-05-18 | **VWSK** (via Pia) | Activated without enablement; requests demo + best practices |
| N4 | 2026-05-18 | (via Max Scholz) | "Report Issue" admin visibility — where does feedback go? |
| N5 | 2026-05-14 | **LSG / LyricHealth / DesertDiamond** (via Tamiko) | Best practices, recommended settings, pre-setup actions for rollout |
| N6 | 2026-05-11 | **Stadtwerke München** (via Tom) | Copilot Agent interface? M365 interface? |
| N7 | 2026-05-11 | **Lindner** (via Tom) | "Can we activate Navigator for mobile only, or test it on mobile only?" |
| N8 | 2026-05-05 | (via Sunidhi) | PDF formatting/structuring guidelines for AI readability |
| N9 | 2026-05-05 | (via Julia Patschake) | Once activated, is there a toggle to deactivate? |
| N10 | 2026-04-29 | **Brussels Airlines** (via Tommy Carey) | Timeline for SharePoint integration? |
| N11 | 2026-04-24 | (via Chriscelle) | Knowledge-base segmentation by personas (Leadership/IC, Frontline/Desk) — beyond Spaces |
| N12 | 2026-04-23 | **CEF** (via Will Latter) | Icon position configurable? Different experiences for different country audiences? |
| N13 | 2026-04-21 | (via Andrew Pabon) | Enabling Navigator for ~50 CS demo accounts — what's the workflow? |
| N14 | 2026-04-17 | **DrinkPAK** (via Stephanie Klein) | Will Navigator pick up SharePoint links embedded inside Staffbase pages? |
| N15 | 2026-04-08 | **Prospect** (via Veronica) | Search through auto-generated video subtitles — Townhall recordings have "hidden" info |
| N16 | 2026-04-01 | (via Jon Lam) | When can forms be surfaced by Navigator? |
| N17 | 2026-03-26 | (via Tara Walker) | How to track customers interested in joining closed beta + future open beta? |

**Theme inside the neutrals:** **format/connector reach** (SharePoint, .docx, video subtitles, forms, ServiceNow), **segmentation/targeting** (by persona, group, country, mobile-only), and **deployment workflow** (how do I activate, demo, configure this thing). These are the same themes that dominate the negatives — they're the surface area of the configuration problem.

---

## 🔴 Negative signals — bugs, complaints, missing features, wrong answers (64)

Clustered by theme so they're actionable in the workshop. The top 6 themes account for ~80% of the negative volume.

### Theme 1 — Production reliability & demo failures (16 signals)

Navigator goes down, slows down, or behaves inconsistently during live demos and customer testing.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 1 | 2026-05-12 | **kleusberg** (via Maika) | Error opening Navigator |
| 2 | 2026-05-11 | **Maximus demo** (via Chriscelle) | "Thinking" >1 minute on production demo |
| 3 | 2026-05-11 | **Laura Turner demo** | Broken link error on referenced page |
| 4 | 2026-05-06 | **VOICES Laura Turner demo video** | Broken sources mid-demo recording |
| 5 | 2026-04-29 | **Prod-de1 OpenSearch incident** | Short interruption during VOICES |
| 6 | 2026-04-24 | **All stages** | Hybrid search broken on all stages (Willi) |
| 7 | 2026-04-14 | **All stages** | Navigator down on all stages — Azure issue |
| 8 | 2026-04-14 | **Foxcorp** (via Emily Ruschy) | Assistant not showing for new-CIO demo |
| 9 | 2026-04-14 | **VOICES** (Steven Stöber) | Navigator visible but not responding to any input |
| 10 | 2026-04-15 | **Sebastian Jethon** internal | Document attached to page — inconsistent extraction (first try fails, second works) |
| 11 | 2026-04-10 | **VOICES** (Steven Stöber) | After Voices app update, Navigator no longer visible |
| 12 | 2026-03-23 | **MAN** (via Ann Brückner-Trinks) | Could open AI Assistant but couldn't interact |
| 13 | 2026-03-19 | **Lorenzo demo** (via Kevin) | Fails on vacation days, then auto-rechecks autonomously, sometimes can't find at all |
| 14 | 2026-03-05 | **Sklavenitis demo** (via Kevin) | Conversation starters broken on mobile during demo |
| 15 | 2026-02-27 → 03-09 | **Sales demos broadly** | Knowledge base broken multi-day; emergency workaround required (custom Azure index for individual demo apps) |
| 16 | 2026-02-26 | **Faraz Hussain** internal | "I couldn't find specific information" for ANY question, including against known pages |

### Theme 2 — Wrong answers / quality (14 signals)

Hallucinations, contradictions, outdated information, retrieval failures even when the source is present.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 17 | 2026-05-13 | **q1erica26 demo** (Erica Wilk) | Strange behavior on "What are my benefits" |
| 18 | 2026-05-12 | **Seeburger** | Doesn't read User Profile Widgets, OrgChart, Employee Directory |
| 19 | 2026-05-07 | **Camion** | Wrong HR email; wrong "Head of Logistics"; contradictory replies ("I can / actually I can't") |
| 20 | 2026-04-21 | **Campsite / Lutz Gerlach** (internal) | Doesn't know ThanksBen was phased out; corrects itself in-session but no persistent learning |
| 21 | 2026-04-15 | **Erica Wilk demo** | Unpublished SOPs still surfacing in answers |
| 22 | 2026-04-14 | **VOICES** (Steven) | Sessions assigned to wrong day in some answers; got stuck on follow-up "are you sure?" questions |
| 23 | 2026-04-14 | **VOICES** (Steven) | Attendee directory unreliable; especially fails on umlauts (Ö, Ä, Ü) |
| 24 | 2026-04-09 | **VOICES** (Lilli) | Accordion-style FAQ pages break Navigator; needs to be flat content |
| 25 | 2026-04-02 | **Gebrüder Weiss** (via Manuel) | Struggles with outdated content; needs FAQ-style predefined answers; can't reliably find contact info |
| 26 | 2026-03-31 | **Cabonline** (via Manuel) | Content sourcing gaps (relies on pages, not news); inaccurate; misinterprets intent; pulls from unrelated sources |
| 27 | 2026-03-30 | **Katryna Weiss** (customer) | Bot gives incomplete URLs in chat |
| 28 | 2026-03-24 | **Campsite / Helen** internal | Outdated Hackathon info — old business units, old contact persons |
| 29 | 2026-03-18 | **Hanna Labs** internal | Can be tricked into answering unrelated questions |
| 30 | 2026-03-11 | **Mission Pet Health** | Keeps saying "can't find anything" despite content existing |

### Theme 3 — Source delivery & broken links (8 signals)

Sources cited but not delivered, links broken, files not clickable.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 31 | 2026-05-08 | **Morley** | PDFs surfaced but not clickable; can't open the associate handbook |
| 32 | 2026-05-07 | **EBZ Gruppe** | Page found, but actual links to the page and document are missing |
| 33 | 2026-05-06 | **Getinge** | Files/links not delivered on first run; when AI offers to re-attach, links still not clickable; T&E directive link wrong |
| 34 | 2026-04-22 | **VOICES PDF assistant** (Manuel) | PDFs cited but: are they clickable for end users, or background-only? Unclear UX |
| 35 | 2026-04-16 | **Fox** (via Claudia) | URL responses not served as clickable links — when will fix land? |
| 36 | 2026-04-01 | (via Manuel) | Broken links — known issue? |
| 37 | 2026-03-31 | **Cabonline** | Issues opening/showing linked content (e.g., videos linked from file manager) |
| 38 | 2026-03-06 | **SNCF demo** (Karl) | Can't find PDF document via Navigator; generic search finds it fine |

### Theme 4 — Permissions / visibility leaks (4 signals — high severity)

Content surfaces to users who shouldn't have access. Treated as critical because it's a credibility/security risk, not just a UX bug.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 39 | 2026-05-05 | **Heraeus** (via Le Linh) | Visibility restrictions ignored — content returned to users who shouldn't see it |
| 40 | 2026-04-16 | **Fox** (via Claudia) | Targeted documents returned in search; user shouldn't have access |
| 41 | 2026-03-31 | **Fox** (via Claudia) | PROMO code restricted to Houston widget surfaced to non-Houston users; links open to "page not loading" but content is in the AI reply |
| 42 | 2026-04-01 | **ISTA International** (via Pia) | Navigator activated without admin knowing — visible to all users (urgent) |

### Theme 5 — Configuration / activation / admin UX (11 signals)

Admins can't configure, can't see what's working, settings don't save, activation is broken in subtle ways.

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 43 | 2026-05-08 | **esa slug** (via Anni) | Navigator setting not loading |
| 44 | 2026-05-08 | **svgroup** (via Nora) | Navigator not clickable for activation in AI Hub |
| 45 | 2026-05-08 | **Grocery Outlet** (via Steve Kallsen) | Has Navigator backend, no knowledge assigned, no setup — "very early exploratory phase" |
| 46 | 2026-05-04 | **Seeburger** (via Le Linh) | Source-management UX is "awful, impossible to get overview; can't bulk-select; menu closes immediately" |
| 47 | 2026-04-22 | **connect.staffbase.com** (Julien) | Failing to save Navigator settings (bug report filed) |
| 48 | 2026-04-15 | **connect slug** (Anni / Sven) | Can't add new user to Navigator visibility setting |
| 49 | 2026-04-06 | **Demo environments** (Angel Perez) | AI Assistant switched to "Not Visible" in all his demo envs — needed manual fix |
| 50 | 2026-04-01 | **ISTA** | Activated without admin awareness |
| 51 | 2026-03-26 | **Badger Infrastructure** (via Jasmina/Jeffrey) | Visible but returning nothing; not even on beta waitlist |
| 52 | 2026-03-17 | **misternow** (via Anni) | Closed-beta customer can't see AI Assistant in settings |
| 53 | 2026-02-24 | **Adrian.M** demo | Conversation starters configured but not appearing on the app |

### Theme 6 — Branding / customization / personalization (7 signals)

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 54 | 2026-05-08 | **Morley** | Can't customize "Ask AI anything…" placeholder text |
| 55 | 2026-05-07 | **EBZ Gruppe** | Personalization placeholders (`{{user.profile.firstName}}`) don't work |
| 56 | 2026-05-05 | **Seeburger** | Slogan capped at 50 chars; personalization placeholders don't work; Conversation Starters can't be targeted by location/group |
| 57 | 2026-04-29 | **Bentley** | Logo background shown despite uploading transparent — escalates to Customization Team |
| 58 | 2026-04-21 | **VOICES** (Manuel) | Assistant name shown in answer text — confusing UX |
| 59 | 2026-04-16 | **Max Rugen** | "Ask AI anything…" placeholder too long in French; should fall back to slogan/name |
| 60 | 2026-03-13 / 04-21 | **Rob Waller / Jon Lam** | Navigator bar/orb covers other action buttons (Live chat, Shorts comment, post widget) |

### Theme 7 — Language & voice handling (4 signals)

| # | When | Customer / Source | Signal |
|---|---|---|---|
| 61 | 2026-05-06 | **NA Voices demo** (Laura) | English-configured assistant answers in Spanish unprompted |
| 62 | 2026-04-16 | **Soren Mothes** internal | German UI even though content language is set to English |
| 63 | 2026-04-15 / 02-24 | **Adrian.M / Karl** | Wants Spanish (Spain), gets Spanish (LatAm) |
| 64 | 2026-04-14 | **VOICES** (Steven) | Voice unstable, choppy, metallic; switched to English accent mid-German answer |

### Smaller-volume sub-themes (folded in above; noting for completeness)

- **Mobile-specific issues:** Anja Seelert (phone overheating, Feb 27), Yuka (IME conversion triggers send, Apr 6), Faraz (text-field reload, Mar 27), Mondelez (typing broken, voice fine, Mar 27).
- **Streaming UX:** Steven Stöber — text moves while generating; can't read top of long answers (Apr 20).
- **Case sensitivity:** P3 Veterinarian Partners — "CoVET" vs "CoVet" returns different results (Apr 23).
- **Voices podcast playback (related app, not Navigator core):** Lilli — only plays 20 seconds on Björn's phone (Apr 24).
- **GTM positioning:** Jon Lam — "What sets us apart from Copilot?" (May 5).
- **Strategic / contractual:** Seeburger (97k ARR) — "having a chatbot for employees will be critical for next renewal — was promised, not delivered, comms person lost annual bonus over it" (Mar 18). Highest-severity strategic risk in the corpus.

---

## What this means for tomorrow

A few read-outs to bring into the workshop framing:

1. **The negative-to-positive ratio (~8:1) is not the story.** The story is that almost every positive comes from a *controlled demo or a tuned power-user setup*, while almost every negative comes from *production usage at a customer that hasn't been hand-held into a working configuration*. **This is the Customer column on the Miro board, loudly.** Activation Concierge maps directly.

2. **Production stability is a Staffbase-column problem.** Three separate multi-day outages in the 12 weeks (search down Feb 26 → Mar 9, Azure down Apr 14, hybrid search Apr 24). Each one cost demos, customer trust, and team time. Eval gates + infra hardening earn their slot independent of features.

3. **The same complaints repeat from different customers.** Source delivery, broken links, wrong answers, permission leaks, branding limits — these aren't long-tail. They are the *same five themes* recurring across Camion, Getinge, EBZ, Morley, Fox, Heraeus, Seeburger, ISTA, Cabonline, Gebrüder Weiss. When the team proposes a bet, the question to ask is: *does this kill one of these five recurring themes, or does it spawn a new feature on top of the same broken substrate?*

4. **One strategic risk worth flagging in the room:** the Seeburger renewal note (Mar 18). Customer was promised an employee chatbot, didn't get it on the original timeline, "comms person lost annual bonus over it," 97k ARR named as at-risk on next renewal. That's not a feature ask — it's an account-health flag. Surface it under the Customer/Staffbase columns.

5. **Positive signals to amplify:** EBZ Gruppe and Steven Stöber both reported the product gets *meaningfully better* when configured well. That's a configuration-leverage story, which is the highest-ROI place to be — better setup work multiplies the product capability we already have.

---

*Source: [#feedback-navigator](https://staffbasehq.slack.com/archives/C09S7QQP1NF), period Feb 23 → May 19, 2026. Pulled via Slack MCP on 2026-05-20.*
