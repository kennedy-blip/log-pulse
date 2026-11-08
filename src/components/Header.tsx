import { Activity, BarChart3, FileDown, Pause, Play, Regex, ScrollText, Trash2, Zap } from "lucide-react";
import { cn } from "@/utils/cn";

export type TabId = "stream" | "parser" | "analytics" | "exporter";

export const TABS: Array<{ id: TabId; label: string; icon: typeof ScrollText }> = [
  { id: "stream", label: "Live Log Stream", icon: ScrollText },
  { id: "parser", label: "Pattern Parser Studio", icon: Regex },
  { id: "analytics", label: "Error Analytics", icon: BarChart3 },
  { id: "exporter", label: "Log Exporter", icon: FileDown },
];

export function Header({
  tab,
  onTab,
  paused,
  onTogglePause,
  onInject,
  onClear,
  totalLines,
  errorCount,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  paused: boolean;
  onTogglePause: () => void;
  onInject: () => void;
  onClear: () => void;
  totalLines: number;
  errorCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-obsidian/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyber to-indigo-600 shadow-[0_0_24px_rgba(139,92,246,0.55)]">
            <Activity className="h-5.5 w-5.5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-neon ring-2 ring-obsidian animate-pulse-dot" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold tracking-tight text-white">
              Log<span className="text-glow-cyber text-cyber">Pulse</span>
            </h1>
            <p className="hidden font-mono text-[10px] tracking-wide text-slate-500 sm:block">
              log aggregator · pattern parser · tailer
            </p>
          </div>
        </div>

        {/* Live status badge */}
        <div
          className={cn(
            "hidden items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] md:inline-flex",
            paused ? "border-electric/40 bg-electric/10 text-electric" : "border-neon/40 bg-neon/10 text-neon",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", paused ? "bg-electric" : "bg-neon animate-pulse-dot")} />
          Log Tailer: {paused ? "Paused" : "Active (Streaming)"}
          {!paused && <span className="text-neon/70 animate-blink">▍</span>}
        </div>

        {/* Quick actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onInject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyber/40 bg-cyber/10 px-2.5 py-1.5 text-xs font-semibold text-cyber transition-all hover:bg-cyber/20 hover:shadow-[0_0_16px_rgba(139,92,246,0.4)] active:scale-95"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Inject Mock Traffic</span>
            <span className="lg:hidden">Inject</span>
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95",
              paused
                ? "border-neon/50 bg-neon/15 text-neon hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                : "border-edge bg-panel text-slate-300 hover:border-electric/50 hover:text-electric",
            )}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{paused ? "Resume Stream" : "Pause Stream"}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:border-spike/50 hover:text-spike active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear Log Buffer</span>
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="order-last flex w-full items-center gap-1 overflow-x-auto border-t border-edge/60 pt-2.5 md:order-none md:w-auto md:border-0 md:pt-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  active
                    ? "border border-cyber/50 bg-cyber/15 text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]"
                    : "border border-transparent text-slate-400 hover:bg-panel hover:text-slate-100",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-cyber")} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      {/* thin live counter strip */}
      <div className="border-t border-edge/50 bg-obsidian/60">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-1 font-mono text-[10px] text-slate-500 sm:px-6">
          <span className="text-slate-400">{totalLines.toLocaleString()} lines buffered</span>
          <span className="text-spike">{errorCount.toLocaleString()} error events</span>
          <span className="hidden text-slate-600 sm:inline">engine: mock-telemetry v2.4 · buffer: ring-600 · parser: grok-core</span>
        </div>
      </div>
    </header>
  );
}
