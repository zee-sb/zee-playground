import React, { useState, useCallback } from 'react'
import AnalyticsHeader from './components/AnalyticsHeader'
import SubNav from './components/SubNav'
import RangePicker from './components/RangePicker'
import DraftFaqModal from './components/DraftFaqModal'
import OverviewView from './views/OverviewView'
import ConversationsView from './views/ConversationsView'
import ConversationDetailView from './views/ConversationDetailView'
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters'

// Wired into NavigatorStudio.jsx via AnalyticsTab.jsx (re-export).
//
// Routing:
//   /analytics                                  → Overview
//   /analytics/conversations                    → list
//   /analytics/conversations/:conversationId    → detail
//
// `detailId` from NavigatorStudio is `pathParts[protoIdx + 2]` — so e.g.
// `/prototypes/navigator-studio/analytics/conversations/<id>` puts the
// conversation id at detailId; the leading 'conversations' segment is
// captured via the `subTab` prop NavigatorStudio passes through.

export default function AnalyticsRouter({
  basePath,
  navigate,
  subTab = null,        // 'conversations' | null
  conversationId = null,
}) {
  const { filters, page, setFilter, setPage, clearFilters } = useAnalyticsFilters()
  const [modal, setModal] = useState(null)

  const handleSubNav = useCallback((id) => {
    if (id === 'overview') navigate(`${basePath}/analytics`)
    else navigate(`${basePath}/analytics/conversations`)
  }, [basePath, navigate])

  const handleSelectConversation = useCallback((row) => {
    navigate(`${basePath}/analytics/conversations/${row.id}`)
  }, [basePath, navigate])

  const handleOpenConversationsWithFilter = useCallback((patch) => {
    setFilter(patch)
    navigate(`${basePath}/analytics/conversations`)
  }, [setFilter, basePath, navigate])

  const onRangeChange = useCallback((range) => setFilter(range), [setFilter])

  const activeSubNav = subTab === 'conversations' ? 'conversations' : 'overview'
  const showingDetail = activeSubNav === 'conversations' && Boolean(conversationId)

  return (
    <div>
      <AnalyticsHeader basePath={basePath} navigate={navigate} />
      <SubNav
        active={activeSubNav}
        onChange={handleSubNav}
        rightSlot={!showingDetail && (
          <RangePicker
            value={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
            onChange={onRangeChange}
          />
        )}
      />

      {showingDetail ? (
        <ConversationDetailView
          conversationId={conversationId}
          onBack={() => navigate(`${basePath}/analytics/conversations`)}
          basePath={basePath}
          navigate={navigate}
          onOpenModal={setModal}
        />
      ) : activeSubNav === 'overview' ? (
        <OverviewView
          filters={filters}
          basePath={basePath}
          navigate={navigate}
          onOpenModal={setModal}
          onOpenConversations={handleOpenConversationsWithFilter}
        />
      ) : (
        <ConversationsView
          filters={filters}
          page={page}
          setFilter={setFilter}
          setPage={setPage}
          clearFilters={clearFilters}
          onSelect={handleSelectConversation}
        />
      )}

      <DraftFaqModal
        open={modal?.modal === 'draft_faq'}
        onClose={() => setModal(null)}
        topic={modal?.topic}
        questionSeed={modal?.question_seed}
      />
    </div>
  )
}
