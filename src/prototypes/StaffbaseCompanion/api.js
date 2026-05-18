// Frontend helpers for /api/auth/*, /api/connections/*, /api/companion/*.

// Append `?branch=<id>` so the backend's resolveBranchId() picks up the
// active tenant. All /api/companion/* helpers thread this through; the
// auth/* helpers don't (they're tenant-neutral).
function withBranch(url, branchId) {
  if (!branchId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}branch=${encodeURIComponent(branchId)}`;
}

// /api/auth/me now returns 401 with code 'tenant_mismatch' when the session
// is bound to a different tenant than the one currently active. We surface
// that as { mismatch: true } so the Companion shell can attempt an
// auto-sign-in for the new tenant using the cached email.
export async function getMe(branchId) {
  const res = await fetch(withBranch('/api/auth/me', branchId), { credentials: 'same-origin' });
  if (res.status === 401) {
    let body = null;
    try { body = await res.json(); } catch { /* */ }
    if (body?.code === 'tenant_mismatch') return { mismatch: true, sessionBranchId: body.sessionBranchId };
    return null;
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  if (!res.ok) return null;
  return await res.json();
}

export async function signInWithEmail(email, branchId) {
  const res = await fetch(withBranch('/api/auth/staffbase/login', branchId), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const code = body?.error || `http_${res.status}`;
    // The auth backend now surfaces the underlying error message for the
    // generic `internal_error` catch-all (prototype-friendly debuggability).
    // Preserve it on the thrown Error so the picker can show it verbatim.
    const detail = body?.message || null;
    const err = new Error(detail ? `${code}: ${detail}` : code);
    err.code = code;
    err.detail = detail;
    throw err;
  }
  return body.user;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

// Re-pull the signed-in user's live Staffbase Directory profile and overwrite
// the cached row. Returns the refreshed summary on success.
export async function refreshProfile() {
  const res = await fetch('/api/auth/refresh-profile', {
    method: 'POST',
    credentials: 'same-origin',
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error(`refresh failed (${res.status})`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `refresh failed (${res.status})`);
  return body;
}

export async function disconnectProvider(provider) {
  const res = await fetch('/api/connections/disconnect', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error(`disconnect failed: ${res.status}`);
}

export async function listConversations(branchId) {
  const res = await fetch(withBranch('/api/companion/conversations', branchId), { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`conversations failed: ${res.status}`);
  return (await res.json()).conversations;
}

export async function createConversation(title, branchId) {
  const res = await fetch(withBranch('/api/companion/conversations', branchId), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`create conversation failed: ${res.status}`);
  return (await res.json()).conversation;
}

export async function deleteConversation(conversationId, branchId) {
  const res = await fetch(withBranch(`/api/companion/conversations/${encodeURIComponent(conversationId)}`, branchId), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`delete conversation failed: ${res.status}`);
  return true;
}

export async function listMessages(conversationId, branchId) {
  const res = await fetch(withBranch(`/api/companion/messages?conversationId=${encodeURIComponent(conversationId)}`, branchId), {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`messages failed: ${res.status}`);
  return (await res.json()).messages;
}

export async function streamPost(url, body, onEvent) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && !res.body) throw new Error(`request failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try { onEvent(JSON.parse(line)); }
      catch (err) { console.warn('[companion stream] bad NDJSON line:', err, line); }
    }
  }
  if (buf.trim()) {
    try { onEvent(JSON.parse(buf)); }
    catch (err) { console.warn('[companion stream] bad NDJSON trailing buffer:', err, buf); }
  }
}
