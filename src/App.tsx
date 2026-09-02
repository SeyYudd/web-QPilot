import { useEffect, useRef, useState } from "react"
import { toast, Toaster } from "sonner"
import { ArrowLeft, ArrowUpRight, Box, Check, ChevronRight, Circle, Download, FileImage, FolderOpen, ImagePlus, LogOut, Menu, MonitorUp, MoreHorizontal, Plus, Redo2, Save, Search, Settings2, ShieldCheck, Sparkles, Undo2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { db, seedWorkspace, clearWorkspace } from "@/infrastructure/storage/db"
import { clearCredentials, loadCredentials, saveCredentials } from "@/infrastructure/storage/credentials"
import { createConfluencePage, searchJira, testConnection, updateJiraStatus, uploadJiraAttachment } from "@/infrastructure/api/atlassian"
import { drawAnnotation, naturalPoint } from "@/domain/canvas"
import type { CanvasAnnotation, Screenshot, ServiceCredentials, StoredCredentials, TestStep, TestSuite } from "@/domain/types"
import "./App.css"

const JIRA_BASE_URL = "https://jira.bri.co.id"
const CONFLUENCE_BASE_URL = "https://confluence.bri.co.id"

const blankService: ServiceCredentials = { baseUrl: "", email: "", pat: "", authScheme: "basic" }

function App() {
  const [credentials, setCredentials] = useState<StoredCredentials | null>(loadCredentials())
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(loadCredentials()))
  const [view, setView] = useState(window.location.hash.startsWith("#/editor/") ? "editor" : "workspace")
  const [navItem, setNavItem] = useState("create-sit-page")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingId, setEditingId] = useState(window.location.hash.split("/")[2] ?? "")
  const [setupOpen, setSetupOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [steps, setSteps] = useState<TestStep[]>([])
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])

  async function refresh() {
    await seedWorkspace()
    const all = await db.suites.orderBy("updatedAt").reverse().toArray()
    const selected = suite ? all.find((item) => item.id === suite.id) ?? all[0] : all[0]
    setSuites(all)
    setSuite(selected ?? null)
    if (selected?.id) {
      setSteps(await db.steps.where("suiteId").equals(selected.id).sortBy("position"))
      setScreenshots(await db.screenshots.where("suiteId").equals(selected.id).sortBy("position"))
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
    // refresh is intentionally initialized once; later mutations call it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onHash = () => {
      const editor = window.location.hash.startsWith("#/editor/")
      setView(window.location.hash === "#/setup" ? "setup" : editor ? "editor" : "workspace")
      setEditingId(window.location.hash.split("/")[2] ?? "")
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  function selectSuite(next: TestSuite) {
    setSuite(next)
    void refresh()
  }

  async function addSuite() {
    const now = Date.now()
    const item: TestSuite = { id: crypto.randomUUID(), name: "New test suite", description: "Add a clear description for this test flow.", createdAt: now, updatedAt: now }
    await db.suites.add(item)
    await refresh()
    toast.success("Suite created")
  }

  async function addStep() {
    if (!suite?.id) return
    const step: TestStep = { id: crypto.randomUUID(), suiteId: suite.id, position: steps.length, action: "New test action", testData: "", expectedResult: "Expected result", status: "not-run" }
    await db.steps.add(step)
    await refresh()
  }

  async function ingest(blob: Blob, source: Screenshot["source"], filename = "capture.png"): Promise<void> {
    if (!suite?.id || !blob.type.startsWith("image/")) { toast.error("Please choose an image file."); return }
    const image = new Image()
    const url = URL.createObjectURL(blob)
    image.onload = async () => {
      const now = Date.now()
      await db.screenshots.add({ id: crypto.randomUUID(), suiteId: suite.id, originalBlob: blob, mimeType: blob.type, filename, source, annotations: [], width: image.naturalWidth, height: image.naturalHeight, position: screenshots.length, createdAt: now, updatedAt: now })
      URL.revokeObjectURL(url)
      await refresh()
      toast.success("Screenshot added to the evidence queue")
    }
    image.src = url
  }

  function logout() {
    setCredentials(null)
    setIsAuthenticated(false)
    clearCredentials()
    setSetupOpen(false)
    window.location.hash = "#/setup"
    toast.success("Signed out")
  }

  if (!isAuthenticated || view === "setup") return <SetupPage initial={credentials} onSaved={(next) => { setCredentials(next); setIsAuthenticated(true); window.location.hash = "#/workspace" }} />
  if (view === "editor" && editingId) return <Editor id={editingId} onBack={() => { window.location.hash = "#/workspace" }} />

  return (
    <div className="app-shell">
      <Toaster position="bottom-right" />
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><div><strong>SIT Generator</strong><span>Evidence workspace</span></div></div>
        <div className="top-actions"><Badge variant="outline" className="connection"><span className="status-dot" /> Local workspace</Badge><Button variant="ghost" size="icon" aria-label="Open settings" onClick={() => setSetupOpen(true)}><Settings2 size={17} /></Button><Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout}><LogOut size={17} /></Button></div>
      </header>
      <div className={`workspace-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-head"><div className="qpilot-brand"><div className="qpilot-mark"><Box size={18} /></div><div className="sidebar-label"><strong>QPilot</strong><span>Where Confluence and Jira<br />More ease</span></div></div><Button variant="ghost" size="icon-sm" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><Menu size={16} /></Button></div>
          <nav className="main-nav" aria-label="Main navigation">{[{ id: "create-tmp-iso", label: "Create TMP/ISO" }, { id: "create-sit-page", label: "Create SIT Page" }, { id: "check-sync-te", label: "Check & Sync TE" }, { id: "upload-capture", label: "Upload Capture" }, { id: "import-test-case", label: "Import Test Case" }].map((item) => <button key={item.id} className={`nav-item ${navItem === item.id ? "active" : ""}`} onClick={() => setNavItem(item.id)} title={sidebarCollapsed ? item.label : undefined}><Box size={16} /><span className="sidebar-label">{item.label}</span></button>)}</nav>
          <div className="sidebar-divider" /><div className="sidebar-section-label sidebar-label">Your suites <Button size="icon-xs" variant="ghost" aria-label="Create suite" onClick={() => void addSuite()}><Plus size={13} /></Button></div><div className="suite-list sidebar-label">{suites.map((item) => <button key={item.id} className={`suite-item ${suite?.id === item.id ? "active" : ""}`} onClick={() => selectSuite(item)}><div className="suite-icon"><FolderOpen size={15} /></div><div className="suite-copy"><strong>{item.name}</strong><span>{item.projectKey ?? "Local draft"}</span></div><ChevronRight size={14} /></button>)}</div>
          <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={16} /><div><strong>Private by default</strong><span>Your evidence stays in this browser until you export it.</span></div></div><button className="clear-link" onClick={() => { if (confirm("Delete all local suites, steps, and screenshots?")) { void clearWorkspace().then(refresh) } }}>Clear local data</button></div>
        </aside>
        <main className="main-content">
          {navItem === "create-sit-page" ? <CreateSitPage suite={suite} steps={steps} onLoad={() => toast.success("Test cases loaded")}/> : <PlaceholderView label={["Create TMP/ISO", "Check & Sync TE", "Upload Capture", "Import Test Case"].find((label) => label.toLowerCase().replaceAll(" ", "-") === navItem) ?? "Workspace"} />}
          {navItem === "create-sit-page" && <>
          <div className="legacy-workspace-actions"><Button variant="outline" onClick={() => setExportOpen(true)}><ArrowUpRight size={16} /> Export</Button><Button onClick={() => void addStep()}><Plus size={16} /> Add step</Button></div>
          <div className="stats-row"><div><span>Steps</span><strong>{steps.length.toString().padStart(2, "0")}</strong></div><div><span>Evidence</span><strong>{screenshots.length.toString().padStart(2, "0")}</strong></div><div><span>Completion</span><strong>{steps.length ? `${Math.round(steps.filter((item) => item.status === "passed").length / steps.length * 100)}%` : "--"}</strong></div><div className="sync-state"><span className="status-dot" /> Saved locally</div></div>
          <section className="content-section"><div className="section-heading"><div><p className="eyebrow">01 / Test definition</p><h2>Test steps</h2></div><Button variant="ghost" size="sm" onClick={() => void addStep()}>Add another <Plus size={14} /></Button></div><Card className="steps-card"><CardContent className="p-0"><div className="table-head"><span className="step-number">#</span><span>Action & test data</span><span>Expected result</span><span>Status</span><span /></div>{steps.map((step, index) => <StepRow key={step.id} step={step} index={index} onChange={async (status) => { await db.steps.update(step.id!, { status }); await refresh() }} />)}{!steps.length && <div className="empty-state">No steps yet. Add a step to start your test definition.</div>}</CardContent></Card></section>
          <section className="content-section evidence-section"><div className="section-heading"><div><p className="eyebrow">02 / Visual evidence</p><h2>Screenshot queue <Badge variant="secondary">{screenshots.length}</Badge></h2></div><CaptureActions onCapture={ingest} /></div><div className="capture-grid"><label className="dropzone"><input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void ingest(file, "upload", file.name) }} /><div className="drop-icon"><Upload size={19} /></div><strong>Drop screenshots here</strong><span>or browse from your device</span></label>{screenshots.map((item) => <ScreenshotCard key={item.id} item={item} />)}</div></section>
          </>}
        </main>
      </div>
      {setupOpen && <SetupDialog initial={credentials} onClose={() => setSetupOpen(false)} onSaved={(next) => { setCredentials(next); setIsAuthenticated(true); setSetupOpen(false) }} />}
      {exportOpen && <ExportDialog credentials={credentials} suite={suite} steps={steps} screenshots={screenshots} onClose={() => setExportOpen(false)} />}
    </div>
  )
}

function StepRow({ step, index, onChange }: { step: TestStep; index: number; onChange: (status: TestStep["status"]) => Promise<void> }) {
  return <div className="step-row"><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{step.action}</strong><span>{step.testData || "No test data specified"}</span></div><span className="expected">{step.expectedResult}</span><select className={`status-select ${step.status}`} value={step.status} onChange={(event) => void onChange(event.target.value as TestStep["status"])}><option value="not-run">Not run</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select><Button variant="ghost" size="icon-sm" aria-label="More step actions"><MoreHorizontal size={16} /></Button></div>
}

function CreateSitPage({ suite, steps, onLoad }: { suite: TestSuite | null; steps: TestStep[]; onLoad: () => void }) {
  const [form, setForm] = useState({ space: "", parent: "", execution: "", name: suite?.name ?? "" })
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="sit-page"><div className="sit-page-heading"><div><p className="eyebrow">QPilot / Document builder</p><h1>Create SIT Page <span>|</span> <small>Create Confluence SIT Document</small></h1></div><Badge variant="outline"><span className="status-dot" /> Draft mode</Badge></div><div className="sit-columns"><Card className="sit-form-card"><CardHeader><CardTitle>Document details</CardTitle><CardDescription>Connect this SIT report to its Confluence home and Jira execution.</CardDescription></CardHeader><CardContent><label className="field-label">Space Key Confluence<Input placeholder="Enter space key" value={form.space} onChange={(event) => update("space", event.target.value)} /></label><label className="field-label">Parent Page ID<Input placeholder="Enter parent page id" value={form.parent} onChange={(event) => update("parent", event.target.value)} /></label><label className="field-label">Jira Test Execution Key<Input placeholder="Enter test execution key" value={form.execution} onChange={(event) => update("execution", event.target.value)} /></label><label className="field-label uppercase-label">SIT PAGE NAME<Input placeholder="Enter SIT page name" value={form.name} onChange={(event) => update("name", event.target.value)} /></label><div className="sit-form-actions"><Button onClick={onLoad}><Search size={15} /> Load Test Cases</Button><Button variant="outline"><Download size={15} /> Download + Sample</Button><Button className="generate-button"><Sparkles size={15} /> Generate SIT PAGE</Button></div></CardContent></Card><Card className="sit-preview-card"><CardHeader><div className="coverage-row"><div><CardDescription>Total coverage</CardDescription><strong>100</strong></div><div className="empty-status"><span /> Empty</div></div></CardHeader><CardContent><div className="preview-toolbar"><div><p className="eyebrow">Confluence preview</p><h2>Tampilan SIT Page</h2></div><div className="preview-actions"><Button variant="outline" size="sm">Expand</Button><Button variant="ghost" size="sm">Without Expand</Button><Button variant="outline" size="sm"><Plus size={14} /> Add TC</Button></div></div><div className="test-table-wrap"><table className="test-table"><thead><tr>{["No", "JIRA TICKET", "SCENARIO", "FUNCTION", "STEPS", "DATA", "EXPECTED", "RESULT", "ACTION"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{steps.length ? steps.map((step, index) => <tr key={step.id}><td>{index + 1}</td><td>{form.execution || "SIT-—"}</td><td>{step.action}</td><td>Functional</td><td>1</td><td>{step.testData || "—"}</td><td>{step.expectedResult}</td><td>{step.status}</td><td><Button variant="ghost" size="icon-sm" aria-label="Remove test case"><X size={14} /></Button></td></tr>) : <tr><td colSpan={9}><div className="table-empty"><Box size={24} /><strong>Clean container ready</strong><span>Load test cases to populate the SIT document.</span></div></td></tr>}</tbody></table></div></CardContent></Card></div></div>
}

function PlaceholderView({ label }: { label: string }) {
  return <div className="placeholder-view"><div className="placeholder-icon"><Box size={26} /></div><p className="eyebrow">QPilot module</p><h1>{label}</h1><p>This workspace is ready for the next workflow implementation.</p></div>
}

function CaptureActions({ onCapture }: { onCapture: (blob: Blob, source: Screenshot["source"], filename?: string) => Promise<void> | void }) {
  const input = useRef<HTMLInputElement>(null)
  async function screenCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const video = document.createElement("video")
      video.srcObject = stream
      await video.play()
      await new Promise((resolve) => setTimeout(resolve, 200))
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext("2d")?.drawImage(video, 0, 0)
      stream.getTracks().forEach((track) => track.stop())
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (blob) await onCapture(blob, "screen-capture", "screen-capture.png")
    } catch { toast.error("Screen capture was cancelled or unavailable") }
  }
  return <div className="capture-actions"><input ref={input} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void onCapture(file, "upload", file.name) }} /><Button variant="outline" size="sm" onClick={() => input.current?.click()}><ImagePlus size={15} /> Upload</Button><Button variant="outline" size="sm" onClick={() => void screenCapture()}><MonitorUp size={15} /> Capture screen</Button></div>
}

function ScreenshotCard({ item }: { item: Screenshot }) {
  const [src] = useState(() => URL.createObjectURL(item.editedBlob ?? item.originalBlob))
  useEffect(() => () => URL.revokeObjectURL(src), [src])
  return <button className="screenshot-card" onClick={() => { window.location.hash = `#/editor/${item.id}` }}><div className="screenshot-image">{src && <img src={src} alt={item.filename ?? "Screenshot evidence"} />}<span className="image-label">{item.mimeType.split("/")[1]?.toUpperCase()}</span></div><div className="screenshot-meta"><div><strong>{item.filename ?? "Untitled capture"}</strong><span>{item.width} × {item.height} px</span></div><ArrowUpRight size={15} /></div></button>
}

function SetupDialog({ initial, onClose, onSaved }: { initial: StoredCredentials | null; onClose: () => void; onSaved: (credentials: StoredCredentials) => void }) {
  const [jira, setJira] = useState<ServiceCredentials>(initial?.jira ?? blankService)
  const [confluence, setConfluence] = useState<ServiceCredentials>(initial?.confluence ?? blankService)
  const [remember, setRemember] = useState(initial?.remember ?? false)
  const [loading, setLoading] = useState<"jira" | "confluence" | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})
  async function test(service: "jira" | "confluence") {
    const target = service === "jira" ? jira : confluence
    if (!target.baseUrl || !target.email || !target.pat) return toast.error(`Complete the ${service} credentials first`)
    setLoading(service)
    try { const result = await testConnection(service, target); setResults((current) => ({ ...current, [service]: result.displayName ?? result.display_name ?? "Connected" })); toast.success(`${service} connected`) } catch (error) { toast.error(error instanceof Error ? error.message : "Connection failed") } finally { setLoading(null) }
  }
  function save() {
    if (!jira.baseUrl && !confluence.baseUrl) return toast.error("Configure at least one Atlassian service")
    const next: StoredCredentials = { version: 1, remember, jira, confluence }
    saveCredentials(next)
    onSaved(next)
  }
  return <div className="dialog-backdrop"><Card className="setup-dialog"><CardHeader><div className="dialog-title-row"><div><p className="eyebrow">Workspace access</p><CardTitle>Connect your Atlassian tools</CardTitle><CardDescription>Tokens stay in this browser and are sent only to the service you choose.</CardDescription></div><Button variant="ghost" size="icon" aria-label="Close setup" onClick={onClose}><X size={18} /></Button></div></CardHeader><CardContent><ServiceForm title="Jira" service={jira} setService={setJira} result={results.jira} loading={loading === "jira"} onTest={() => void test("jira")} /><ServiceForm title="Confluence" service={confluence} setService={setConfluence} result={results.confluence} loading={loading === "confluence"} onTest={() => void test("confluence")} /><label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><strong>Remember credentials</strong><small>Stored in localStorage. Do not use on shared devices.</small></span></label><div className="dialog-footer"><Button variant="ghost" onClick={() => { clearCredentials(); onClose() }}>Clear saved credentials</Button><Button onClick={save}><Check size={15} /> Save connection</Button></div></CardContent></Card></div>
}

function ServiceForm({ title, service, setService, result, loading, onTest }: { title: string; service: ServiceCredentials; setService: (value: ServiceCredentials) => void; result?: string; loading: boolean; onTest: () => void }) {
  return <div className="service-form"><div className="service-heading"><div><strong>{title}</strong><span>{title === "Jira" ? "Issue tracking and evidence" : "Test documentation"}</span></div>{result ? <Badge className="success-badge"><Check size={12} /> {result}</Badge> : <Badge variant="outline">Not connected</Badge>}</div><div className="form-grid"><Input placeholder={`${title} base URL`} value={service.baseUrl} onChange={(event) => setService({ ...service, baseUrl: event.target.value })} /><Input placeholder="Email or username" value={service.email} onChange={(event) => setService({ ...service, email: event.target.value })} /><Input placeholder="Personal access token" type="password" value={service.pat} onChange={(event) => setService({ ...service, pat: event.target.value })} /><select value={service.authScheme} onChange={(event) => setService({ ...service, authScheme: event.target.value as ServiceCredentials["authScheme"] })}><option value="basic">Basic · email + PAT</option><option value="bearer">Bearer · PAT</option></select></div><Button variant="outline" size="sm" onClick={onTest} disabled={loading}>{loading ? "Testing…" : `Test ${title}`}</Button></div>
}

function SetupPage({ initial, onSaved }: { initial: StoredCredentials | null; onSaved: (credentials: StoredCredentials) => void }) {
  const [jiraPat, setJiraPat] = useState(initial?.jira.pat ?? "")
  const [confluencePat, setConfluencePat] = useState(initial?.confluence.pat ?? "")
  const [remember, setRemember] = useState(initial?.remember ?? false)
  function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: StoredCredentials = {
      version: 1,
      remember,
      jira: { baseUrl: JIRA_BASE_URL, email: "", pat: jiraPat, authScheme: "basic" },
      confluence: { baseUrl: CONFLUENCE_BASE_URL, email: "", pat: confluencePat, authScheme: "basic" },
    }
    saveCredentials(next)
    onSaved(next)
  }
  return <div className="setup-page"><div className="setup-page-brand"><div className="brand-mark"><Sparkles size={16} /></div><strong>SIT Generator</strong></div><div className="setup-page-layout"><div className="setup-intro"><span className="tagline-badge"><span className="status-dot" />Private QA workspace</span><h1>Turn test runs into evidence your team can trust.</h1><p>Capture screenshots, annotate the important details, and publish a clean record to Atlassian when you are ready.</p><div className="setup-points"><div><span>01</span><strong>Capture locally</strong><small>Drafts and screenshots stay in your browser.</small></div><div><span>02</span><strong>Annotate clearly</strong><small>Call out failures with a fast image editor.</small></div><div><span>03</span><strong>Publish deliberately</strong><small>Send only selected evidence to Jira or Confluence.</small></div></div></div><form className="setup-card" onSubmit={submit}><div className="setup-card-header"><h2>Get Started</h2><p>Connect your tools</p></div><div className="service-form"><div className="service-heading"><div><strong>Jira</strong><span>{JIRA_BASE_URL}</span></div></div><div className="form-grid"><Input type="password" placeholder="Personal Access Token" value={jiraPat} onChange={(event) => setJiraPat(event.target.value)} /></div></div><div className="service-form"><div className="service-heading"><div><strong>Confluence</strong><span>{CONFLUENCE_BASE_URL}</span></div></div><div className="form-grid"><Input type="password" placeholder="Personal Access Token" value={confluencePat} onChange={(event) => setConfluencePat(event.target.value)} /></div></div><label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><strong>Remember Credentials</strong><small>Stored in localStorage.</small></span></label><Button type="submit" className="setup-submit">Enter Workspace <ArrowUpRight size={15} /></Button><p className="setup-footnote"><ShieldCheck size={13} /> No application server. Direct browser connections only.</p></form></div></div>
}

function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [item, setItem] = useState<Screenshot | null>(null)
  const [tool, setTool] = useState<CanvasAnnotation["type"]>("arrow")
  const [color, setColor] = useState("#f04438")
  const [history, setHistory] = useState<CanvasAnnotation[][]>([])
  const [future, setFuture] = useState<CanvasAnnotation[][]>([])
  const drawing = useRef<CanvasAnnotation | null>(null)
  useEffect(() => { void db.screenshots.get(id).then((next) => { if (next) { setItem(next); setHistory([next.annotations]); } }) }, [id])
  useEffect(() => {
    if (!item || !canvasRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return
    const url = URL.createObjectURL(item.editedBlob ?? item.originalBlob)
    const image = new Image()
    image.onload = () => { canvas.width = item.width; canvas.height = item.height; context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); item.annotations.forEach((annotation) => drawAnnotation(context, annotation)); URL.revokeObjectURL(url) }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [item])
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!item || !canvasRef.current) return
    canvasRef.current.setPointerCapture(event.pointerId)
    const point = naturalPoint(event.nativeEvent, canvasRef.current, item.width, item.height)
    drawing.current = tool === "freehand" ? { id: crypto.randomUUID(), type: tool, points: [point], color, strokeWidth: 5 } : { id: crypto.randomUUID(), type: tool, x: point.x, y: point.y, points: [point], color, strokeWidth: 5 }
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !item || !canvasRef.current) return
    const point = naturalPoint(event.nativeEvent, canvasRef.current, item.width, item.height)
    if (drawing.current.type === "freehand") drawing.current.points = [...(drawing.current.points ?? []), point]
    else { drawing.current.width = point.x - (drawing.current.x ?? 0); drawing.current.height = point.y - (drawing.current.y ?? 0); drawing.current.points = [(drawing.current.points ?? [])[0], point] }
    setItem({ ...item })
  }
  function end() { if (!drawing.current || !item) return; const next = [...item.annotations, drawing.current]; setHistory([...history, next].slice(-30)); setFuture([]); setItem({ ...item, annotations: next }); drawing.current = null }
  async function save() {
    if (!item || !canvasRef.current) return
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png"))
    await db.screenshots.update(id, { annotations: item.annotations, editedBlob: blob ?? undefined, updatedAt: Date.now() })
    toast.success("Annotation saved locally")
  }
  function download() { if (!canvasRef.current) return; canvasRef.current.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${item?.filename ?? "evidence"}.png`; link.click(); URL.revokeObjectURL(url) }, "image/png") }
  function undo() { if (!item || history.length < 2) return; const current = history[history.length - 1]; const previous = history[history.length - 2]; setFuture([current, ...future]); setHistory(history.slice(0, -1)); setItem({ ...item, annotations: previous }) }
  function redo() { if (!item || !future.length) return; const next = future[0]; setHistory([...history, next]); setFuture(future.slice(1)); setItem({ ...item, annotations: next }) }
  if (!item) return <div className="loading-screen">Loading editor…</div>
  return <div className="editor-shell"><header className="topbar editor-topbar"><Button variant="ghost" onClick={onBack}><ArrowLeft size={17} /> Back to workspace</Button><div className="editor-file"><FileImage size={16} /><strong>{item.filename ?? "Untitled capture"}</strong><span>{item.width} × {item.height}</span></div><div className="top-actions"><Button variant="outline" onClick={download}><Download size={15} /> Download</Button><Button onClick={() => void save()}><Save size={15} /> Save changes</Button></div></header><div className="editor-body"><aside className="editor-tools"><p className="eyebrow">Tools</p>{(["arrow", "freehand", "rectangle", "ellipse", "line", "text", "blur"] as CanvasAnnotation["type"][]).map((name) => <Button key={name} variant={tool === name ? "secondary" : "ghost"} className="tool-button" onClick={() => setTool(name)}><Circle size={14} /> {name}</Button>)}<div className="tool-divider" /><label className="color-picker"><span>Stroke</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><div className="history-buttons"><Button variant="outline" size="icon" aria-label="Undo" onClick={undo} disabled={history.length < 2}><Undo2 size={16} /></Button><Button variant="outline" size="icon" aria-label="Redo" onClick={redo} disabled={!future.length}><Redo2 size={16} /></Button></div></aside><main className="canvas-stage"><div className="canvas-frame"><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /></div><div className="canvas-hint">{tool === "arrow" ? "Drag across the image to point out a detail" : `Draw with ${tool}`}</div></main></div></div>
}

function ExportDialog({ credentials, suite, steps, screenshots, onClose }: { credentials: StoredCredentials | null; suite: TestSuite | null; steps: TestStep[]; screenshots: Screenshot[]; onClose: () => void }) {
  const [tab, setTab] = useState<"jira" | "confluence">("jira")
  const [issue, setIssue] = useState("")
  const [query, setQuery] = useState("")
  const [title, setTitle] = useState(suite?.name ?? "Test evidence")
  const [space, setSpace] = useState("")
  const [busy, setBusy] = useState(false)
  async function jiraSearch() { if (!credentials?.jira.baseUrl) return toast.error("Connect Jira first"); try { const result = await searchJira(credentials.jira, query || "project = SIT"); const first = result.issues?.[0]; if (first) { setIssue(first.key); toast.success(`${first.key}: ${first.fields?.summary ?? "Issue found"}`) } else toast.error("No Jira issues found") } catch (error) { toast.error(error instanceof Error ? error.message : "Jira search failed") } }
  async function publishJira() { if (!credentials?.jira.baseUrl || !issue) return toast.error("Select a Jira issue first"); setBusy(true); try { await updateJiraStatus(credentials.jira, issue, "passed"); for (const screenshot of screenshots) await uploadJiraAttachment(credentials.jira, issue, screenshot.editedBlob ?? screenshot.originalBlob, screenshot.filename ?? "evidence.png"); toast.success("Jira status and evidence updated") } catch (error) { toast.error(error instanceof Error ? error.message : "Jira export failed") } finally { setBusy(false) } }
  async function publishConfluence() { if (!credentials?.confluence.baseUrl || !space) return toast.error("Enter a Confluence space ID first"); setBusy(true); try { const body = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(suite?.description ?? "Test evidence")}</p><table><tbody>${steps.map((step) => `<tr><td>${escapeHtml(step.action)}</td><td>${escapeHtml(step.expectedResult)}</td><td>${escapeHtml(step.status)}</td></tr>`).join("")}</tbody></table>`; await createConfluencePage(credentials.confluence, space, title, body); toast.success("Confluence page created") } catch (error) { toast.error(error instanceof Error ? error.message : "Confluence export failed") } finally { setBusy(false) } }
  return <div className="dialog-backdrop"><Card className="export-dialog"><CardHeader><div className="dialog-title-row"><div><p className="eyebrow">Publish evidence</p><CardTitle>Export test documentation</CardTitle><CardDescription>Preview locally, then choose exactly where to send it.</CardDescription></div><Button variant="ghost" size="icon" aria-label="Close export" onClick={onClose}><X size={18} /></Button></div><div className="export-tabs"><button className={tab === "jira" ? "active" : ""} onClick={() => setTab("jira")}>Jira <span>01</span></button><button className={tab === "confluence" ? "active" : ""} onClick={() => setTab("confluence")}>Confluence <span>02</span></button></div></CardHeader><CardContent>{tab === "jira" ? <div className="export-panel"><div className="export-icon jira-icon">J</div><h3>Update Jira issue</h3><p>Attach {screenshots.length} screenshot{screenshots.length === 1 ? "" : "s"} and mark the test as passed.</p><div className="export-input-row"><Input placeholder="Search by JQL, e.g. project = SIT" value={query} onChange={(event) => setQuery(event.target.value)} /><Button variant="outline" onClick={() => void jiraSearch()}><Search size={15} /> Find issue</Button></div><Input placeholder="Selected issue key, e.g. SIT-42" value={issue} onChange={(event) => setIssue(event.target.value)} /><div className="publish-summary"><span><Check size={14} /> Status transition: Passed</span><span><FileImage size={14} /> {screenshots.length} attachment{screenshots.length === 1 ? "" : "s"}</span></div><Button className="publish-button" onClick={() => void publishJira()} disabled={busy}>{busy ? "Publishing…" : "Update Jira and attach evidence"} <ArrowUpRight size={15} /></Button></div> : <div className="export-panel"><div className="export-icon confluence-icon">C</div><h3>Create Confluence page</h3><p>Generate a clean test report using the local suite and step data.</p><Input placeholder="Confluence space ID" value={space} onChange={(event) => setSpace(event.target.value)} /><Input placeholder="Page title" value={title} onChange={(event) => setTitle(event.target.value)} /><div className="html-preview"><div className="preview-label">Storage format preview</div><h4>{title || "Test evidence"}</h4><p>{suite?.description}</p><div className="preview-table">{steps.map((step) => <div key={step.id}><span>{step.action}</span><Badge variant="outline">{step.status}</Badge></div>)}</div></div><Button className="publish-button" onClick={() => void publishConfluence()} disabled={busy}>{busy ? "Publishing…" : "Create Confluence page"} <ArrowUpRight size={15} /></Button></div>}</CardContent></Card></div>
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character) }

export default App
