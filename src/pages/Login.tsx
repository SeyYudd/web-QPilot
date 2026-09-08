import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

import { loadSession, saveSession, clearSession, touchLastValidated } from "@/lib/auth/session"
import { validateSession } from "@/lib/auth/validation"

export default function Login() {
  const navigate = useNavigate()
  const [jiraToken, setJiraToken] = useState("")
  const [confluenceToken, setConfluenceToken] = useState("")
  const [showJiraToken, setShowJiraToken] = useState(false)
  const [showConfluenceToken, setShowConfluenceToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pnMismatch, setPnMismatch] = useState<{ jiraPn: string; confPn: string } | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!jiraToken.trim() || !confluenceToken.trim()) {
      toast.error("Silakan isi Personal Access Token Jira dan Confluence")
      return
    }
    setLoading(true)
    // Simpan session ke localStorage (Step 1), lalu validasi di background (Step 2).
    saveSession({
      pn: "",
      displayName: "",
      username: "",
      emailAddress: "",
      jiraPat: jiraToken.trim(),
      confluencePat: confluenceToken.trim(),
      lastValidated: new Date().toISOString(),
    })
    const session = loadSession()
    if (!session) {
      setLoading(false)
      toast.error("Gagal menyimpan session. Coba lagi.")
      return
    }
    const result = await validateSession(session)
    setLoading(false)

    if (result.outcome === "authenticated") {
      toast.success("Kredensial berhasil diverifikasi!")
      navigate("/dashboard", { replace: true })
    } else if (result.outcome === "pnMismatch") {
      setPnMismatch({ jiraPn: result.jiraPn, confPn: result.confluencePn })
    } else if (result.outcome === "expired") {
      clearSession()
      toast.error("Session habis, silakan masukkan PAT baru.")
} else if (result.outcome === "cors") {
      clearSession()
      toast.error(
        "Validasi token gagal: browser diblokir CORS oleh Jira/Confluence. " +
          "Origin aplikasi ini perlu di-allowlist di server, atau akses via proxy/extension.",
      )
    } else if (result.outcome === "network") {
      toast.warning("Tidak dapat memvalidasi token (jaringan internal BRI tidak terhubung). Pastikan VPN aktif.")
      navigate("/dashboard", { replace: true })
    } else {
      clearSession()
      toast.error(result.detail || "Validasi token gagal. Periksa kembali PAT Anda.")
    }
  }

  const proceedWithMismatch = () => {
    const session = loadSession()
    if (session) touchLastValidated(session)
    setPnMismatch(null)
    toast.success("Kredensial berhasil diverifikasi!")
    navigate("/dashboard", { replace: true })
  }
  const rejectMismatch = () => {
    setPnMismatch(null)
    clearSession()
  }

  return (
    <main className="min-h-screen w-full bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* Left Side - Typography Branding */}
        <div className="space-y-4 text-ink pr-0 md:pr-8">
          <h1 className="font-serif text-4xl lg:text-5xl font-normal leading-tight tracking-tight max-w-[450px]">
            Tempat buat bikin sama Upload Jira dan Confluence
          </h1>
        </div>

        {/* Right Side - Floating Auth Card */}
        <div className="bg-card p-8 md:p-10 rounded-[28px] shadow-panel border border-line">
          <div className="mb-8">
            <span className="text-[13px] font-medium text-muted-foreground">Get Started</span>
            <h2 className="font-serif text-2xl text-ink mt-1">Connect your tools</h2>
            <hr className="mt-4 border-line" />
          </div>

          <form onSubmit={submit} className="space-y-6">
            {/* Jira Field */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground block">Jira</label>
              <div className="relative">
                <Input
                  type={showJiraToken ? "text" : "password"}
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                  placeholder="Personal Access Token"
                  className="rounded-full py-5 px-5 text-sm bg-card border-line focus-visible:border-brand focus-visible:ring-brand/25 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowJiraToken(!showJiraToken)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showJiraToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <hr className="border-slate-100 w-1/2 mx-auto my-2" />

            {/* Confluence Field */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground block">Confluence</label>
              <div className="relative">
                <Input
                  type={showConfluenceToken ? "text" : "password"}
                  value={confluenceToken}
                  onChange={(e) => setConfluenceToken(e.target.value)}
                  placeholder="Personal Access Token"
                  className="rounded-full py-5 px-5 text-sm bg-card border-line focus-visible:border-brand focus-visible:ring-brand/25 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfluenceToken(!showConfluenceToken)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfluenceToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 text-center">
              <Button
                type="submit"
                disabled={loading}
                variant="link"
                className="font-serif text-xl text-ink hover:text-brand underline underline-offset-8 transition-colors p-0 h-auto"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="animate-spin" size={18} /> Connecting...
                  </span>
                ) : (
                  "Enter Workspace"
                )}
              </Button>
            </div>
          </form>
        </div>

      </div>

      <ConfirmDialog
        open={Boolean(pnMismatch)}
        title="Perbedaan PN Jira & Confluence"
        description={`PN Jira (${pnMismatch?.jiraPn}) tidak sama dengan PN Confluence (${pnMismatch?.confPn}). Apakah ingin tetap lanjut?`}
        onClose={rejectMismatch}
        onConfirm={proceedWithMismatch}
      />
    </main>
  )
}