import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CloudUpload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPage } from "@/pages/DashboardPage"
import { HoldingsPage } from "@/pages/HoldingsPage"
import { getBackupStatus, uploadBackup } from "@/api/backup"

function App() {
  const [backupConfigured, setBackupConfigured] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    getBackupStatus()
      .then((s) => setBackupConfigured(s.configured))
      .catch(() => {})
  }, [])

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
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">VFinance</h1>
        {backupConfigured && (
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="mr-2 h-4 w-4" />
            )}
            Save to Cloud
          </Button>
        )}
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6">
            <DashboardPage />
          </TabsContent>
          <TabsContent value="holdings" className="mt-6">
            <HoldingsPage />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  )
}

export default App
