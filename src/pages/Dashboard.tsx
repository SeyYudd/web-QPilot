// src/pages/Dashboard.tsx
import { useState } from "react"
import { toast } from "sonner"
import {
  ChevronRight, FileSpreadsheet, FileText, ImagePlus, LayoutGrid, ListChecks,
  LogOut, Menu, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Step } from "@/components/features/shared"
import '@/assets/styles/app.css'

import TmpIsoPage from "@/components/features/create-tmp-iso/TmpIsoPage"
import CreateSitPage from "@/components/features/create-sit-page/CreateSitPage"
import SyncPage from "@/components/features/check-sync-te/SyncPage"
import UploadPage from "@/components/features/upload-capture/UploadPage"
import ImportPage from "@/components/features/import-test-case/ImportPage"

type ModuleId = "tmp-iso" | "create-sit" | "sync-te" | "upload-capture" | "import-test-case"

const modules: Array<{ id: ModuleId; label: string; icon: typeof LayoutGrid }> = [
  { id: "tmp-iso", label: "Create TMP/ISO", icon: FileText },
  { id: "create-sit", label: "Create SIT Page", icon: ListChecks },
  { id: "sync-te", label: "Check & Sync TE", icon: RefreshCw },
  { id: "upload-capture", label: "Upload Capture", icon: ImagePlus },
  { id: "import-test-case", label: "Import Test Case", icon: FileSpreadsheet },
]

const seedSteps: Step[] = [
  { id: "st-1", action: "Open the storefront", data: "https://store.example.com", expectedResult: "The home page is displayed" },
  { id: "st-2", action: "Search for a product", data: "Wireless keyboard", expectedResult: "Relevant products appear in search results" },
  { id: "st-3", action: "Add an item to the cart", data: "Keyboard · Qty 1", expectedResult: "The cart badge increments to 1" },
]

export default function Dashboard() {
  const [active, setActive] = useState<ModuleId>("create-sit")
  const [collapsed, setCollapsed] = useState(false)
  const [steps, setSteps] = useState<Step[]>(seedSteps)
  const [toastKey, setToastKey] = useState(0)

  function notify(message: string) {
    setToastKey((key) => key + 1)
    toast.success(message)
  }

  return (
    <div className="app-shell">
      <div className={`workspace-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
        <aside className="sidebar">
          <div className="brand">
            <div><strong>Web QPilot</strong><span>Evidence workspace</span></div>
            <Button variant="ghost" size="icon" aria-label="Workspace settings" onClick={() => toast.info("Settings are available after UI approval.")}>
              <LogOut size={17} />
            </Button>
          </div>
          <div className="sidebar-head">
            <Button variant="ghost" size="icon-sm" aria-label="Collapse sidebar" onClick={() => setCollapsed((v) => !v)}>
              <Menu size={16} />
            </Button>
          </div>

          <p className="nav-caption sidebar-label">Workspace</p>
          <nav className="main-nav" aria-label="Main navigation">
            {modules.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${active === id ? "active" : ""}`} onClick={() => setActive(id)} title={collapsed ? label : undefined}>
                <Icon size={16} />
                <span className="sidebar-label">{label}</span>
                {active === id && <span className="nav-active-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-divider" />
        </aside>

        <main className="main-content">
          <PageHeader active={active} />
          <div key={toastKey} className="page-transition">
            {active === "tmp-iso" && <TmpIsoPage onNotify={notify} />}
            {active === "create-sit" && <CreateSitPage steps={steps} setSteps={setSteps} onNotify={notify} />}
            {active === "sync-te" && <SyncPage onNotify={notify} />}
            {active === "upload-capture" && <UploadPage onNotify={notify} />}
            {active === "import-test-case" && <ImportPage onNotify={notify} />}
          </div>
        </main>
      </div>
    </div>
  )
}

function PageHeader({ active }: { active: ModuleId }) {
  const module = modules.find((item) => item.id === active)!
  return (
    <div className="page-heading">
      <div>
        <div className="breadcrumb">
          <span>QPilot</span><ChevronRight size={12} /><span>Workspace</span><ChevronRight size={12} /><strong>{module.label}</strong>
        </div>
        <h1>{module.label}</h1>
        <p>
          {active === "tmp-iso" ? "Set up a clear test plan before execution begins." :
           active === "create-sit" ? "Build a structured SIT document from your test coverage." :
           active === "sync-te" ? "Compare Jira execution order with your Confluence page." :
           active === "upload-capture" ? "Organize visual evidence by scenario and target." :
           "Bring test cases into your workspace with confidence."}
        </p>
      </div>
      <Badge variant="outline" className="draft-badge"><span className="status-dot" /> Draft mode</Badge>
    </div>
  )
}
