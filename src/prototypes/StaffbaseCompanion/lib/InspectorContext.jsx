import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Inspector dock — single source of truth for the right rail on desktop.
//
// The dock has four tabs: sources, flow, trace, connections. Each tab's
// content lives in its own dedicated slot on the context so ChatPanel can
// dispatch updates as the conversation evolves (a tool call arrives with
// sources, a flow step starts, an orchestrator route resolves).
//
// The dock starts collapsed (icon rail only). It auto-expands the first
// time a meaningful context event lands — but only once per session, and
// never if the user has manually dismissed the dock during the session.
// That keeps the empty/greeting state spacious without leaving discovery
// at zero.

const InspectorContext = createContext(null);

const initialSources = { sources: [], anchorMessageIndex: null };
const initialFlow = { active: false, flowItem: null };
const initialTrace = { traceItem: null };

export function InspectorProvider({ enabled, children }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('sources');
  const [sources, setSourcesState] = useState(initialSources);
  const [flow, setFlowState] = useState(initialFlow);
  const [trace, setTraceState] = useState(initialTrace);

  // Track auto-expand vs manual-dismiss so we don't fight the user.
  // - autoExpandedOnce: did we already auto-expand on a context event?
  // - userDismissed: did the user explicitly close the panel?
  // Once either flips true, future events update badges silently.
  const autoExpandedOnce = useRef(false);
  const userDismissed = useRef(false);

  const openTab = useCallback((nextTab) => {
    setTab(nextTab);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    userDismissed.current = true;
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) userDismissed.current = true;
      return !prev;
    });
  }, []);

  // Auto-expand helper — opens the dock at the supplied tab only if the
  // user hasn't already opened or dismissed it this session. After the
  // first auto-expand, all subsequent context events just update badges.
  const maybeAutoExpand = useCallback((nextTab) => {
    if (autoExpandedOnce.current || userDismissed.current) return;
    autoExpandedOnce.current = true;
    setTab(nextTab);
    setOpen(true);
  }, []);

  const setSources = useCallback((next) => {
    setSourcesState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next;
      const hadNone = !prev.sources || prev.sources.length === 0;
      const hasNow = merged.sources && merged.sources.length > 0;
      if (hadNone && hasNow) maybeAutoExpand('sources');
      return merged;
    });
  }, [maybeAutoExpand]);

  const setFlow = useCallback((next) => {
    setFlowState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next;
      // Auto-expand on the *first* time a flow becomes active in this
      // session — repeated starts (user runs multiple flows back to back)
      // shouldn't keep prying the panel open.
      if (!prev.active && merged.active) maybeAutoExpand('flow');
      return merged;
    });
  }, [maybeAutoExpand]);

  const setTrace = useCallback((next) => {
    setTraceState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next;
      return merged;
    });
  }, []);

  const value = useMemo(() => ({
    enabled: !!enabled,
    open, tab,
    sources, flow, trace,
    openTab, close, toggle,
    setSources, setFlow, setTrace,
  }), [enabled, open, tab, sources, flow, trace, openTab, close, toggle, setSources, setFlow, setTrace]);

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

export function useInspector() {
  const ctx = useContext(InspectorContext);
  // Always return a usable object so consumers can safely call setters even
  // when no provider is mounted (e.g. mobile path). The mobile no-op makes
  // ChatPanel rendering branchless — it dispatches unconditionally and the
  // mobile UI keeps using its own bottom sheets / inline cards.
  if (!ctx) {
    return {
      enabled: false,
      open: false,
      tab: 'sources',
      sources: initialSources,
      flow: initialFlow,
      trace: initialTrace,
      openTab: () => {},
      close: () => {},
      toggle: () => {},
      setSources: () => {},
      setFlow: () => {},
      setTrace: () => {},
    };
  }
  return ctx;
}
