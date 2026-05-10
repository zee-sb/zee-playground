// Acme Intranet — mock corpus of company content (leadership memos,
// product updates, team wikis, events, ERG pages, spotlights).
// Used by the intranet MCP server (api/mcp-intranet.mjs) to back a
// keyword-search RAG demo. English only for the prototype.

export const CATEGORIES = ['leadership', 'product', 'team_wiki', 'event', 'erg', 'spotlight'];

export const CATEGORY_LABELS = {
  leadership: 'Leadership',
  product:    'Product',
  team_wiki:  'Team Wiki',
  event:      'Events',
  erg:        'ERGs & Culture',
  spotlight:  'Employee Spotlight',
};

export const INTRANET_ARTICLES = [
  // ── Leadership ────────────────────────────────────────────────────────────
  {
    id: 'ceo-q2-priorities',
    title: 'Q2 Priorities — A Note from the CEO',
    category: 'leadership',
    author: 'Eve Martinez',
    authorTitle: 'CEO',
    publishedAt: '2026-04-02',
    summary: 'Three priorities for Q2: ship the new self-serve onboarding, double customer NPS, and make every meeting count.',
    tags: ['ceo', 'q2', 'priorities', 'strategy', 'leadership'],
    body: `# Q2 Priorities — A Note from the CEO

Team — coming out of Q1 we have momentum, and a clear shot at making Q2 our best quarter ever.

## Three priorities

1. **Ship self-serve onboarding.** The single biggest thing holding us back in commercial deals is the 6-week pro-services tail. Self-serve onboarding lands in May and we need everyone — product, success, marketing — pulling on the same rope.
2. **Double customer NPS.** We finished Q1 at +42. Industry leaders are at +70. Every team should pick one customer-facing irritation and remove it this quarter.
3. **Make every meeting count.** I want a smaller meeting load and a bigger writing culture. Defaults: no recurring meetings, share writeups in advance, end on time.

## How we get there

- Weekly all-hands becomes bi-weekly; off-weeks I'll publish a written update on this intranet.
- Each team picks two OKRs max — fewer, better, sharper.
- Prioritise the boring middle: docs, runbooks, the small UX papercuts that compound.

I'm proud of this team. Let's go make Q2 count.

— Eve`,
  },
  {
    id: 'cfo-finance-update-march',
    title: 'Finance Update — March 2026',
    category: 'leadership',
    author: 'Marcus Hill',
    authorTitle: 'CFO',
    publishedAt: '2026-04-08',
    summary: 'Q1 closed ahead of plan on revenue, slightly behind on hiring. Cash runway extended to 22 months. Hiring freeze lifted in Engineering and Product.',
    tags: ['finance', 'cfo', 'budget', 'hiring', 'runway'],
    body: `# Finance Update — March 2026

## TL;DR
- **Q1 revenue:** 104% of plan
- **Cash runway:** 22 months (was 19)
- **Headcount:** 312 (plan was 326)
- **Hiring freeze:** lifted for Engineering, Product, Customer Success

## What changed
A combination of strong Q1 bookings and slower hiring than planned has extended runway. Finance and the leadership team have agreed to lift the partial hiring freeze for Eng, Product, and CS. People Ops is unblocking the requisitions that were held since January.

## What stays the same
G&A and Marketing remain on the hiring pause through Q2. We'll revisit at the half-year board meeting in July.

## Open enrolment
Reminder: open enrolment for benefits closes November 30. Workday is the system of record. Your HRBP is your first contact for questions.`,
  },
  {
    id: 'all-hands-q2-recap',
    title: 'Q2 All-Hands Recap',
    category: 'leadership',
    author: 'Eve Martinez',
    authorTitle: 'CEO',
    publishedAt: '2026-05-15',
    summary: 'Recording, slides, and the top five questions answered live. Self-serve onboarding ships May 28; new parental leave policy goes live June 1.',
    tags: ['all-hands', 'town hall', 'q2', 'recording', 'announcement'],
    body: `# Q2 All-Hands Recap — May 15

Thanks to everyone who joined live (and thanks to the night-shift folks in APAC who'll catch the recording).

## Headlines
- **Self-serve onboarding ships May 28.** Beta with 12 customers from May 20.
- **Parental leave policy** expands June 1 — 16 weeks fully paid for primary caregivers.
- **Town hall cadence** moves to bi-weekly. Off weeks get a written update.

## Top 5 questions

1. *"Are bonuses on plan?"* — Yes, Q1 attainment averaged 103%.
2. *"What's the latest on the Berlin office?"* — Lease signed; opening late June.
3. *"How do I get on the self-serve beta team?"* — Ping Sara Patel in #beta-onboarding.
4. *"When do laptops refresh?"* — IT runs the next refresh wave end of June. Watch for an email.
5. *"What's the AI tool policy?"* — Updated v2 just went live; see the IT wiki.`,
  },

  // ── Product ───────────────────────────────────────────────────────────────
  {
    id: 'self-serve-onboarding-launch',
    title: 'Launching Self-Serve Onboarding — May 28',
    category: 'product',
    author: 'Sara Patel',
    authorTitle: 'VP Product',
    publishedAt: '2026-04-29',
    summary: 'After 9 months of work, self-serve onboarding ships May 28. Customers can go from sign-up to first value in under 15 minutes.',
    tags: ['product', 'launch', 'self-serve', 'onboarding', 'q2'],
    body: `# Launching Self-Serve Onboarding — May 28

Nine months. 47 customer interviews. Three full redesigns. We're launching self-serve onboarding May 28 and it's the biggest product release of the year.

## What's in the launch
- Guided setup that takes the average new customer from sign-up to first value in under 15 minutes (was: 6 weeks of pro-services).
- A new sample-data mode so prospects can play before they connect anything real.
- A redesigned admin onboarding checklist with smart skip logic.

## Beta from May 20
12 customers in the closed beta. Sales, send any candidates to Sara Patel by May 16. Success, you'll get the dashboard for monitoring beta progress on May 19.

## What this unlocks
This is the foundation for product-led growth in H2. The smaller the gap between "I heard about Acme" and "I'm getting value", the more we can invest in self-serve acquisition channels.

## Resources
- [Internal demo recording] in the All-Hands deck
- Pricing FAQ — see #pricing in Slack
- Talk track for AEs goes live May 22 in Highspot`,
  },
  {
    id: 'q2-launch-mobile-redesign',
    title: 'Mobile App Redesign — Now Live',
    category: 'product',
    author: 'Lin Wei',
    authorTitle: 'Director, Mobile',
    publishedAt: '2026-04-19',
    summary: 'The new iOS and Android apps shipped to the App Store on April 18. Faster, cleaner, and finally has dark mode.',
    tags: ['product', 'mobile', 'ios', 'android', 'launch', 'redesign'],
    body: `# Mobile App Redesign — Now Live

The new mobile apps shipped to the App Store and Google Play on April 18. If you have the app installed it should auto-update over the next 48 hours.

## What's new
- **40% faster cold start** on iOS, 60% on Android.
- **Dark mode** — finally.
- New navigation that puts the three things people actually do (search, scan, notify) on the home tab.
- Push notifications that don't double-fire.

## How to share
We have a customer-facing post in #marketing-launches. AEs can use the talk track in Highspot. Please don't post the internal-only screenshots from the design Figma.

## Thanks
Huge shoutout to the mobile team — Lin, Hiro, Priya, Marcus K — and to the design system team for shipping the dark-mode tokens on time.`,
  },
  {
    id: 'product-roadmap-h2',
    title: 'Product Roadmap H2 2026',
    category: 'product',
    author: 'Sara Patel',
    authorTitle: 'VP Product',
    publishedAt: '2026-05-02',
    summary: 'Three big bets for H2: deeper integrations, a new analytics surface, and putting AI in the hands of every admin.',
    tags: ['roadmap', 'product', 'h2', 'planning', 'ai'],
    body: `# Product Roadmap — H2 2026

Following Q2 priorities, here are the three big bets for H2.

## 1. Integration depth
We're moving from "we have an API" to "we have first-class integrations." Salesforce, HubSpot, and Snowflake get the bidirectional treatment. Slack and Teams get richer notifications.

## 2. Analytics surface
A new analytics workspace for admins — usage, adoption, ROI views. Replaces the three half-finished dashboards we have today.

## 3. AI for admins
Every admin gets an "Ask Acme" assistant in-product. Natural-language queries against their own data, with safe guardrails. Connected to the new MCP layer the platform team has been building.

## What's NOT on the list
- No platform rewrite.
- No new pricing tier.
- No mobile-only features beyond what's on the mobile roadmap.

This is intentionally short. If you have a strong opinion that something missing should be on the list, the time is the H2 review session on May 22.`,
  },

  // ── Team wikis ────────────────────────────────────────────────────────────
  {
    id: 'team-wiki-engineering',
    title: 'Engineering Team Wiki',
    category: 'team_wiki',
    author: 'Frank Lee',
    authorTitle: 'Engineering',
    publishedAt: '2026-03-12',
    summary: 'How we work in Engineering — on-call, code review norms, RFC process, and what to read in your first week.',
    tags: ['engineering', 'team', 'wiki', 'on-call', 'rfc', 'code review'],
    body: `# Engineering Team Wiki

This is the front door to how the engineering team works.

## On-call
- Rotation: weekly, primary + secondary.
- PagerDuty schedule lives in the IT wiki.
- Pages should be acknowledged within 5 minutes during business hours, 15 outside.
- Run the *post-incident review* template within 48 hours of any SEV-2 or above.

## Code review
- Default reviewer: anyone on the team. No "blessed reviewer" system.
- Aim for first response within 4 working hours.
- Approve-with-comments is encouraged for non-blocking nits.
- Avoid "ship-blocking" labels for stylistic preferences — write a follow-up issue instead.

## RFC process
- Any change that crosses team boundaries or affects more than ~500 lines of behavioural code: write an RFC.
- Template lives in the engineering folder. 1 page is fine. 5 pages is too many.
- Comment period: 5 working days minimum.

## First week reading
1. The deployment pipeline doc
2. The "how we test" doc
3. The on-call runbook for the service you're joining
4. The data classification policy (in IT wiki)`,
  },
  {
    id: 'team-wiki-design',
    title: 'Design Team Wiki',
    category: 'team_wiki',
    author: 'Dave Wilson',
    authorTitle: 'UX Designer',
    publishedAt: '2026-02-20',
    summary: 'How design works at Acme — research cadence, the design-system contract, and how to brief a designer.',
    tags: ['design', 'ux', 'team', 'wiki', 'research', 'design system'],
    body: `# Design Team Wiki

## Research cadence
- Continuous discovery: every designer talks to 2 customers per week.
- Quarterly synthesis lives in the *design research* folder.
- Big-bet research (anything > 1 quarter of build) gets a dedicated study.

## Design-system contract
- All product surfaces ship with components from the design system unless explicitly waived.
- New components: propose in #design-system, get a +1 from a system maintainer, then build.
- Tokens are the source of truth. Don't hard-code colours.

## How to brief a designer
- One paragraph: what problem, for whom, by when.
- Existing screenshots if there's a "before".
- Constraints: must-haves, nice-to-haves, out-of-scope.
- Don't pre-design. Let the designer push back on the framing.

## Tools
- Figma (org-paid; ask IT for an account).
- Loom for short walkthroughs.
- Notion for research notes.`,
  },
  {
    id: 'team-wiki-sales',
    title: 'Sales Team Playbook',
    category: 'team_wiki',
    author: 'Carol Davis',
    authorTitle: 'VP Sales',
    publishedAt: '2026-03-30',
    summary: 'Sales playbook — qualification framework, pricing guardrails, and how to escalate a deal.',
    tags: ['sales', 'team', 'playbook', 'pricing', 'meddpicc'],
    body: `# Sales Team Playbook

## Qualification: MEDDPICC
- **M**etrics — what's the quantified pain?
- **E**conomic buyer — who has signing authority?
- **D**ecision criteria — what would make them choose us?
- **D**ecision process — what are the steps from here to signed?
- **P**aper process — legal, security review, procurement timing
- **I**dentify pain — what's the cost of inaction?
- **C**hampion — who's selling for us internally?
- **C**ompetition — who else is in the deal?

If you can't answer all eight, the deal isn't qualified yet.

## Pricing guardrails
- Standard discount authority: 10% (AE).
- Up to 20%: AE manager approval.
- 20%-30%: VP Sales approval.
- 30%+: CEO + CFO approval, must include retention plan.

## Escalation
Use #deal-help in Slack. Tag your manager. Standard SLA is 24 hours, faster for live calls.

## Tools
- Salesforce: source of truth for pipeline.
- Outreach: sequencing.
- Gong: call review (every AE listens to one peer call per week).`,
  },
  {
    id: 'team-wiki-success',
    title: 'Customer Success Wiki',
    category: 'team_wiki',
    author: 'Hiro Tanaka',
    authorTitle: 'Director, CS',
    publishedAt: '2026-04-04',
    summary: 'How CS works — book of business model, health scoring, renewal motion, and our shared definition of "at risk".',
    tags: ['customer success', 'cs', 'team', 'wiki', 'renewals', 'health score'],
    body: `# Customer Success Wiki

## Book of business
- Strategic CSMs: 8-12 accounts.
- Mid-market CSMs: 30-40 accounts.
- SMB pooled coverage via the digital CS team.

## Health scoring
Three inputs, equally weighted: usage, sentiment, executive engagement. Anything below 60 is "at risk" — must have a recovery plan in CRM within 7 days.

## Renewal motion
- 90 days out: renewal kickoff with the buyer.
- 60 days: pricing draft.
- 30 days: paper out.
- 0 days: don't be at zero days.

## Shared definitions
- *At risk*: health < 60 OR a P0 incident in the last 30 days OR known leadership change at the customer.
- *Champion gone*: the person who advocated for us has left. Treat this as at-risk until proven otherwise.`,
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    id: 'summit-2026-recap',
    title: 'Acme Summit 2026 — Recap',
    category: 'event',
    author: 'Priya Shah',
    authorTitle: 'Events',
    publishedAt: '2026-03-25',
    summary: 'Three days, 412 customers, 28 sessions. Top-rated talk: the platform engineering keynote. Photos, recordings, and on-stage demo links inside.',
    tags: ['summit', 'event', 'conference', 'recap', '2026'],
    body: `# Acme Summit 2026 — Recap

Three days in Lisbon, 412 customers, 28 breakout sessions, and one karaoke night nobody is going to forget.

## Numbers
- 412 customer attendees (target was 350)
- NPS for the event: +71
- 28 breakout sessions, 4 keynotes
- 17 customer-led talks
- 1 karaoke night

## Top-rated talks
1. Platform engineering keynote (Sara Patel)
2. "How we ship to 50M users daily" (customer talk — Globex)
3. AI in the admin console live demo
4. The roadmap deep-dive

## Where to find things
- All session recordings: in the Summit folder
- Photos: shared photo album link in #marketing-summit
- Customer feedback survey: results are in the Summit Notion page

## Save the date
Summit 2027 is in Berlin, March 17-19.`,
  },
  {
    id: 'engineering-offsite-may',
    title: 'Engineering Offsite — May 6-8',
    category: 'event',
    author: 'Eve Martinez',
    authorTitle: 'CEO',
    publishedAt: '2026-04-12',
    summary: 'Engineering all-team offsite in Lisbon, May 6-8. Logistics, agenda, and the (non-mandatory) hiking option.',
    tags: ['offsite', 'engineering', 'event', 'lisbon', 'team'],
    body: `# Engineering Offsite — May 6-8, Lisbon

The engineering all-team offsite is in Lisbon, May 6-8.

## Logistics
- Hotel block: Hotel Marquês, booked via the link in #eng-offsite.
- Flights: book your own through Concur, follow the Travel Policy.
- Per diem: $80/day.

## Agenda
- **Day 1**: opening from Eve, team breakouts, dinner together
- **Day 2**: working sessions on H2 priorities, evening free
- **Day 3**: fireside Q&A, social, optional hike at sunset

## Hike option
Optional. The hike is the *Roca cliff trail* — 8 km, moderate. Bring shoes that aren't sneakers.

## Accessibility
The hotel and main session venue are step-free. If you need any specific accommodation, please email events@acme.com by April 25.`,
  },

  // ── ERG / culture ─────────────────────────────────────────────────────────
  {
    id: 'erg-women-at-acme',
    title: 'Women at Acme — ERG Page',
    category: 'erg',
    author: 'Alice Chen',
    authorTitle: 'HR Manager',
    publishedAt: '2026-02-01',
    summary: 'The Women at Acme ERG: monthly meet-ups, mentorship circles, and our annual leadership-track sponsorship programme.',
    tags: ['erg', 'women', 'culture', 'mentorship', 'community'],
    body: `# Women at Acme — Employee Resource Group

Welcome. Women at Acme is for women, non-binary folks, and allies across the company.

## What we do
- **Monthly meet-ups** — first Thursday of each month, in-person + remote bridge.
- **Mentorship circles** — small groups of 4-6 that meet for a 6-month season.
- **Sponsorship programme** — annual leadership-track sponsorship for high-potential ICs.
- **Allyship 101 sessions** — quarterly, open to anyone.

## How to join
- Join #erg-women-at-acme in Slack.
- Sign up for the next meet-up via the Events page on the intranet.
- Mentorship season starts twice a year (Feb, Aug).

## Co-leads
Alice Chen (people@acme.com), Sara Patel, Lin Wei.

## Budget
The ERG has a quarterly budget of $5,000 for events, speakers, and external sponsorships. Approval lives with the co-leads.`,
  },
  {
    id: 'erg-pride-month',
    title: 'Pride Month at Acme — June 2026',
    category: 'erg',
    author: 'Frank Lee',
    authorTitle: 'Engineer & Pride co-lead',
    publishedAt: '2026-05-08',
    summary: 'Pride Month at Acme — speaker series, the annual donation match, and our company commitment to LGBTQ+ inclusion.',
    tags: ['pride', 'erg', 'lgbtq', 'culture', 'june', 'community'],
    body: `# Pride Month at Acme — June 2026

Pride Month is in June. Here's how Acme is showing up.

## Speaker series
- **June 4** — "Out at Work: Then and Now" — fireside with senior leaders.
- **June 11** — Trans inclusion in tech, with a guest from Out in Tech.
- **June 18** — Allyship workshop, open to all.
- **June 25** — closing celebration.

## Donation match
Acme will match employee donations to LGBTQ+ orgs up to $500/employee. Use the Benevity portal — link in #erg-pride.

## Beyond June
- Pronoun fields are now optional everywhere we have a name field.
- Healthcare benefits include gender-affirming care in all regions where it's legal.
- The dress code policy is gender-neutral; if you find a place where it isn't, please flag it to People Ops.`,
  },

  // ── Spotlights ────────────────────────────────────────────────────────────
  {
    id: 'spotlight-priya-shah',
    title: 'Employee Spotlight — Priya Shah',
    category: 'spotlight',
    author: 'Comms Team',
    authorTitle: 'Internal Communications',
    publishedAt: '2026-04-22',
    summary: 'Meet Priya Shah, our events lead — the person behind Summit 2026 and a quiet force inside the company.',
    tags: ['spotlight', 'employee', 'priya', 'events'],
    body: `# Employee Spotlight — Priya Shah

If you went to Summit 2026, you saw Priya's work everywhere.

## Role
Events lead. Owns Summit, our customer roadshow series, and the engineering offsite logistics.

## Joined Acme
2022.

## What people don't know
She trained as a structural engineer before pivoting to events. *"Bridges and conferences both fall over if you skip the load-bearing work."*

## Favourite Acme moment
"The first time we had a customer cry happy tears in a session — Summit 2024. That's when I knew this job was different."

## Outside work
Long-distance trail running, sourdough, two cats named Laplace and Fourier.

## What she's reading
*"Anything by Mary Oliver. And the post-mortem from a conference that went wrong — I read other people's post-mortems for fun."*`,
  },
  {
    id: 'spotlight-marcus-k',
    title: 'Employee Spotlight — Marcus K.',
    category: 'spotlight',
    author: 'Comms Team',
    authorTitle: 'Internal Communications',
    publishedAt: '2026-03-18',
    summary: 'Mobile engineer Marcus K. on shipping the redesign, the under-rated importance of release notes, and learning to say no.',
    tags: ['spotlight', 'employee', 'marcus', 'mobile', 'engineering'],
    body: `# Employee Spotlight — Marcus K.

## Role
Senior mobile engineer, shipped the iOS side of the April redesign.

## What he's working on
"Quietly tearing out the last of the legacy navigation code. The redesign was the front door — there's still a lot of plumbing behind the wall."

## Underrated part of the job
"Release notes. Nobody reads them, except the people who do, and they really read them. I write mine like I'd want to read them: short, specific, no marketing voice."

## Lesson he learned this year
"Saying no. I said yes to too many side projects in 2025 and shipped the main one slower. This year I'm saying no a lot more, with a smile."

## Coffee order
Cortado. *"And no, that's not the same thing as a flat white."*`,
  },

  // ── Two more leadership/announcement-style ─────────────────────────────────
  {
    id: 'office-berlin-opening',
    title: 'Berlin Office Opening — Late June',
    category: 'leadership',
    author: 'Marcus Hill',
    authorTitle: 'CFO',
    publishedAt: '2026-05-04',
    summary: 'Lease signed; the Berlin office opens late June. Up to 30 desks, hybrid by default. Hiring kicks off this month for Eng + GTM.',
    tags: ['berlin', 'office', 'expansion', 'hiring', 'eu'],
    body: `# Berlin Office Opening — Late June

We've signed the lease for the new Berlin office.

## What
- ~30 desks, hybrid by default.
- Friedrichshain, walkable from Ostbahnhof.
- Step-free; meeting rooms are video-conf-equipped.

## When
Soft-open late June. Official opening event in early July.

## Who
- Eng leads on the German hires: Frank Lee.
- GTM leads on the German hires: Carol Davis.
- People Ops contact for German employment matters: Alice Chen.

## How to relocate
We have a small relocation budget for current employees who want to move. Email people@acme.com with your situation; we'll work through it case by case.`,
  },
  {
    id: 'ai-tool-policy-v2',
    title: 'AI Tool Usage Policy — v2 Now Live',
    category: 'leadership',
    author: 'IT & Security',
    authorTitle: 'IT & Security',
    publishedAt: '2026-04-15',
    summary: 'Updated AI tool policy. New approved tools (Microsoft Copilot in pilot), clearer attribution rules, and explicit guidance for customer-facing roles.',
    tags: ['ai', 'policy', 'security', 'copilot', 'compliance'],
    body: `# AI Tool Usage Policy — v2

The updated AI Tool Usage Policy is live as of April 15.

## What changed
1. **Approved tools list expanded** — Microsoft 365 Copilot is now in pilot for Sales and Success. ChatGPT Enterprise remains approved for everyone. Personal/free-tier AI tools remain prohibited for company data.
2. **Attribution rules** — anything *generated* by AI for customer-facing material must be reviewed by a human before it ships. Internal use needs no attribution.
3. **Customer-facing role guidance** — when using AI to draft customer comms, you own the final words; review for tone, accuracy, and hallucinations.
4. **Data classification reminder** — *Confidential* or *Restricted* data must not be pasted into any AI tool, period.

## Where to read it
The full policy is in the IT wiki. If you have questions, post in #ai-tools or email security@acme.com.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeExcerpt(body, length = 260) {
  return body
    .replace(/^#+ .*$/gm, '')         // strip headings
    .replace(/[*_`>]/g, '')           // strip md markup
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length) + '…';
}

export function listArticles({ category, limit } = {}) {
  let rows = [...INTRANET_ARTICLES];
  if (category) rows = rows.filter(a => a.category === category);
  rows.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  if (limit) rows = rows.slice(0, limit);
  return rows.map(a => publicShape(a, false));
}

export function getArticle(id) {
  const a = INTRANET_ARTICLES.find(x => x.id === id);
  return a ? publicShape(a, true) : null;
}

export function searchArticles(query, category) {
  const q = (query || '').toLowerCase().trim();
  let pool = INTRANET_ARTICLES;
  if (category) pool = pool.filter(a => a.category === category);
  if (!q) {
    return [...pool]
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, 10)
      .map(a => publicShape(a, false));
  }

  const terms = q.split(/\s+/).filter(Boolean);
  const scored = pool.map(a => {
    const tagHay = (a.tags || []).join(' ').toLowerCase();
    const titleHay = (a.title || '').toLowerCase();
    const summaryHay = (a.summary || '').toLowerCase();
    const bodyHay = (a.body || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (titleHay.includes(term)) score += 4;
      if (tagHay.includes(term)) score += 3;
      if (summaryHay.includes(term)) score += 2;
      if (bodyHay.includes(term)) score += 1;
    }
    return { article: a, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ article }) => publicShape(article, false));
}

function publicShape(a, includeBody) {
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    categoryLabel: CATEGORY_LABELS[a.category] || a.category,
    author: a.author,
    authorTitle: a.authorTitle,
    publishedAt: a.publishedAt,
    summary: a.summary,
    tags: a.tags || [],
    excerpt: a.summary || makeExcerpt(a.body),
    uri: `acme://intranet/${a.id}`,
    ...(includeBody ? { body: a.body } : {}),
  };
}
