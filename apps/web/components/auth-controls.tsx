"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function GoogleSignIn({ enabled, failed = false }: { enabled: boolean; failed?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(failed ? "Sign-in was not completed. Please try again." : "");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/account",
        newUserCallbackURL: "/account",
        errorCallbackURL: "/sign-in?error=oauth",
      });
      if (result.error) throw new Error("Sign-in failed");
      // The client navigates to Google on success; retain the disabled state.
    } catch {
      setError("Unable to start Google sign-in. Please try again.");
      setPending(false);
    }
  }

  return <div className="auth-controls">
    {!enabled && <p role="status">Sign-in is currently unavailable. You can still browse courses.</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    <button className="auth-button" disabled={!enabled || pending} onClick={signIn}>
      {pending ? "Connecting to Google…" : "Continue with Google"}
    </button>
  </div>;
}

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
      setPending(false);
    }
  }

  return <div className="auth-controls">
    {error && <p role="alert" className="auth-error">{error}</p>}
    <button className="auth-button" disabled={pending} onClick={signOut}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  </div>;
}
