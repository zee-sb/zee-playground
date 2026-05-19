import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ConversationsTable from '../components/ConversationsTable'
import ConversationsToolbar from '../components/ConversationsToolbar'
import EmptyState from '../components/EmptyState'
import { RowSkeleton } from '../components/LoadingSkeleton'
import { useConversations } from '../hooks/useAnalyticsApi'

const PAGE_SIZE = 25

export default function ConversationsView({ filters, page, setFilter, setPage, clearFilters, onSelect }) {
  const { data, isLoading, error, refetch } = useConversations({
    filters,
    page,
    pageSize: PAGE_SIZE,
  })

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'dateFrom' || k === 'dateTo') return false
    return v != null && v !== ''
  })

  const totalPages = data ? Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))) : 1

  return (
    <div>
      <ConversationsToolbar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error ? (
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-4 flex items-center justify-between">
          <div className="text-[12.5px] text-[#7F1D1D]">Failed to load conversations: {error.message}</div>
          <button
            type="button"
            onClick={refetch}
            className="text-[12px] font-semibold text-[#7F1D1D] underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <RowSkeleton count={8} />
      ) : data?.rows?.length ? (
        <>
          <ConversationsTable rows={data.rows} onSelect={onSelect} />
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#6B7280]">
            <div>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-2 py-1 border border-[#E5E7EB] rounded-md disabled:opacity-40 hover:bg-[#F9FAFB] flex items-center gap-1"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="tabular-nums">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 border border-[#E5E7EB] rounded-md disabled:opacity-40 hover:bg-[#F9FAFB] flex items-center gap-1"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No conversations match these filters"
          cta={hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[12px] font-semibold text-[#7C3AED] hover:underline"
            >
              Clear filters
            </button>
          )}
        />
      )}
    </div>
  )
}
