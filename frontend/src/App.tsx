import { Toaster } from "@/components/ui/sonner"
import { HoldingsPage } from "@/pages/HoldingsPage"

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">VFinance</h1>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <HoldingsPage />
      </main>
      <Toaster />
    </div>
  )
}

export default App
