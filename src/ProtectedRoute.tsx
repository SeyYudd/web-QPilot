// src/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { AUTH_STORAGE_KEY } from "@/pages/Login"

function isAuthenticated() {
  return Boolean(
    window.localStorage.getItem(AUTH_STORAGE_KEY) || 
    window.sessionStorage.getItem(AUTH_STORAGE_KEY)
  )
}

export function ProtectedRoute() {
  const location = useLocation()
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}

export function PublicRoute() {
  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export function RootRedirect() {
  return <Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />
}