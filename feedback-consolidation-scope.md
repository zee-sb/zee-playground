# Feedback Consolidation — Feature Scope

**Bet:** NAV-BET-03 Actionable Analytics (PI-305) · **Sub-topic:** 3.3 Reported feedback + quality signals
**Owner:** Zee · **Status:** Scoping · **Date:** 2026-06-10
**Trigger:** Slack thread w/ Maxim + Leah (NAV-984) — customers confused by two feedback paths

---

## Problem

Navigator has **two parallel feedback mechanisms** and they don't agree with each other:

1. **Conversation-level** — the "Report a problem" / "Report Issue" flow. Surfaces in the Studio conversation logs list, is filterable, drives the "Reported Problems" view.
2. **Message-level** — thumbs up / thumbs down (+ optional free-text) on an individual assistant message.

Message-level feedback is **invisible in the conversation logs list**. A conversation where a user thumbed-down a wrong answer still shows as *"Kein Problem / No problem"*, can't be filtered, and the feedback only appears buried in the transcript. On top of that, the conversation-level feedback filter itself currently returns an empty list (NAV-984) — so the "Reported Problems" page is empty for customers and Johannesstift Diakonie is escalating.

Net effect: admins can't trust the logs to tell them where the assistant is failing, which is the whole point of Actionable Analytics.

## Solution

Collapse to **one feedback model**: message-level thumbs up/down (with optional free-text), aggregated up to the conversation so the conversation logs list and filters work off it. Retire the conversation-level "Report a problem" flow entirely.

### Aggregation model (decided)

Each assistant message can carry a rating: 👍, 👎, or none (plus optional free-text comment). Roll up to the conversation with an **"any 👎 → flagged"** rule:

| Conversation derived field | Definition |
|---|---|
| `hasFeedback` | true if **any** message in the conversation was rated |
| `feedbackSentiment` | `NEGATIVE` if ≥1 👎 · `POSITIVE` if ≥1 👍 and no 👎 · `NONE` otherwise |
| `isFlagged` | true if `feedbackSentiment = NEGATIVE` (≥1 thumbs-down anywhere) |

The conversation list shows the sentiment/flag, and the filter that used to be "Reported Problems" now filters on `isFlagged` / `hasFeedback`. A single thumbs-down anywhere in the thread flags the whole conversation — simplest rule, surfaces every problem, matches the intent of the old "Report a problem."

### Free-text feedback (decided)

Free-text comments left with a rating are shown **only inside the single-conversation transcript** (as today). The list does not surface or cluster free-text in this epic — it only reflects rating sentiment. Theme clustering of comments is deferred to 3.4 (Suggested next actions).

### "Report a problem" retirement (decided)

Removed in the **same release** as the aggregation work — not phased. Message-level + aggregation fully replaces it, so there's no transition window with two competing flows.

## In scope

- Conversation-level derived fields computed from message ratings (`hasFeedback`, `feedbackSentiment`, `isFlagged`), kept correct even when feedback arrives **after** the conversation is finalized (the NAV-984 root cause).
- Conversation logs list column/badge for feedback sentiment.
- Filter conversations by feedback presence / negative-flagged (replacing "Reported Problems").
- Remove the conversation-level "Report a problem" UI and its dedicated reporting path.
- Free-text remains visible in the single-conversation transcript.

## Out of scope

- Free-text theme clustering / NLP on comments → 3.4 Suggested next actions.
- Aggregated charts (resolution rate, satisfaction trend) → 3.2 (NAV-537).
- Suggested next actions / auto-fixes → 3.4 / Bet 04 Concierge.
- Changing the thumbs up/down UI in the chat surface itself.

## Dependencies & related

- **NAV-984** — BE bug: feedback filter on the analytics list returns empty because `computedFields.feedbackType` is only populated by `finalizeConversation`, so post-finalize feedback is excluded. This is the denormalization the aggregation model depends on; fixing it is the foundation of the first story. (Agreed in thread as "step 1, we need to do it anyway.")
- Conversation logs foundation — NAV-216 (Done).
- Feeds 3.4 Suggested next actions and Bet 04 Concierge gap detection (they consume the negative-feedback signal).

## Proposed story breakdown

1. **(First story — built now)** Aggregate message-level ratings to conversation level; surface + filter flagged conversations in Studio logs. Includes correct denormalization on the post-finalize feedback path (NAV-984).
2. Remove the conversation-level "Report a problem" UI + reporting path; migrate any historical reported-problem data to the unified model.
3. (Optional polish) Free-text indicator review in the transcript view; confirm parity after "Report a problem" removal.
