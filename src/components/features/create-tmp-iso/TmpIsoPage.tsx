import { useState } from "react"
import { Blocks, Check, CircleAlert, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/features/shared"

export default function TmpIsoPage({ onNotify }: { onNotify: (message: string) => void }) {
  const [type, setType] = useState("TMP")
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("Anisa Nurhaliza")
  return (
    <>
      <div className="intro-strip">
        <div className="module-icon purple"><Blocks size={19} /></div>
        <div><strong>Start with a test plan</strong><span>Define the scope and ownership of your TMP or ISO document.</span></div>
        <Badge variant="outline">Local draft</Badge>
      </div>
      <div className="two-column-content">
        <Card>
          <CardHeader>
            <CardTitle>Document details</CardTitle>
            <CardDescription>Keep the plan lightweight. You can refine it as coverage grows.</CardDescription>
          </CardHeader>
          <CardContent className="form-stack">
            <Field label="Document type">
              <div className="segmented">
                <button className={type === "TMP" ? "selected" : ""} onClick={() => setType("TMP")}>TMP</button>
                <button className={type === "ISO" ? "selected" : ""} onClick={() => setType("ISO")}>ISO</button>
              </div>
            </Field>
            <Field label="Document name">
              <Input placeholder="e.g. Checkout release plan" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Project owner">
              <select value={owner} onChange={(event) => setOwner(event.target.value)}>
                <option>Anisa Nurhaliza</option>
                <option>Rizky Pratama</option>
                <option>Dewi Lestari</option>
              </select>
            </Field>
            <Field label="Scope summary" hint="Optional">
              <textarea placeholder="What does this plan cover?" />
            </Field>
            <Button onClick={() => onNotify(`${type} draft saved locally`)}><Check size={15} /> Save draft</Button>
          </CardContent>
        </Card>
        <Card className="accent-card">
          <CardHeader>
            <div className="card-kicker"><span>DOCUMENT OUTLINE</span><MoreHorizontal size={16} /></div>
            <CardTitle>{name || "Untitled plan"}</CardTitle>
            <CardDescription>{type} · Owned by {owner}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="outline-list">
              <div><span>01</span><strong>Purpose & scope</strong><small>Not started</small></div>
              <div><span>02</span><strong>Test approach</strong><small>Not started</small></div>
              <div><span>03</span><strong>Environment & risks</strong><small>Not started</small></div>
            </div>
            <div className="outline-footer">
              <span><CircleAlert size={14} /> 3 sections to complete</span>
              <Button variant="outline" size="sm" onClick={() => onNotify("Preview opened locally")}>Preview outline</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
