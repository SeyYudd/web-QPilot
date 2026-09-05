export type Step = { action: string; data: string; expectedResult: string };
export type Row = { no: number; reuse: boolean; jiraExist: string; project: string; testId: string; summary: string; description: string; assignee: string; repository: string; expectedResult: string; testExecution: string; issueLinks: string; labels: string; steps: Step[]; selected: boolean; error: string; result?: "created" | "linked" | "failed" | "processing"; statusCode?: number; jiraKey?: string; detail?: string; payload?: string; duration?: string };

export const text = (value: unknown) => String(value ?? "").trim();
export const dash = (value: string) => (value && value.trim() ? value : "-");

export function valid(row: Row) {
  if (!Number.isInteger(row.no) || row.no < 1) return "No harus urut mulai dari 1.";
  if ([row.project, row.summary, row.repository].some((value) => !value)) return "Project, Summary, dan Test Repository Path wajib diisi.";
  if (row.reuse && !row.jiraExist) return "Jira Exist wajib diisi untuk mode REUSE.";
  return "";
}

export function emptyRow(no: number): Row { return { no, reuse: false, jiraExist: "", project: "", testId: "", summary: "", description: "", assignee: "", repository: "", expectedResult: "", testExecution: "", issueLinks: "", labels: "", steps: [{ action: "", data: "", expectedResult: "" }], selected: true, error: "" }; }
