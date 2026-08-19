import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/header';
import { DollarSign, ExternalLink, Info } from 'lucide-react';
import { Calculator } from './calculator';
import { Usage } from './usage';
import { FamilyCard } from './family-card';
import type { FamilySpec } from './family-card';

export const metadata: Metadata = {
  title: 'Model Pricing · Claude Code Dashboard',
  description:
    'Per-token rates for Claude Fable, Mythos, Opus, Sonnet, and Haiku — input, output, cache write, and cache read rates.',
};

const RATES_VERIFIED_AT = '2026-08-19';

const FAMILIES: FamilySpec[] = [
  {
    name: 'Fable',
    accent: '#F472B6',
    versions: [
      { displayName: 'Fable 5', input: 10, output: 50, cacheWrite: 20, cacheRead: 1.00, status: 'live' },
    ],
  },
  {
    name: 'Mythos',
    accent: '#A78BFA',
    versions: [
      { displayName: 'Mythos 5', input: 10, output: 50, cacheWrite: 20, cacheRead: 1.00, status: 'invite-only' },
    ],
  },
  {
    name: 'Opus',
    accent: '#818CF8',
    versions: [
      { displayName: 'Opus 5',   input: 5,  output: 25, cacheWrite: 10, cacheRead: 0.50, status: 'live' },
      { displayName: 'Opus 4.8', input: 5,  output: 25, cacheWrite: 10, cacheRead: 0.50, status: 'live' },
      { displayName: 'Opus 4.7', input: 5,  output: 25, cacheWrite: 10, cacheRead: 0.50, status: 'live' },
      { displayName: 'Opus 4.6', input: 5,  output: 25, cacheWrite: 10, cacheRead: 0.50, status: 'live' },
      { displayName: 'Opus 4.5', input: 5,  output: 25, cacheWrite: 10, cacheRead: 0.50, status: 'live' },
      { displayName: 'Opus 4.1', input: 15, output: 75, cacheWrite: 30, cacheRead: 1.50, status: 'retired' },
      { displayName: 'Opus 4',   input: 15, output: 75, cacheWrite: 30, cacheRead: 1.50, status: 'retired' },
    ],
  },
  {
    name: 'Sonnet',
    accent: '#34D399',
    versions: [
      { displayName: 'Sonnet 5',   input: 2,  output: 10, cacheWrite: 4,  cacheRead: 0.20, status: 'live' },
      { displayName: 'Sonnet 4.6', input: 3,  output: 15, cacheWrite: 6,  cacheRead: 0.30, status: 'live' },
      { displayName: 'Sonnet 4.5', input: 3,  output: 15, cacheWrite: 6,  cacheRead: 0.30, status: 'live' },
      { displayName: 'Sonnet 4',   input: 3,  output: 15, cacheWrite: 6,  cacheRead: 0.30, status: 'retired' },
    ],
  },
  {
    name: 'Haiku',
    accent: '#FBBF24',
    versions: [
      { displayName: 'Haiku 4.5', input: 1,    output: 5, cacheWrite: 2,    cacheRead: 0.10, status: 'live' },
      { displayName: 'Haiku 3.5', input: 0.80, output: 4, cacheWrite: 1.60, cacheRead: 0.08, status: 'retired' },
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Model Pricing" />
      <div className="flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:p-6 space-y-6 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border bg-card p-2.5 shrink-0">
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Per-token rates for Claude model families — the same numbers used to price every session in this dashboard.
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="sr-only">Per-model rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {FAMILIES.map((family) => (
              <FamilyCard key={family.name} family={family} />
            ))}
          </div>

          <div className="space-y-3 pt-2">
            {/* Callout 1: MTok explanation */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-4 py-3.5 flex gap-3 items-start">
              <span className="rounded-full border border-blue-400/50 h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="h-3 w-3 text-blue-400" strokeWidth={2.5} />
              </span>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                <span className="font-mono text-foreground/95">MTok</span> = Million tokens. The{' '}
                <span className="text-foreground/95">&ldquo;Input $/M&rdquo;</span> column shows
                standard input pricing, the{' '}
                <span className="text-foreground/95">&ldquo;Cache Write 1h $/M&rdquo;</span> and{' '}
                <span className="text-foreground/95">&ldquo;Cache Read $/M&rdquo;</span> columns
                are specific to{' '}
                <a
                  href="https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 underline-offset-2"
                >
                  prompt caching
                </a>
                , and <span className="text-foreground/95">&ldquo;Output $/M&rdquo;</span> shows output
                pricing. See{' '}
                <a
                  href="https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 underline-offset-2"
                >
                  prompt caching pricing
                </a>{' '}
                for an explanation of the cache columns and pricing multipliers.
              </p>
            </div>

            {/* Callout 2: Opus 4.7 tokenizer note */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-4 py-3.5 flex gap-3 items-start">
              <span className="rounded-full border border-blue-400/50 h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="h-3 w-3 text-blue-400" strokeWidth={2.5} />
              </span>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                <span className="text-foreground/95">Opus 4.7</span> uses a new tokenizer compared to
                previous models, contributing to its improved performance on a wide range of tasks. This new
                tokenizer may use up to 35% more tokens for the same fixed text.
              </p>
            </div>

            {/* Callout 3: Standard API pricing note */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-4 py-3.5 flex gap-3 items-start">
              <span className="rounded-full border border-blue-400/50 h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="h-3 w-3 text-blue-400" strokeWidth={2.5} />
              </span>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                Rates are standard API pricing, not Batch API pricing. The dashboard recalculates all
                session costs from these numbers on every page load &mdash; updating a rate here
                retroactively changes what every past session displays.
              </p>
            </div>

            <p className="text-xs text-muted-foreground/70 pt-1 px-1">
              Rates last verified {RATES_VERIFIED_AT} ·{' '}
              <a
                href="https://www.anthropic.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground underline decoration-dotted underline-offset-2"
              >
                View official pricing on anthropic.com
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </section>

        <Calculator />

        <Suspense fallback={null}>
          <Usage />
        </Suspense>
      </div>
    </div>
  );
}
