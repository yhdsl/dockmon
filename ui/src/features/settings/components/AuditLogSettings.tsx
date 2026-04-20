/**
 * Audit Log Settings Component
 * Admin-only audit log viewer with filtering, export, and retention settings
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  Calendar,
  User as UserIcon,
  Activity,
  FileText,
  Clock,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  useAuditLog,
  useAuditActions,
  useAuditEntityTypes,
  useAuditUsers,
  useAuditRetention,
  useUpdateAuditRetention,
  useCleanupAuditLog,
  useExportAuditLog,
} from '@/hooks/useAuditLog'
import type { AuditLogQueryParams, AuditLogEntry } from '@/types/audit'
import { getActionLabel, getEntityTypeLabel, RETENTION_LABELS } from '@/types/audit'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils/timeFormat'

// =============================================================================
// Constants
// =============================================================================

const PAGE_SIZE = 25

// Shared CSS classes
const INPUT_CLASS =
  'w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none'

// Action color mappings
const ACTION_COLORS: Record<string, string> = {
  delete: 'text-red-400',
  login_failed: 'text-red-400',
  create: 'text-green-400',
  login: 'text-green-400',
  update: 'text-blue-400',
  deploy: 'text-blue-400',
  shell: 'text-yellow-400',
}

// =============================================================================
// Subcomponents
// =============================================================================

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

function AuditEntryRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: AuditLogEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const actionLabel = getActionLabel(entry.action)
  const entityTypeLabel = getEntityTypeLabel(entry.entity_type)

  // Get action color from mapping, with fallbacks for partial matches
  const actionColor = useMemo(() => {
    // Direct match first
    if (ACTION_COLORS[entry.action]) {
      return ACTION_COLORS[entry.action]
    }
    // Partial matches for composite actions
    if (entry.action.includes('delete')) return 'text-red-400'
    if (entry.action.includes('create')) return 'text-green-400'
    if (entry.action.includes('update')) return 'text-blue-400'
    return 'text-gray-400'
  }, [entry.action])

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer transition-colors hover:bg-gray-800/50">
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">
          {formatDateTime(entry.created_at)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-white">
          {entry.username}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${actionColor}`}>
          {actionLabel}
        </td>
        <td className="px-4 py-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
              {entityTypeLabel}
            </span>
            {entry.entity_name && <span className="truncate text-white">{entry.entity_name}</span>}
            {entry.host_name && (
              <span className="text-gray-400">({entry.host_name})</span>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
          {entry.ip_address || '-'}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-800/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {entry.entity_id && (
                  <div>
                    <span className="text-gray-400">条目 ID:</span>{' '}
                    <span className="font-mono text-white">{entry.entity_id}</span>
                  </div>
                )}
                {entry.host_id && (
                  <div>
                    <span className="text-gray-400">主机:</span>{' '}
                    <span className="text-white">{entry.host_name || entry.host_id}</span>
                  </div>
                )}
                {entry.user_agent && (
                  <div className="col-span-2">
                    <span className="text-gray-400">用户代理:</span>{' '}
                    <span className="text-gray-300">{entry.user_agent}</span>
                  </div>
                )}
              </div>

              {entry.details && Object.keys(entry.details).length > 0 && (
                <div>
                  <span className="text-gray-400">详细信息:</span>
                  <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-300">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RetentionDialog({
  isOpen,
  onClose,
  retention,
  onRetentionChange,
  onCleanup,
  isPending,
}: {
  isOpen: boolean
  onClose: () => void
  retention: { retention_days: number; valid_options: number[] } | undefined
  onRetentionChange: (days: number) => void
  onCleanup: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保留审计日志</DialogTitle>
          <DialogDescription>
            设置自动清理审计日志前的保留时长。
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4">
          <div className="text-sm text-gray-400">
            当前日期设置:{' '}
            <span className="font-medium text-white">
              {retention?.retention_days === 0 ? '永久' : `${retention?.retention_days} 天`}
            </span>
          </div>

          <div className="space-y-2">
            {retention?.valid_options.map((days) => (
              <button
                key={days}
                onClick={() => onRetentionChange(days)}
                disabled={isPending}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  retention?.retention_days === days
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-white">
                  {RETENTION_LABELS[days] || `${days} 天`}
                </div>
                {days === 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    将永久不会删除审计日志条目
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button variant="destructive" onClick={onCleanup}>
            <Trash2 className="mr-2 h-4 w-4" />
            手动清理
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CleanupDialog({
  isOpen,
  onClose,
  retentionDays,
  onConfirm,
  isPending,
}: {
  isOpen: boolean
  onClose: () => void
  retentionDays: number
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <DialogTitle>手动清理</DialogTitle>
              <DialogDescription>
                删除超过保留时长的审计日志条目。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4">
          <p className="text-sm text-gray-400">
            这将永久删除所有早于以下保留时长的审计日志{' '}
            <span className="font-medium text-white">
              {retentionDays === 0
                ? '(保留时长被设置为永久，将不会删除任何条目)'
                : `${retentionDays} 天`}
            </span>
            。
          </p>
          {retentionDays !== 0 && (
            <p className="mt-2 text-sm text-yellow-400">此操作将无法撤销。</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending || retentionDays === 0}
          >
            {isPending ? '清理中...' : '删除过期条目'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function AuditLogSettings() {
  // State
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AuditLogQueryParams>({})
  const [searchInput, setSearchInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showRetentionDialog, setShowRetentionDialog] = useState(false)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null)

  // Queries
  const queryParams = useMemo(() => ({ ...filters, page, page_size: PAGE_SIZE }), [filters, page])
  const { data: auditLog, isLoading, refetch } = useAuditLog(queryParams)
  const { data: actions } = useAuditActions()
  const { data: entityTypes } = useAuditEntityTypes()
  const { data: users } = useAuditUsers()
  const { data: retention } = useAuditRetention()
  const updateRetention = useUpdateAuditRetention()
  const cleanupAuditLog = useCleanupAuditLog()
  const exportAuditLog = useExportAuditLog()

  // Count active filters
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== undefined && v !== '').length,
    [filters]
  )

  // Handlers
  const handleSearch = useCallback(() => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      if (searchInput) {
        newFilters.search = searchInput
      } else {
        delete newFilters.search
      }
      return newFilters
    })
    setPage(1)
  }, [searchInput])

  const handleFilterChange = useCallback(
    (key: keyof AuditLogQueryParams, value: string | number | undefined) => {
      setFilters((prev) => {
        const newFilters = { ...prev }
        if (value !== undefined && value !== '') {
          // @ts-expect-error - key is valid for the type
          newFilters[key] = value
        } else {
          delete newFilters[key]
        }
        return newFilters
      })
      setPage(1)
    },
    []
  )

  const clearFilters = useCallback(() => {
    setFilters({})
    setSearchInput('')
    setPage(1)
  }, [])

  const handleRetentionChange = useCallback(
    (days: number) => {
      updateRetention.mutate({ retention_days: days })
      setShowRetentionDialog(false)
    },
    [updateRetention]
  )

  const handleCleanup = useCallback(() => {
    cleanupAuditLog.mutate()
    setShowCleanupDialog(false)
  }, [cleanupAuditLog])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">审计日志</h2>
          <p className="mt-1 text-sm text-gray-400">查看并导出安全审计事件</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetentionDialog(true)}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            保留时长
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAuditLog.mutate(filters)}
            disabled={exportAuditLog.isPending}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            {exportAuditLog.isPending ? '导出中...' : '导出为 CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {retention && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="条目总数" value={retention.total_entries.toLocaleString()} />
          <StatCard
            label="保留时长"
            value={retention.retention_days === 0 ? '永久' : `${retention.retention_days} 天`}
          />
          <StatCard
            label="最早日志"
            value={
              <span className="text-sm">
                {retention.oldest_entry_date ? formatDateTime(retention.oldest_entry_date) : 'N/A'}
              </span>
            }
          />
          <StatCard label="筛选结果" value={auditLog?.total.toLocaleString() ?? '-'} />
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索用户名、条目名称、条目 ID 或者主机名称..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>
          <Button onClick={handleSearch} variant="default" size="sm">
            搜索
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 ${activeFilterCount > 0 ? 'border-blue-500 text-blue-400' : ''}`}
          >
            <Filter className="h-4 w-4" />
            过滤器
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  <UserIcon className="mr-1 inline-block h-3 w-3" />
                  用户
                </label>
                <Select
                  value={String(filters.user_id ?? '')}
                  onValueChange={(v) => handleFilterChange('user_id', v ? Number(v) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {filters.user_id
                        ? users?.find((u) => u.user_id === filters.user_id)?.username ?? `用户 ${filters.user_id}`
                        : '全部用户'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部用户</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.user_id} value={String(user.user_id)}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  <Activity className="mr-1 inline-block h-3 w-3" />
                  操作
                </label>
                <Select
                  value={filters.action ?? ''}
                  onValueChange={(v) => handleFilterChange('action', v || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {filters.action
                        ? getActionLabel(filters.action)
                        : '全部操作'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部操作</SelectItem>
                    {actions?.map((action) => (
                      <SelectItem key={action} value={action}>
                        {getActionLabel(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  <FileText className="mr-1 inline-block h-3 w-3" />
                  条目类别
                </label>
                <Select
                  value={filters.entity_type ?? ''}
                  onValueChange={(v) => handleFilterChange('entity_type', v || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {filters.entity_type
                        ? getEntityTypeLabel(filters.entity_type)
                        : '全部类别'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部类别</SelectItem>
                    {entityTypes?.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getEntityTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  <Calendar className="mr-1 inline-block h-3 w-3" />
                  开始时间
                </label>
                <input
                  type="date"
                  value={filters.start_date?.split('T')[0] ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'start_date',
                      e.target.value ? `${e.target.value}T00:00:00Z` : undefined
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  <Calendar className="mr-1 inline-block h-3 w-3" />
                  结束时间
                </label>
                <input
                  type="date"
                  value={filters.end_date?.split('T')[0] ?? ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'end_date',
                      e.target.value ? `${e.target.value}T23:59:59Z` : undefined
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  清除过滤器
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-400">加载审计日志数据中...</div>
      ) : !auditLog?.entries.length ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-8 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <h3 className="font-medium text-gray-400">尚未找到审计日志</h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeFilterCount > 0
              ? '请尝试其他的过滤参数'
              : '审计日志会在执行操作时显示在这里'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900/70">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  <Clock className="mr-1 inline-block h-3 w-3" />
                  时间戳
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  <UserIcon className="mr-1 inline-block h-3 w-3" />
                  用户
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  <Activity className="mr-1 inline-block h-3 w-3" />
                  操作
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  <FileText className="mr-1 inline-block h-3 w-3" />
                  条目
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  IP 地址
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/30">
              {auditLog.entries.map((entry) => (
                <AuditEntryRow
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntryId === entry.id}
                  onToggle={() => setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {auditLog && auditLog.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            第 {auditLog.page} 页 / 共 {auditLog.total_pages} 页 (总共 {auditLog.total.toLocaleString()} 个条目)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(auditLog.total_pages, p + 1))}
              disabled={page === auditLog.total_pages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <RetentionDialog
        isOpen={showRetentionDialog}
        onClose={() => setShowRetentionDialog(false)}
        retention={retention}
        onRetentionChange={handleRetentionChange}
        onCleanup={() => {
          setShowRetentionDialog(false)
          setShowCleanupDialog(true)
        }}
        isPending={updateRetention.isPending}
      />

      <CleanupDialog
        isOpen={showCleanupDialog}
        onClose={() => setShowCleanupDialog(false)}
        retentionDays={retention?.retention_days ?? 0}
        onConfirm={handleCleanup}
        isPending={cleanupAuditLog.isPending}
      />
    </div>
  )
}
