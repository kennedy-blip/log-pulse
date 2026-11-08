/**
 * Mini Grok-style pattern compiler.
 * Supports %{TYPE} and %{TYPE:field_name} tokens mapped to named capture groups,
 * plus a raw-regex mode for hand-written JS regex with (?<name>...) groups.
 */

const GROK_PATTERNS: Record<string, string> = {
  IP: String.raw`(?:\d{1,3}\.){3}\d{1,3}`,
  IPV6: String.raw`(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}`,
  NUMBER: String.raw`\d+(?:\.\d+)?`,
  INT: String.raw`[+-]?\d+`,
  POSINT: String.raw`\d+`,
  WORD: String.raw`\w+`,
  NOTSPACE: String.raw`\S+`,
  DATA: String.raw`.+?`,
  GREEDYDATA: String.raw`.+`,
  QUOTEDSTRING: String.raw`"(?:[^"\\]|\\.)*"`,
  SINGLEQUOTEDSTRING: String.raw`'(?:[^'\\]|\\.)*'`,
  HTTPDATE: String.raw`[^\]]+`,
  SYSLOGTIMESTAMP: String.raw`[A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}`,
  TIMESTAMP_ISO8601: String.raw`\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?`,
  DATE_US: String.raw`\d{2}/\d{2}/\d{4}`,
  TIME: String.raw`\d{2}:\d{2}:\d{2}(?:\.\d+)?`,
  URIPATH: String.raw`[^\s"]+`,
  URI: String.raw`[^\s"]+`,
  HOSTNAME: String.raw`[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*`,
  LOGLEVEL: String.raw`TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|CRITICAL|FATAL|ALERT|EMERG(?:ENCY)?`,
  UUID: String.raw`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`,
  SPACE: String.raw`\s+`,
  MAC: String.raw`(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}`,
  HEX: String.raw`0x[0-9a-fA-F]+|[0-9a-fA-F]+`,
};

export type PatternMode = "grok" | "regex";

export interface CompileResult {
  regex: RegExp | null;
  error: string | null;
  fields: string[];
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function groupNames(re: RegExp): string[] {
  // eslint-disable-next-line no-control-regex
  const src = re.source;
  const names: string[] = [];
  const re2 = /\(\?<([A-Za-z_$][A-Za-z0-9_$]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re2.exec(src))) names.push(m[1]);
  return names;
}

export function compilePattern(pattern: string, mode: PatternMode): CompileResult {
  if (!pattern.trim()) {
    return { regex: null, error: "Pattern is empty.", fields: [] };
  }
  try {
    if (mode === "regex") {
      const slash = pattern.match(/^\/(.*)\/([a-z]*)$/s);
      const src = slash ? slash[1] : pattern;
      const flagsIn = slash ? slash[2] : "";
      const flags = flagsIn.includes("d") ? flagsIn : flagsIn + "d";
      const regex = new RegExp(src, flags);
      return { regex, error: null, fields: groupNames(regex) };
    }

    // Grok mode
    const seen = new Set<string>();
    const parts: string[] = [];
    let last = 0;
    const token = /%\{([A-Za-z0-9_]+)(?::([A-Za-z_$][A-Za-z0-9_$]*))?\}/g;
    let m: RegExpExecArray | null;
    while ((m = token.exec(pattern))) {
      parts.push(escapeRegExp(pattern.slice(last, m.index)));
      const type = m[1].toUpperCase();
      const name = m[2];
      const def = GROK_PATTERNS[type];
      if (!def) {
        return { regex: null, error: `Unknown grok type "%{${m[1]}}". Available: ${Object.keys(GROK_PATTERNS).join(", ")}`, fields: [] };
      }
      if (name) {
        if (seen.has(name)) {
          parts.push(`(?:${def})`); // duplicate name -> non-capturing
        } else {
          seen.add(name);
          parts.push(`(?<${name}>${def})`);
        }
      } else {
        parts.push(`(?:${def})`);
      }
      last = token.lastIndex;
    }
    parts.push(escapeRegExp(pattern.slice(last)));
    const regex = new RegExp(parts.join(""), "d");
    return { regex, error: null, fields: [...seen] };
  } catch (e) {
    return {
      regex: null,
      error: e instanceof Error ? `Invalid pattern: ${e.message}` : String(e),
      fields: [],
    };
  }
}

export interface HighlightSegment {
  text: string;
  field: string | null;
}

export interface ParseResult {
  matched: boolean;
  fields: Record<string, string>;
  segments: HighlightSegment[];
  error: string | null;
}

function cleanValue(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

/** Parse a single line, returning captured fields and match segments for highlighting. */
export function parseLine(pattern: string, mode: PatternMode, line: string): ParseResult {
  const { regex, error, fields } = compilePattern(pattern, mode);
  if (!regex) {
    return { matched: false, fields: {}, segments: [{ text: line, field: null }], error };
  }
  const m = regex.exec(line);
  if (!m) {
    return { matched: false, fields: {}, segments: [{ text: line, field: null }], error: null };
  }
  const out: Record<string, string> = {};
  for (const f of fields) out[f] = cleanValue(m.groups?.[f] ?? "");

  const segments: HighlightSegment[] = [];
  const indices = (m as unknown as { indices?: { groups?: Record<string, [number, number] | undefined> } }).indices;
  if (indices?.groups) {
    const entries = Object.entries(indices.groups)
      .filter((e): e is [string, [number, number]] => Array.isArray(e[1]))
      .sort((a, b) => a[1][0] - b[1][0]);
    let cur = 0;
    for (const [name, [s, e]] of entries) {
      if (s > cur) segments.push({ text: line.slice(cur, s), field: null });
      segments.push({ text: line.slice(s, e), field: name });
      cur = e;
    }
    if (cur < line.length) segments.push({ text: line.slice(cur), field: null });
  } else {
    segments.push({ text: line, field: null });
  }
  return { matched: true, fields: out, segments, error: null };
}

/** Count how many of the given lines match the pattern. */
export function matchStats(pattern: string, mode: PatternMode, lines: string[]): { matched: number; total: number } {
  const { regex } = compilePattern(pattern, mode);
  if (!regex) return { matched: 0, total: lines.length };
  let matched = 0;
  for (const l of lines) if (regex.test(l)) matched++;
  return { matched, total: lines.length };
}

/** Deterministic color per field name for highlight segments. */
const SEGMENT_PALETTE = ["#8b5cf6", "#10b981", "#f59e0b", "#38bdf8", "#f43f5e", "#a3e635", "#e879f9", "#22d3ee"];

export function fieldColor(field: string, order: string[]): string {
  const i = order.indexOf(field);
  return SEGMENT_PALETTE[(i < 0 ? 0 : i) % SEGMENT_PALETTE.length];
}
