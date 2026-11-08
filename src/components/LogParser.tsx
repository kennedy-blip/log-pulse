import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  FlaskConical,
  ListChecks,
  Plus,
  Regex,
  Save,
  Shuffle,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import type { LogEntry } from "@/types";
import { DEFAULT_PATTERN, makeLog } from "@/lib/logEngine";
import { compilePattern, fieldColor, matchStats, parseLine, type PatternMode } from "@/lib/grok";
import { cn } from "@/utils/cn";
import { Card, CopyButton } from "./ui";

interface Preset {
  name: string;
  mode: PatternMode;
  pattern: string;
  sample: string;
}

const PRESETS: Preset[] = [
  {
    name: "Nginx Combined",
    mode: "grok",
    pattern: DEFAULT_PATTERN,
    sample:
      '192.168.1.24 - - [12/Jan/2026:14:32:01 +0000] "GET /api/v1/orders HTTP/1.1" 200 512 "https://app.logpulse.io/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0" 42ms',
  },
  {
    name: "Apache Common",
    mode: "grok",
    pattern:
      '%{IP:ip_address} %{NOTSPACE:ident} %{NOTSPACE:auth} \\[%{HTTPDATE:timestamp}\\] "%{WORD:method} %{URIPATH:path} %{NOTSPACE:protocol}" %{NUMBER:status_code} %{NUMBER:bytes_sent}',
    sample: '203.0.113.45 - frank [10/Oct/2026:13:55:36 +0000] "GET /index.html HTTP/1.0" 200 2326',
  },
  {
    name: "JSON Line",
    mode: "regex",
    pattern: '^\\{"ts":"(?<timestamp>[^"]+)","level":"(?<level>[^"]+)","service":"(?<service>[^"]+)","msg":"(?<message>.*)","status":(?<status_code>\\d+)\\}$',
    sample: '{"ts":"2026-01-12T14:32:01.204Z","level":"ERROR","service":"payment-worker","msg":"payment failed: card_declined","status":500}',
  },
  {
    name: "Syslog",
    mode: "grok",
    pattern: "%{SYSLOGTIMESTAMP:timestamp} %{HOSTNAME:host} %{WORD:service}\\[%{INT:pid}\\]: %{GREEDYDATA:message}",
    sample: "Jan 12 14:32:01 web-01 sshd[2841]: Failed password for invalid user admin from 203.0.113.45 port 51244 ssh2",
  },
  {
    name: "Blank Custom",
    mode: "grok",
    pattern: "",
    sample: "",
  },
];

interface SavedPattern {
  name: string;
  mode: PatternMode;
  pattern: string;
}

export function LogParser({ logs }: { logs: LogEntry[] }) {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [mode, setMode] = useState<PatternMode>("grok");
  const [sample, setSample] = useState(PRESETS[0].sample);
  const [saved, setSaved] = useState<SavedPattern[]>([
    { name: "default-nginx", mode: "grok", pattern: DEFAULT_PATTERN },
  ]);
  const [newName, setNewName] = useState("");
  const [flash, setFlash] = useState(0);

  const compiled = useMemo(() => compilePattern(pattern, mode), [pattern, mode]);
  const result = useMemo(
    () => (sample.trim() ? parseLine(pattern, mode, sample) : null),
    [pattern, mode, sample],
  );
  const fieldOrder = useMemo(() => compiled.fields, [compiled]);

  const bufferStats = useMemo(() => {
    const tail = logs.slice(-60).map((l) => l.raw);
    return tail.length ? matchStats(pattern, mode, tail) : { matched: 0, total: 0 };
  }, [pattern, mode, logs]);

  const applyPreset = (p: Preset) => {
    setMode(p.mode);
    setPattern(p.pattern);
    if (p.sample) setSample(p.sample);
    setFlash((f) => f + 1);
  };

  const savePattern = () => {
    const name = newName.trim() || `pattern-${saved.length + 1}`;
    setSaved((s) => [...s, { name, mode, pattern }]);
    setNewName("");
  };

  const matchPct = bufferStats.total ? Math.round((bufferStats.matched / bufferStats.total) * 100) : 0;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      {/* ---- Pattern definition ---- */}
      <Card
        title="Pattern Definition"
        icon={<Regex className="h-4 w-4" />}
        right={
          <div className="flex rounded-lg border border-edge bg-obsidian p-0.5 text-[11px] font-semibold">
            {(["grok", "regex"] as PatternMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  mode === m ? "bg-cyber/20 text-cyber" : "text-slate-500 hover:text-slate-200",
                )}
              >
                {m === "grok" ? "%{Grok}" : "Raw Regex"}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {/* presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-edge bg-obsidian px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-cyber/50 hover:text-cyber active:scale-95"
              >
                {p.name}
              </button>
            ))}
          </div>

          <textarea
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            placeholder={mode === "grok" ? 'e.g. %{IP:ip} - [%{HTTPDATE:ts}] "%{WORD:method} ..."' : 'e.g. ^(?<ip>\\d+\\.\\d+\\.\\d+\\.\\d+) - \\[(?<ts>[^\\]]+)\\] ...'}
            className="h-36 w-full resize-y rounded-xl border border-edge bg-obsidian p-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600 focus:border-cyber/60 focus:outline-none focus:ring-2 focus:ring-cyber/20"
          />

          {compiled.error ? (
            <div className="flex items-start gap-2 rounded-xl border border-spike/40 bg-spike/10 p-3 text-xs text-spike animate-fade-in">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="font-mono break-all">{compiled.error}</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">capture fields:</span>
              {compiled.fields.length === 0 && <span className="font-mono text-[11px] text-slate-600">none detected</span>}
              {compiled.fields.map((f) => (
                <span
                  key={f}
                  className="rounded-md border border-edge bg-obsidian px-1.5 py-0.5 font-mono text-[10px]"
                  style={{ color: fieldColor(f, fieldOrder), borderColor: `${fieldColor(f, fieldOrder)}55` }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* saved patterns */}
          <div className="rounded-xl border border-edge bg-obsidian/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Save className="h-3 w-3" /> saved patterns
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {saved.map((s) => (
                <span key={s.name} className="group inline-flex items-center gap-1 rounded-lg border border-edge bg-panel px-2 py-1 font-mono text-[10px] text-slate-300">
                  <button className="hover:text-cyber" onClick={() => { setPattern(s.pattern); setMode(s.mode); }} title="Load pattern">
                    {s.name}
                  </button>
                  <button
                    className="text-slate-600 hover:text-spike"
                    onClick={() => setSaved((arr) => arr.filter((x) => x.name !== s.name))}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && savePattern()}
                  placeholder="name…"
                  className="w-24 rounded-lg border border-edge bg-panel px-2 py-1 font-mono text-[10px] text-slate-200 placeholder:text-slate-600 focus:border-cyber/60 focus:outline-none"
                />
                <button
                  onClick={savePattern}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyber/40 bg-cyber/10 px-2 py-1 text-[10px] font-semibold text-cyber hover:bg-cyber/20"
                >
                  <Plus className="h-3 w-3" /> save
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ---- Test bench ---- */}
      <Card
        title="Test Bench"
        icon={<FlaskConical className="h-4 w-4" />}
        right={
          <button
            onClick={() => setSample(makeLog(Date.now(), {}).raw)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-obsidian px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-neon/50 hover:text-neon"
          >
            <Shuffle className="h-3.5 w-3.5" /> Sample from buffer
          </button>
        }
      >
        <div className="space-y-3">
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            spellCheck={false}
            placeholder="Paste an unstructured log line here…"
            className="h-24 w-full resize-y rounded-xl border border-edge bg-obsidian p-3 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-600 focus:border-cyber/60 focus:outline-none focus:ring-2 focus:ring-cyber/20"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFlash((f) => f + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyber/50 bg-cyber/15 px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_14px_rgba(139,92,246,0.35)] transition-all hover:bg-cyber/25 active:scale-95"
            >
              <Wand2 className="h-3.5 w-3.5" /> Parse sample
            </button>
            {result && (
              <span
                key={flash}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold animate-fade-in",
                  result.error
                    ? "border-spike/40 bg-spike/10 text-spike"
                    : result.matched
                      ? "border-neon/40 bg-neon/10 text-neon"
                      : "border-electric/40 bg-electric/10 text-electric",
                )}
              >
                {result.error ? (
                  <><XCircle className="h-3.5 w-3.5" /> invalid pattern</>
                ) : result.matched ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> MATCHED · {Object.keys(result.fields).length} fields</>
                ) : (
                  <><AlertTriangle className="h-3.5 w-3.5" /> no match against sample line</>
                )}
              </span>
            )}

            {/* live buffer match rate */}
            <div className="ml-auto w-full sm:w-56">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> buffer match rate (last 60)</span>
                <span className={cn("font-bold", matchPct === 100 ? "text-neon" : matchPct > 50 ? "text-electric" : "text-spike")}>
                  {bufferStats.matched}/{bufferStats.total} · {matchPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", matchPct === 100 ? "bg-neon" : matchPct > 50 ? "bg-electric" : "bg-spike")}
                  style={{ width: `${matchPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* highlighted match preview */}
          {result && !result.error && (
            <div className="rounded-xl border border-edge bg-obsidian p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">match highlight</p>
              <p className="break-all font-mono text-[11px] leading-6">
                {result.segments.map((seg, i) =>
                  seg.field ? (
                    <span
                      key={i}
                      className="rounded px-0.5"
                      style={{ color: fieldColor(seg.field, fieldOrder), backgroundColor: `${fieldColor(seg.field, fieldOrder)}22` }}
                      title={seg.field}
                    >
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i} className="text-slate-500">{seg.text}</span>
                  ),
                )}
              </p>
              {result.matched && fieldOrder.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-edge/60 pt-2">
                  {fieldOrder.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded border border-edge bg-panel px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: fieldColor(f, fieldOrder) }} />
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* captured fields */}
          {result?.matched && (
            <div className="animate-fade-in">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Braces className="h-3.5 w-3.5 text-cyber" /> captured attributes (JSON)
                </p>
                <CopyButton text={JSON.stringify(result.fields, null, 2)} label="Copy JSON" />
              </div>
              <div className="max-h-56 overflow-auto rounded-xl border border-edge bg-obsidian p-3 font-mono text-xs leading-6">
                <span className="text-slate-500">{"{"}</span>
                {Object.entries(result.fields).map(([k, v], i, arr) => {
                  const isNum = /^-?\d+(\.\d+)?$/.test(v);
                  return (
                    <div key={k} className="flex gap-2 pl-4">
                      <span className="shrink-0 text-cyber">"{k}"</span>
                      <span className="text-slate-500">:</span>
                      <span className={cn("break-all", isNum ? "text-electric" : "text-neon")}>{isNum ? v : `"${v}"`}</span>
                      {i < arr.length - 1 && <span className="text-slate-600">,</span>}
                    </div>
                  );
                })}
                <span className="text-slate-500">{"}"}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
