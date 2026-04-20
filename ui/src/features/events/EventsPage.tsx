/**
 * EventsPage Component
 *
 * Table-based event log viewer with modern v2 design and enhanced functionality
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvents } from '@/hooks/useEvents'
import { useHosts } from '@/features/hosts/hooks/useHosts'
import type { EventFilters, EventSeverity, EventCategory } from '@/types/events'
import { formatSeverity } from '@/lib/utils/eventUtils'
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, X, Check, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/utils/csvExport'
import { useDynamicPageSize } from '@/hooks/useDynamicPageSize'
import { ContainerDetailsModal } from '@/features/containers/components/ContainerDetailsModal'
import { HostDetailsModal } from '@/features/hosts/components/HostDetailsModal'
import { EventRow } from './components/EventRow'
import { makeCompositeKey, parseCompositeKey } from '@/lib/utils/containerKeys'
import type { Container } from '@/features/containers/types'
import { apiClient } from '@/lib/api/client'
import { debug } from '@/lib/debug'

const SEVERITY_OPTIONS: EventSeverity[] = ['critical', 'error', 'warning', 'info', 'debug']
const CATEGORY_OPTIONS: EventCategory[] = ['container', 'host', 'system', 'alert', 'notification', 'user']
const TIME_RANGE_OPTIONS = [
  { value: 1, label: '最近 1 小时' },
  { value: 6, label: '最近 6 小时' },
  { value: 12, label: '最近 12 小时' },
  { value: 24, label: '最近 24 小时' },
  { value: 48, label: '最近 48 小时' },
  { value: 168, label: '最近 7 天' },
  { value: 720, label: '最近 30 天' },
  { value: 0, label: '全部时间' },
]

export function EventsPage() {
  const queryClient = useQueryClient()

  const { pageSize, containerRef } = useDynamicPageSize({
    rowHeight: 35, // Height of each event row in table (34 + 1px padding)
    minRows: 15,
    maxRows: 35, // Conservative max to prevent overflow
    reservedSpace: 280, // Space for header, filters, table header, pagination
  })

  const [filters, setFilters] = useState<EventFilters>({
    limit: pageSize,
    offset: 0,
    hours: 24,
  })
  const [searchInput, setSearchInput] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [hostSearchInput, setHostSearchInput] = useState('')
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([])
  const [showHostDropdown, setShowHostDropdown] = useState(false)
  const hostDropdownRef = useRef<HTMLDivElement>(null)
  const [containerSearchInput, setContainerSearchInput] = useState('')
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([])
  const [showContainerDropdown, setShowContainerDropdown] = useState(false)
  const containerDropdownRef = useRef<HTMLDivElement>(null)

  // Modal state for viewing container/host details from event links
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)

  useEffect(() => {
    setFilters((prev) => ({ ...prev, limit: pageSize }))
  }, [pageSize])

  const { data: hosts = [] } = useHosts()
  const { data: containers = [] } = useQuery<Container[]>({
    queryKey: ['containers'],
    queryFn: () => apiClient.get<Container[]>('/containers'),
  })
  const { data: eventsData, isLoading } = useEvents(filters, {
    refetchInterval: 30000,
  })

  useEffect(() => {
    const fetchSortOrder = async () => {
      try {
        const data = await apiClient.get<{ sort_order: 'desc' | 'asc' }>('/user/event-sort-order')
        if (data.sort_order) {
          setSortOrder(data.sort_order)
        }
      } catch (err) {
        // Silently fail - will use default sort order
      }
    }
    fetchSortOrder()
  }, [])

  const events = eventsData?.events ?? []
  const totalCount = eventsData?.total_count ?? 0
  const currentPage = Math.floor((filters.offset ?? 0) / (filters.limit ?? 20)) + 1
  const totalPages = Math.ceil(totalCount / (filters.limit ?? 20))

  const selectedContainer = useMemo(
    () => containers.find((c) => makeCompositeKey(c) === selectedContainerId),
    [containers, selectedContainerId]
  )
  const selectedHost = useMemo(
    () => hosts.find((h) => h.id === selectedHostId),
    [hosts, selectedHostId]
  )

  const filteredHosts = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(hostSearchInput.toLowerCase()) ||
      (h.url && h.url.toLowerCase().includes(hostSearchInput.toLowerCase()))
  )

  const filteredContainers = containers.filter((c) => {
    if (selectedHostIds.length > 0 && c.host_id && !selectedHostIds.includes(c.host_id)) {
      return false
    }

    return (
      c.name.toLowerCase().includes(containerSearchInput.toLowerCase()) ||
      (c.host_name && c.host_name.toLowerCase().includes(containerSearchInput.toLowerCase()))
    )
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hostDropdownRef.current && !hostDropdownRef.current.contains(event.target as Node)) {
        setShowHostDropdown(false)
      }
      if (containerDropdownRef.current && !containerDropdownRef.current.contains(event.target as Node)) {
        setShowContainerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateFilter = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [key]: value,
      }
      // Reset to first page unless changing page
      if (key !== 'offset') {
        newFilters.offset = 0
      }
      return newFilters
    })
  }

  const handleSearch = () => {
    updateFilter('search', searchInput || undefined)
  }

  const toggleSortOrder = async () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(newOrder)

    try {
      await apiClient.post('/user/event-sort-order', { sort_order: newOrder })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    } catch (err) {
      debug.error('EventsPage', '保存排序顺序时失败:', err)
    }
  }

  const resetFilters = () => {
    setFilters({ limit: pageSize, offset: 0, hours: 24 })
    setSearchInput('')
    setSelectedHostIds([])
    setHostSearchInput('')
    setSelectedContainerIds([])
    setContainerSearchInput('')
    setSortOrder('desc')
  }

  const toggleHostSelection = (hostId: string) => {
    const newSelection = selectedHostIds.includes(hostId)
      ? selectedHostIds.filter((id) => id !== hostId)
      : [...selectedHostIds, hostId]

    setSelectedHostIds(newSelection)
    updateFilter('host_id', newSelection.length > 0 ? newSelection : undefined)
  }

  const toggleContainerSelection = (containerCompositeKey: string) => {
    const newSelection = selectedContainerIds.includes(containerCompositeKey)
      ? selectedContainerIds.filter((id) => id !== containerCompositeKey)
      : [...selectedContainerIds, containerCompositeKey]

    setSelectedContainerIds(newSelection)
    // UI state uses composite keys (prevents cross-host collisions in dropdown),
    // but backend EventLog.container_id stores plain short IDs
    const shortIds = newSelection.map((key) => parseCompositeKey(key).containerId)
    updateFilter('container_id', shortIds.length > 0 ? shortIds : undefined)
  }

  const goToPage = (page: number) => {
    const offset = (page - 1) * (filters.limit ?? 20)
    updateFilter('offset', offset)
  }

  const exportToCSV = () => {
    if (events.length === 0) return

    const headers = [
      'Timestamp',
      'Severity',
      'Category',
      'Type',
      'Title',
      'Message',
      'Host',
      'Container',
      'Old State',
      'New State',
    ]

    const rows = events.map((event) => [
      event.timestamp,
      event.severity,
      event.category || '',
      event.event_type || '',
      event.title || '',
      event.message || '',
      event.host_name || '',
      event.container_name || '',
      event.old_state || '',
      event.new_state || '',
    ])

    exportToCsv(headers, rows, `dockmon-events-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-surface px-3 sm:px-4 md:px-6 py-4 pt-20 md:pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold">事件日志</h1>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={exportToCSV}
              disabled={events.length === 0}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">导出 CSV</span>
              <span className="sm:hidden">导出</span>
            </button>
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? '最新优先' : '最早优先'}</span>
              <span className="sm:hidden">{sortOrder === 'desc' ? '最新' : '最早'}</span>
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-sm whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              <span>重置筛选</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Time Range */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">时间范围</label>
            <select
              value={filters.hours ?? 24}
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

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">事件类别</label>
            <select
              value={filters.category?.[0] ?? ''}
              onChange={(e) => updateFilter('category', e.target.value ? [e.target.value as EventCategory] : undefined)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部类别</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat} className="capitalize">
                  {{
                    "container": "容器",
                    "host": "主机",
                    "system": "系统",
                    "alert": "告警",
                    "notification": "通知",
                    "user": "用户"
                  }[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">严重程度</label>
            <select
              value={filters.severity?.[0] ?? ''}
              onChange={(e) => updateFilter('severity', e.target.value ? [e.target.value as EventSeverity] : undefined)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">全部等级</option>
              {SEVERITY_OPTIONS.map((sev) => (
                <option key={sev} value={sev}>
                  {formatSeverity(sev)}
                </option>
              ))}
            </select>
          </div>

          {/* Host Search with Checkboxes */}
          <div ref={hostDropdownRef} className="relative">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">主机</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={hostSearchInput}
                onChange={(e) => setHostSearchInput(e.target.value)}
                onFocus={() => setShowHostDropdown(true)}
                placeholder={selectedHostIds.length > 0 ? `${selectedHostIds.length} 个主机已选择` : '搜索主机...'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Host Dropdown with Checkboxes */}
            {showHostDropdown && (
              <div className="absolute z-50 w-full mt-1 py-1 rounded-lg border border-border bg-surface shadow-lg max-h-[300px] overflow-y-auto">
                {filteredHosts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">尚未找到任何主机</div>
                ) : (
                  filteredHosts.map((host) => {
                    const isSelected = selectedHostIds.includes(host.id)
                    return (
                      <button
                        key={host.id}
                        onClick={() => toggleHostSelection(host.id)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-2 transition-colors"
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-border bg-surface-1'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{host.name}</div>
                          {host.url && (
                            <div className="text-xs text-muted-foreground truncate">{host.url}</div>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Container Search with Checkboxes */}
          <div ref={containerDropdownRef} className="relative">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">容器</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={containerSearchInput}
                onChange={(e) => setContainerSearchInput(e.target.value)}
                onFocus={() => setShowContainerDropdown(true)}
                placeholder={selectedContainerIds.length > 0 ? `${selectedContainerIds.length} 个容器已选择` : '搜索容器...'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Container Dropdown with Checkboxes */}
            {showContainerDropdown && (
              <div className="absolute z-50 w-full mt-1 py-1 rounded-lg border border-border bg-surface shadow-lg max-h-[300px] overflow-y-auto">
                {filteredContainers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">尚未找到任何容器</div>
                ) : (
                  filteredContainers.map((container) => {
                    // Use composite key for selection to match database storage format
                    const compositeKey = makeCompositeKey(container)
                    const isSelected = selectedContainerIds.includes(compositeKey)
                    return (
                      <button
                        key={container.id}
                        onClick={() => toggleContainerSelection(compositeKey)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-2 transition-colors"
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-border bg-surface-1'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{container.name}</div>
                          {container.host_name && (
                            <div className="text-xs text-muted-foreground truncate">{container.host_name}</div>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* General Search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">搜索</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索 (文本或正则表达式)..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground text-sm">加载事件数据中...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground text-sm">暂无事件</div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {/* Table Header */}
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-2 grid grid-cols-[200px_120px_1fr] gap-4 text-xs font-medium text-muted-foreground">
              <div>时间戳</div>
              <div>严重程度</div>
              <div>详细信息</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border">
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  showMetadata={true}
                  compact={false}
                  onContainerClick={setSelectedContainerId}
                  onHostClick={setSelectedHostId}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Pagination */}
      <div className="border-t border-border bg-surface px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {events.length === 0 ? '尚未找到任何事件' : `正在展示 ${(filters.offset ?? 0) + 1}-${Math.min((filters.offset ?? 0) + events.length, totalCount)} 条事件 (共 ${totalCount} 条)`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>

          <div className="text-sm text-muted-foreground">
            第 {currentPage} 页/ 共 {totalPages} 页
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={totalPages === 0 || currentPage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modals for viewing container/host details from event links */}
      <ContainerDetailsModal
        open={!!selectedContainerId}
        onClose={() => setSelectedContainerId(null)}
        containerId={selectedContainerId}
        container={selectedContainer ?? null}
      />

      <HostDetailsModal
        open={!!selectedHostId}
        onClose={() => setSelectedHostId(null)}
        hostId={selectedHostId}
        host={selectedHost}
      />
    </div>
  )
}
