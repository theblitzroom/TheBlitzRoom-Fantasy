"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let mounted = true;

    async function activateRecoverySession() {
      setChecking(true);
      setError("");

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);

          if (codeError) {
            throw codeError;
          }

          window.history.replaceState({}, document.title, window.location.pathname);

          if (mounted) {
            setReady(true);
          }

          return;
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            throw sessionError;
          }

          window.history.replaceState({}, document.title, window.location.pathname);

          if (mounted) {
            setReady(true);
          }

          return;
        }

        const { data } = await supabase.auth.getSession();

        if (mounted) {
          setReady(Boolean(data.session));
        }
      } catch (caught) {
        if (mounted) {
          setReady(false);
          setError(caught instanceof Error ? caught.message : "Password reset link could not be verified.");
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        setReady(true);
        setChecking(false);
      }
    });

    activateRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated. Sending you back to your account.");
      window.setTimeout(() => window.location.assign("/account"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card reset-password-card">
      <span className="badge badge-premium">Account recovery</span>
      <h2>Choose a new password</h2>
      <p>Open this page from the password reset email. Once the recovery session is active, set a new password below.</p>
      {checking ? (
        <div className="account-checklist">
          <span>Checking your secure reset link.</span>
          <span>This usually takes a moment after opening the email.</span>
        </div>
      ) : !ready ? (
        <div className="account-checklist">
          <span>This reset link is missing, expired, or has already been used.</span>
          <span>Go back to sign in and request a fresh password reset email.</span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submitNewPassword}>
          <label>
            New password
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            Confirm password
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <button className="premium-button premium-button-primary" disabled={loading} type="submit">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      )}
      {message ? <p className="auth-message">{message}</p> : null}
      {error ? <p className="sync-error">{error}</p> : null}
    </div>
  );
}
