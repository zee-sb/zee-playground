// Knowledge base content — hand-written docs for each KB connector defined
// in lib/seed.mjs. Indexed by kbId. Used by lib/mcp-servers/kb.mjs's
// `search` tool to do keyword matching + return real text the LLM can cite.
//
// Schema:
//   { id, title, body, tags[], lastUpdated }
//
// Search: simple TF-IDF-ish keyword match. No embeddings (yet). The docs are
// short on purpose — a real workspace would have 100s; this is enough to
// demo "the assistant cited a real policy" with no infrastructure burden.

export const KB_DOCUMENTS = {
  // ── HR POLICIES ───────────────────────────────────────────────────────────
  'kb-hr': [
    {
      id: 'hr-pto-policy',
      title: 'Paid Time Off (PTO) Policy',
      tags: ['pto', 'leave', 'vacation', 'holiday'],
      lastUpdated: '2026-01-12',
      body: `## Paid Time Off

All full-time Staffbase employees accrue **20 days** of paid time off per calendar year, plus public holidays in their work location.

**Accrual:** PTO accrues at 1.66 days per month. New hires accrue from their start date and can take time off as soon as it's accrued.

**Carryover:** Up to 5 unused days carry over to the next calendar year. Anything above 5 is forfeited on Jan 1.

**Requesting time off:** Submit via the HR Portal at least 2 weeks in advance for trips longer than 3 days. Same-day requests are accepted for sick leave; manager approval not required for less than 3 days.

**Blackout dates:** No PTO during the last week of each quarter (Mar 24–31, Jun 24–30, Sep 24–30, Dec 24–31) unless approved by your department head.

**Unlimited PTO?** No — Staffbase explicitly chose a fixed-allowance policy. Research shows employees with "unlimited" PTO take fewer days off, not more.`,
    },
    {
      id: 'hr-parental-leave',
      title: 'Parental Leave',
      tags: ['parental', 'leave', 'maternity', 'paternity', 'adoption'],
      lastUpdated: '2025-09-04',
      body: `## Parental Leave

**Primary caregivers** receive 16 weeks of fully paid leave following the birth or adoption of a child. Available to all employees regardless of gender.

**Secondary caregivers** receive 6 weeks of fully paid leave within the first 12 months.

**Phased return:** Optional 4-week phased return at 60% of normal hours. Manager and HR coordinate the schedule.

**Eligibility:** All full-time employees from day one. Contractors are not covered.

**How to request:** Notify HR and your manager at least 8 weeks before the expected start date. HR will coordinate with payroll and IT for benefits continuity and equipment access during leave.`,
    },
    {
      id: 'hr-benefits-overview',
      title: 'Benefits Overview',
      tags: ['benefits', 'health', 'dental', 'vision', '401k', 'pension', 'insurance'],
      lastUpdated: '2026-01-15',
      body: `## Benefits

**Health, dental, vision:** Staffbase covers 100% of employee premiums and 80% of dependent premiums. Three plan tiers (Basic / Plus / Premium); see HR Portal for details.

**Retirement:** 401(k) in the US, equivalent pension schemes in EU offices. Staffbase matches 100% of contributions up to 4% of base salary. Vests immediately.

**Wellness:** $100/month wellness stipend (gym, therapy, meditation apps). Reimburse via the expense system with category "Wellness".

**Learning:** $2,000/year personal learning budget. No pre-approval needed for items under $200; manager sign-off for the rest.

**Equipment:** All employees get a MacBook Pro M-series. External monitor, keyboard, mouse, and a $300 home-office stipend on top.

**Open enrollment:** Annual benefits enrollment runs Oct 15 – Nov 15. Changes outside this window require a qualifying life event.`,
    },
    {
      id: 'hr-performance-review',
      title: 'Performance Review Cycle',
      tags: ['performance', 'review', 'feedback', '360', 'rating'],
      lastUpdated: '2025-11-20',
      body: `## Performance Reviews

Staffbase runs **two formal review cycles** per year: June and December.

**Process (3 weeks per cycle):**
1. Self-assessment in Lattice (1 week)
2. Peer feedback — 3 to 5 reviewers, manager-curated (1 week)
3. Manager review + calibration + 1:1 (1 week)

**Ratings:** Exceeding · Meeting · Developing · Needs Improvement. Calibration sessions ensure consistency across teams.

**Compensation:** Merit increases and bonuses are tied to the December cycle. The June cycle is feedback-only — no comp impact — so employees can iterate without anxiety.

**Promotions** are decided in calibration based on consistent "Exceeding" performance and a documented impact narrative. Talk to your manager mid-cycle if you're aiming for one.`,
    },
    {
      id: 'hr-remote-work',
      title: 'Remote & Hybrid Work Policy',
      tags: ['remote', 'hybrid', 'wfh', 'office', 'attendance'],
      lastUpdated: '2025-10-01',
      body: `## Remote & Hybrid Work

Staffbase is **remote-first** — every role can be performed from anywhere in the country of hire. We have offices in Chemnitz, Berlin, Cologne, and New York for those who prefer in-person.

**Hybrid teams:** Some teams (Customer Success, Sales) require 2 in-office days per week. Check with your manager.

**Travel for work:** All employees are expected to attend the company offsite (twice a year) and team offsites (once a year). Travel is fully covered; see Travel Policies.

**Working from another country:** Up to 30 days/year from another EU country. Outside the EU requires tax + legal review (4-week notice to HR).

**Async by default:** No same-day-response expectation for non-urgent messages. Use Slack threads, not DMs, for anything that's not 1:1.`,
    },
    {
      id: 'hr-conduct',
      title: 'Code of Conduct & Anti-Harassment',
      tags: ['conduct', 'harassment', 'ethics', 'discrimination', 'reporting'],
      lastUpdated: '2025-08-15',
      body: `## Code of Conduct

Staffbase has a zero-tolerance policy for harassment, discrimination, bullying, and retaliation. The full Code of Conduct is in the HR Portal.

**Reporting:** Three channels — your manager, People Ops directly (people@staffbase.com), or the anonymous tip line. All reports are investigated within 7 business days.

**Whistleblower protection:** Anyone reporting in good faith is protected from retaliation regardless of whether the report is ultimately substantiated.

**External speaking:** When representing Staffbase publicly (conferences, podcasts, social media), follow the Brand Guidelines and run topics by Communications.`,
    },
    {
      id: 'hr-sick-leave',
      title: 'Sick Leave',
      tags: ['sick', 'illness', 'medical', 'doctor'],
      lastUpdated: '2025-12-01',
      body: `## Sick Leave

Take sick days as needed — no annual limit on legitimate illness. Notify your manager via Slack as early as you can on the day.

**Doctor's note:** Not required for 3 days or fewer. After 3 consecutive days, HR may request documentation for benefits continuity.

**Mental health days:** Explicitly count as sick days. You don't have to disclose the reason.

**Long-term illness:** Anything over 5 consecutive days, contact HR for short-term disability coordination.`,
    },
    {
      id: 'hr-faqs',
      title: 'HR Frequently Asked Questions',
      tags: ['faq', 'how-to', 'question'],
      lastUpdated: '2026-02-10',
      body: `## Top HR FAQs

**How do I change my address?** Update it in the HR Portal under "My Profile". Auto-syncs to payroll within 24 hours.

**When do I get paid?** US: 1st and 15th. EU: last business day of the month.

**Who's my HRBP?** Each department has an assigned HR Business Partner. See "My Team" → "HR Contacts" in the HR Portal.

**Can I refer someone?** Yes — submit through the referral portal in the HR Portal. $2,000 bonus when the referral passes 90 days.

**Do you sponsor visas?** Yes for full-time roles. Coordinate with your hiring manager and our immigration partner.`,
    },
  ],

  // ── IT WIKI ───────────────────────────────────────────────────────────────
  'kb-it': [
    {
      id: 'it-vpn-setup',
      title: 'VPN Setup (Tailscale)',
      tags: ['vpn', 'tailscale', 'security', 'remote'],
      lastUpdated: '2025-11-12',
      body: `## VPN — Tailscale

Staffbase uses Tailscale for VPN. Required for accessing internal staging environments, the production bastion, and any service marked "Internal Only" in the SSO catalog.

**Install:**
1. Download the Tailscale app from tailscale.com for your OS.
2. Sign in with your @staffbase.com Google account.
3. You'll be auto-added to the "staffbase-employees" tailnet.

**Daily use:** Just keep the app running. Routes are pushed automatically. No manual server configuration.

**Troubleshooting:** If DNS resolution fails for *.staffbase.internal, restart the Tailscale app. Still failing? IT ticket — tag it #tailscale.`,
    },
    {
      id: 'it-mfa',
      title: 'Multi-Factor Authentication (MFA)',
      tags: ['mfa', '2fa', 'security', 'yubikey', 'authenticator'],
      lastUpdated: '2025-10-22',
      body: `## MFA Setup

All Staffbase accounts require MFA. We support TOTP (Google Authenticator, 1Password, etc.) and hardware keys (YubiKey).

**Strongly recommended:** Two methods enrolled — one TOTP and one hardware key. If you lose one, you can still sign in.

**YubiKey program:** Engineering, Security, and Finance employees get a company-issued YubiKey. Other roles can request one via the IT Helpdesk.

**Lost a factor?** File an IT ticket — Recovery requires manager verification + a 24-hour cool-down. Don't share recovery codes via Slack.`,
    },
    {
      id: 'it-software-requests',
      title: 'Software & Access Requests',
      tags: ['software', 'access', 'license', 'request'],
      lastUpdated: '2026-01-05',
      body: `## Requesting Software & Access

**Pre-approved tools** (no ticket needed — auto-provisioned via SSO): Slack, Google Workspace, Notion, Linear, Figma, GitHub, Lattice, Mixpanel, Productboard, Sentry, AWS console (read-only).

**Request via IT ticket:** Anything not in the pre-approved list. Tag your ticket #software-request and explain the use case. Average turnaround: 1 business day.

**Production access:** Engineering on-call rotation members get production read-only on rotation start. Write access requires manager + SRE approval.

**License costs over $50/month:** Need department head approval before IT will provision.`,
    },
    {
      id: 'it-equipment',
      title: 'Equipment & Hardware Policy',
      tags: ['equipment', 'hardware', 'laptop', 'monitor', 'home-office'],
      lastUpdated: '2025-12-15',
      body: `## Equipment Policy

**Standard issue:** MacBook Pro 14" (M-series), USB-C hub, Magic Mouse, Magic Keyboard. Engineering and Design get the 16" model and a 4K external display.

**Refresh cycle:** Every 3 years, or sooner if your device fails. Trade-in via the IT Helpdesk — old device is wiped and recycled or donated.

**Damage:** Accidental damage is covered. Negligence (lost, stolen with no police report, intentional) is not — IT will deduct replacement cost from your next paycheck after review.

**Personal use:** Light personal use is fine. No torrenting, no installing unvetted software, no jailbreaking.

**Returning equipment** (departure or extended leave): Mail back via IT-provided pre-paid label within 5 business days.`,
    },
    {
      id: 'it-phishing',
      title: 'Phishing & Email Security',
      tags: ['phishing', 'email', 'security', 'social-engineering'],
      lastUpdated: '2025-11-30',
      body: `## Phishing Awareness

**If you're not sure an email is legit:** Forward it to security@staffbase.com. Do NOT click links or download attachments.

**Common red flags:**
- Urgent language ("respond in 1 hour or your account will be locked")
- Sender domain doesn't match the company they claim to be from
- Asks for credentials, MFA codes, or payment info
- Bad grammar or oddly-formatted signatures

**Internal phishing drills:** Security runs quarterly phishing simulations. Report sims by forwarding — you'll see a "Thanks for reporting" auto-reply.

**Never share:** Your password, MFA codes, recovery codes. Even with IT. We will never ask.`,
    },
    {
      id: 'it-mdm',
      title: 'Mobile Device Management (MDM)',
      tags: ['mdm', 'mobile', 'phone', 'byod'],
      lastUpdated: '2025-10-18',
      body: `## MDM Policy

**Company-issued laptops** are enrolled in Jamf MDM. Enables remote wipe if lost/stolen, enforces FileVault encryption, and pushes security updates.

**Personal phones with work email/Slack:** Must enroll in Intune MDM. This creates a separate "work profile" — IT can wipe the work profile only, not your personal data.

**BYOD laptops:** Not supported for employees. Contractors with valid contracts may BYOD with IT-approved security posture (FileVault, MDM, current OS).

**Off-boarding:** All MDM-managed devices are remote-wiped on the last day. Personal-profile data on phones is preserved.`,
    },
    {
      id: 'it-ai-tools',
      title: 'AI Tool Usage Policy',
      tags: ['ai', 'chatgpt', 'copilot', 'claude', 'data', 'security'],
      lastUpdated: '2026-02-05',
      body: `## AI Tools

**Approved for confidential data:** Staffbase's internal Companion (this assistant), GitHub Copilot Business, Anthropic Claude via the Enterprise plan.

**Approved for non-confidential data only:** ChatGPT Plus, Gemini, Perplexity. Don't paste customer data, internal financials, or unreleased product specs.

**Forbidden:**
- Free-tier ChatGPT (training opt-out not guaranteed)
- Any AI tool you haven't seen on the approved list

**Generated code:** Review carefully — you own anything you commit. Copilot Business has IP indemnification, but it doesn't replace code review.

**Generated content for customers:** Disclose AI-generated content per Marketing's guidelines. Never claim Staffbase Companion's output as a human-authored answer.`,
    },
    {
      id: 'it-password',
      title: 'Password Policy',
      tags: ['password', 'security', 'rotation', 'manager'],
      lastUpdated: '2025-09-30',
      body: `## Passwords

**Use a password manager.** 1Password (company subscription) is auto-provisioned. Never reuse passwords across services.

**Length over complexity:** Minimum 16 characters. A long passphrase ("correct horse battery staple") beats a short complex one.

**Rotation:** We do NOT enforce time-based password rotation (industry consensus is that forced rotation makes passwords worse, not better). Rotate only on suspected compromise.

**MFA is required** on every account regardless of password strength.`,
    },
  ],

  // ── ONBOARDING GUIDE ──────────────────────────────────────────────────────
  'kb-onboard': [
    {
      id: 'onboard-day-one',
      title: 'Day One Checklist',
      tags: ['day-one', 'first-day', 'new-hire', 'checklist'],
      lastUpdated: '2026-01-08',
      body: `## Day One — Welcome to Staffbase

**Morning:**
- Pick up your MacBook (office) or check the courier tracking link (remote). Sign the asset handover form.
- Sign in to Google Workspace with your @staffbase.com email; complete MFA enrollment.
- Open the Onboarding Hub in Campsite — your buddy and manager are already listed.
- Slack: your manager added you to your team channels. Drop a hello in #new-hires.

**Afternoon:**
- 1:1 with your manager (calendar invite already on your calendar)
- Watch the "Welcome to Staffbase" video (Campsite > Onboarding)
- Optional: 30-minute tour with your onboarding buddy

**End of day:**
- Submit the "Day One Pulse" survey (link in your inbox). 90 seconds.

Don't worry about productivity — Day One is for paperwork, intros, and getting your tools working.`,
    },
    {
      id: 'onboard-first-week',
      title: 'First Week Plan',
      tags: ['first-week', 'onboarding', 'new-hire'],
      lastUpdated: '2026-01-08',
      body: `## First Week

**By end of Day 5 you should have:**
- Read the Company Handbook (in Campsite > Onboarding)
- Met every direct teammate 1:1 (your buddy schedules these)
- Attended your department's weekly all-hands
- Set up dev environment (Engineering) or domain tools (other roles)
- Completed mandatory security training

**Manager check-in (end of week):**
- What's been clear vs. confusing
- What's missing from your environment
- Goals for the next 30 days

**Don't:** feel guilty about not contributing yet. The expectation is zero output in Week 1 — you're absorbing context.`,
    },
    {
      id: 'onboard-first-month',
      title: 'First Month Goals',
      tags: ['first-month', 'onboarding', '30-day', 'review'],
      lastUpdated: '2026-01-08',
      body: `## First Month

By Day 30 you should:
- Ship one small thing end-to-end (a PR, a customer call summary, a slide deck — anything visible)
- Document one process or piece of context you learned (someone after you will thank you)
- Set Q-end goals with your manager in Lattice
- Submit the 30-day feedback survey

**30-day check-in with manager:** Set this up yourself. Reflect on what's working, what's not, what to adjust for the next 30.

**Common pitfalls:**
- Trying to "prove yourself" by working long hours — don't, it's a marathon
- Quietly waiting to be told what to do — propose work, don't wait
- Not asking questions — the goofiest question on Day 28 is fine; on Day 90 it's harder`,
    },
    {
      id: 'onboard-buddy-program',
      title: 'Onboarding Buddy Program',
      tags: ['buddy', 'onboarding', 'support', 'mentor'],
      lastUpdated: '2025-11-05',
      body: `## Buddy Program

Every new hire gets a buddy — a teammate (not your manager) who's been at Staffbase for 6+ months.

**Buddy's role:** Answer the "is this normal?" questions. Show you the unwritten rules. Be the safe person to ask anything.

**Your buddy will:**
- Schedule daily 15-min check-ins for Week 1
- Coffee chat once a week through Week 4
- Be your point of contact in Slack #new-hires

**Buddies are matched by:** team, time zone, and personality. If the match isn't working after Week 1, tell HR — we'll rematch with zero drama.`,
    },
    {
      id: 'onboard-manager-intro',
      title: 'Meeting Your Manager — What to Expect',
      tags: ['manager', '1:1', 'intro', 'expectations'],
      lastUpdated: '2025-12-10',
      body: `## First 1:1 with Your Manager

Most managers have a similar shape for the first 1:1:
1. **15 min — Get to know you:** background, motivations, working style
2. **15 min — Get to know them:** their context, what their week looks like, what they're optimizing for
3. **15 min — Ground rules:** how 1:1s will run, what async vs sync, when to escalate, vacation/PTO style
4. **15 min — Open Q&A**

**Questions worth asking:**
- What does success look like at 30 / 60 / 90 days?
- What's the team's single biggest priority right now?
- Who else should I meet this week?
- What's something the team does well that's not obvious from outside?
- What's the team's biggest challenge — and how can I help?`,
    },
    {
      id: 'onboard-tools-setup',
      title: 'Tools Setup Checklist',
      tags: ['tools', 'setup', 'access', 'sso'],
      lastUpdated: '2026-01-12',
      body: `## Tools — what you'll need access to

**Every role:** Google Workspace, Slack, Campsite, Lattice, 1Password, Tailscale.

**Engineering:** GitHub, AWS console, Sentry, PagerDuty, Linear. Run \`./bootstrap.sh\` in the repo for local env.

**Product:** Linear, Mixpanel, Productboard, Maze, Notion. Plus read-only Sentry.

**Design:** Figma, FigJam, Loom. Optional: Maze for testing.

**Customer Success:** Salesforce, Gainsight, Zendesk, Loom.

**Sales:** Salesforce, Outreach, Gong.

**If you're missing a tool:** File an IT ticket tagged #onboarding — they'll provision within hours.`,
    },
  ],

  // ── TRAVEL POLICIES ───────────────────────────────────────────────────────
  'kb-travel': [
    {
      id: 'travel-booking',
      title: 'How to Book Business Travel',
      tags: ['travel', 'booking', 'flight', 'hotel', 'navan'],
      lastUpdated: '2025-12-01',
      body: `## Booking Travel

Book all business travel through Navan (our T&E platform). Direct bookings outside Navan are non-reimbursable unless pre-approved.

**Approval:** Trips under $1,000 USD auto-approved. $1,000–$3,000 needs manager approval (one-click in Navan). Over $3,000 needs department head + finance approval.

**Class:**
- Flights under 6 hours: Economy
- Flights 6+ hours: Premium Economy
- Flights 10+ hours: Business class (manager approval required)
- Trains: Standard. First class only on overnight trains.

**Hotels:** Up to $300/night in tier-1 cities (NYC, SF, London, Tokyo), $200/night otherwise. Stay at company-rate hotels when possible — Navan flags them.`,
    },
    {
      id: 'travel-per-diem',
      title: 'Per Diem & Meals',
      tags: ['per-diem', 'meals', 'food', 'expense'],
      lastUpdated: '2025-10-15',
      body: `## Per Diem & Meals

**Per-diem option:** $75/day in the US, €65 in EU, equivalent local rate elsewhere. Covers meals + incidentals. No receipts required.

**Actual-expense option:** Submit receipts for meals up to $100/day. Alcohol with client meals only — never solo.

**Pick one mode per trip** — can't mix per-diem and actual expenses on the same trip.

**Team meals:** Reimbursable when ≥3 colleagues. One person pays + submits with attendees listed.`,
    },
    {
      id: 'travel-expenses',
      title: 'Reimbursable Expenses',
      tags: ['expense', 'reimbursement', 'receipt'],
      lastUpdated: '2025-11-10',
      body: `## What's Reimbursable

**Always reimbursable:** Transit to/from airport, parking, baggage fees, work-related phone roaming, conference fees, business meals.

**Reimbursable with policy adherence:** Hotels, flights (per the booking rules), per-diem meals.

**Not reimbursable:** In-flight upgrades you didn't get approval for, personal entertainment, mini-bar, room service for personal preference, traffic/parking fines, lost luggage replacement (use travel insurance).

**Submission:** Upload receipts to Navan within 14 days of trip end. Late submissions can be rejected.`,
    },
    {
      id: 'travel-offsite',
      title: 'Company & Team Offsites',
      tags: ['offsite', 'company', 'team', 'all-hands'],
      lastUpdated: '2026-01-20',
      body: `## Offsites

**Company offsite (twice a year):** All-hands, mid-year and end-of-year. Travel and lodging fully covered. Attendance expected unless on leave.

**Team offsite (once a year):** Each team plans its own. Up to $1,500/person budget. Pre-approved location list in Navan.

**During an offsite:** Per-diem doesn't apply — meals are covered as a group expense by the trip organizer.

**Bringing family:** You may extend stays personally at your own cost. Coordinate with your manager to avoid blackout dates.`,
    },
    {
      id: 'travel-international',
      title: 'International Travel',
      tags: ['international', 'visa', 'passport', 'global'],
      lastUpdated: '2025-09-22',
      body: `## International Travel

**Visa support:** If you need a visa for business travel, request via HR at least 8 weeks in advance. We use Fragomen for visa assistance.

**Passport validity:** Must have 6 months remaining beyond return date. Request expedited renewal via HR if needed; Staffbase covers the fee.

**Insurance:** All international business travel is covered by our corporate travel insurance (auto-applied when you book through Navan).

**Currency & cards:** Use the Navan corporate card — no FX fees. If you pay personally, submit at original-currency rate; finance handles conversion.`,
    },
  ],

  // ── CAMPSITE ARTICLES (curated leadership memos) ──────────────────────────
  'kb-intranet': [
    {
      id: 'intranet-q2-priorities',
      title: 'Q2 2026 Priorities from the ELT',
      tags: ['q2', 'priorities', 'leadership', 'strategy', 'roadmap'],
      lastUpdated: '2026-04-02',
      body: `## Q2 Priorities

Three big rocks for Q2:

**1. Navigator GA.** Launch general availability mid-quarter. Customer success teams own enablement; engineering owns reliability targets (99.5% uptime, p95 < 1.2s).

**2. Customer growth in EU.** Target 25 new logos across DACH and Nordics. Sales-led, marketing supports with localized content.

**3. Reduce time-to-first-value for new customers.** Currently 14 days median; target 7 days by quarter-end. Drives retention.

Everything else is below-the-line. If your work doesn't ladder up, surface it in your 1:1 — we may pause it.`,
    },
    {
      id: 'intranet-self-serve-launch',
      title: 'Self-Serve Trial Launch Recap',
      tags: ['product', 'launch', 'self-serve', 'trial'],
      lastUpdated: '2026-03-18',
      body: `## Self-Serve Trial — We Shipped

After 6 months of work, the self-serve trial flow is live. Customers can sign up, configure their Staffbase environment, and start running campaigns without sales involvement.

**Week 1 results:** 312 trial sign-ups, 47% activated (set up at least one channel), 12% converted within 7 days.

**What worked:** Onboarding video, in-app guides, fast time-to-first-post.

**What didn't:** SSO setup confusion (28% drop-off there). Fix in flight.

Huge thanks to the Growth team and the Onboarding Hub squad.`,
    },
    {
      id: 'intranet-pride-month',
      title: 'Pride Month 2026 at Staffbase',
      tags: ['pride', 'erg', 'culture', 'inclusion'],
      lastUpdated: '2026-05-30',
      body: `## Pride Month — Programming

The Staffbase Pride ERG has organized a packed June:

- **June 4** — Allyship workshop with a Berlin-based DEI facilitator
- **June 11** — "Coming out at work" panel — three Staffbase employees + Q&A
- **June 18** — Match-the-shoe trivia + happy hour, all offices
- **June 25** — Volunteer day with Trevor Project (US) and Quarteera (Germany)

Pride pins are at every office reception. Slack #pride for the full calendar.`,
    },
    {
      id: 'intranet-engineering-oncall',
      title: 'Engineering On-Call — How It Works',
      tags: ['engineering', 'on-call', 'oncall', 'production', 'incident'],
      lastUpdated: '2026-02-14',
      body: `## On-Call

Engineering runs a weekly on-call rotation. One primary, one secondary per service tier (Tier 1: Auth, Channels, Push; Tier 2: everything else).

**Compensation:** $400 weekly stipend, plus comp time for any after-hours incident response (1.5x hours, taken within 30 days).

**Pages:** Routed via PagerDuty. SLO is 5-minute acknowledgement, 30-minute first-response.

**Runbooks:** Every service has a runbook in Confluence (#runbooks). If yours doesn't, ship it — that's an on-call expectation.

**Postmortems:** Every Sev-1/Sev-2 gets a blameless postmortem within 5 business days. Template in Confluence.`,
    },
    {
      id: 'intranet-ceo-town-hall',
      title: 'CEO Town Hall — March Recap',
      tags: ['town-hall', 'ceo', 'leadership', 'all-hands'],
      lastUpdated: '2026-03-25',
      body: `## March All-Hands — CEO Recap

Highlights from this month's town hall:

- **Numbers:** ARR up 18% YoY, NRR at 112%, customer count 2,400+
- **Hiring:** 35 open roles, mostly engineering and customer success
- **Customer story:** Lufthansa Group rolled out Staffbase to 60K employees — case study coming
- **Acquisition:** Closing the Voiced.io acquisition in April (voice AI for frontline)
- **The big bet:** Doubling down on Navigator + agentic AI through 2026

Q&A covered remote work expectations (no change), career frameworks (rollout July), and the EU office expansion (Stockholm in late Q3).`,
    },
    {
      id: 'intranet-spotlight-mira',
      title: 'Employee Spotlight: Mira Okafor',
      tags: ['spotlight', 'employee', 'engineering', 'profile'],
      lastUpdated: '2026-04-15',
      body: `## Employee Spotlight — Mira Okafor

Mira joined Staffbase six months ago as a Software Engineer on the Channels team in Chemnitz. Before Staffbase, she was at Zalando and contributed to several Rust open-source projects.

**Recent work:** Mira led the Channels API v2 redesign — cut p95 latency from 800ms to 110ms.

**Outside work:** Trail running, mechanical keyboards (she's built three), and coordinating a Berlin-based women-in-tech reading club.

**Fun fact:** She speaks four languages — Igbo, English, German, and Spanish.

Welcome again, Mira — we're glad you're here.`,
    },
  ],
};

// Lookup helpers.
export function getKbDocuments(kbId) {
  return KB_DOCUMENTS[kbId] || [];
}

export function getKbDocument(kbId, docId) {
  return (KB_DOCUMENTS[kbId] || []).find((d) => d.id === docId) || null;
}

export function getKbIds() {
  return Object.keys(KB_DOCUMENTS);
}

// Naive keyword scorer — splits the query into tokens, scores each doc by
// title/tag/body hits. Returns at most `limit` docs sorted by score, with
// short snippets centered on the first match. Good enough for a demo;
// swap for pgvector later without changing the call site.
export function searchKb(kbId, query, { limit = 4 } = {}) {
  const docs = getKbDocuments(kbId);
  if (!docs.length) return [];
  const q = String(query || '').toLowerCase().trim();
  if (!q) return docs.slice(0, limit).map((d) => ({
    id: d.id, title: d.title, snippet: d.body.slice(0, 240) + '…', tags: d.tags, lastUpdated: d.lastUpdated, score: 0,
  }));
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  const scored = docs.map((d) => {
    const title = d.title.toLowerCase();
    const body = d.body.toLowerCase();
    const tagBag = (d.tags || []).map((t) => t.toLowerCase()).join(' ');
    let score = 0;
    for (const t of tokens) {
      if (title.includes(t)) score += 5;
      if (tagBag.includes(t)) score += 3;
      const bodyHits = body.split(t).length - 1;
      score += Math.min(bodyHits, 4);
    }
    return { doc: d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      snippet: makeSnippet(doc.body, tokens),
      tags: doc.tags,
      lastUpdated: doc.lastUpdated,
      score,
    }));
}

function makeSnippet(body, tokens) {
  const lower = body.toLowerCase();
  let bestIdx = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0) return body.slice(0, 240) + (body.length > 240 ? '…' : '');
  const start = Math.max(0, bestIdx - 80);
  const end = Math.min(body.length, bestIdx + 220);
  let snippet = body.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < body.length) snippet = snippet + '…';
  return snippet;
}
