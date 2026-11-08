import { useMemo, useState } from "react";
import { AlignLeft, Braces, Check, Download, FileJson, FileDown, Table2 } from "lucide-react";
import type { ExportFormat, LogEntry, LogLevel } from "@/types";
import { LOG_LEVELS } from "@/types";
import { exportLogs, formatBytes } from "@/lib/logEngine";
import { cn } from "@/utils/cn";
import { Card } from "./ui";

const FORMATS: Array<{ id: ExportFormat; label: string; icon: typeof Braces; ext: string; mime: string }> = [
  { id: "json", label: "JSON", icon: Braces, ext: "json", mime: "application/json" },
  { id: "ndjson", label: "NDJSON", icon: FileJson, ext: "ndjson", mime: "application/x-ndjson" },
  { id: "csv", label: "CSV", icon: Table2, ext: "csv", mime: "text/csv" },
  { id: "txt", label: "Plain Text", icon: AlignLeft, ext: "log", mime: "text/plain" },
];

const LIMITS: Array<{ id: number; label: string }> = [
  { id: 100, label: "Last 100" },
  { id: 300, label: "Last 300" },
  { id: 600, label: "All buffered" },
];

export function LogExporter({ logs }: { logs: LogEntry[] }) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [limit, setLimit] = useState(600);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => {
    const byLevel = level === "all" ? logs : logs.filter((l) => l.level === level);
    return byLevel.slice(-limit);
  }, [logs, level, limit]);

  const levelsForExport = useMemo(() => (level === "all" ? ("all" as const) : [level]), [level]);

  const output = useMemo(
    () => exportLogs(selected, format, levelsForExport),
    [selected, format, levelsForExport],
  );

  const preview = useMemo(() => output.split("\n").slice(0, 12).join("\n"), [output]);
  const size = new Blob([output]).size;
  const fmt = FORMATS.find((f) => f.id === format)!;

  const download = () => {
    const blob = new Blob([output], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logpulse-export-${new Date().toISOString().replace(/[:.]/g, "-")}.${fmt.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-5">
      {/* ---- controls ---- */}
      <Card className="xl:col-span-2" title="Export Configuration" icon={<FileDown className="h-4 w-4" />}>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">format</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
                      active
                        ? "border-cyber/60 bg-cyber/15 text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                        : "border-edge bg-obsidian text-slate-400 hover:border-slate-600 hover:text-slate-200",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-cyber")} />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">severity filter</p>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...LOG_LEVELS] as const).map((lv) => (
                <button
                  key={lv}
                  onClick={() => setLevel(lv)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-wider transition-all",
                    level === lv
                      ? "border-cyber/60 bg-cyber/15 text-white"
                      : "border-edge bg-obsidian text-slate-400 hover:text-slate-200",
                  )}
                >
                  {lv === "all" ? "ALL LEVELS" : lv}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">window</p>
            <div className="flex flex-wrap gap-1.5">
              {LIMITS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLimit(l.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all",
                    limit === l.id
                      ? "border-neon/50 bg-neon/10 text-neon"
                      : "border-edge bg-obsidian text-slate-400 hover:text-slate-200",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-edge bg-obsidian p-3 font-mono text-center">
            <div>
              <p className="text-lg font-bold text-slate-100">{selected.length}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">entries</p>
            </div>
            <div>
              <p className="text-lg font-bold text-cyber">{formatBytes(size)}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">payload</p>
            </div>
            <div>
              <p className="text-lg font-bold text-neon">{fmt.ext}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">format</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={download}
              disabled={selected.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/15 px-4 py-2.5 text-sm font-bold text-neon transition-all hover:bg-neon/25 hover:shadow-[0_0_18px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Download .{fmt.ext}
            </button>
            <button
              onClick={copyAll}
              disabled={selected.length === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40",
                copied
                  ? "border-neon/60 bg-neon/15 text-neon"
                  : "border-edge bg-obsidian text-slate-200 hover:border-cyber/50 hover:text-white",
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Braces className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy all"}
            </button>
          </div>
        </div>
      </Card>

      {/* ---- preview ---- */}
      <Card
        className="xl:col-span-3"
        title={`Live preview — ${fmt.label}`}
        icon={<AlignLeft className="h-4 w-4" />}
        right={<span className="font-mono text-[10px] text-slate-500">{formatBytes(size)} · {output.split("\n").length - (output.endsWith("\n") ? 1 : 0)} lines</span>}
      >
        <div className="relative overflow-hidden rounded-xl border border-edge bg-obsidian">
          <div className="max-h-[520px] overflow-auto p-3 font-mono text-[11px] leading-5">
            {selected.length === 0 ? (
              <p className="py-10 text-center text-slate-600">buffer is empty — nothing to export</p>
            ) : (
              preview.split("\n").map((line, i) => (
                <div key={i} className="flex gap-3 hover:bg-panel-2/60">
                  <span className="w-8 shrink-0 select-none text-right text-slate-700">{i + 1}</span>
                  <span className="whitespace-pre-wrap break-all text-slate-300">{line || " "}</span>
                </div>
              ))
            )}
            {output.split("\n").length > 12 && (
              <p className="mt-2 border-t border-edge/60 pt-2 text-center text-[10px] text-slate-600">
                … {output.split("\n").length - 12} more lines in payload
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
