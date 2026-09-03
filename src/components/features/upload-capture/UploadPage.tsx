import { useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronRight, ClipboardPaste, CloudUpload, ImagePlus, Plus, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Field, SectionTitle, StatusPill, type QueueItem } from "@/components/features/shared"

export default function UploadPage({ onNotify }: { onNotify: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [scenario, setScenario] = useState("Checkout flow")
  const [target, setTarget] = useState("Payment confirmation")
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: "cap-1", name: "checkout-success.png", size: "1.8 MB", target: "Payment confirmation", progress: 100, status: "success" },
    { id: "cap-2", name: "invalid-card.jpg", size: "842 KB", target: "Payment confirmation", progress: 64, status: "uploading" }
  ])

  function addFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        toast.error(`${file.name}: use PNG, JPG, or WEBP`)
        return
      }
      const id = crypto.randomUUID()
      setQueue((items) => [...items, { id, name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, target, progress: 0, status: "uploading" }])
      let progress = 0
      const timer = window.setInterval(() => {
        progress += 20
        setQueue((items) => items.map((item) => item.id === id ? { ...item, progress, status: progress >= 100 ? "success" : "uploading" } : item))
        if (progress >= 100) {
          window.clearInterval(timer)
          onNotify(`${file.name} uploaded to the local queue`)
        }
      }, 220)
    })
  }

  return (
    <>
      <div className="capture-selector">
        <div><p className="eyebrow">EVIDENCE LOCATION</p><h2>Select a target</h2><p>Choose where the next capture will be organized.</p></div>
        <div className="selector-fields">
          <Field label="Scenario">
            <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
              <option>Checkout flow</option>
              <option>Profile update</option>
              <option>Payment gateway</option>
            </select>
          </Field>
          <ChevronRight className="selector-arrow" size={16} />
          <Field label="Target">
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option>Payment confirmation</option>
              <option>Order summary</option>
              <option>Validation message</option>
            </select>
          </Field>
          <Button variant="outline" size="sm" onClick={() => onNotify("Target added to local scenario")}><Plus size={14} /> Add target</Button>
        </div>
      </div>
      <SectionTitle
        eyebrow="01 / Intake"
        title="Add captures"
        action={
          <div className="capture-actions">
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}><Upload size={14} /> Upload files</Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Paste an image from your clipboard to add it")}><ClipboardPaste size={14} /> Paste image</Button>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => addFiles(event.target.files)} />
          </div>
        }
      />
      <label className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}>
        <div className="drop-icon"><CloudUpload size={20} /></div>
        <strong>Drop screenshots here</strong>
        <span>PNG, JPG, or WEBP up to 10 MB each</span>
        <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}>Browse files</Button>
      </label>
      <SectionTitle eyebrow="02 / Queue" title="Upload queue" action={<Badge variant="secondary">{queue.length} files</Badge>} />
      <Card className="queue-card">
        <CardContent className="p-0">
          {queue.map((item) => (
            <div className="queue-row" key={item.id}>
              <div className="file-thumb"><ImagePlus size={16} /></div>
              <div className="file-info">
                <strong>{item.name}</strong><span>{item.size} · {scenario} / {item.target}</span>
                <div className="progress-track"><div style={{ width: `${item.progress}%` }} /></div>
              </div>
              {item.status === "success" ? <StatusPill tone="match">Uploaded</StatusPill> : <span className="progress-label">{item.progress}%</span>}
              <button className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => setQueue(queue.filter((file) => file.id !== item.id))}><X size={15} /></button>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
