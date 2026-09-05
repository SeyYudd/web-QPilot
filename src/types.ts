export type SyncStatus = "Match" | "Urutan berbeda" | "Missing di Confluence" | "Extra di Confluence";

export type CaptureStatus = string;

export type DisplayMode = "expand" | "table" | "missing";

export interface ComparisonResult {
  key: string;
  order: number | "-";
  position: number;
  positionTitle: string;
  displayMode: DisplayMode;
  capture: CaptureStatus;
  captureCount: number;
  status: SyncStatus;
  teStatus: string;
  summary?: string;
  scenario?: string;
  functionName?: string;
  steps?: Array<{ action: string; data: string; expectedResult: string }>;
}

export interface CompareSummary {
  jiraTotal: number;
  confluenceTotal: number;
  match: number;
  differentOrder: number;
  missing: number;
  extra: number;
  captured: number;
}

export interface JiraIssue {
  key: string;
  fields?: Record<string, unknown>;
  names?: Record<string, string>;
}

export type XrayTestRun =
  | string
  | { key?: string; issueKey?: string; status?: unknown; assignee?: unknown };

export interface XrayTestRunRecord {
  id?: string | number;
  status?: unknown;
}
