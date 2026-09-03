import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

export type Step = { id: string; action: string; data: string; expectedResult: string }

export type SyncStatus = "Match" | "Urutan berbeda" | "Missing di Confluence" | "Extra di Confluence"

export type QueueItem = { id: string; name: string; size: string; target: string; progress: number; status: "uploading" | "success" | "failed" }

export type ImportRow = {
  id: string
  no: number
  reuse: boolean
  jiraExist: string
  project: string
  summary: string
  assignee: string
  repository: string
  steps: Array<{ action: string; data: string; expectedResult: string }>
  selected: boolean
  error: string
  result?: "created" | "linked" | "failed"
  jiraKey?: string
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field-label"><span>{label}{hint && <em>{hint}</em>}</span>{children}</label>
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <Badge variant="outline" className={`status-pill ${tone}`}><span />{children}</Badge>
}
