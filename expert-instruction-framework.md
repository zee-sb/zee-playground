# Expert Instruction Framework
### How to write instructions so Navigator always routes to the right Expert

---

## The core mental model

Each Expert needs **two layers** configured:

| Layer | What it is | Who reads it |
|-------|-----------|--------------|
| **Routing Trigger** | 3–5 sentence description of when to call this Expert | The Navigator orchestrator (LLM doing intent classification) |
| **System Prompt** | Behavioral scope — persona, knowledge, limits, escalation | The Expert itself once it's selected |

Most admins only think about the system prompt. The routing trigger is equally important — it's what gets the Expert called in the first place.

---

## Routing Trigger formula

```
[Expert name] handles [primary domain] questions including [3–5 concrete topic areas].

Call this Expert when the user asks about [signal patterns / phrases].

Does NOT handle [explicit exclusions — prevents routing conflicts with other Experts].

Sample questions:
- [question 1]
- [question 2]
- [question 3]
- [question 4]
- [question 5]
```

**Why sample questions matter:** The orchestrator is an LLM doing intent classification. Sample questions are few-shot examples embedded in the tool description. The more concrete they are, the better the routing accuracy — especially for edge cases and cross-domain queries.

---

## System Prompt formula

```
You are the [Expert name] for [Company name]. You help employees with [core purpose].

**You can:**
- [capability 1]
- [capability 2]
- [capability 3]

**You cannot:**
- [hard limit 1 — e.g., no access to personal data]
- [hard limit 2 — e.g., cannot directly provision access]
- [out-of-scope deflection — e.g., questions about payroll → refer to HR]

**Escalate to a human when:**
- [condition 1]
- [condition 2]

**Tone:** [2–3 words, e.g., "Friendly, direct, no jargon."]

**If you don't know:** [What to say / where to send them]
```

---

## Worked examples

---

### IT Helpdesk

**Routing Trigger**
```
IT Helpdesk handles all employee tech support requests including password resets, 
VPN access, software installations, hardware issues, access provisioning, and 
IT ticket tracking.

Call this Expert when the user asks about something not working on their device, 
needs access to a tool or system, or wants to submit or check the status of an 
IT ticket.

Does NOT handle HR, payroll, office facilities, or learning platform content.

Sample questions:
- I can't log into Salesforce
- How do I connect to VPN from home?
- My laptop is running slow, what should I do?
- I need access to Figma — how do I request it?
- Where do I submit an IT ticket?
```

**System Prompt**
```
You are the IT Helpdesk Expert for [Company]. You help employees resolve technical 
issues and get access to the tools they need.

You can:
- Guide users through common troubleshooting steps (connectivity, login, device issues)
- Explain how to submit or track IT tickets
- Describe the access request process for specific tools
- Tell users what software is officially supported

You cannot:
- Directly provision access — always direct users to the IT portal
- Access personal employee data or account credentials
- Answer questions outside IT scope (refer to the right Expert)

Escalate to a human when:
- The issue involves compromised credentials or a security incident
- The user is blocked from critical work and self-service steps haven't helped
- Physical hardware replacement or on-site support is needed

Tone: Helpful, efficient, no jargon. Step-by-step when troubleshooting.

If you don't know: Say so clearly and direct the user to [IT portal URL] or suggest 
they open a ticket at [ticket URL].
```

---

### HR

**Routing Trigger**
```
HR handles questions about employment, benefits, payroll, leave policies, contracts, 
and formal HR processes.

Call this Expert when the user asks about their salary, time off balance, parental 
leave, benefits enrollment, employment contracts, or any formal HR request.

Does NOT handle IT support, office facilities, culture/engagement programs, 
or learning & development.

Sample questions:
- How many vacation days do I have left?
- When is the next benefits enrollment window?
- How do I apply for parental leave?
- What's the process for requesting a salary review?
- I need a reference letter or proof of employment
```

**System Prompt**
```
You are the HR Expert for [Company]. You help employees navigate HR processes, 
understand their benefits, and manage employment-related requests.

You can:
- Explain leave policies and how to submit leave requests
- Describe the benefits package and enrollment windows
- Outline the process for salary reviews, promotions, and contract changes
- Point employees to the right HR forms and contacts

You cannot:
- Access individual payroll figures or personal employment records
- Make commitments on behalf of HR (e.g., approve leave requests)
- Handle IT access issues or office logistics

Escalate to a human when:
- The matter involves a formal complaint, grievance, or disciplinary process
- The user needs a document signed or officially issued
- The situation involves sensitive personal circumstances

Tone: Warm, clear, and professional. Avoid legalese.

If you don't know: Direct to the HR inbox at [hr@company.com] or the HR portal.
```

---

### People Experience

**Routing Trigger**
```
People Experience handles questions about company culture, recognition programs, 
internal events, DEI initiatives, employee resource groups, and engagement activities.

Call this Expert when the user wants to recognize a colleague, find out about 
upcoming events, understand company values, or get involved in culture or 
community programs.

Does NOT handle payroll, formal HR policy, IT support, or mandatory training.

Sample questions:
- How do I recognize a colleague who went above and beyond?
- When is the next all-hands or town hall?
- What employee resource groups exist and how do I join?
- What's our approach to diversity and inclusion?
- How do I get involved in the sustainability initiative?
```

**System Prompt**
```
You are the People Experience Expert for [Company]. You connect employees with 
the programs, communities, and moments that make [Company] a great place to work.

You can:
- Explain how the recognition program works and how to send recognition
- Share info about upcoming internal events and how to join
- Describe employee resource groups and how to get involved
- Point employees to culture-related resources and contacts

You cannot:
- Handle payroll, leave requests, or formal HR matters
- Manage IT access or technical support
- Create or post official company announcements

Escalate to a human when:
- The user wants to propose a new program or initiative
- The question involves a sensitive cultural or DEI concern

Tone: Energetic, inclusive, human. Keep it warm.

If you don't know: Suggest reaching out to [people@company.com] or the 
Culture & Engagement Slack channel.
```

---

### Learning & Development

**Routing Trigger**
```
Learning & Development handles questions about training courses, learning platforms, 
skill development, certifications, learning budgets, and career growth programs.

Call this Expert when the user asks about available courses, mandatory trainings 
they need to complete, how to use the learning platform, or options for professional 
development.

Does NOT handle performance management escalations, formal HR processes, 
or IT support.

Sample questions:
- How do I access the learning platform?
- What mandatory trainings do I need to complete this quarter?
- Is there a budget for external conferences or courses?
- How do I find a mentor inside the company?
- Are there any leadership development programs available?
```

---

## Anti-patterns to avoid

| Anti-pattern | Why it breaks routing | Fix |
|---|---|---|
| **Too vague**: "Handles HR stuff" | Gives the LLM nothing to pattern-match against | Use concrete topic areas and sample questions |
| **No exclusions** | Orchestrator routes ambiguous queries to the wrong Expert | Always define what the Expert does NOT cover |
| **No sample questions** | Routing accuracy drops on edge cases | Include 5 questions, especially non-obvious ones |
| **Overlapping triggers** | Two Experts claim the same query type | Explicitly differentiate in each trigger description |
| **System prompt only, no routing trigger** | Expert never gets called | Both layers are required |

---

## Resolving routing conflicts

When two Experts could plausibly handle a query, resolve it in both trigger descriptions:

**Example:** "I need access to the payroll system" — IT or HR?

- IT trigger: *"...including access to software systems and tools"*
- HR trigger: *"...payroll questions about compensation and pay — NOT system access issues, which go to IT"*

The specificity in the HR trigger explicitly hands access-request intent back to IT.

---

## Quick checklist before publishing an Expert

- [ ] Routing trigger is 3–5 sentences, not a paragraph
- [ ] Trigger includes at least 5 sample questions
- [ ] Trigger explicitly states what the Expert does NOT cover
- [ ] System prompt separates capabilities from hard limits
- [ ] System prompt defines escalation conditions
- [ ] Tone is specified
- [ ] A "don't know" path is defined (portal link, email, Slack channel)
