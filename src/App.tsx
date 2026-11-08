import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, TimelineBucket } from "@/types";
import { makeLog, pruneTimeline, pushTimeline, seedLogs } from "@/lib/logEngine";
import { Header, type TabId } from "@/components/Header";
import { LogStream } from "@/components/LogStream";
import { LogParser } from "@/components/LogParser";
import { LogAnalytics } from "@/components/LogAnalytics";
import { LogExporter } from "@/components/LogExporter";

const BUFFER_CAP = 600;

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [paused, setPaused] = useState(false);
  const [hot, setHot] = useState(false);
  const [tab, setTab] = useState<TabId>("stream");
  const hotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // seed a believable history on mount
  useEffect(() => {
    const seeded = seedLogs(150, 10);
    setLogs(seeded);
    setTimeline(pushTimeline([], seeded));
  }, []);

  // live tailer engine
  useEffect(() => {
    if (paused) return;
    const iv = setInterval(() => {
      const batch = hot ? 2 + Math.floor(Math.random() * 3) : Math.random() < 0.35 ? 2 : 1;
      const now = Date.now();
      const entries = Array.from({ length: batch }, () => makeLog(now + Math.random() * 200, { hot }));
      setLogs((prev) => [...prev, ...entries].slice(-BUFFER_CAP));
      setTimeline((prev) => pushTimeline(prev, entries));
    }, hot ? 350 : 850);
    return () => clearInterval(iv);
  }, [paused, hot]);

  // keep the analytics window sliding forward even when idle
  useEffect(() => {
    const iv = setInterval(() => setTimeline((prev) => pruneTimeline(prev)), 10000);
    return () => clearInterval(iv);
  }, []);

  const injectMockTraffic = useCallback(() => {
    // staggered burst for a visible "spike" in the feed + analytics
    for (let i = 0; i < 36; i++) {
      setTimeout(() => {
        const entry = makeLog(Date.now(), { hot: true });
        setLogs((prev) => [...prev, entry].slice(-BUFFER_CAP));
        setTimeline((prev) => pushTimeline(prev, [entry]));
      }, i * 45);
    }
    setHot(true);
    if (hotTimer.current) clearTimeout(hotTimer.current);
    hotTimer.current = setTimeout(() => setHot(false), 4500);
  }, []);

  const clearBuffer = useCallback(() => setLogs([]), []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const errorCount = useMemo(() => logs.reduce((n, l) => n + (l.errorType ? 1 : 0), 0), [logs]);

  return (
    <div className="relative min-h-screen">
      {/* decorative grid backdrop */}
      <div className="bg-grid pointer-events-none fixed inset-0" />

      <Header
        tab={tab}
        onTab={setTab}
        paused={paused}
        onTogglePause={togglePause}
        onInject={injectMockTraffic}
        onClear={clearBuffer}
        totalLines={logs.length}
        errorCount={errorCount}
      />

      <main className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div key={tab} className="animate-fade-in">
          {tab === "stream" && <LogStream logs={logs} paused={paused} />}
          {tab === "parser" && <LogParser logs={logs} />}
          {tab === "analytics" && <LogAnalytics timeline={timeline} logs={logs} />}
          {tab === "exporter" && <LogExporter logs={logs} />}
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-edge/60 pt-4 font-mono text-[10px] text-slate-600">
          <span>
            LogPulse v1.0.0 · mock telemetry engine · ring buffer cap {BUFFER_CAP}
          </span>
          <span>
            parser: <span className="text-cyber">grok-core</span> · window: <span className="text-electric">15m</span> · typeface:{" "}
            <span className="text-neon">JetBrains Mono</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
