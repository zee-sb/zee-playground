// Frontend helpers for /api/auth/*, /api/connections/*, /api/companion/*.

export async function getMe() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (res.status === 401) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  if (!res.ok) return null;
  return await res.json();
}

export async function listDemoPersonas() {
  const res = await fetch('/api/auth/staffbase/login', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`list personas failed: ${res.status}`);
  return (await res.json()).personas;
}

export async function signInAsDemo(staffbaseUserId) {
  const res = await fetch('/api/auth/staffbase/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffbaseUserId }),
  });
  if (!res.ok) throw new Error(`demo sign-in failed: ${res.status}`);
  return (await res.json()).user;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
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

export async function listConversations() {
  const res = await fetch('/api/companion/conversations', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`conversations failed: ${res.status}`);
  return (await res.json()).conversations;
}

export async function createConversation(title) {
  const res = await fetch('/api/companion/conversations', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`create conversation failed: ${res.status}`);
  return (await res.json()).conversation;
}

export async function listMessages(conversationId) {
  const res = await fetch(`/api/companion/messages?conversationId=${encodeURIComponent(conversationId)}`, {
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
      try { onEvent(JSON.parse(line)); } catch { /* skip */ }
    }
  }
  if (buf.trim()) { try { onEvent(JSON.parse(buf)); } catch { /* */ } }
}
