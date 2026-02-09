import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "@/types/auth";
import * as authApi from "@/api/auth";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
  connectSheets: () => Promise<void>;
  disconnectSheets: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (googleToken: string) => {
    const u = await authApi.googleLogin(googleToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
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
    <AuthContext.Provider value={{ user, loading, login, logout, connectSheets, disconnectSheets }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
