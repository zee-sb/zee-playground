import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { signInWithEmail, logout } from './api.js';

const AUTH_ERROR_COPY = {
  state_mismatch: 'Sign-in attempt expired. Try again.',
  missing_code: 'Google did not return an authorization code.',
  callback_failed: 'Something went wrong completing sign-in. Try again.',
  db_not_configured: 'The companion database is not configured (set DATABASE_URL).',
  domain_not_allowed: 'Only @staffbase.com Google Workspace accounts can sign in to this demo.',
  access_denied: 'You declined the Google consent screen.',
  google_disabled: 'Google sign-in is temporarily unavailable — sign in with your email below.',
};

const SIGNIN_ERROR_COPY = {
  invalid_email: 'Please enter a valid email address.',
  user_not_found: "We couldn't find that email in the Staffbase directory.",
  directory_lookup_failed: 'Could not reach the Staffbase directory. Try again in a moment.',
  db_not_configured: 'The companion database is not configured (set DATABASE_URL).',
};

export default function SSOPicker({ authError, onBack, onSignedIn }) {
  const errMsg = authError ? (AUTH_ERROR_COPY[authError] || `Sign-in error: ${authError}`) : null;
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState(null);

  useEffect(() => {
    // If the picker is showing, the user is by definition not signed in
    // (parent already checked /api/auth/me). Proactively clear any stale
    // session cookie left over from an earlier flow.
    logout().catch(() => { /* best-effort */ });
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSignInError(null);
    try {
      await signInWithEmail(email.trim());
      onSignedIn?.();
    } catch (err) {
      const code = err.code || err.message;
      setSignInError(SIGNIN_ERROR_COPY[code] || `Sign-in failed: ${code}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <header className="bg-white border-b border-[#E4E4E7] px-10">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between h-16">
          <button onClick={onBack} className="text-[13px] text-[#71717A] hover:text-[#18181B] font-medium">
            ← Back to Studio
          </button>
          <span className="text-[13px] text-[#A1A1AA]">Staffbase Companion · v0.3</span>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-12">
        <div className="max-w-[460px] w-full bg-white border border-[#E4E4E7] rounded-2xl shadow-sm p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[#7C3AED] grid place-items-center text-white shadow-lg">
            <Sparkles size={28} />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight mb-2">Staffbase Companion</h1>
          <p className="text-[15px] text-[#71717A] leading-relaxed mb-8">
            Enter your Staffbase email to continue. You'll be signed in as that teammate for the demo.
          </p>

          {errMsg && (
            <div className="mb-6 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 text-left">
              {errMsg}
            </div>
          )}

          <form onSubmit={submit} className="text-left">
            <label htmlFor="sso-email" className="block text-[12px] font-semibold text-[#52525B] mb-2">
              Email
            </label>
            <input
              id="sso-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@staffbase.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSignInError(null); }}
              disabled={busy}
              className="w-full px-4 py-3 text-[14px] border border-[#E4E4E7] rounded-xl focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-[14px] px-5 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Signing in…' : 'Continue'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          {signInError && (
            <div className="mt-4 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 text-left">
              {signInError}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#F1F5F9] text-left">
            <div className="flex items-start gap-3 text-[12px] text-[#52525B]">
              <ShieldCheck size={16} className="text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                Demo mode: any @staffbase.com email resolves against the Campsite directory. External connectors like Atlassian are linked separately and respect each service's real permissions.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
