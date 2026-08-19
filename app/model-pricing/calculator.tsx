'use client';

import { useState, useMemo } from 'react';
import { Calculator as CalculatorIcon, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { resolveModelPricing, formatCost } from '@/lib/utils';

interface ModelOption {
  id: string;         // canonical model ID (passed to resolveModelPricing)
  label: string;      // display name matching family-card labels
  retired?: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-fable-5',    label: 'Fable 5' },
  { id: 'claude-mythos-5',   label: 'Mythos 5' },
  { id: 'claude-opus-5',     label: 'Opus 5' },
  { id: 'claude-opus-4-8',   label: 'Opus 4.8' },
  { id: 'claude-opus-4-7',   label: 'Opus 4.7' },
  { id: 'claude-opus-4-6',   label: 'Opus 4.6' },
  { id: 'claude-opus-4-5',   label: 'Opus 4.5' },
  { id: 'claude-opus-4-1',   label: 'Opus 4.1', retired: true },
  { id: 'claude-opus-4',     label: 'Opus 4',   retired: true },
  { id: 'claude-sonnet-5',   label: 'Sonnet 5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
  { id: 'claude-sonnet-4',   label: 'Sonnet 4', retired: true },
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5' },
  { id: 'claude-haiku-3-5',  label: 'Haiku 3.5', retired: true },
];

interface FieldSpec {
  key: 'input' | 'output' | 'cacheWrite' | 'cacheRead';
  label: string;
}

const FIELDS: FieldSpec[] = [
  { key: 'input',      label: 'Input tokens' },
  { key: 'output',     label: 'Output tokens' },
  { key: 'cacheWrite', label: 'Cache Write tokens' },
  { key: 'cacheRead',  label: 'Cache Read tokens' },
];

const EMPTY_VALUES: Record<FieldSpec['key'], string> = {
  input: '',
  output: '',
  cacheWrite: '',
  cacheRead: '',
};

export function Calculator() {
  const [modelId, setModelId] = useState<string>('claude-sonnet-4-6');
  const [values, setValues] = useState<Record<FieldSpec['key'], string>>(EMPTY_VALUES);
  const isDirty = Object.values(values).some((v) => v !== '');
  const reset = () => setValues(EMPTY_VALUES);

  const { cost, pricing } = useMemo(() => {
    const num = (v: string) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const p = resolveModelPricing(modelId);
    const c =
      num(values.input)      * p.input       / 1_000_000 +
      num(values.output)     * p.output      / 1_000_000 +
      num(values.cacheWrite) * p.cache_write / 1_000_000 +
      num(values.cacheRead)  * p.cache_read  / 1_000_000;
    return { cost: c, pricing: p };
  }, [modelId, values]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CalculatorIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Cost calculator</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Model</label>
            <Select value={modelId} onValueChange={(v) => setModelId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    <span>{opt.label}</span>
                    {opt.retired && (
                      <span className="ml-2 text-[10px] font-medium text-amber-600 dark:text-amber-400">Retired</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label htmlFor={`calc-${f.key}`} className="text-xs text-muted-foreground">
                  {f.label}
                </label>
                <input
                  id={`calc-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Current rates for selected model */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
            <span className="text-muted-foreground">Input</span>
            <span className="ml-1.5 font-mono text-foreground">{formatCost(pricing.input)}/M</span>
          </div>
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
            <span className="text-muted-foreground">Output</span>
            <span className="ml-1.5 font-mono text-foreground">{formatCost(pricing.output)}/M</span>
          </div>
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
            <span className="text-muted-foreground">Cache Write 1h</span>
            <span className="ml-1.5 font-mono text-foreground">{formatCost(pricing.cache_write)}/M</span>
          </div>
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
            <span className="text-muted-foreground">Cache Read</span>
            <span className="ml-1.5 font-mono text-foreground">{formatCost(pricing.cache_read)}/M</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-4 pt-4 border-t border-border/60">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Estimated cost
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={!isDirty}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
          <span className="text-2xl font-semibold text-emerald-400 font-mono">
            {formatCost(cost)}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Cache write uses the 1h rate. The 5-min rate is 1.25× input — billed-at-5m totals will be lower.
        </p>
      </div>
    </section>
  );
}
