import React, { useEffect, useState, useCallback, useRef } from 'react';
import SSOPicker from './SSOPicker.jsx';
import CompanionShell from './CompanionShell.jsx';
import { getMe, signInWithEmail, logout } from './api.js';
import { useActiveTenant } from '../AIAssistant/useActiveTenant';

// Per-tenant identity: the session cookie is bound to one tenant at a time
// (the branchId is embedded in the JWT). Switching tenants in the gallery
// picker is treated like switching accounts: we re-call /api/auth/me with the
// new branch; if the session belongs to a different tenant we auto-attempt a
// silent sign-in using the email we cached on previous sign-in. If that
// email isn't registered in the new tenant, the SSOPicker is shown.
const LAST_EMAIL_KEY = 'sb_companion_last_email';

function readCachedEmail() {
  try { return window.localStorage.getItem(LAST_EMAIL_KEY) || null; } catch { return null; }
}
function writeCachedEmail(email) {
  try { window.localStorage.setItem(LAST_EMAIL_KEY, email); } catch { /* */ }
}
function clearCachedEmail() {
  try { window.localStorage.removeItem(LAST_EMAIL_KEY); } catch { /* */ }
}

const CONNECT_ERROR_COPY = {
  state_mismatch: 'Connection attempt expired. Try again.',
  missing_code: 'Atlassian did not return an authorization code.',
  no_refresh_token: 'Atlassian did not grant offline access. Re-consent and ensure offline_access is enabled.',
  no_accessible_resources: 'Your Atlassian account isn\'t connected to a Confluence/Jira site.',
  callback_failed: 'Something went wrong completing the connection. Try again.',
  db_not_configured: 'The companion database is not configured (set DATABASE_URL).',
  not_signed_in: 'Sign in to Staffbase first, then connect Atlassian.',
  access_denied: 'You declined the Atlassian consent screen.',
  state_user_mismatch: 'Connection state did not match the signed-in user.',
};

export default function StaffbaseCompanion({ onBack }) {
  const { branchId, tenant } = useActiveTenant();
  const [state, setState] = useState({ status: 'loading', user: null, connections: [], staffbase: null, tenant: null, authError: null });
  // Sentinel so the very first run (when branchId may legitimately be null
  // before the tenants list loads) still triggers a `/api/auth/me` call.
  const lastBranchRef = useRef(Symbol('uninitialised'));

  const refresh = useCallback(async (currentBranchId) => {
    try {
      const me = await getMe(currentBranchId);
      // Tenant mismatch: session is for a different tenant. Try silent
      // sign-in with the cached email; fall through to picker if that fails
      // (e.g. this email isn't in the new tenant's directory).
      if (me?.mismatch) {
        const cachedEmail = readCachedEmail();
        if (cachedEmail) {
          try {
            await signInWithEmail(cachedEmail, currentBranchId);
            const me2 = await getMe(currentBranchId);
            if (me2?.user) {
              setState({
                status: 'signed_in',
                user: me2.user,
                connections: me2.connections || [],
                staffbase: me2.staffbase || null,
                tenant: me2.tenant || null,
                authError: null,
              });
              return;
            }
          } catch {
            // Auto-sign-in failed (email not in this tenant, etc) — fall
            // through to the picker so the user can sign in explicitly.
          }
        }
        setState((prev) => ({ status: 'signed_out', user: null, connections: [], staffbase: null, tenant: null, authError: prev.authError }));
        return;
      }
      if (me?.user) {
        setState((prev) => ({
          ...prev,
          status: 'signed_in',
          user: me.user,
          connections: me.connections || [],
          staffbase: me.staffbase || null,
          tenant: me.tenant || null,
        }));
      } else {
        setState((prev) => ({ status: 'signed_out', user: null, connections: [], staffbase: null, tenant: null, authError: prev.authError }));
      }
    } catch (err) {
      setState({ status: 'signed_out', user: null, connections: [], staffbase: null, tenant: null, authError: err.message });
    }
  }, []);

  useEffect(() => {
    // Surface ?connect_error= from the OAuth callback bounce.
    const params = new URLSearchParams(window.location.search);
    const connectError = params.get('connect_error');
    if (connectError) {
      const cleaned = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleaned);
      setState((prev) => ({ ...prev, authError: CONNECT_ERROR_COPY[connectError] || `Connection error: ${connectError}` }));
    }
  }, []);

  // Re-evaluate the session whenever the active tenant changes. This is
  // what makes "switch tenant in the picker" feel like "switch account".
  useEffect(() => {
    if (lastBranchRef.current === branchId) return;
    lastBranchRef.current = branchId;
    setState((prev) => ({ ...prev, status: 'loading' }));
    refresh(branchId);
  }, [branchId, refresh]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F5F5F7] text-[#71717A] text-[14px]">
        Loading Companion…
      </div>
    );
  }

  if (state.status === 'signed_out') {
    return (
      <SSOPicker
        authError={state.authError}
        tenant={tenant || state.tenant}
        onBack={onBack}
        onSignedIn={async (email) => {
          if (email) writeCachedEmail(email);
          await refresh(branchId);
        }}
      />
    );
  }

  return (
    <CompanionShell
      user={state.user}
      connections={state.connections}
      staffbase={state.staffbase}
      tenant={state.tenant || tenant}
      onBack={onBack}
      onSignedOut={() => {
        clearCachedEmail();
        setState({ status: 'signed_out', user: null, connections: [], staffbase: null, tenant: null, authError: null });
      }}
      onMeRefresh={() => refresh(branchId)}
    />
  );
}
