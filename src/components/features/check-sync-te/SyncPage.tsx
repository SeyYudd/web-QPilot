import { useState } from "react"
import { toast } from "sonner"
import { Check, CircleAlert, GripVertical, Link2, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, StatusPill, type SyncStatus } from "@/components/features/shared"

type SyncRow = {
  id: string
  key: string
  title: string
  status: SyncStatus
  capture: string
  jiraStatus: string
  assignee: string
  included: boolean
}

const syncRows: SyncRow[] = [
  { id: "sync-1", key: "SIT-142", title: "Checkout with valid card", status: "Match", capture: "Captured", jiraStatus: "PASS", assignee: "Anisa N.", included: true },
  { id: "sync-2", key: "SIT-143", title: "Checkout with expired card", status: "Urutan berbeda", capture: "Captured", jiraStatus: "FAIL", assignee: "Rizky P.", included: true },
  { id: "sync-3", key: "SIT-144", title: "Apply promotional voucher", status: "Missing di Confluence", capture: "Not captured", jiraStatus: "TODO", assignee: "Dewi L.", included: false },
  { id: "sync-4", key: "SIT-145", title: "Guest checkout confirmation", status: "Extra di Confluence", capture: "Captured", jiraStatus: "PASS", assignee: "Anisa N.", included: true },
]

export default function SyncPage({ onNotify }: { onNotify: (message: string) => void }) {
  const [rows, setRows] = useState<SyncRow[]>(syncRows)
  const [dialog, setDialog] = useState<string | null>(null)
  const [pageId, setPageId] = useState("6597588")
  const [executionKey, setExecutionKey] = useState("SIT-TE-241")
  const [comparing, setComparing] = useState(false)

  const jiraTotal = rows.length
  const match = rows.filter((row) => row.status === "Match").length
  const missing = rows.filter((row) => row.status === "Missing di Confluence").length
  const extra = rows.filter((row) => row.status === "Extra di Confluence").length
  const coverage = jiraTotal ? ((jiraTotal - missing) / jiraTotal) * 100 : 0
  const matchRate = jiraTotal ? (match / jiraTotal) * 100 : 0

  function compare() {
    if (!pageId.trim() || !executionKey.trim()) {
      toast.error("Confluence Page ID dan Jira Test Execution Key wajib diisi")
      return
    }
    setComparing(true)
    window.setTimeout(() => {
      setComparing(false)
      onNotify(`Comparison refreshed for ${executionKey}`)
    }, 600)
  }

  function action(id: string, actionName: string) {
    setRows(rows.map((row) => row.id === id ? { ...row, status: "Match" } : row))
    setDialog(null)
    onNotify(`${actionName} completed locally`)
  }

  return (
    <>
      <div className="sync-toolbar">
        <div className="sync-context">
          <div className="jira-logo">J</div>
          <div><strong>SIT-TE-241</strong><span>Checkout flow · Last checked just now</span></div>
        </div>
        <Button variant="outline" onClick={() => onNotify("Comparison refreshed from mock data")}><RefreshCw size={14} /> Refresh comparison</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: 20 }}>
        <Card size="sm">
          <CardContent>
            <p className="eyebrow">Coverage</p>
            <p className="mt-1 text-2xl font-black">{Math.round(coverage)}%</p>
            <div className="progress-track"><div style={{ width: `${coverage}%` }} /></div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="eyebrow">Match Rate</p>
            <p className="mt-1 text-2xl font-black">{Math.round(matchRate)}%</p>
            <div className="progress-track"><div style={{ width: `${matchRate}%` }} /></div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="eyebrow">Missing / Extra</p>
            <p className="mt-1 text-2xl font-black">{missing} / {extra}</p>
            <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>{jiraTotal} Jira TC · {rows.filter((row) => row.capture === "Captured").length} captured</p>
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginTop: 20 }}>
        <CardHeader>
          <CardTitle>Compare Controller</CardTitle>
          <CardDescription>Jira TE vs Confluence — bandingkan hasil terbaru dari Jira dan Confluence.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="selector-fields">
            <Field label="Confluence Page ID">
              <Input value={pageId} onChange={(event) => setPageId(event.target.value)} placeholder="6597588 atau tempel URL halaman" />
            </Field>
            <Field label="Jira Test Execution Key">
              <Input value={executionKey} onChange={(event) => setExecutionKey(event.target.value)} placeholder="SIT-TE-241" />
            </Field>
            <Button onClick={compare} disabled={comparing}>{comparing ? "Comparing…" : "Compare TE"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="sync-grid">
        <Card className="compare-card">
          <CardHeader>
            <div className="card-title-row">
              <div><CardTitle>Compare panel</CardTitle><CardDescription>Jira/Xray order against the Confluence page.</CardDescription></div>
              <Badge variant="secondary">{rows.length} test cases</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="compare-head"><span>TEST CASE</span><span>SYNC STATUS</span><span>CAPTURE</span><span>ACTION</span></div>
            {rows.map((row, index) => (
              <div className="compare-row" key={row.id}>
                <div className="case-cell">
                  <span className="drag-hint"><GripVertical size={14} /></span>
                  <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{row.key}</strong><small>{row.title}</small></span>
                </div>
                <StatusPill tone={row.status === "Match" ? "match" : row.status === "Urutan berbeda" ? "warning" : "missing"}>{row.status}</StatusPill>
                <StatusPill tone={row.capture === "Captured" ? "capture" : "not-captured"}>{row.capture}</StatusPill>
                <div className="row-actions">
                  {row.status === "Urutan berbeda" && <Button variant="outline" size="sm" onClick={() => setDialog(row.id)}>Fix position</Button>}
                  {row.status === "Missing di Confluence" && <Button variant="outline" size="sm" onClick={() => action(row.id, "Macro added")}>Add macro</Button>}
                  {row.status === "Extra di Confluence" && <Button variant="ghost" size="sm" onClick={() => setDialog(row.id)}>Remove macro</Button>}
                  {row.status === "Match" && <span className="muted-action"><Check size={14} /> In sync</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="jira-card">
          <CardHeader>
            <CardTitle>Jira Test Execution</CardTitle>
            <CardDescription>Tests in the current Xray execution.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="jira-list">
              {rows.slice(0, 3).map((row) => (
                <div className="jira-test" key={row.id}>
                  <div><strong>{row.key}</strong><span>{row.title}</span></div>
                  <StatusPill tone={row.jiraStatus === "PASS" ? "match" : row.jiraStatus === "FAIL" ? "missing" : "warning"}>{row.jiraStatus}</StatusPill>
                  <span className="assignee">{row.assignee}</span>
                  <button className="icon-button" aria-label={`Open ${row.key}`} onClick={() => toast.info("Mock Jira detail link")}><Link2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="jira-footer">
              <Button variant="outline" size="sm" onClick={() => onNotify("SIT-144 added to local execution")}><Plus size={14} /> Add test</Button>
              <Button variant="ghost" size="sm" onClick={() => onNotify("Selected test removed locally")}><Trash2 size={14} /> Remove test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {dialog && (
        <ConfirmDialog
          title={rows.find((row) => row.id === dialog)?.status === "Urutan berbeda" ? "Fix test case position?" : "Remove Confluence macro?"}
          description="Review this local change before applying it to the preview."
          onCancel={() => setDialog(null)}
          onConfirm={() => action(dialog, rows.find((row) => row.id === dialog)?.status === "Urutan berbeda" ? "Position fixed" : "Macro removed")}
        />
      )}
    </>
  )
}

function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <button className="dialog-close icon-button" onClick={onCancel} aria-label="Close dialog"><X size={17} /></button>
        <div className="dialog-icon"><CircleAlert size={20} /></div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Confirm change</Button>
        </div>
      </div>
    </div>
  )
}
