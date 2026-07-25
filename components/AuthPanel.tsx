"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

type AuthPanelProps = {
  defaultRedirectTo?: string;
  presentation?: "default" | "immersive";
};

function safeInternalRedirect(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.origin !== window.location.origin) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function AuthPanel({ defaultRedirectTo, presentation = "default" }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");

    if (authError) {
      setError(authError);
    }
  }, []);

  function requestedRedirect() {
    const next = new URLSearchParams(window.location.search).get("next");
    return safeInternalRedirect(next) ?? safeInternalRedirect(defaultRedirectTo);
  }

  async function postAuthRedirect() {
    const requested = requestedRedirect();

    if (requested) {
      return requested;
    }

    try {
      const response = await fetch("/api/auth/landing", { cache: "no-store" });
      const data = await response.json() as { redirectTo?: string };
      return safeInternalRedirect(data.redirectTo) ?? "/account";
    } catch {
      return "/account";
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (!supabase) {
        throw new Error("Account access is unavailable in this local preview.");
      }

      const trimmedEmail = email.trim();

      if (mode === "signup") {
        const redirectTarget = requestedRedirect() ?? "/account";
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`
          }
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          window.location.assign(await postAuthRedirect());
          return;
        }

        setMessage("Check your email to confirm the account, then come back here to sign in.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (signInError) {
        throw signInError;
      }

      window.location.assign(await postAuthRedirect());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Authentication failed.";
      setError(
        mode === "signin" && message.toLowerCase().includes("invalid login credentials")
          ? "That email and password do not match. Use Forgot password to set a new password, then sign in again."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    setResetLoading(true);
    setMessage("");
    setError("");

    try {
      if (!supabase) {
        throw new Error("Password reset is unavailable in this local preview.");
      }

      if (!email.trim()) {
        throw new Error("Enter your email address first, then request a password reset.");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
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
    <div className={`auth-card${presentation === "immersive" ? " auth-card-immersive" : ""}`}>
      {presentation === "immersive" ? (
        <div className="auth-panel-heading">
          <span className="auth-panel-kicker">{mode === "signin" ? "Member access" : "Create your account"}</span>
          <h1>{mode === "signin" ? "Log In to Your Account" : "Join TBR Fantasy"}</h1>
          <p>
            {mode === "signin"
              ? "Access your teams, tools, and league dashboard."
              : "Create one account for draft tools, rankings, and league intelligence."}
          </p>
        </div>
      ) : (
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
            Create account
          </button>
        </div>
      )}

      <form className="auth-form" onSubmit={submitAuth}>
        <label>
          Email address
          <span className="auth-input-shell">
            <Mail aria-hidden="true" size={18} />
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </span>
        </label>
        <label>
          Password
          <span className="auth-input-shell">
            <LockKeyhole aria-hidden="true" size={18} />
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signin" ? "Enter your password" : "Minimum 6 characters"}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {mode === "signin" ? (
          <div className="auth-secondary-actions auth-session-row">
            <span><ShieldCheck size={15} /> Secure session</span>
            <button className="auth-reset-link" disabled={resetLoading} onClick={sendPasswordReset} type="button">
              {resetLoading ? "Sending reset email..." : "Forgot password?"}
            </button>
          </div>
        ) : null}
        <button className="premium-button premium-button-primary auth-submit-button" disabled={loading} type="submit">
          <span>{loading ? "Working..." : mode === "signin" ? "Log In" : "Create Account"}</span>
          {!loading ? <ArrowRight aria-hidden="true" size={19} /> : null}
        </button>
        {message ? <p className="auth-message">{message}</p> : null}
        {error ? <p className="sync-error">{error}</p> : null}
      </form>

      {presentation === "immersive" ? (
        <p className="auth-mode-switch">
          {mode === "signin" ? "Don’t have an account?" : "Already have an account?"}
          <button type="button" onClick={() => {
            setMode((current) => current === "signin" ? "signup" : "signin");
            setError("");
            setMessage("");
          }}>
            {mode === "signin" ? "Create account" : "Log in"}
          </button>
        </p>
      ) : null}
    </div>
  );
}
