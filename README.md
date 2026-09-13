# LaunchPad

Autonomous AI co-founder for early-stage founders. LaunchPad walks a founder through a **7-stage validation journey** (Idea Validation → Operate), gating each stage on real evidence rather than vibes. A memory-grounded chat agent proposes work; nothing with a side effect runs until the founder approves it from an **approval inbox**; and a single daily cron quietly runs competitor/market **watchers**, folds findings into a **knowledge graph**, and ships a weekly **Monday Brief**. Built on the Pi Agent SDK + OpenAI.

## Quick Start

```bash
git clone https://github.com/SenseFoundItaly/LaunchPad-v2.git
cd LaunchPad-v2
cp .env.example .env.local       # Fill in DATABASE_URL (Supabase Postgres) + OPENAI_API_KEY + Supabase keys
npm install
npm run db:migrate               # Apply migrations (reads .env.local; add  -- --prod  to target prod)
npm run dev                      # http://localhost:3000
```

First login uses Supabase Auth (magic link) — see [Supabase setup](#supabase-setup).

---

## How it works

### The full loop — system map

Every piece below is a station on one circuit. The founder is the only switch: nothing turns green, runs, or writes without their click — with one declared exception (watcher autoflow).

```
                    ┌──────────────────────────────────────────────┐
                    │                 THE FOUNDER                   │
                    │   (the only one who can turn anything green)  │
                    └───────┬──────────────────────────▲───────────┘
                            │ talks / clicks            │ Monday Brief · activity feed
                            ▼                           │
   ┌─────────────── CO-PILOT (chat) ──────────┐   ┌─── PULSE (weekly) ─────────┐
   │ reads: static rules + the LIVE spine     │   │ reads the week: score delta │
   │ state (open checks, the check they       │   │ facts, pending actions,     │
   │ pressed) · proposes: evidence, watchers, │   │ alerts → narrates it back   │
   │ skills — never writes directly           │   └────────────▲────────────────┘
   └───────────────┬──────────────────────────┘                │
                   │ proposal cards                            │
                   ▼                                           │
   ┌────────────── INBOX (pending_actions) ────────────────────┼──┐
   │ evidence proposals (from chat, uploads, NOTES) · watcher  │  │
   │ configs · assumption reviews · ecosystem alerts           │  │
   └───────────────┬────────────────────────────────────────────  │
                   │ founder Apply = the switch                    │
                   ▼                                               │
   ┌────────────── EXECUTORS (the single write path) ─────────────┤
   │ write: memory facts (keyword-prefixed) · competitors ·       │
   │ graph nodes · interviews · active monitors · canvas snaps    │
   └───────┬──────────────────────────┬───────────────────────────┘
           ▼                          ▼
   ┌── KNOWLEDGE ──────┐      ┌── WATCHERS ──────────────────────┐
   │ memory_facts      │      │ re-read the project AS IT IS     │
   │ + entity graph    │─────▶│ TODAY on every run (canvas,      │
   │ (the cumulative   │ ctx  │ competitors, keywords) → scan    │
   │  substrate)       │      │ outside → alerts w/ URLs → inbox │
   └───────┬───────────┘      └──────────────────────────────────┘
           ▼
   ┌── SPINE / GATE (deterministic measurement) ──────────────────┐
   │ reads the snapshot (facts, canvas, interviews, score…) →     │
   │ 7 stages, 21 gate checks · no LLM inside any check ·         │
   │ clicking a check carries the TARGET back into chat           │
   └───────┬──────────────────────────────────────────────────────┘
           ▼
   SCORING (Clarity → Startup) → IRL (1-9 ladder) → LOOPS 1-2 (PSF/pivot)
```

Three properties make this a loop rather than a tangle:

1. **One switch.** Everything converges on the founder's Apply. The only exception — watcher autoflow — is declared, and when a check greens by itself the product can explain why.
2. **The measurement doesn't reason.** Checks read columns, never an LLM. That's why the IRL ladder is auditable and the gate can't be talked into anything.
3. **Context is live, never photographed.** Watchers, skills and the pulse re-read the project on every run — a pivot propagates everywhere for free.

LaunchPad has four pillars: the **journey** (where the founder is), **skills** (how they make progress), the **approval inbox** (how the agent acts on their behalf), and **self-driving intelligence** (what runs while they're away). Most chat-driven state is written through **structured artifacts** — the agent emits `:::artifact{…}:::` blocks that `artifact-parser.ts` turns into Canvas tiles, knowledge entries, and inbox proposals.

### 1. The 7-stage journey

The spine of the product. `src/lib/journey/` defines a canonical 7-stage journey and evaluates it with **48 evidence gate checks** read straight from the project's data — a stage is only "done" when **every** check passes. There's no fuzzy score deciding the gate: the evidence is in the record or it isn't (most checks read structured rows; a handful match against captured memory facts).

| # | Stage | Checks | A stage clears when… |
|---|-------|:-----:|----------------------|
| 1 | **Idea Validation** | 9 | the L2 Phase-0 step list 1:1 — problem · solution · target & ICP (preliminary) · value prop · competitive advantage (incl. unfair advantage/moat) · acquisition channels · cost & revenue sources · **Lean Canvas compiled** (all 9 blocks) · **Clarity Score baseline** (0-100, canvas-only — the full Startup Scoring runs post-gate) |
| 2 | **Validation Gate** | 21 | three tracks, **1A ∥ 1B → 1C** (see below) |
| 3 | **Persona** | 2 | ICP described · acquisition channels validated (fact-based — the preliminary versions live in Stage 1) |
| 4 | **Business Model** | 8 | anchor price set · 2+ tiers · willingness-to-pay researched · pricing model chosen · **revenue streams defined** · **COGS & OPEX defined** · **5-year financial draft (3 scenarios)** · **unit economics viable (LTV/CAC ≥ 3×)** |
| 5 | **Build & Launch** | 4 | workflow active · MVP scope defined · **something shipped** (a published asset) · 3+ early-user signals |
| 6 | **Fundraise** | 2 | **runway ≥ 12 months** · capital plan in motion (open round or revenue metric) |
| 7 | **Operate** | 2 | 1+ active growth loop · 3+ metrics tracked |

#### Stage 2 in detail — the Validation Gate (1A ∥ 1B → 1C)

The gate is the heaviest stage, and the only one with internal structure. **1A** (Market) and **1B** (Technical) run in parallel; **1C** (Problem-Solution Fit) stays *locked* until every 1A + 1B check passes, so the agent never pushes interviews at a half-filled gate.

| Track | Checks | Contents |
|-------|:-----:|----------|
| **1A · Market** | 5 | market size (TAM/SAM/SOM, **founder-approved**) · **3+ competitors** mapped · GTM chances & challenges · potential partners · **1+ active watcher** |
| **1B · Technical** | 6 | build approach · biggest technical risk · key dependencies · regulatory & compliance deep dive · IP analysis (patents, trademarks, FTO) · data availability & quality |
| **1C · PSF** | 10 | validation strategy · Jobs-to-be-Done mapped · **5+ interviews** logged · top pain captured · differentiation evidenced · willingness-to-pay signal · **solution updated on customer insights** · **value proposition sharpened** · **Startup Scoring reviewed against evidence** (the last three measure a REVISION against the pre-interview canvas snapshot, not text) · **go / pivot / stop decision** |

The track contents follow the *Iteration Cycle* spec, which is the source of truth. Three of the spec's seven 1C artifact steps (solution in-depth, value prop sharpened, scoring review) ship as **revision checks** — they diff the live canvas against a snapshot frozen at the first interview. The remaining four — cold-user lists, interview/survey drafts, outreach logs, insight synthesis — need capture surfaces that don't exist yet (#398), so they are deliberately absent rather than added as checks the founder couldn't close.

Two things make this stage different from the rest:

- **Only `market_size` needs an explicit founder yes** (an `approved: true` stamp — the column is also written ungated as reference data, and counting those would green the gate without consent). Most other 1A/1B checks match bilingual keyword families over captured memory facts, so they close *as the founder talks*, via the chat fact sweep.
- **The gate ends in a decision, not a tally.** `gate_verdict` is locked until every other check passes, then asks for **GO / PIVOT / STOP** — the same vocabulary as the validation loops. Only GO completes the stage. A `PIVOT` names which track was weak (a `1C` pivot opens the PSF review loop); `STOP` parks the idea with a reason. Both are reversible. The checks are mostly *presence* checks, so all-green can still mean a weak case — catching exactly that is what the decision is for.

`buildProjectSnapshot()` runs ~18 guarded facet queries in parallel (each degrades to empty on error rather than failing the whole evaluation), then `evaluateAllStages()` marks the first incomplete stage `active` and the rest `pending`. The active stage, its passed/missing checks, and the gap hints are injected into the chat system prompt (the **spine**, `formatStageContextForPrompt`) and rendered in the Canvas — so the agent always pushes toward the *specific* missing evidence.

### 2. Skills — 24 expert playbooks

Each skill is a `launchpad-skills/<id>/SKILL.md` file (YAML frontmatter + a markdown body used as the skill's system prompt). `getSkillTools()` loads all **24** and exposes each to the chat agent as a `skill_<id>` tool (e.g. `skill_market_research`).

### 3. The approval inbox (approve-first)

Every agent-proposed side effect — run a skill, configure a watcher, accept a signal into knowledge, draft an email, set a budget — lands as a row in `pending_actions` for the founder to **approve / edit / reject**. Nothing that spends credits or writes durable state happens without a click.

### 4. Self-driving intelligence — one unified cron

All scheduled background work runs in **a single endpoint**, `GET /api/cron`, triggered **once daily at 08:00 UTC** by GitHub Actions (`.github/workflows/scheduled-cron.yml`, bearer-gated by `CRON_SECRET`).

---

## Tech stack

- **Next.js 16** — App Router, TypeScript, Turbopack
- **Supabase Auth** — magic link / OAuth / SSO-ready
- **Supabase PostgreSQL** via `postgres.js`
- **Pi Agent SDK** — `@mariozechner/pi-ai` + `@mariozechner/pi-agent-core`
- **OpenAI**, tier-routed per task (`src/lib/llm/router.ts` + `models.ts`): **cheap → gpt-4o-mini**, **balanced → gpt-4o**, **premium → o3-mini**
- **Langfuse** — LLM observability + per-call cost logging
- **D3.js** — knowledge-graph rendering

## Configuration

See `.env.example` for the full list.

- **Required:** `DATABASE_URL` (Supabase Postgres), `OPENAI_API_KEY`, and `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
