import type { ErrorTypeKey, ExportFormat, LogEntry, LogLevel, TimelineBucket } from "../types";
import { ERROR_TYPE_LABELS } from "../types";
import { parseLine } from "./grok";

/** Default Grok pattern used by the live tailer to structure raw access-log lines. */
export const DEFAULT_PATTERN =
  '%{IP:ip_address} - %{NOTSPACE:ident} %{NOTSPACE:auth} \\[%{HTTPDATE:timestamp}\\] "%{WORD:method} %{URIPATH:path} %{DATA:protocol}" %{NUMBER:status_code} %{NUMBER:bytes_sent} "%{DATA:referer}" "%{DATA:user_agent}" %{NUMBER:response_time_ms}ms';

export const TIMELINE_WINDOW_MIN = 15;

let counter = 1;

const SERVICES = [
  "api-gateway",
  "auth-service",
  "payment-worker",
  "user-db",
  "cache-layer",
  "search-index",
  "notify-svc",
  "billing-api",
];

const IPS = [
  "10.0.4.22", "10.0.4.87", "172.16.0.14", "192.168.1.24", "192.168.1.102",
  "203.0.113.45", "198.51.100.77", "172.16.8.9", "10.20.30.40", "192.0.2.61",
];

const PATHS = [
  "/api/v1/users", "/api/v1/orders", "/api/v1/payments", "/api/v1/cart", "/health",
  "/metrics", "/api/v2/search", "/auth/login", "/auth/refresh", "/api/v1/webhooks/stripe",
  "/static/app.js", "/api/v1/reports", "/api/v1/notifications", "/admin/config",
];

const METHODS = ["GET", "GET", "GET", "POST", "POST", "PUT", "DELETE"];

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/127.0",
  "logpulse-agent/2.4.1 (k8s; linux/amd64)",
  "curl/8.5.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148",
  "PostmanRuntime/7.39.0",
];

const REFERERS = [
  "https://app.logpulse.io/dashboard",
  "https://app.logpulse.io/analytics",
  "https://admin.logpulse.io/",
  "-",
];

const ERROR_MESSAGES = [
  "Unhandled exception in {svc}: NullPointerException at {path}",
  "upstream {host} timed out after {rt}ms",
  "payment failed: card_declined (order #{id})",
  "DB connection pool exhausted (active {n}/{max})",
  "rate limit exceeded for api key ak_live_{hex}",
  "failed to publish event to kafka topic 'orders': BrokerNotAvailable",
  "TLS handshake failed with {ip}: certificate verify failed",
  "502 Bad Gateway from load-balancer edge-{n}",
  "OOMKilled: container {svc} exceeded memory limit 512Mi",
  "deadlock detected in transaction on table 'payments'",
];

const WARN_MESSAGES = [
  "slow query on table '{table}' took {rt}ms",
  "heap usage at {pct}% (threshold 80%)",
  "retry {n}/5 for job #{id} — reason: upstream timeout",
  "TLS certificate for {host} expires in {d} days",
  "disk usage at {pct}% on /var/log",
  "connection pool nearly saturated ({n}/{max})",
  "deprecated API version v1 called by client {ip}",
];

const INFO_MESSAGES = [
  "{method} {path} -> {status} in {rt}ms",
  "request completed successfully ({bytes} bytes sent)",
  "health check OK ({rt}ms)",
  "cache HIT for key session:{id}",
  "connected to postgres://user-db.internal:5432/app",
  "deployed build #{id} to {n} pods",
  "user {id} authenticated via oauth2 (provider: okta)",
];

const DEBUG_MESSAGES = [
  "loaded config from /etc/{svc}/config.yaml ({n} keys)",
  "span trace_id={hex} parent=none sampled=false",
  "parsed {bytes} bytes from socket fd={n}",
  "GC pause {rt}ms (young gen)",
  "outbound queue depth {n} (max 10000)",
  "feature flag 'new-checkout' evaluated=true for tenant {id}",
];

const ERROR_KINDS: Array<{ status: number; type: ErrorTypeKey; weight: number }> = [
  { status: 500, type: "500", weight: 46 },
  { status: 429, type: "429", weight: 22 },
  { status: 404, type: "404", weight: 18 },
  { status: 502, type: "other", weight: 8 },
  { status: 503, type: "other", weight: 6 },
];

const WARN_STATUSES: Array<{ status: number; type?: ErrorTypeKey; weight: number }> = [
  { status: 200, weight: 40 },
  { status: 304, weight: 18 },
  { status: 404, type: "404", weight: 22 },
  { status: 429, type: "429", weight: 20 },
];

const OK_STATUSES = [200, 200, 200, 201, 201, 204, 204, 304];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickWeighted<T extends { weight: number }>(arr: T[]): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}
function hex(n: number): string {
  let s = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

export function httpDate(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${MONTHS[d.getMonth()]}/${d.getFullYear()}:${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} +0000`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtMillis(ts: number): string {
  return `${fmtTime(ts)}.${pad(new Date(ts).getMilliseconds(), 3)}`;
}

export function fmtHM(minuteEpoch: number): string {
  const d = new Date(minuteEpoch * 60000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export interface MakeLogOpts {
  hot?: boolean;
  forceLevel?: LogLevel;
}

/** Build one raw access-log line + parse it with the default Grok pattern (dogfooding the parser). */
export function makeLog(ts: number, opts: MakeLogOpts = {}): LogEntry {
  const roll = Math.random();
  let level: LogLevel;
  if (opts.forceLevel) level = opts.forceLevel;
  else if (opts.hot) level = roll < 0.42 ? "INFO" : roll < 0.62 ? "DEBUG" : roll < 0.78 ? "WARN" : "ERROR";
  else level = roll < 0.55 ? "INFO" : roll < 0.75 ? "DEBUG" : roll < 0.9 ? "WARN" : "ERROR";

  const service = rand(SERVICES);
  const ip = rand(IPS);
  const method = rand(METHODS);
  const path = rand(PATHS);
  const protocol = "HTTP/1.1";
  const referer = rand(REFERERS);
  const userAgent = rand(USER_AGENTS);

  let status: number;
  let errorType: ErrorTypeKey | undefined;
  if (level === "ERROR") {
    const k = pickWeighted(ERROR_KINDS);
    status = k.status;
    errorType = k.type;
  } else if (level === "WARN") {
    const k = pickWeighted(WARN_STATUSES);
    status = k.status;
    errorType = k.type;
  } else {
    status = rand(OK_STATUSES);
  }

  let rt: number;
  if (level === "ERROR") rt = randInt(1800, 5200);
  else if (level === "WARN") rt = randInt(700, 2600);
  else rt = randInt(4, 480);
  const bytes = randInt(120, 48000);

  const raw = `${ip} - - [${httpDate(ts)}] "${method} ${path} ${protocol}" ${status} ${bytes} "${referer}" "${userAgent}" ${rt}ms`;

  const parsedResult = parseLine(DEFAULT_PATTERN, "grok", raw);
  const parsed: Record<string, string> = { ...parsedResult.fields, level, service };

  const vars: Record<string, string | number> = {
    svc: service, path, rt, status, method, bytes, ip,
    id: randInt(1000, 99999), n: randInt(1, 12), max: 25, pct: randInt(80, 98),
    d: randInt(3, 30), host: `${rand(["redis", "postgres", "auth", "billing"])}.internal`,
    table: rand(["orders", "users", "payments", "events"]), hex: hex(8),
  };

  let message: string;
  if (level === "ERROR") message = fill(rand(ERROR_MESSAGES), vars);
  else if (level === "WARN") message = fill(rand(WARN_MESSAGES), vars);
  else if (level === "INFO") message = fill(rand(INFO_MESSAGES), vars);
  else message = fill(rand(DEBUG_MESSAGES), vars);

  if (errorType) parsed.error_type = ERROR_TYPE_LABELS[errorType];

  return {
    id: counter++,
    ts,
    level,
    service,
    message,
    raw,
    parsed,
    status,
    errorType,
  };
}

/** Seed a believable history: `count` logs spread over the last `spreadMin` minutes. */
export function seedLogs(count: number, spreadMin: number): LogEntry[] {
  const now = Date.now();
  const out: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const ts = now - randInt(0, spreadMin * 60000);
    // sprinkle a couple of error spikes into history
    const hot = Math.random() < 0.08;
    out.push(makeLog(ts, { hot }));
  }
  return out.sort((a, b) => a.ts - b.ts);
}

const EMPTY_COUNTS = (): Record<ErrorTypeKey, number> => ({ "500": 0, "404": 0, "429": 0, other: 0 });

export function emptyBucket(minute: number): TimelineBucket {
  return { minute, counts: EMPTY_COUNTS() };
}

/** Merge new entries into the rolling error timeline (last `windowMin` minutes). */
export function pushTimeline(
  prev: TimelineBucket[],
  entries: LogEntry[],
  windowMin = TIMELINE_WINDOW_MIN,
): TimelineBucket[] {
  const map = new Map<number, TimelineBucket>();
  for (const b of prev) map.set(b.minute, { minute: b.minute, counts: { ...b.counts } });
  for (const e of entries) {
    if (!e.errorType) continue;
    const m = Math.floor(e.ts / 60000);
    const b = map.get(m) ?? emptyBucket(m);
    b.counts[e.errorType] += 1;
    map.set(m, b);
  }
  return pruneTimeline([...map.values()], windowMin);
}

export function pruneTimeline(buckets: TimelineBucket[], windowMin = TIMELINE_WINDOW_MIN): TimelineBucket[] {
  const cutoff = Math.floor(Date.now() / 60000) - windowMin + 1;
  return buckets.filter((b) => b.minute >= cutoff).sort((a, b) => a.minute - b.minute);
}

/** Build a full, gap-filled 15-bucket series for the chart. */
export function fillTimeline(timeline: TimelineBucket[], windowMin = TIMELINE_WINDOW_MIN): TimelineBucket[] {
  const nowMin = Math.floor(Date.now() / 60000);
  const map = new Map(timeline.map((b) => [b.minute, b]));
  return Array.from({ length: windowMin }, (_, i) => {
    const m = nowMin - (windowMin - 1 - i);
    return map.get(m) ?? emptyBucket(m);
  });
}

/* ---------------- Exporters ---------------- */

function publicEntry(l: LogEntry) {
  return {
    id: l.id,
    timestamp: iso(l.ts),
    level: l.level,
    service: l.service,
    status_code: l.status ?? null,
    error_type: l.errorType ? ERROR_TYPE_LABELS[l.errorType] : null,
    message: l.message,
    attributes: l.parsed,
    raw: l.raw,
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportLogs(logs: LogEntry[], format: ExportFormat, levels: LogLevel[] | "all"): string {
  const filtered = levels === "all" ? logs : logs.filter((l) => levels.includes(l.level));
  if (format === "json") {
    return JSON.stringify(
      { exported_at: new Date().toISOString(), source: "LogPulse", count: filtered.length, logs: filtered.map(publicEntry) },
      null,
      2,
    );
  }
  if (format === "ndjson") {
    return filtered.map((l) => JSON.stringify(publicEntry(l))).join("\n") + (filtered.length ? "\n" : "");
  }
  if (format === "csv") {
    const head = ["timestamp", "level", "service", "status_code", "ip_address", "method", "path", "response_time_ms", "error_type", "message", "raw"];
    const rows = filtered.map((l) =>
      [
        iso(l.ts), l.level, l.service, l.status ?? "", l.parsed.ip_address ?? "", l.parsed.method ?? "",
        l.parsed.path ?? "", l.parsed.response_time_ms ?? "", l.errorType ? ERROR_TYPE_LABELS[l.errorType] : "",
        l.message, l.raw,
      ].map(csvCell).join(","),
    );
    return [head.join(","), ...rows].join("\n") + "\n";
  }
  // txt
  return filtered.map((l) => l.raw).join("\n") + (filtered.length ? "\n" : "");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
