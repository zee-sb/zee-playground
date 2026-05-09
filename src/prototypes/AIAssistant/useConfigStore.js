import { useCallback, useEffect, useState } from 'react'
import {
  STORAGE_KEY,
  loadConfig,
  saveConfig,
  clearConfig,
  buildSeedConfig,
} from './configStore'

/**
 * Hook that wraps the localStorage-backed config blob (v2 schema).
 *
 * The seed lives in configStore.js so both prototypes (Studio + Employee)
 * end up with the same initial state when localStorage is empty.
 *
 * Returns:
 *   config                       — current persisted blob
 *   setConfig(updater)           — functional update
 *   patchConfig(partial)         — shallow merge
 *   setMcpConnectors(next)       — typed setter for the most common mutation
 *   setExternalAgents(next)
 *   setAssistants(next)
 *   setKnowledgeBases(next)
 *   resetConfig()                — wipe localStorage + reseed
 *
 * Cross-tab/window sync via the `storage` event so Studio in one tab and
 * Employee in another stay in sync live.
 */
export function useConfigStore() {
  const [config, setConfigState] = useState(() => {
    const loaded = loadConfig()
    if (loaded) return loaded
    const seeded = buildSeedConfig()
    saveConfig(seeded)
    return seeded
  })

  useEffect(() => {
    saveConfig(config)
  }, [config])

  useEffect(() => {
    if (typeof window === 'undefined') return
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return
      const next = loadConfig()
      if (next) setConfigState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setConfig = useCallback((updater) => {
    setConfigState((prev) =>
      typeof updater === 'function' ? updater(prev) : updater
    )
  }, [])

  const patchConfig = useCallback((patch) => {
    setConfigState((prev) => ({ ...prev, ...patch }))
  }, [])

  const makeArraySetter = (key) =>
    useCallback((next) => {
      setConfigState((prev) => ({
        ...prev,
        [key]: typeof next === 'function' ? next(prev[key] || []) : next,
      }))
    }, [])

  const setMcpConnectors = makeArraySetter('mcpConnectors')
  const setExternalAgents = makeArraySetter('externalAgents')
  const setAssistants = makeArraySetter('assistants')
  const setKnowledgeBases = makeArraySetter('knowledgeBases')

  const resetConfig = useCallback(() => {
    clearConfig()
    const seeded = buildSeedConfig()
    saveConfig(seeded)
    setConfigState(seeded)
  }, [])

  return {
    config,
    setConfig,
    patchConfig,
    setMcpConnectors,
    setExternalAgents,
    setAssistants,
    setKnowledgeBases,
    resetConfig,
  }
}
