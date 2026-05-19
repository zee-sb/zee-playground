import React from 'react'
import { useLocation } from 'react-router-dom'
import AnalyticsRouter from '../analytics'

// Thin wrapper so NavigatorStudio's existing import path keeps working. The
// real analytics experience lives in ../analytics. We parse the sub-path
// here (subTab + conversationId) instead of teaching NavigatorStudio about
// nested analytics routes.
export default function AnalyticsTab({ basePath, navigate }) {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  const idx = parts.indexOf('analytics')
  const subTab = idx >= 0 ? parts[idx + 1] || null : null
  const conversationId = subTab === 'conversations' ? (parts[idx + 2] || null) : null

  return (
    <AnalyticsRouter
      basePath={basePath}
      navigate={navigate}
      subTab={subTab}
      conversationId={conversationId}
    />
  )
}
