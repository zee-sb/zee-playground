import React from 'react'

const shimmer = 'animate-pulse bg-[#F1F5F9]'

export function KpiSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className={`${shimmer} h-3 w-20 rounded mb-2`} />
      <div className={`${shimmer} h-6 w-16 rounded`} />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className={`${shimmer} h-3 w-24 rounded mb-3`} />
      <div className={`${shimmer} h-[180px] w-full rounded`} />
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className={`${shimmer} h-3 w-3/4 rounded mb-2`} />
      <div className={`${shimmer} h-3 w-1/2 rounded`} />
    </div>
  )
}

export function RowSkeleton({ count = 8 }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="border-b border-[#F1F5F9] last:border-0 px-3 py-3 flex items-center gap-3">
          <div className={`${shimmer} h-3 w-1/3 rounded`} />
          <div className={`${shimmer} h-3 w-16 rounded`} />
          <div className={`${shimmer} h-3 w-16 rounded`} />
          <div className={`${shimmer} h-3 w-16 rounded ml-auto`} />
        </div>
      ))}
    </div>
  )
}
