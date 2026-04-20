/**
 * ContainerEventsTab Component
 *
 * Events tab for container drawer - Shows events for specific container with pagination
 */

import { useState } from 'react'
import { Calendar, AlertCircle, ChevronLeft, ChevronRight, Bell } from 'lucide-react'
import { useContainerEvents } from '@/hooks/useEvents'
import { EventRow } from '@/features/events/components/EventRow'

interface ContainerEventsTabProps {
  hostId: string
  containerId: string
}

const EVENTS_PER_PAGE = 20

export function ContainerEventsTab({ hostId, containerId }: ContainerEventsTabProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const { data: eventsData, isLoading, error } = useContainerEvents(hostId, containerId, 200)
  const allEvents = eventsData?.events ?? []

  // Count alert events
  const alertEventCount = allEvents.filter(e => e?.category === 'alert').length

  // Pagination
  const totalPages = allEvents.length > 0 ? Math.ceil(allEvents.length / EVENTS_PER_PAGE) : 1
  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE
  const endIndex = startIndex + EVENTS_PER_PAGE
  const events = allEvents.slice(startIndex, endIndex)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">加载事件中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500 opacity-50" />
          <p className="text-sm text-red-500">加载事件时出错</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with alert indicator */}
      {alertEventCount > 0 && (
        <div className="border-b border-border bg-surface px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-yellow-500" />
            <span className="text-foreground">
              已记录 <span className="font-semibold text-yellow-500">{alertEventCount}</span> 个告警事件
            </span>
          </div>
        </div>
      )}

      {allEvents.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">未在此容器中找到事件</p>
          </div>
        </div>
      ) : (
        <>
          {/* Event list using EventRow component */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {events.map((event) => (
              <EventRow key={event.id} event={event} showMetadata={false} compact={true} />
            ))}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between shrink-0">
              <div className="text-sm text-muted-foreground">
                显示 {startIndex + 1}-{Math.min(endIndex, allEvents.length)} ({allEvents.length}) 个事件
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  上一页
                </button>

                <div className="text-sm text-muted-foreground">
                  第 {currentPage} 页 / 共 {totalPages} 页
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  下一页
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
