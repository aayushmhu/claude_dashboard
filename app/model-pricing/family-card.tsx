'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCost } from '@/lib/utils';

export interface VersionSpec {
  displayName: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  status: 'live' | 'retired' | 'invite-only';
}

export interface FamilySpec {
  name: string;
  accent: string;
  versions: VersionSpec[];
}

function formatRate(dollarsPerMillion: number): string {
  return `${formatCost(dollarsPerMillion)} / MTok`;
}

function StatusBadge({ status }: { status: VersionSpec['status'] }) {
  if (status === 'retired') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 leading-none shrink-0">
        Retired
      </span>
    );
  }
  if (status === 'invite-only') {
    return (
      <span
        className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 leading-none shrink-0 cursor-help"
        title="Available to Anthropic Glasswing program participants only. Rates shown are standard API pricing."
      >
        Invite only
      </span>
    );
  }
  return null;
}

function VersionRow({ version, muted }: { version: VersionSpec; muted: boolean }) {
  const textClass = muted ? 'text-slate-500 dark:text-slate-400' : 'text-foreground';
  const mutedTextClass = muted ? 'text-slate-500 dark:text-slate-400' : 'text-muted-foreground';
  return (
    <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 items-center py-2 border-b border-border/50 last:border-0`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-medium truncate ${textClass}`}>
          {version.displayName}
        </span>
        <StatusBadge status={version.status} />
      </div>
      <span className={`font-mono text-xs text-right tabular-nums ${textClass}`}>{formatRate(version.input)}</span>
      <span className={`font-mono text-xs text-right tabular-nums ${textClass}`}>{formatRate(version.output)}</span>
      <span className={`font-mono text-xs text-right tabular-nums ${mutedTextClass}`}>{formatRate(version.cacheWrite)}</span>
      <span className={`font-mono text-xs text-right tabular-nums ${mutedTextClass}`}>{formatRate(version.cacheRead)}</span>
    </div>
  );
}

export function FamilyCard({ family }: { family: FamilySpec }) {
  const [expanded, setExpanded] = useState(false);

  const newestVersion = family.versions[0];
  const olderVersions = family.versions.slice(1);
  const hasOlderVersions = olderVersions.length > 0;

  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden"
      style={{ borderLeft: `3px solid ${family.accent}` }}
    >
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-base font-semibold mb-3" style={{ color: family.accent }}>
          {family.name}
        </h3>
      </div>

      {/* Scrollable table area — horizontal scroll on narrow viewports */}
      <div className="overflow-x-auto">
        <div className="px-5 pb-1 min-w-[540px]">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 items-center mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Version</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Input $/M</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Output $/M</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Cache Write 1h $/M</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Cache Read $/M</span>
          </div>
          <VersionRow version={newestVersion} muted={false} />
          {/* Older versions — vertical scroll when list exceeds ~288px (max-h-72) */}
          {expanded && (
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {olderVersions.map((v) => (
                <VersionRow key={v.displayName} version={v} muted={v.status === 'retired'} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Older versions toggle */}
      {hasOlderVersions && (
        <div className="px-5 pb-3 pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={expanded}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded
              ? 'Hide older versions'
              : `${olderVersions.length} older version${olderVersions.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* No older versions — just bottom padding */}
      {!hasOlderVersions && <div className="pb-3" />}
    </div>
  );
}
