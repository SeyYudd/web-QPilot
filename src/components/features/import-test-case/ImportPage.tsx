import { useState } from "react"
import { toast } from "sonner"
import { FileSpreadsheet, Globe, Link2, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Field, StatusPill, type ImportRow } from "@/components/features/shared"

function valid(row: ImportRow) {
  if (!row.project.trim() || !row.summary.trim() || !row.repository.trim()) return "Project, Summary, dan Test Repository wajib diisi."
  if (row.reuse && !row.jiraExist.trim()) return "Jira Exist wajib diisi untuk mode REUSE."
  return ""
}

function emptyRow(no: number): ImportRow {
  return { id: crypto.randomUUID(), no, reuse: false, jiraExist: "", project: "SIT", summary: "", assignee: "", repository: "", steps: [{ action: "", data: "", expectedResult: "" }], selected: true, error: "" }
}

const seedRows: ImportRow[] = [
  { id: "imp-1", no: 1, reuse: false, jiraExist: "", project: "SIT", summary: "Checkout with valid card", assignee: "Anisa N.", repository: "queries/checkout", steps: [{ action: "Open the storefront", data: "https://store.example.com", expectedResult: "The home page is displayed" }], selected: true, error: "" },
  { id: "imp-2", no: 2, reuse: true, jiraExist: "OCOC-142", project: "SIT", summary: "Checkout with expired card", assignee: "Rizky P.", repository: "queries/checkout-expired", steps: [], selected: true, error: "" },
  { id: "imp-3", no: 3, reuse: false, jiraExist: "", project: "SIT", summary: "Apply promotional voucher", assignee: "Dewi L.", repository: "queries/voucher", steps: [], selected: true, error: "" },
]

export default function ImportPage({ onNotify }: { onNotify: (message: string) => void }) {
  const [rows, setRows] = useState<ImportRow[]>(seedRows)
  const [editing, setEditing] = useState<ImportRow | null>(null)
  const [pasteUrl, setPasteUrl] = useState(false)
  const [sourceUrl, setSourceUrl] = useState("")
  const [running, setRunning] = useState(false)

  const selected = rows.filter((row) => row.selected && !valid(row))
  const successCount = rows.filter((row) => row.result === "created" || row.result === "linked").length
  const failedCount = rows.filter((row) => row.result === "failed").length

  function toggle(id: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, selected: !row.selected } : row))
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(current.length + 1)])
    onNotify("Test case row added")
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id).map((row, index) => ({ ...row, no: index + 1 })))
  }

  function parseSource() {
    if (!sourceUrl.trim()) {
      toast.error("Tempel URL Confluence atau sumber test case terlebih dahulu")
      return
    }
    setRows(seedRows)
    setPasteUrl(false)
    setSourceUrl("")
    onNotify("Test cases parsed from source (mock)")
  }

  function runImport() {
    if (!selected.length) {
      toast.error("Tidak ada baris valid yang dipilih")
      return
    }
    setRunning(true)
    window.setTimeout(() => {
      setRows((current) => current.map((row) => {
        if (!row.selected || valid(row)) return row
        return row.reuse
          ? { ...row, result: "linked", jiraKey: row.jiraExist }
          : { ...row, result: "created", jiraKey: `OCOC-${100 + row.no}` }
      }))
      setRunning(false)
      onNotify("Import finished — results applied locally")
    }, 900)
  }

  return (
    <>
      <div className="import-hero">
        <div>
          <div className="module-icon purple"><FileSpreadsheet size={19} /></div>
          <div>
            <p className="eyebrow">IMPORT TEST CASE</p>
            <h2>Bring test cases into your workspace</h2>
            <p>Paste a source URL or add rows manually, validate, then run the import.</p>
          </div>
        </div>
        <div className="import-actions">
          <Button variant="outline" onClick={() => setPasteUrl(!pasteUrl)}><Globe size={14} /> Paste source URL</Button>
          <Button onClick={addRow}><Plus size={14} /> Add row</Button>
        </div>
      </div>

      {pasteUrl && (
        <Card className="import-drop-card" style={{ marginTop: 16 }}>
          <CardContent className="selector-fields">
            <Field label="Confluence page / source URL">
              <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://confluence.example.com/display/SIT/Test+Cases" />
            </Field>
            <Button onClick={parseSource}>Parse test cases</Button>
          </CardContent>
        </Card>
      )}

      <Card className="import-table-card" style={{ marginTop: 20 }}>
        <CardContent className="p-0">
          <div className="import-head"><span>NO</span><span>TEST CASE</span><span>PROJECT</span><span>ASSIGNEE</span><span>MODE</span><span>RESULT</span><span /></div>
          {rows.map((row) => (
            <div className="import-row" key={row.id}>
              <span>{String(row.no).padStart(2, "0")}</span>
              <div>
                <input type="checkbox" checked={row.selected} onChange={() => toggle(row.id)} aria-label={`Select ${row.summary}`} />
                <strong>{row.summary || "Untitled test case"}</strong>
                <span>{row.repository || "no repository"}</span>
                {row.error && <span style={{ color: "#c25249" }}>{row.error}</span>}
              </div>
              <span>{row.project}</span>
              <span>{row.assignee || "-"}</span>
              {row.reuse
                ? <Badge className="reuse-badge" variant="outline">REUSE · {row.jiraExist || "?"}</Badge>
                : <Badge className="create-badge" variant="outline">CREATE NEW</Badge>}
              {row.result
                ? <StatusPill tone={row.result === "failed" ? "missing" : "match"}>{row.result === "created" ? `Created ${row.jiraKey}` : row.result === "linked" ? `Linked ${row.jiraKey}` : "Failed"}</StatusPill>
                : <span className="ready-result">ready</span>}
              <div className="row-actions">
                <button className="icon-button" aria-label={`Edit ${row.summary}`} onClick={() => setEditing(row)}><Pencil size={14} /></button>
                <button className="icon-button danger-hover" aria-label={`Remove ${row.summary}`} onClick={() => removeRow(row.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="import-actions" style={{ marginTop: 16 }}>
        <Button onClick={runImport} disabled={running}>
          {running ? <><LoaderCircle size={14} className="animate-spin" /> Importing…</> : <><Link2 size={14} /> Run import ({selected.length})</>}
        </Button>
        {(successCount > 0 || failedCount > 0) && (
          <Badge variant="secondary">{successCount} success · {failedCount} failed</Badge>
        )}
      </div>

      {editing && <RowEditor row={editing} onSave={(next) => { setRows((current) => current.map((row) => row.id === next.id ? { ...next, error: valid(next) } : row)); setEditing(null); onNotify("Test case updated") }} onClose={() => setEditing(null)} />}
    </>
  )
}

function RowEditor({ row, onSave, onClose }: { row: ImportRow; onSave: (row: ImportRow) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ImportRow>(row)
  const fields = ["project", "summary", "assignee", "repository", "jiraExist"] as const

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" style={{ width: "min(520px, 100%)" }}>
        <button className="dialog-close icon-button" onClick={onClose} aria-label="Close dialog">✕</button>
        <h2>Edit test case #{row.no}</h2>
        <div className="form-stack" style={{ marginTop: 14 }}>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((key) => (
              <Field key={key} label={key} hint={key === "jiraExist" ? "for REUSE" : undefined}>
                <Input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </Field>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={draft.reuse} onChange={(event) => setDraft({ ...draft, reuse: event.target.checked })} /> Reuse existing Jira test
          </label>
          {!draft.reuse && (
            <div className="form-stack">
              <div className="card-title-row">
                <p className="eyebrow" style={{ margin: 0 }}>MANUAL TEST STEPS</p>
                <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { action: "", data: "", expectedResult: "" }] })}><Plus size={14} /> Add step</Button>
              </div>
              {draft.steps.map((step, index) => (
                <div key={index} className="form-stack" style={{ gap: 6 }}>
                  <span className="eyebrow" style={{ margin: 0 }}>Step {index + 1}</span>
                  {(["action", "data", "expectedResult"] as const).map((field) => (
                    <Input key={field} placeholder={field} value={step[field]} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item) })} />
                  ))}
                  {draft.steps.length > 1 && (
                    <button className="icon-button danger-hover" aria-label={`Remove step ${index + 1}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)}>Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
