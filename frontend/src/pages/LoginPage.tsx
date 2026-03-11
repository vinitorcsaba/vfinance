import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogoMark } from "@/components/Logo";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export function LoginPage() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <LogoMark className="h-16 w-16 text-primary drop-shadow-lg mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">VFinance</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-center">
            Track your portfolio, simply.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-lg">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Sign in to continue
          </p>

          {!GOOGLE_CLIENT_ID ? (
            <p className="text-center text-sm text-destructive">
              Google OAuth is not configured. Set{" "}
              <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code>.
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

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          BET Index &amp; international portfolio tracker
        </p>
      </div>
    </div>
  );
}
