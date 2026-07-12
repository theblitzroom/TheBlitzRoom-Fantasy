"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`
          }
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          window.location.assign("/account");
          return;
        }

        setMessage("Check your email to confirm the account, then come back here to sign in.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        throw signInError;
      }

      window.location.assign("/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    setResetLoading(true);
    setMessage("");
    setError("");

    try {
      if (!email.trim()) {
        throw new Error("Enter your email address first, then request a password reset.");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
      });

      if (resetError) {
        throw resetError;
      }

      setMessage("Password reset email sent. Open the link in that email to choose a new password.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password reset failed.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => setMode("signin")}>
          Sign in
        </button>
        <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={submitAuth}>
        <label>
          Email address
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 6 characters"
            required
            type="password"
            value={password}
          />
        </label>
        <button className="premium-button premium-button-primary" disabled={loading} type="submit">
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {mode === "signin" ? (
          <button className="auth-reset-link" disabled={resetLoading} onClick={sendPasswordReset} type="button">
            {resetLoading ? "Sending reset email..." : "Forgot password?"}
          </button>
        ) : null}
        {message ? <p className="auth-message">{message}</p> : null}
        {error ? <p className="sync-error">{error}</p> : null}
      </form>
    </div>
  );
}
