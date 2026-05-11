import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { listDemoPersonas, signInAsDemo } from './api.js';

const AUTH_ERROR_COPY = {
  state_mismatch: 'Sign-in attempt expired. Try again.',
  missing_code: 'Google did not return an authorization code.',
  callback_failed: 'Something went wrong completing sign-in. Try again.',
  db_not_configured: 'The companion database is not configured (set DATABASE_URL).',
  domain_not_allowed: 'Only @staffbase.com Google Workspace accounts can sign in to this demo.',
  access_denied: 'You declined the Google consent screen.',
};

export default function SSOPicker({ authError, onBack, onSignedIn }) {
  const errMsg = authError ? (AUTH_ERROR_COPY[authError] || `Sign-in error: ${authError}`) : null;
  const [showDemo, setShowDemo] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [demoBusy, setDemoBusy] = useState(null);
  const [demoError, setDemoError] = useState(null);

  useEffect(() => {
    if (!showDemo || personas.length) return;
    (async () => {
      try { setPersonas(await listDemoPersonas()); }
      catch (err) { setDemoError(err.message); }
    })();
  }, [showDemo, personas.length]);

  async function pickDemo(p) {
    setDemoBusy(p.id);
    setDemoError(null);
    try {
      await signInAsDemo(p.id);
      onSignedIn?.();
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoBusy(null);
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
            Sign in with your Staffbase Google account. Then link Atlassian and ask Companion anything across HR, IT, the intranet, Confluence, and Jira.
          </p>

          <a
            href="/api/auth/google/login"
            className="w-full inline-flex items-center justify-center gap-3 bg-white border border-[#E4E4E7] text-[#18181B] font-semibold text-[15px] px-5 py-3 rounded-xl hover:border-[#7C3AED] hover:bg-[#FAFAFA] transition-colors shadow-sm"
          >
            <GoogleG />
            Sign in with Google
          </a>

          <div className="mt-3 text-[11px] text-[#A1A1AA]">
            Restricted to <span className="font-mono">@staffbase.com</span> Workspace accounts
          </div>

          {errMsg && (
            <div className="mt-6 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 text-left">
              {errMsg}
            </div>
          )}

          {!showDemo ? (
            <button
              onClick={() => setShowDemo(true)}
              className="mt-6 text-[12px] text-[#71717A] hover:text-[#18181B] underline-offset-2 hover:underline"
            >
              Or sign in with a demo persona (dev only)
            </button>
          ) : (
            <div className="mt-6 pt-6 border-t border-[#F1F5F9]">
              <div className="text-[11px] uppercase tracking-wider text-[#A1A1AA] font-bold mb-3 text-left">Demo personas</div>
              {personas.length === 0 && !demoError && (
                <div className="text-[12px] text-[#A1A1AA] py-2">Loading personas…</div>
              )}
              <div className="space-y-1.5">
                {personas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickDemo(p)}
                    disabled={demoBusy !== null}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-[#E4E4E7] hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition-colors disabled:opacity-50 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold grid place-items-center shrink-0">
                      {p.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-[#71717A] truncate">{p.title} · {p.email}</div>
                    </div>
                    {demoBusy === p.id ? <span className="text-[11px] text-[#A1A1AA]">…</span> : <ArrowRight size={14} className="text-[#A1A1AA] shrink-0" />}
                  </button>
                ))}
              </div>
              {demoError && (
                <div className="mt-3 text-[12px] text-[#B91C1C]">{demoError}</div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#F1F5F9] text-left">
            <div className="flex items-start gap-3 text-[12px] text-[#52525B]">
              <ShieldCheck size={16} className="text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                Companion uses your real Staffbase identity. External connectors like Atlassian are linked separately and respect your permissions on each service.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.71H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.708A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.708V4.96H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.292C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
