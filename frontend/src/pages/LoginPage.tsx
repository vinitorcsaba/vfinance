import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export function LoginPage() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;

    // Wait for GSI script to load
    const tryInit = () => {
      if (typeof google === "undefined" || !google.accounts?.id) {
        setTimeout(tryInit, 100);
        return;
      }
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            setError(null);
            await login(response.credential);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Login failed");
          }
        },
      });
      google.accounts.id.renderButton(buttonRef.current!, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      });
    };
    tryInit();
  }, [login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">VFinance</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sign in to access your portfolio
        </p>
        {!GOOGLE_CLIENT_ID ? (
          <p className="text-center text-sm text-destructive">
            Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID.
          </p>
        ) : (
          <div className="flex justify-center">
            <div ref={buttonRef} />
          </div>
        )}
        {error && (
          <p className="mt-4 text-center text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
