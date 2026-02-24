import { useState, type KeyboardEvent } from "react"
import { LockIcon, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import * as encryptionApi from "@/api/encryption"

interface UnlockDatabaseDialogProps {
  open: boolean
}

export function UnlockDatabaseDialog({ open }: UnlockDatabaseDialogProps) {
  const { unlockDatabase, logout } = useAuth()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      await unlockDatabase(password)
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      if (status === 401) {
        setError("Incorrect password. Please try again.")
      } else {
        setError(e instanceof Error ? e.message : "Failed to unlock database")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleUnlock()
    }
  }

  const handleReset = async () => {
    setResetLoading(true)
    try {
      await encryptionApi.resetEncryptedDb()
      await logout()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed")
      setShowResetConfirm(false)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {!showResetConfirm ? (
          <>
            <DialogHeader>
              <div className="flex justify-center mb-2">
                <LockIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <DialogTitle className="text-center">Database Locked</DialogTitle>
              <DialogDescription className="text-center">
                Your data is encrypted. Enter your Data Password to unlock it.
                The key is cleared on server restart.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Input
                type="password"
                placeholder="Data password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button onClick={handleUnlock} disabled={loading || !password}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unlocking...
                  </>
                ) : (
                  "Unlock"
                )}
              </Button>
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground text-center mt-1"
                onClick={() => { setError(null); setShowResetConfirm(true) }}
              >
                Forgot password? Reset database
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">Reset Database?</DialogTitle>
              <DialogDescription className="text-center">
                This will permanently delete all your portfolio data. This cannot be undone.
                You will be logged out and start with a fresh empty database.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Yes, delete all my data"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetLoading}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
