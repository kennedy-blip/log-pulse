import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Clock3, Gauge, Layers, TrendingUp } from "lucide-react";
import type { ErrorTypeKey, LogEntry, TimelineBucket } from "@/types";
import { ERROR_TYPE_LABELS, LOG_LEVELS } from "@/types";
import { fillTimeline, fmtHM, TIMELINE_WINDOW_MIN } from "@/lib/logEngine";
import { Card, StatCard } from "./ui";

const TYPE_COLORS: Record<ErrorTypeKey, string> = {
  "500": "#f43f5e",
  "404": "#f59e0b",
  "429": "#8b5cf6",
  other: "#64748b",
};
const TYPE_ORDER: ErrorTypeKey[] = ["500", "404", "429", "other"];

const LEVEL_COLORS: Record<string, string> = {
  INFO: "#10b981",
  WARN: "#f59e0b",
  ERROR: "#f43f5e",
  DEBUG: "#38bdf8",
};

export function LogAnalytics({ timeline, logs }: { timeline: TimelineBucket[]; logs: LogEntry[] }) {
  // re-render periodically so the rolling window slides even when idle
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  const buckets = useMemo(() => fillTimeline(timeline, TIMELINE_WINDOW_MIN), [timeline]);

  const totals = useMemo(() => {
    const t: Record<ErrorTypeKey, number> = { "500": 0, "404": 0, "429": 0, other: 0 };
    let total = 0;
    let peak = { minute: buckets[0]?.minute ?? 0, count: 0 };
    for (const b of buckets) {
      const sum = b.counts["500"] + b.counts["404"] + b.counts["429"] + b.counts.other;
      total += sum;
      for (const k of TYPE_ORDER) t[k] += b.counts[k];
      if (sum > peak.count) peak = { minute: b.minute, count: sum };
    }
    const topType = TYPE_ORDER.reduce((a, b) => (t[a] >= t[b] ? a : b));
    return { perType: t, total, peak, topType, avgPerMin: total / TIMELINE_WINDOW_MIN };
  }, [buckets]);

  const spike = totals.peak.count >= Math.max(4, totals.avgPerMin * 3);

  const levelDist = useMemo(() => {
    const cutoff = Date.now() - TIMELINE_WINDOW_MIN * 60000;
    const c: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (const l of logs) if (l.ts >= cutoff) c[l.level]++;
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    return { counts: c, total };
  }, [logs]);

  return (
    <div className="space-y-4">
      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={`Errors · last ${TIMELINE_WINDOW_MIN} min`}
          value={totals.total}
          sub="all severities ≥ 400 status"
          accent="spike"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Avg error rate"
          value={`${totals.avgPerMin.toFixed(1)}/min`}
          sub="rolling 15-minute window"
          accent="electric"
          icon={<Gauge className="h-4 w-4" />}
        />
        <StatCard
          label="Peak spike"
          value={totals.peak.count > 0 ? `${totals.peak.count} @ ${fmtHM(totals.peak.minute)}` : "—"}
          sub={spike ? "spike threshold breached" : "no anomalous spike"}
          accent={spike ? "spike" : "slate"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Top error type"
          value={ERROR_TYPE_LABELS[totals.topType].split(" ")[0]}
          sub={ERROR_TYPE_LABELS[totals.topType]}
          accent="cyber"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {spike && (
        <div className="flex items-center gap-3 rounded-2xl border border-spike/40 bg-spike/10 px-4 py-3 text-sm text-spike animate-fade-in">
          <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
          <p className="font-mono text-xs sm:text-sm">
            <span className="font-bold">ERROR SPIKE DETECTED</span> — {totals.peak.count} error events at {fmtHM(totals.peak.minute)} exceeded 3× the 15-min average.
          </p>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-3">
        {/* ---- time-series chart ---- */}
        <Card
          className="xl:col-span-2"
          title={`Error frequency — last ${TIMELINE_WINDOW_MIN} minutes`}
          icon={<BarChart3 className="h-4 w-4" />}
          right={
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400">
              {TYPE_ORDER.filter((t) => t !== "other").map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t] }} />
                  {t === "500" ? "500 Server" : t === "404" ? "404 Not Found" : "429 Rate Limit"}
                </span>
              ))}
              <span className="hidden items-center gap-1.5 text-slate-500 sm:flex">
                <Clock3 className="h-3 w-3" /> 1-min buckets
              </span>
            </div>
          }
        >
          <ErrorChart buckets={buckets} />
        </Card>

        {/* ---- breakdown + donut ---- */}
        <div className="space-y-4">
          <Card title="Error type breakdown" icon={<Layers className="h-4 w-4" />}>
            <div className="space-y-3">
              {TYPE_ORDER.map((t) => {
                const count = totals.perType[t];
                const pct = totals.total ? (count / totals.total) * 100 : 0;
                return (
                  <div key={t}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t] }} />
                        <span className="font-mono">{ERROR_TYPE_LABELS[t]}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {count} <span className="text-slate-600">· {pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[t], boxShadow: `0 0 10px ${TYPE_COLORS[t]}66` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Severity mix · 15 min" icon={<Activity className="h-4 w-4" />}>
            <div className="flex items-center gap-4">
              <Donut counts={levelDist.counts} total={levelDist.total} />
              <ul className="flex-1 space-y-1.5">
                {LOG_LEVELS.map((lv) => (
                  <li key={lv} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[lv] }} />
                      {lv}
                    </span>
                    <span className="text-slate-200">
                      {levelDist.counts[lv]}
                      <span className="ml-1 text-slate-600">
                        {levelDist.total ? ((levelDist.counts[lv] / levelDist.total) * 100).toFixed(0) : 0}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- grouped bar chart ---------------- */

function ErrorChart({ buckets }: { buckets: TimelineBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 250;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxTotal = Math.max(4, ...buckets.map((b) => b.counts["500"] + b.counts["404"] + b.counts["429"] + b.counts.other));
  const groupW = plotW / buckets.length;
  const barW = Math.min(14, (groupW * 0.72) / 3);
  const yTicks = 4;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* gridlines + y labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (maxTotal / yTicks) * i;
          const y = padT + plotH - (v / maxTotal) * plotH;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} strokeDasharray={i === 0 ? "" : "3 4"} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="JetBrains Mono, monospace">
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {buckets.map((b, i) => {
          const total = b.counts["500"] + b.counts["404"] + b.counts["429"] + b.counts.other;
          const gx = padL + i * groupW;
          const baseY = padT + plotH;
          const hovered = hover === i;
          return (
            <g key={b.minute} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hover column */}
              {hovered && (
                <rect x={gx} y={padT} width={groupW} height={plotH} fill="#8b5cf6" opacity={0.08} rx={4} />
              )}
              {TYPE_ORDER.filter((t) => t !== "other").map((t, ti) => {
                const h = (b.counts[t] / maxTotal) * plotH;
                const x = gx + groupW / 2 - (barW * 3) / 2 - barW + ti * (barW + 2) + 1;
                return (
                  <rect
                    key={t}
                    x={x}
                    y={baseY - h}
                    width={barW}
                    height={Math.max(h, b.counts[t] > 0 ? 2 : 0)}
                    rx={2}
                    fill={TYPE_COLORS[t]}
                    opacity={hovered || hover === null ? 1 : 0.35}
                    className={b.counts[t] > 0 ? "bar-grow" : ""}
                    style={b.counts[t] > 0 ? { filter: hovered ? `drop-shadow(0 0 6px ${TYPE_COLORS[t]})` : "none" } : undefined}
                  >
                    <title>{`${fmtHM(b.minute)} — ${ERROR_TYPE_LABELS[t]}: ${b.counts[t]}`}</title>
                  </rect>
                );
              })}
              {/* x label every 3rd bucket */}
              {i % 3 === 0 && (
                <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="JetBrains Mono, monospace">
                  {fmtHM(b.minute)}
                </text>
              )}
              {/* total on top when hovered */}
              {hovered && total > 0 && (
                <text x={gx + groupW / 2} y={padT + 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#e2e8f0" fontFamily="JetBrains Mono, monospace">
                  {total}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-edge bg-panel/95 px-3 py-2 shadow-xl backdrop-blur"
          style={{ left: `${((padL + (hover + 0.5) * (plotW / buckets.length)) / W) * 100}%` }}
        >
          <p className="font-mono text-[10px] font-bold text-slate-200">{fmtHM(buckets[hover].minute)}</p>
          {TYPE_ORDER.filter((t) => t !== "other").map((t) => (
            <p key={t} className="font-mono text-[10px]" style={{ color: TYPE_COLORS[t] }}>
              {t}: {buckets[hover].counts[t]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- severity donut ---------------- */

function Donut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#1e293b" strokeWidth="10" />
        {total > 0 &&
          LOG_LEVELS.map((lv) => {
            const frac = counts[lv] / total;
            const seg = (
              <circle
                key={lv}
                cx="40"
                cy="40"
                r={R}
                fill="none"
                stroke={LEVEL_COLORS[lv]}
                strokeWidth="10"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += frac * C;
            return seg;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-bold text-slate-100">{total}</span>
        <span className="text-[8px] uppercase tracking-wider text-slate-500">logs</span>
      </div>
    </div>
  );
}
