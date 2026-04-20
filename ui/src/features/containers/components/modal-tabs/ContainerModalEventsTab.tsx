/**
 * ContainerModalEventsTab Component
 *
 * Events tab for container modal - Shows filtered events for specific container
 * Includes filtering by time range, severity, event type, and search
 */

import { useState } from 'react'
import { Calendar, AlertCircle, X, ArrowUpDown, Download, Bell } from 'lucide-react'
import { useContainerEvents } from '@/hooks/useEvents'
import { EventRow } from '@/features/events/components/EventRow'
import { exportToCsv } from '@/lib/utils/csvExport'

interface ContainerModalEventsTabProps {
  hostId: string
  containerId: string
}

const TIME_RANGE_OPTIONS = [
  { value: 1, label: '最近 1 小时' },
  { value: 6, label: '最近 6 小时' },
  { value: 12, label: '最近 12 小时' },
  { value: 24, label: '最近 24 小时' },
  { value: 48, label: '最近 48 小时' },
  { value: 168, label: "最近 7 天" },
  { value: 720, label: '最近 30 天' },
  { value: 0, label: '全部时间' },
]

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info']

// Event type options matching backend EventType enum values
const EVENT_TYPE_OPTIONS = [
  { value: 'state_change', label: '状态改变' },
  { value: 'action_taken', label: '执行操作' },
  { value: 'auto_restart', label: '自动重启' },
]

export function ContainerModalEventsTab({ hostId, containerId }: ContainerModalEventsTabProps) {
  const [filters, setFilters] = useState({
    hours: 24,
    severity: '' as string,
    eventType: '',
    search: '',
  })
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // TODO: Update useContainerEvents to support filtering parameters
  const { data: eventsData, isLoading, error } = useContainerEvents(hostId, containerId, 200)
  const allEvents = eventsData?.events ?? []

  // Count alert events in all (unfiltered) events
  const alertEventCount = allEvents.filter(e => e?.category === 'alert').length

  // Client-side filtering (TODO: move to backend)
  const filteredEvents = allEvents
    .filter((event) => {
      if (filters.hours > 0) {
        const eventTime = new Date(event.timestamp).getTime()
        const cutoff = Date.now() - filters.hours * 60 * 60 * 1000
        if (eventTime < cutoff) return false
      }

      if (filters.severity && event.severity.toLowerCase() !== filters.severity.toLowerCase()) {
        return false
      }

      // Event type filter (filter by event_type, not category)
      if (filters.eventType && event.event_type !== filters.eventType) {
        return false
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const titleMatch = event.title?.toLowerCase().includes(searchLower)
        const messageMatch = event.message?.toLowerCase().includes(searchLower)
        if (!titleMatch && !messageMatch) return false
      }

      return true
    })
    .sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime()
      const bTime = new Date(b.timestamp).getTime()
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime
    })

  const updateFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      hours: 24,
      severity: '',
      eventType: '',
      search: '',
    })
  }

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  const exportToCSV = () => {
    if (filteredEvents.length === 0) return

    const headers = [
      'Timestamp',
      'Severity',
      'Type',
      'Title',
      'Message',
      'Old State',
      'New State',
    ]

    const rows = filteredEvents.map((event) => [
      event.timestamp,
      event.severity,
      event.event_type || '',
      event.title || '',
      event.message || '',
      event.old_state || '',
      event.new_state || '',
    ])

    exportToCsv(headers, rows, `dockmon-container-events-${new Date().toISOString().split('T')[0]}.csv`)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">加载事件数据中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500 opacity-50" />
          <p className="text-sm text-red-500">无法加载事件数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Alert indicator banner */}
      {alertEventCount > 0 && (
        <div className="border-b border-border bg-surface px-6 py-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-yellow-500" />
            <span className="text-foreground">
              已在此容器内记录了 <span className="font-semibold text-yellow-500">{alertEventCount}</span> 条告警事件
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-border bg-surface px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">容器事件</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              disabled={filteredEvents.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              <span>导出 CSV</span>
            </button>
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{sortOrder === 'desc' ? '最新优先' : '最早优先'}</span>
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm"
            >
              <X className="h-3.5 w-3.5" />
              <span>重置筛选</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-4 gap-3">
          {/* Time Range */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">时间范围</label>
            <select
              value={filters.hours}
              onChange={(e) => updateFilter('hours', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">严重程度</label>
            <select
              value={filters.severity}
              onChange={(e) => updateFilter('severity', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部等级</option>
              {SEVERITY_OPTIONS.map((sev) => (
                <option key={sev} value={sev}>
                  {{'critical': "严重", 'error': "错误", 'warning': "警告", 'info': "通知"}[sev]}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">事件类型</label>
            <select
              value={filters.eventType}
              onChange={(e) => updateFilter('eventType', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部类型</option>
              {EVENT_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">搜索</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="请输入搜索内容..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Events Table */}
      {filteredEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无事件</p>
          </div>
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="sticky top-0 bg-surface border-b border-border px-6 py-2 grid grid-cols-[200px_120px_1fr] gap-4 text-xs font-medium text-muted-foreground shrink-0">
            <div>时间戳</div>
            <div>严重程度</div>
            <div>详细信息</div>
          </div>

          {/* Table Rows - scrollable */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredEvents.map((event) => (
              <EventRow key={event.id} event={event} showMetadata={false} compact={false} />
            ))}
          </div>

          {/* Event Count Footer */}
          <div className="border-t border-border px-6 py-3 shrink-0">
            <div className="text-sm text-muted-foreground">
              正在展示 {filteredEvents.length} 条事件
            </div>
          </div>
        </>
      )}
    </div>
  )
}
