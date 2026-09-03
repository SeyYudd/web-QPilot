import { useState } from "react"
import { toast } from "sonner"
import { Plus, Search, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, StatusPill, type Step } from "@/components/features/shared"

export default function CreateSitPage({ steps, setSteps, onNotify }: { steps: Step[]; setSteps: (steps: Step[]) => void; onNotify: (message: string) => void }) {
  const [form, setForm] = useState({ space: "SIT", parent: "18493201", execution: "SIT-TE-241", name: "Checkout flow — SIT" })
  const [preview, setPreview] = useState(false)
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })

  function addStep() {
    setSteps([...steps, { id: crypto.randomUUID(), action: "New test action", data: "", expectedResult: "Expected result" }]);
    onNotify("Test case added")
  }

  function removeStep(id: string) {
    setSteps(steps.filter((step) => step.id !== id));
    onNotify("Test case removed")
  }

  return (
    <>
      <div className="sit-layout">
        <Card className="form-card">
          <CardHeader>
            <CardTitle>Document details</CardTitle>
            <CardDescription>Connect this SIT report to its future Confluence home.</CardDescription>
          </CardHeader>
          <CardContent className="form-stack">
            <Field label="Space Key Confluence"><Input value={form.space} onChange={(event) => update("space", event.target.value)} /></Field>
            <Field label="Parent Page ID"><Input value={form.parent} onChange={(event) => update("parent", event.target.value)} /></Field>
            <Field label="Jira Test Execution Key"><Input value={form.execution} onChange={(event) => update("execution", event.target.value)} /></Field>
            <Field label="SIT PAGE NAME"><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <div className="form-actions">
              <Button variant="outline" onClick={() => onNotify("3 mock test cases loaded")}><Search size={14} /> Load test cases</Button>
              <Button variant="ghost" onClick={addStep}><Plus size={14} /> Add test case</Button>
              <Button onClick={() => { if (!form.name.trim()) { toast.error("SIT page name is required"); return } onNotify("SIT page preview generated") }}>
                <Sparkles size={14} /> Generate SIT page
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="preview-card">
          <CardHeader>
            <div className="coverage-summary">
              <div><span>Total coverage</span><strong>{String(steps.length).padStart(2, "0")}</strong><small>test cases in this draft</small></div>
              <StatusPill tone={steps.length ? "ready" : "empty"}>{steps.length ? "Ready" : "Empty"}</StatusPill>
            </div>
          </CardHeader>
          <CardContent>
            <div className="preview-title-row">
              <div><p className="eyebrow">Confluence preview</p><h2>{form.name || "SIT Page title"}</h2></div>
              <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>{preview ? "Close preview" : "Expand preview"}</Button>
            </div>
            {preview ? (
              <div className="storage-preview">
                <div className="preview-label">Storage format · local only</div>
                <h3>{form.name}</h3>
                <p>Test Execution: {form.execution}</p>
                {steps.map((step, index) => (
                  <div className="storage-row" key={step.id}>
                    <strong>{index + 1}. {step.action}</strong>
                    <span>{step.expectedResult}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="coverage-table">
                <div className="table-head"><span>#</span><span>Action & test data</span><span>Expected result</span><span /></div>
                {steps.map((step, index) => (
                  <StepEditor key={step.id} step={step} index={index} onChange={(next) => setSteps(steps.map((item) => item.id === step.id ? next : item))} onRemove={() => removeStep(step.id)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StepEditor({ step, index, onChange, onRemove }: { step: Step; index: number; onChange: (step: Step) => void; onRemove: () => void }) {
  return (
    <div className="step-editor">
      <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
      <div className="step-inputs">
        <input aria-label="Action" value={step.action} onChange={(event) => onChange({ ...step, action: event.target.value })} />
        <input aria-label="Data" placeholder="Test data (optional)" value={step.data} onChange={(event) => onChange({ ...step, data: event.target.value })} />
      </div>
      <input className="expected-input" aria-label="Expected result" value={step.expectedResult} onChange={(event) => onChange({ ...step, expectedResult: event.target.value })} />
      <button className="icon-button danger-hover" aria-label="Delete test case" onClick={onRemove}><Trash2 size={15} /></button>
    </div>
  )
}
