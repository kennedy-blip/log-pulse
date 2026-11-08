import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Eye,
  EyeOff,
  Inbox,
  Search,
  X,
} from "lucide-react";
import type { LogEntry, LogLevel } from "@/types";
import { LOG_LEVELS } from "@/types";
import { fmtMillis, fmtTime, iso } from "@/lib/logEngine";
import { cn } from "@/utils/cn";
import { CopyButton, JsonFields, LevelBadge, LEVEL_STYLES, Toggle } from "./ui";

const BUFFER_CAP = 600;

export function LogStream({ logs, paused }: { logs: LogEntry[]; paused: boolean }) {
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<Set<LogLevel>>(new Set(LOG_LEVELS));
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (const l of logs) c[l.level]++;
    return c;
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (!levels.has(l.level)) return false;
      if (!q) return true;
      const hay = `${l.raw} ${l.message} ${l.service} ${JSON.stringify(l.parsed)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, levels, query]);

  const selected = useMemo(() => logs.find((l) => l.id === selectedId) ?? null, [logs, selectedId]);

  // auto-scroll to bottom on new logs
  useEffect(() => {
    const el = boxRef.current;
    if (el && autoScroll && atBottom) el.scrollTo({ top: el.scrollHeight });
  }, [filtered.length, autoScroll, atBottom]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };

  const toggleLevel = (lv: LogLevel) => {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      return next;
    });
  };

  const moveSelection = (dir: 1 | -1) => {
    if (!selected) return;
    const idx = filtered.findIndex((l) => l.id === selected.id);
    const next = filtered[idx + dir];
    if (next) setSelectedId(next.id);
  };

  return (
    <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---- Feed card ---- */}
      <section className="card-sheen flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-edge/70 px-4 py-3">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter logs — keyword, ip, path, service…"
              className="w-full rounded-lg border border-edge bg-obsidian py-1.5 pl-8 pr-8 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyber/60 focus:outline-none focus:ring-2 focus:ring-cyber/20"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* severity pills */}
          <div className="flex items-center gap-1 rounded-lg border border-edge bg-obsidian p-1">
            <Pill active={levels.size === LOG_LEVELS.length} onClick={() => setLevels(new Set(LOG_LEVELS))} label="ALL" count={logs.length} />
            {LOG_LEVELS.map((lv) => (
              <Pill key={lv} active={levels.has(lv)} onClick={() => toggleLevel(lv)} label={lv} count={counts[lv]} level={lv} />
            ))}
          </div>

          <Toggle
            checked={autoScroll}
            onChange={setAutoScroll}
            label="Auto-scroll"
            icon={autoScroll ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          />
          <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
            {filtered.length}/{logs.length} shown · cap {BUFFER_CAP}
            {paused && <span className="ml-2 text-electric">stream paused</span>}
          </span>
        </div>

        {/* feed */}
        <div ref={boxRef} onScroll={onScroll} className="relative h-[62vh] min-h-[420px] flex-1 overflow-y-auto bg-obsidian/70">
          {/* scanline */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-cyber/50 to-transparent animate-scan" />
          </div>

          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500 animate-fade-in">
              <Inbox className="h-10 w-10 text-slate-700" />
              <p className="font-mono text-xs">no log lines match the current filters</p>
              <button
                onClick={() => { setQuery(""); setLevels(new Set(LOG_LEVELS)); }}
                className="rounded-lg border border-cyber/40 bg-cyber/10 px-3 py-1.5 text-xs font-semibold text-cyber hover:bg-cyber/20"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="py-1 font-mono text-[12px] leading-5">
              {filtered.map((l) => {
                const s = LEVEL_STYLES[l.level];
                const active = l.id === selectedId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedId(active ? null : l.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 px-3 text-left transition-colors animate-log-in hover:bg-panel-2/80",
                      active && "bg-cyber/10 ring-1 ring-inset ring-cyber/40",
                    )}
                  >
                    <span className="hidden shrink-0 text-slate-600 sm:inline">{fmtMillis(l.ts)}</span>
                    <span className="shrink-0 text-slate-600 sm:hidden">{fmtTime(l.ts)}</span>
                    <LevelBadge level={l.level} className="!w-[4.6rem]" />
                    <span className={cn("hidden w-28 shrink-0 truncate text-[11px] lg:inline", s.text)}>{l.service}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300 group-hover:text-white">{l.message}</span>
                    {l.status !== undefined && l.status >= 400 && (
                      <span className={cn("shrink-0 rounded border px-1 text-[10px] font-bold", s.bg, s.text, s.border)}>{l.status}</span>
                    )}
                  </button>
                );
              })}
              <div className="flex items-center gap-2 px-3 py-2 text-slate-600">
                <span className="text-neon animate-blink">▍</span>
                <span className="text-[11px]">{paused ? "stream paused — press Resume to continue tailing" : "tailing…"}</span>
              </div>
            </div>
          )}

          {/* jump to latest */}
          {!atBottom && (
            <button
              onClick={() => {
                const el = boxRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                setAtBottom(true);
              }}
              className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyber/50 bg-panel/95 px-3.5 py-1.5 text-xs font-semibold text-cyber shadow-[0_0_18px_rgba(139,92,246,0.45)] animate-float-btn hover:bg-cyber/20"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
            </button>
          )}
        </div>
      </section>

      {/* ---- Inspector drawer ---- */}
      {selected ? (
        <aside className="card-sheen flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-cyber/30 bg-panel shadow-[0_0_40px_rgba(139,92,246,0.18)] animate-drawer-in lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)]">
          <header className="flex items-center justify-between gap-2 border-b border-edge/70 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <LevelBadge level={selected.level} />
              <span className="truncate font-mono text-xs text-slate-300">#{selected.id} · {selected.service}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => moveSelection(-1)} disabled={!filtered.some((f, i) => f.id === selected.id && i > 0)} className="rounded-lg border border-edge bg-obsidian p-1.5 text-slate-400 transition-colors hover:text-white disabled:opacity-30" title="Previous log">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => moveSelection(1)} disabled={!filtered.some((f, i) => f.id === selected.id && i < filtered.length - 1)} className="rounded-lg border border-edge bg-obsidian p-1.5 text-slate-400 transition-colors hover:text-white disabled:opacity-30" title="Next log">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={() => setSelectedId(null)} className="rounded-lg border border-edge bg-obsidian p-1.5 text-slate-400 transition-colors hover:border-spike/50 hover:text-spike" title="Close inspector">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <Meta label="timestamp" value={iso(selected.ts)} icon={<Clock className="h-3 w-3" />} />
              <Meta label="epoch ms" value={String(selected.ts)} />
              <Meta label="status_code" value={selected.status != null ? String(selected.status) : "—"} warn={!!selected.status && selected.status >= 400} />
              <Meta label="error_type" value={selected.errorType ? selected.errorType : "—"} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">raw line</p>
                <CopyButton text={selected.raw} label="Copy raw" />
              </div>
              <pre className="overflow-x-auto rounded-xl border border-edge bg-obsidian p-3 font-mono text-[11px] leading-5 break-all whitespace-pre-wrap text-slate-300">
                {selected.raw}
              </pre>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  parsed attributes <span className="text-cyber">(grok-core)</span>
                </p>
                <CopyButton text={JSON.stringify(selected.parsed, null, 2)} label="Copy JSON" />
              </div>
              <JsonFields fields={selected.parsed} />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">message</p>
              <p className="rounded-xl border border-edge bg-obsidian p-3 font-mono text-[11px] leading-5 text-slate-300">{selected.message}</p>
            </div>

            {selected.level === "ERROR" && (
              <div className="flex items-start gap-2 rounded-xl border border-spike/30 bg-spike/10 p-3 text-xs text-spike">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-mono">error event routed to analytics timeline — counted in the 15-minute spike window.</span>
              </div>
            )}
          </div>
        </aside>
      ) : (
        <aside className="hidden flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edge bg-panel/50 p-8 text-center lg:flex">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyber/30 bg-cyber/10">
            <Search className="h-5 w-5 text-cyber" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Log Row Inspector</p>
          <p className="max-w-56 text-xs leading-5 text-slate-500">
            Click any line in the stream to expand its parsed attributes — <span className="font-mono text-slate-400">timestamp</span>,{" "}
            <span className="font-mono text-slate-400">ip_address</span>,{" "}
            <span className="font-mono text-slate-400">status_code</span>,{" "}
            <span className="font-mono text-slate-400">response_time_ms</span>,{" "}
            <span className="font-mono text-slate-400">user_agent</span> and more.
          </p>
        </aside>
      )}
    </div>
  );
}

function Pill({
  active, onClick, label, count, level,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  level?: LogLevel;
}) {
  const s = level ? LEVEL_STYLES[level] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all",
        active
          ? s
            ? cn(s.bg, s.text, "ring-1 ring-inset", s.border)
            : "bg-cyber/20 text-white ring-1 ring-inset ring-cyber/50"
          : "text-slate-500 hover:bg-panel-2 hover:text-slate-300",
      )}
    >
      {label}
      <span className={cn("ml-1.5 text-[9px] opacity-70")}>{count}</span>
    </button>
  );
}

function Meta({ label, value, icon, warn }: { label: string; value: string; icon?: ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-edge bg-obsidian px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-slate-500">
        {icon} {label}
      </p>
      <p className={cn("mt-0.5 truncate", warn ? "text-spike font-semibold" : "text-slate-200")} title={value}>{value}</p>
    </div>
  );
}
