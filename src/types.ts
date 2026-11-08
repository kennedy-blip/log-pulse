export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export type ErrorTypeKey = "500" | "404" | "429" | "other";

export interface LogEntry {
  id: number;
  /** epoch milliseconds */
  ts: number;
  level: LogLevel;
  service: string;
  message: string;
  /** raw unstructured log line */
  raw: string;
  /** structured attributes parsed from `raw` */
  parsed: Record<string, string>;
  status?: number;
  errorType?: ErrorTypeKey;
}

export interface TimelineBucket {
  /** epoch minutes */
  minute: number;
  counts: Record<ErrorTypeKey, number>;
}

export type ExportFormat = "json" | "ndjson" | "csv" | "txt";

export const LOG_LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG"];

export const ERROR_TYPE_LABELS: Record<ErrorTypeKey, string> = {
  "500": "500 Internal Server Error",
  "404": "404 Not Found",
  "429": "429 Rate Limit Exceeded",
  other: "Other Failures",
};
