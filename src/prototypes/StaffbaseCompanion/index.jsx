import React, { useEffect, useState, useCallback } from 'react';
import SSOPicker from './SSOPicker.jsx';
import CompanionShell from './CompanionShell.jsx';
import { getMe } from './api.js';

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
  const [state, setState] = useState({ status: 'loading', user: null, connections: [], authError: null });

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      if (me?.user) {
        setState((prev) => ({
          ...prev,
          status: 'signed_in',
          user: me.user,
          connections: me.connections || [],
          staffbase: me.staffbase || null,
        }));
      } else {
        setState((prev) => ({ status: 'signed_out', user: null, connections: [], staffbase: null, authError: prev.authError }));
      }
    } catch (err) {
      setState({ status: 'signed_out', user: null, connections: [], staffbase: null, authError: err.message });
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
    refresh();
  }, [refresh]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F5F5F7] text-[#71717A] text-[14px]">
        Loading Companion…
      </div>
    );
  }

  if (state.status === 'signed_out') {
    return <SSOPicker authError={state.authError} onBack={onBack} onSignedIn={refresh} />;
  }

  return (
    <CompanionShell
      user={state.user}
      connections={state.connections}
      staffbase={state.staffbase}
      onBack={onBack}
      onSignedOut={() => setState({ status: 'signed_out', user: null, connections: [], staffbase: null, authError: null })}
      onMeRefresh={refresh}
    />
  );
}
