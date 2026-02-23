import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CloudUpload, Loader2, LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

function AppContent() {
  const { user, loading, logout, encryptionLocked } = useAuth()
  const [backupConfigured, setBackupConfigured] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")

  useEffect(() => {
    if (!user) return
    getBackupStatus()
      .then((s) => setBackupConfigured(s.configured))
      .catch(() => {})
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show unlock dialog before login check — user is authenticated but DB locked
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold md:text-2xl">VFinance</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {backupConfigured && (
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <CloudUpload className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Save to Cloud</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            {user.picture_url ? (
              <img
                src={user.picture_url}
                alt={user.name}
                className="h-7 w-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Desktop tabs */}
          <TabsList className="hidden md:inline-flex">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6">
            <DashboardPage />
          </TabsContent>
          <TabsContent value="holdings" className="mt-6">
            <HoldingsPage />
          </TabsContent>
          <TabsContent value="allocations" className="mt-6">
            <AllocationGroupsPage />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryPage />
          </TabsContent>
          <TabsContent value="snapshots" className="mt-6">
            <SnapshotsPage />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsPage />
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile navigation menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>VFinance</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-2">
            {[
              { value: "dashboard", label: "Dashboard" },
              { value: "holdings", label: "Holdings" },
              { value: "allocations", label: "Allocations" },
              { value: "history", label: "History" },
              { value: "snapshots", label: "Snapshots" },
              { value: "settings", label: "Settings" },
            ].map(({ value, label }) => (
              <button
                key={value}
                className={`w-full rounded-md px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activeTab === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => {
                  setActiveTab(value)
                  setMobileMenuOpen(false)
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

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
