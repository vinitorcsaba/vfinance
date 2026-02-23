import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "@/types/auth";
import * as authApi from "@/api/auth";
import * as encryptionApi from "@/api/encryption";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  encryptionLocked: boolean;
  login: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockDatabase: (password: string) => Promise<void>;
  connectSheets: () => Promise<void>;
  disconnectSheets: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptionLocked, setEncryptionLocked] = useState(false);

  useEffect(() => {
    authApi
      .getMe()
      .then((u) => {
        setUser(u);
        setEncryptionLocked(false);
      })
      .catch(async (err: unknown) => {
        if ((err as { status?: number })?.status === 423) {
          setEncryptionLocked(true);
        } else {
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (googleToken: string) => {
    const u = await authApi.googleLogin(googleToken);
    setUser(u);
    if (u.encryption_enabled) {
      const status = await encryptionApi.getEncryptionStatus();
      setEncryptionLocked(!status.unlocked);
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setEncryptionLocked(false);
  }, []);

  const unlockDatabase = useCallback(async (password: string) => {
    await encryptionApi.unlockDatabase(password);
    const u = await authApi.getMe();
    setUser(u);
    setEncryptionLocked(false);
  }, []);

  const connectSheets = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Google Client ID not configured");

    return new Promise<void>((resolve, reject) => {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          try {
            const updatedUser = await authApi.connectSheets(response.code);
            setUser(updatedUser);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
      client.requestCode();
    });
  }, []);

  const disconnectSheets = useCallback(async () => {
    const updatedUser = await authApi.disconnectSheets();
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        encryptionLocked,
        login,
        logout,
        unlockDatabase,
        connectSheets,
        disconnectSheets,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
