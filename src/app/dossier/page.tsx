'use client';

import Link from 'next/link';
import { TopBar } from '@/components/design/chrome';
import { Icon, I, Pill } from '@/components/design/primitives';

export default function MarketingDossierPage() {
  return (
    <div className="lp-frame" style={{ background: 'var(--paper)', minHeight: '100vh' }}>
      <TopBar
        breadcrumb={['LaunchPad', 'Marketing Dossier & Support Hub']}
        right={
          <Link
            href="/"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink-2)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon d={I.arrow} size={12} style={{ transform: 'rotate(180deg)' }} />
            Back to Workspace
          </Link>
        }
      />

      <div
        className="lp-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 24px 80px',
          maxWidth: 960,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Hero Header */}
        <div
          style={{
            padding: '36px 32px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-l, 16px)',
            marginBottom: 32,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Pill kind="live" dot>Official Product Dossier</Pill>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)' }}>v2.0 • Pi Agent SDK + OpenAI</span>
          </div>

          <h1
            className="lp-serif"
            style={{ fontSize: 36, fontWeight: 400, letterSpacing: -0.8, margin: '0 0 12px', color: 'var(--ink)' }}
          >
            LaunchPad
          </h1>
          <p
            style={{
              fontSize: 18,
              color: 'var(--accent-ink)',
              margin: '0 0 20px',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            The Autonomous AI Co-Founder for Early-Stage Founders
          </p>

          <p style={{ fontSize: 14.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0, maxWidth: 780 }}>
            LaunchPad guides founders through an evidence-gated <strong>7-Stage Validation Journey</strong> from raw idea to scale-ready operation. Unlike ungrounded chat assistants, LaunchPad relies on deterministic evidence checks, an approve-first action inbox, continuous background watchers, and an integrated entity knowledge graph.
          </p>
        </div>

        {/* Dossier Content Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Section: Core Framework & 7 Stages */}
          <section
            style={{
              padding: 24,
              background: 'var(--paper-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-m, 12px)',
            }}
          >
            <h2 className="lp-serif" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 16px', color: 'var(--ink)' }}>
              1. The 7-Stage Validation Journey
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {[
                { stage: '1. Idea Validation', desc: 'Lean Canvas baseline, problem/solution definition, ICP, value prop.' },
                { stage: '2. Validation Gate (1A ∥ 1B → 1C)', desc: 'Parallel Market (1A) & Technical (1B) tracks before unlocking Problem-Solution Fit (1C).' },
                { stage: '3. Persona & Channels', desc: 'Evidence-backed customer acquisition channels & detailed persona modeling.' },
                { stage: '4. Business Model', desc: 'Anchor pricing, 3-scenario financial drafts, COGS/OPEX, and LTV/CAC ≥ 3× verification.' },
                { stage: '5. Build & Launch', desc: 'MVP scoping, shipped asset tracking, and early user signal logging.' },
                { stage: '6. Fundraise', desc: 'Runway planning (≥12 months) and investor pipeline tracking.' },
                { stage: '7. Operate', desc: 'Active growth loops and telemetry metric grid tracking.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    {item.stage}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.45 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Unique Value Proposition */}
          <section
            style={{
              padding: 24,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-m, 12px)',
            }}
          >
            <h2 className="lp-serif" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 16px', color: 'var(--ink)' }}>
              2. Core Value & Unique Differentiation
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--paper)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={I.shield} size={14} style={{ color: 'var(--moss)' }} />
                  Deterministic Evidence Gates
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  The measurement engine never uses an LLM inside gate check evaluation. Checks read direct database records, so an LLM can never be hallucinated or talked into passing a stage.
                </div>
              </div>

              <div style={{ padding: 16, background: 'var(--paper)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={I.tickets} size={14} style={{ color: 'var(--accent-ink)' }} />
                  Approve-First Security Architecture
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  The agent proposes work; nothing with a side effect (financial edits, watcher configs, graph writes) executes until the founder explicitly approves it from the Inbox.
                </div>
              </div>

              <div style={{ padding: 16, background: 'var(--paper)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={I.signal} size={14} style={{ color: 'var(--sky)' }} />
                  Self-Driving Watchers
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Daily background crons re-read the venture snapshot, scanning external news, regulatory changes, and competitor movements, feeding findings straight into the Knowledge Graph.
                </div>
              </div>
            </div>
          </section>

          {/* Section: Competitive Matrix */}
          <section
            style={{
              padding: 24,
              background: 'var(--paper-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-m, 12px)',
            }}
          >
            <h2 className="lp-serif" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 16px', color: 'var(--ink)' }}>
              3. Competitive Landscape
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line-2)', color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>
                    <th style={{ padding: '8px 12px' }}>Feature</th>
                    <th style={{ padding: '8px 12px', color: 'var(--accent-ink)' }}>LaunchPad</th>
                    <th style={{ padding: '8px 12px' }}>ChatGPT / Claude</th>
                    <th style={{ padding: '8px 12px' }}>Venture Studios</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--ink-2)' }}>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>Validation Engine</td>
                    <td style={{ padding: '10px 12px', color: 'var(--moss)', fontWeight: 600 }}>7-Stage Deterministic</td>
                    <td style={{ padding: '10px 12px' }}>Unstructured Chat</td>
                    <td style={{ padding: '10px 12px' }}>Subjective Mentor Advice</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>Side-Effect Safety</td>
                    <td style={{ padding: '10px 12px', color: 'var(--moss)', fontWeight: 600 }}>Approve-First Inbox</td>
                    <td style={{ padding: '10px 12px' }}>None (Direct Output)</td>
                    <td style={{ padding: '10px 12px' }}>Manual Approval</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>Competitor Intelligence</td>
                    <td style={{ padding: '10px 12px', color: 'var(--moss)', fontWeight: 600 }}>Daily Automated Watchers</td>
                    <td style={{ padding: '10px 12px' }}>Manual Prompts</td>
                    <td style={{ padding: '10px 12px' }}>Manual Analysis</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>Knowledge Base</td>
                    <td style={{ padding: '10px 12px', color: 'var(--moss)', fontWeight: 600 }}>Interactive D3 Entity Graph</td>
                    <td style={{ padding: '10px 12px' }}>Transient Memory</td>
                    <td style={{ padding: '10px 12px' }}>Static Folders</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: FAQ & Help Documentation */}
          <section
            style={{
              padding: 24,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-m, 12px)',
            }}
          >
            <h2 className="lp-serif" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 16px', color: 'var(--ink)' }}>
              4. Frequently Asked Questions & Help Docs
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  q: 'How does LaunchPad verify a validation check?',
                  a: 'LaunchPad checks real structured evidence rows (e.g., number of recorded interviews, verified pricing tiers, TAM/SAM/SOM entries). Check logic is deterministic code and does not rely on LLM opinions.',
                },
                {
                  q: 'What happens when I upload documents into LaunchPad?',
                  a: 'PDFs, DOCX files, code, and spreadsheets are chunked and extracted into entity nodes (competitors, ICPs, features). Proposed canvas updates and entities preview before landing in your knowledge graph.',
                },
                {
                  q: 'Can LaunchPad run background actions without asking me?',
                  a: 'No. Everything with a durable side effect lands in your Approval Inbox (/actions) first. You retain total control to approve, edit, or reject any proposal.',
                },
                {
                  q: 'How can I export my venture report for investors?',
                  a: 'Use the export button in the AI Co-Pilot top bar or project settings to generate a full Markdown report, Go/No-Go decision matrix, or Financial Model CSV.',
                },
              ].map((faq, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--paper)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Q: {faq.q}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
