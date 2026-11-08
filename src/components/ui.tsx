import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { LogLevel } from "../types";
import { cn } from "@/utils/cn";

export const LEVEL_STYLES: Record<LogLevel, { text: string; bg: string; border: string; dot: string }> = {
  INFO: { text: "text-neon", bg: "bg-neon/10", border: "border-neon/30", dot: "bg-neon" },
  WARN: { text: "text-electric", bg: "bg-electric/10", border: "border-electric/30", dot: "bg-electric" },
  ERROR: { text: "text-spike", bg: "bg-spike/10", border: "border-spike/30", dot: "bg-spike" },
  DEBUG: { text: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30", dot: "bg-sky-400" },
};

export function LevelBadge({ level, className }: { level: LogLevel; className?: string }) {
  const s = LEVEL_STYLES[level];
  return (
    <span
      className={cn(
        "inline-flex w-[4.25rem] shrink-0 items-center justify-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
        s.text, s.bg, s.border, className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {level}
    </span>
  );
}

export function Card({ title, icon, right, children, className, bodyClassName }: {
  title?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "card-sheen rounded-2xl border border-edge bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-edge/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-cyber">{icon}</span>}
            <h2 className="truncate text-sm font-semibold tracking-tight text-slate-100">{title}</h2>
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, accent, icon }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent: "cyber" | "neon" | "electric" | "spike" | "slate";
  icon?: ReactNode;
}) {
  const accents = {
    cyber: "border-cyber/30 text-cyber",
    neon: "border-neon/30 text-neon",
    electric: "border-electric/30 text-electric",
    spike: "border-spike/30 text-spike",
    slate: "border-edge text-slate-300",
  };
  const valueAccents = {
    cyber: "text-slate-50",
    neon: "text-neon",
    electric: "text-electric",
    spike: "text-spike",
    slate: "text-slate-100",
  };
  return (
    <div className="card-sheen rounded-2xl border border-edge bg-panel p-4 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {icon && <span className={cn("rounded-lg border bg-obsidian p-1.5", accents[accent])}>{icon}</span>}
      </div>
      <p className={cn("mt-2 font-mono text-2xl font-bold tracking-tight sm:text-[1.7rem]", valueAccents[accent])}>{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, icon }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-neon/40 bg-neon/10 text-neon"
          : "border-edge bg-obsidian text-slate-400 hover:text-slate-200",
      )}
    >
      {icon}
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", checked ? "bg-neon/70" : "bg-slate-700")}>
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
            checked ? "left-[15px]" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-edge bg-obsidian px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyber/50 hover:text-white",
        copied && "border-neon/50 text-neon",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Renders parsed attributes as a syntax-colored key/value table. */
export function JsonFields({ fields }: { fields: Record<string, string> }) {
  const entries = Object.entries(fields);
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-obsidian">
      <div className="max-h-72 overflow-auto p-3 font-mono text-xs leading-6">
        <span className="text-slate-500">{"{"}</span>
        {entries.map(([k, v], i) => {
          const isNum = /^-?\d+(\.\d+)?$/.test(v);
          return (
            <div key={k} className="flex gap-2 pl-4">
              <span className="shrink-0 text-cyber">"{k}"</span>
              <span className="text-slate-500">:</span>
              <span className={cn("break-all", isNum ? "text-electric" : "text-neon")}>
                {isNum ? v : `"${v}"`}
              </span>
              {i < entries.length - 1 && <span className="text-slate-600">,</span>}
            </div>
          );
        })}
        <span className="text-slate-500">{"}"}</span>
      </div>
    </div>
  );
}
