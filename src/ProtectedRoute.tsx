// src/ProtectedRoute.tsx
import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { hasSession, clearSession } from "@/lib/auth/session"
import { validateStoredSession } from "@/lib/auth/validation"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

export function ProtectedRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mismatch, setMismatch] = useState<{ jiraPn: string; confPn: string } | null>(null)

  // Step 1 + Step 2: session ditemukan di localStorage → silent background
  // validation (simultan Jira & Confluence) tanpa memblokir tampilan.
  useEffect(() => {
    if (!hasSession()) return
    let alive = true
    void validateStoredSession().then((result) => {
      if (!alive) return
      if (result.outcome === "expired") {
        // tokenExpiredOrInvalid: 401 → evict session + toast.
        clearSession()
        toast.error("Session habis, silakan masukkan PAT baru.")
        navigate("/login", { replace: true, state: { from: location } })
      } else if (result.outcome === "pnMismatch") {
        setMismatch({ jiraPn: result.jiraPn, confPn: result.confluencePn })
      } else if (result.outcome === "cors") {
        // Browser diblokir lintas-origin oleh server Jira/Confluence.
        toast.error(
          "Tidak dapat memvalidasi session: browser diblokir CORS oleh Jira/Confluence. " +
            "Origin aplikasi ini perlu di-allowlist di server, atau gunakan proxy/extension.",
        )
      } else if (result.outcome === "network") {
        // VPN/internal BRI terputus: biarkan user tetap di workspace, validasi lagi nanti.
        toast.info("Tidak dapat memvalidasi session (jaringan internal BRI tidak terhubung).")
      }
    })
    return () => { alive = false }
  }, [navigate, location])

  if (!hasSession()) return <Navigate to="/login" replace state={{ from: location }} />

  const continueAnyway = () => setMismatch(null)
  const rejectMismatch = () => {
    setMismatch(null)
    clearSession()
    navigate("/login", { replace: true, state: { from: location } })
  }

  return (
    <>
      <Outlet />
      <ConfirmDialog
        open={Boolean(mismatch)}
        title="Perbedaan PN Jira & Confluence"
        description={`PN Jira (${mismatch?.jiraPn}) tidak sama dengan PN Confluence (${mismatch?.confPn}). Apakah ingin tetap lanjut?`}
        onClose={rejectMismatch}
        onConfirm={continueAnyway}
      />
    </>
  )
}

export function PublicRoute() {
  return hasSession() ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export function RootRedirect() {
  return <Navigate to={hasSession() ? "/dashboard" : "/login"} replace />
}