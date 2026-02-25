import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import * as authApi from "@/api/auth"
import * as encryptionApi from "@/api/encryption"

export function SettingsPage() {
  const { user } = useAuth()

  // Enable encryption state
  const [setupPassword, setSetupPassword] = useState("")
  const [setupConfirm, setSetupConfirm] = useState("")
  const [setupLoading, setSetupLoading] = useState(false)

  // Change password state
  const [changeCurrent, setChangeCurrent] = useState("")
  const [changeNew, setChangeNew] = useState("")
  const [changeConfirm, setChangeConfirm] = useState("")
  const [changeLoading, setChangeLoading] = useState(false)

  // Disable encryption state
  const [disablePassword, setDisablePassword] = useState("")
  const [disableLoading, setDisableLoading] = useState(false)

  // Local copy of user to reflect updates without full re-login
  const [localUser, setLocalUser] = useState(user)

  if (!localUser) return null

  const handleSetupEncryption = async () => {
    if (!setupPassword || setupPassword !== setupConfirm) return
    setSetupLoading(true)
    try {
      await encryptionApi.setupEncryption(setupPassword)
      toast.success("Database encrypted successfully")
      const updated = await authApi.getMe()
      setLocalUser(updated)
      setSetupPassword("")
      setSetupConfirm("")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to enable encryption")
    } finally {
      setSetupLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!changeCurrent || !changeNew || changeNew !== changeConfirm) return
    setChangeLoading(true)
    try {
      await encryptionApi.changePassword(changeCurrent, changeNew)
      toast.success("Password changed successfully")
      setChangeCurrent("")
      setChangeNew("")
      setChangeConfirm("")
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      if (status === 401) {
        toast.error("Incorrect current password")
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to change password")
      }
    } finally {
      setChangeLoading(false)
    }
  }

  const handleDisableEncryption = async () => {
    if (!disablePassword) return
    setDisableLoading(true)
    try {
      await encryptionApi.disableEncryption(disablePassword)
      toast.success("Encryption disabled")
      const updated = await authApi.getMe()
      setLocalUser(updated)
      setDisablePassword("")
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      if (status === 401) {
        toast.error("Incorrect password")
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to disable encryption")
      }
    } finally {
      setDisableLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Encryption status */}
      <Card>
        <CardHeader>
          <CardTitle>Database Encryption</CardTitle>
          <CardDescription>
            Protect your portfolio data with a separate Data Password. The key is held in server
            RAM only and is cleared on server restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {localUser.encryption_enabled ? (
              <Badge variant="default">Encrypted</Badge>
            ) : (
              <Badge variant="secondary">Not Encrypted</Badge>
            )}
          </div>
          {localUser.encryption_enabled && (
            <div className="flex gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
              <span>⚠️</span>
              <span>
                Automatic monthly snapshots are <strong>not created</strong> for encrypted databases.
                The scheduler cannot unlock your database without your Data Password.
                Take snapshots manually while logged in.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable encryption */}
      {!localUser.encryption_enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Enable Encryption</CardTitle>
            <CardDescription>
              Set a Data Password to encrypt your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              ⚠ If you forget this password, your data will be permanently inaccessible. There is no
              recovery option.
            </div>
            <Input
              type="password"
              placeholder="New data password"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={setupConfirm}
              onChange={(e) => setSetupConfirm(e.target.value)}
            />
            {setupConfirm && setupPassword !== setupConfirm && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
            <Button
              onClick={handleSetupEncryption}
              disabled={
                setupLoading ||
                !setupPassword ||
                setupPassword !== setupConfirm
              }
            >
              {setupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Encrypting...
                </>
              ) : (
                "Enable Encryption"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Change password */}
      {localUser.encryption_enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your Data Password.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="Current password"
              value={changeCurrent}
              onChange={(e) => setChangeCurrent(e.target.value)}
            />
            <Input
              type="password"
              placeholder="New password"
              value={changeNew}
              onChange={(e) => setChangeNew(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={changeConfirm}
              onChange={(e) => setChangeConfirm(e.target.value)}
            />
            {changeConfirm && changeNew !== changeConfirm && (
              <p className="text-sm text-destructive">Passwords do not match</p>
            )}
            <Button
              onClick={handleChangePassword}
              disabled={
                changeLoading ||
                !changeCurrent ||
                !changeNew ||
                changeNew !== changeConfirm
              }
            >
              {changeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Disable encryption */}
      {localUser.encryption_enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Disable Encryption</CardTitle>
            <CardDescription>
              Remove encryption and convert your database back to plaintext.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="Current data password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
            />
            <Button
              variant="destructive"
              onClick={handleDisableEncryption}
              disabled={disableLoading || !disablePassword}
            >
              {disableLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable Encryption"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
