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

interface UnlockDatabaseDialogProps {
  open: boolean
}

export function UnlockDatabaseDialog({ open }: UnlockDatabaseDialogProps) {
  const { unlockDatabase } = useAuth()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Dialog
      open={open}
      onOpenChange={() => {}}
    >
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
