import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import { ProtectedRoute, PublicRoute, RootRedirect } from "@/ProtectedRoute"

export default function AppRouter() {
  return <BrowserRouter><Toaster position="bottom-right" toastOptions={{ className: "app-toast" }} /><Routes>
    <Route element={<PublicRoute />}><Route path="/login" element={<Login />} /></Route>
    <Route element={<ProtectedRoute />}><Route path="/dashboard/*" element={<Dashboard />} /></Route>
    <Route path="*" element={<RootRedirect />} />
  </Routes></BrowserRouter>
}
