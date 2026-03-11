import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Archive,
  Briefcase,
  CloudUpload,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  PieChart,
  Settings,
  Sun,
  TrendingUp,
} from "lucide-react"
import { LogoMark } from "@/components/Logo"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { DashboardPage } from "@/pages/DashboardPage"
import { HoldingsPage } from "@/pages/HoldingsPage"
import { SnapshotsPage } from "@/pages/SnapshotsPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { AllocationGroupsPage } from "@/pages/AllocationGroupsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoginPage } from "@/pages/LoginPage"
import { UnlockDatabaseDialog } from "@/components/UnlockDatabaseDialog"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { getBackupStatus, uploadBackup } from "@/api/backup"

const NAV_ITEMS = [
  { value: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { value: "holdings", label: "Holdings", Icon: Briefcase },
  { value: "allocations", label: "Allocations", Icon: PieChart },
  { value: "history", label: "History", Icon: TrendingUp },
  { value: "snapshots", label: "Snapshots", Icon: Archive },
  { value: "settings", label: "Settings", Icon: Settings },
]

function AppContent() {
  const { user, loading, logout, encryptionLocked } = useAuth()
  const [backupConfigured, setBackupConfigured] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    if (!user) return
    getBackupStatus()
      .then((s) => setBackupConfigured(s.configured))
      .catch(() => {})
  }, [user])

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("vfinance-theme", next ? "dark" : "light")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (encryptionLocked) {
    return <UnlockDatabaseDialog open={true} />
  }

  if (!user) {
    return <LoginPage />
  }

  const handleUpload = async () => {
    setUploading(true)
    try {
      const res = await uploadBackup()
      const kb = (res.size_bytes / 1024).toFixed(1)
      toast.success(`Database saved to cloud (${kb} KB)`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-7xl flex items-center justify-between h-14 px-4 md:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <LogoMark className="h-7 w-7 text-primary" />
            <span className="text-base font-bold tracking-tight">VFinance</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {backupConfigured && (
              <Button
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={handleUpload}
                className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                <span className="hidden md:inline">Backup</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="flex items-center gap-1.5 pl-2 ml-1 border-l">
              {user.picture_url ? (
                <img
                  src={user.picture_url}
                  alt={user.name}
                  className="h-7 w-7 rounded-full ring-2 ring-border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden md:block text-sm text-muted-foreground max-w-[140px] truncate">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={logout}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Desktop navigation ─────────────────────────────────────────── */}
      <div className="hidden md:block sticky top-14 z-40 border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <nav className="flex overflow-x-auto">
            {NAV_ITEMS.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6 pb-24 md:pb-8">
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "holdings" && <HoldingsPage />}
        {activeTab === "allocations" && <AllocationGroupsPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "snapshots" && <SnapshotsPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {/* ── Mobile bottom navigation ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="grid grid-cols-6 h-16">
          {NAV_ITEMS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === value
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${activeTab === value ? "stroke-[2.5]" : ""}`} />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <Toaster />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
