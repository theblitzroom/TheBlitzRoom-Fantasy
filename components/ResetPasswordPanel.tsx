"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        setReady(true);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setReady(true);
      }
    });

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
      {!ready ? (
        <div className="account-checklist">
          <span>Waiting for a valid reset email session.</span>
          <span>If you opened this page directly, go back to sign in and request a new reset email.</span>
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
