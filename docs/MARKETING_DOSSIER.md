# LaunchPad — Product Marketing Dossier & Support Documentation

## Executive Summary & Tagline
**Tagline:** *The Autonomous AI Co-Founder for Early-Stage Founders*
**Product Name:** LaunchPad
**Category:** Autonomous Startup Validation & Execution Engine

---

## Product Description
LaunchPad is an autonomous AI co-founder that guides early-stage startup founders through a rigorous, evidence-gated **7-Stage Validation Journey** (from raw Idea Validation to scale-ready Operation). Built on top of the Pi Agent SDK and OpenAI, LaunchPad replaces vague founder "vibes" with real, auditable market evidence.

Rather than relying on ungrounded LLM chat outputs, LaunchPad combines an active chat co-pilot, deterministic (non-LLM) evidence gates, an approve-first action inbox, continuous background watchers, and a unified knowledge graph to continuously stress-test and validate early-stage ventures.

---

## Long Description
Building a startup is traditionally fraught with confirmation bias, unvalidated assumptions, and disorganized market research. LaunchPad brings discipline and autonomous execution to early-stage venture building.

At its core, LaunchPad enforces a 7-stage validation framework:
1. **Idea Validation:** Structuring problem, solution, target ICP, value proposition, and Lean Canvas baseline.
2. **Validation Gate (1A Market ∥ 1B Technical → 1C PSF):** The heaviest gate in early stage validation. 1A and 1B evaluate TAM/SAM/SOM, competitor landscapes, and technical risk in parallel, unlocking 1C (Problem-Solution Fit) only when market & tech evidence is solid.
3. **Persona & Channels:** Validating ICP behaviors and real acquisition channels against evidence facts.
4. **Business Model:** Anchoring unit economics, 3-scenario financial modeling, pricing tiers, and ensuring LTV/CAC ≥ 3×.
5. **Build & Launch:** Defining MVP scopes, tracking live product deployments, and logging early user feedback signals.
6. **Fundraise:** Capital runway planning (≥12 months) and investor pipeline tracking.
7. **Operate:** Growth loop tracking and telemetry metric grids.

Unlike generic AI chat wrappers, LaunchPad operates on an **Approve-First Security Architecture**: the AI co-pilot proposes side-effects (file ingestions, market watchers, financial revisions, skill executions), but **nothing runs or writes until the founder approves it from the Approval Inbox**. Continuous background watchers run daily cron jobs to scan competitor movements and market shifts, feeding findings into a live entity knowledge graph and compiling a weekly Monday Brief.

---

## Target Audience & Primary Personas

1. **First-Time Founders:** Needs a structured playbook and expert co-pilot to avoid classic traps (building without market validation, unviable unit economics).
2. **Serial Entrepreneurs & Studio Builders:** Rapidly stress-tests multiple venture ideas in parallel using reproducible, evidence-based gate checks.
3. **Accelerators & Incubator Programs:** Provides cohort founders with an objective, auditable framework for measuring real progress over 7 validation stages.
4. **Angel Investors & Micro-VCs:** Evaluates deal flow quality with transparent, fact-backed Investment Readiness Level (IRL 1-9) scores and live knowledge graphs.

---

## Key Use Cases

* **Zero-to-One Validation:** Transform a fuzzy napkin sketch into a fully-validated Lean Canvas and 7-stage roadmap within hours.
* **Document Ingestion & Knowledge Extraction:** Upload pitch decks, customer interview transcripts, or financial spreadsheets; LaunchPad automatically ingests, extracts entities, and primes the validation spine.
* **Competitor & Market Watchers:** Configure background watchers that track competitor websites, regulatory changes, and grant calls automatically.
* **Financial Model & Unit Economics Viability:** Run Base, Bull, and Bear financial projections while automatically testing whether LTV/CAC is ≥ 3×.
* **Investor Data Room Preparation:** Automatically compile clean markdown and PDF exports of validated venture milestones, node timelines, and financial projections.

---

## Value Proposition & Unique Value

### Core Value Proposition
LaunchPad gives founders the strategic depth and execution capacity of an experienced co-founder, combined with the discipline of an evidence-backed validation engine.

### Unique Value ("Why LaunchPad is Different")
1. **Deterministic Measurement, No Fuzzy LLM Gates:** Stage gates are calculated deterministically against recorded database evidence facts and structured rows — an LLM can never be talked into greenlighting an unvalidated check.
2. **Approve-First Action Inbox:** Full founder control. The AI agent proposes actions (configuring monitors, setting budgets, applying facts), but every write requires founder approval.
3. **Live Context, Never Photographed:** Watchers, skills, and weekly briefs re-read the venture snapshot on every run — when a founder pivots, the entire knowledge substrate adapts instantly.
4. **Self-Driving Intelligence:** Daily background crons track external signals, grants, and competitor moves 24/7 without manual prompt engineering.

---

## Market Fit & Competitive Matrix

| Feature / Metric | LaunchPad | Traditional AI Chat (ChatGPT/Claude) | Venture Builders / Incubators | Static Canvas Tools (Strategyzer) |
|---|---|---|---|---|
| **Autonomous Workflow** | Full 7-stage guided journey | None (freeform prompts) | Human-dependent | Static templates |
| **Evidence Gating** | 48 deterministic checks | None | Subjective mentor review | Manual self-report |
| **Side-Effect Safety** | Founder Approval Inbox | Unrestricted or read-only | Manual approval | N/A |
| **Background Research** | Daily automated watchers | None | Manual research | Manual updates |
| **Financial Viability** | Live 3-scenario projections | Text generation only | Spreadsheet templates | Basic input boxes |
| **Entity Knowledge Graph** | Interactive D3 Graph | Static text context | Internal docs | None |

---

## Core Features List

- **7-Stage Validation Journey:** Guided progression across 48 evidence checks with visual steppers and gate locks.
- **AI Co-Pilot (Pi Agent SDK):** Persona-driven co-pilot with tool calling (DDG web search, market sizing, financial modeling, watcher config).
- **Approval Inbox:** Unified inbox for reviewing, editing, approving, or rejecting agent-proposed actions.
- **Data Room & Ingestion:** Multiformat parser (.pdf, .docx, .csv, code) with automatic entity graph extraction.
- **Interactive Knowledge Graph:** Visual D3 network visualization of venture entities, competitors, ICPs, and channels.
- **Financial Workbench:** 3-scenario projections (Base, Bull, Bear), COGS/OPEX breakdown, and LTV/CAC viability indicators.
- **Competitor & Market Watchers:** Continuous background monitors tracking market shifts and competitor updates.
- **Export Engine:** One-click exports of Context Summaries, Go/No-Go Decision Reports, and Financial Model CSVs.

---

## Frequently Asked Questions (FAQ)

### Q1: Can LaunchPad make decisions or spend money without my consent?
**No.** LaunchPad operates on a strict **Approve-First Architecture**. Any proposal (budget changes, watcher configurations, memory fact applications) lands in your Approval Inbox (`/actions`) and requires your explicit click.

### Q2: How does LaunchPad determine if a validation stage is complete?
Every stage has explicit evidence gate checks (48 in total across the 7 stages). Checks evaluate structured database records (e.g., number of logged interviews, competitor counts, TAM/SAM/SOM presence). Checks are calculated deterministically — an LLM cannot fake a green status.

### Q3: What document formats can I upload into LaunchPad?
LaunchPad supports PDF, DOCX, TXT, Markdown, CSV, JSON, TSV, YAML, and major source code files. Documents are digested, chunked, and extracted into the Knowledge Base and Entity Graph.

### Q4: What LLM models power LaunchPad?
LaunchPad uses tier-routed OpenAI models via the Pi Agent SDK: `gpt-4o-mini` for fast background tasks, `gpt-4o` for standard co-pilot turns, and `o3-mini` for complex financial and technical risk analysis.

### Q5: Can I export my venture data for pitch decks or investors?
**Yes.** From any project chat or today page, you can export a full Markdown summary, a dedicated Go/No-Go Decision Report, or financial projection CSVs.

---

## Help & Support Documentation

### Getting Started Guide
1. **Create Your Workspace:** Click **+ New Project** on the home dashboard. Choose between starting from scratch or uploading existing pitch decks/documents.
2. **Review Extracted Knowledge:** If documents were uploaded, LaunchPad previews extracted Lean Canvas fields and entity nodes. Click **Apply & Continue** to seed Stage 1.
3. **Interact with the Co-Pilot:** Use the left-side AI Co-Pilot chat to ask questions, run skill analyses (e.g., TAM/SAM/SOM calculations, competitor mapping), or work through open gate checks.
4. **Approve Pending Actions:** Open the **Inbox** (`/actions`) to approve proposed facts, watcher configs, and milestone tasks.
5. **Track Progression:** Monitor your progress on the **Home / Today** dashboard (`/today`) to watch your venture advance through all 7 validation stages.

### Technical Support & Contact
- **Documentation:** Accessible via `/dossier` or the top bar link in LaunchPad.
- **Repository:** Private GitHub repository — issues and feature requests are tracked via internal project boards.
