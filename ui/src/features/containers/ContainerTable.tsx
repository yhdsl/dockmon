/**
 * Container Table Component
 *
 * Sortable, filterable container table with real-time WebSocket updates,
 * sparklines, and container actions.
 */

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type Table,
} from '@tanstack/react-table'

// Extend TanStack Table's ColumnMeta to include our custom align property
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right'
  }
}
import {
  Circle,
  PlayCircle,
  Square,
  RotateCw,
  ArrowUpDown,
  FileText,
  RefreshCw,
  RefreshCwOff,
  Play,
  Clock,
  AlertTriangle,
  Maximize2,
  Package,
  ExternalLink,
  Activity,
  Filter,
  X,
  ChevronDown,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { debug } from '@/lib/debug'
import { POLLING_CONFIG } from '@/lib/config/polling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagChip } from '@/components/TagChip'
import { DropdownMenu, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useAlertCounts, type AlertSeverityCounts } from '@/features/alerts/hooks/useAlerts'
import { AlertDetailsDrawer } from '@/features/alerts/components/AlertDetailsDrawer'
import { ContainerDrawer } from './components/ContainerDrawer'
import { BulkActionBar } from './components/BulkActionBar'
import { BulkActionConfirmModal } from './components/BulkActionConfirmModal'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
import { UpdateConfirmModal } from './components/UpdateConfirmModal'
import { BatchUpdateValidationConfirmModal } from './components/BatchUpdateValidationConfirmModal'
import { BatchJobPanel } from './components/BatchJobPanel'
import { ColumnCustomizationPanel } from './components/ColumnCustomizationPanel'
import { IPAddressCell } from './components/IPAddressCell'
import type { Container } from './types'
import { useAuth } from '@/features/auth/AuthContext'
import { useSimplifiedWorkflow, useUserPreferences, useUpdatePreferences } from '@/lib/hooks/useUserPreferences'
import { useContainerUpdateStatus, useUpdatesSummary, useAllAutoUpdateConfigs, useAllHealthCheckConfigs } from './hooks/useContainerUpdates'
import { useContainerActions } from './hooks/useContainerActions'
import { useContainerHealthCheck } from './hooks/useContainerHealthCheck'
import { makeCompositeKey } from '@/lib/utils/containerKeys'
import { sanitizeHref } from '@/lib/utils/urlSanitize'
import { formatBytes } from '@/lib/utils/formatting'
import { useContainerModal } from '@/providers'
import { useHosts } from '@/features/hosts/hooks/useHosts'
import { HostDetailsModal } from '@/features/hosts/components/HostDetailsModal'
import { useWebSocketContext } from '@/lib/websocket/WebSocketProvider'

/**
 * Update badge showing if updates are available
 */
function UpdateBadge({
  onClick,
  hasUpdate
}: {
  onClick?: () => void
  hasUpdate: boolean
}) {
  if (!hasUpdate) {
    return null
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="relative group p-1 rounded hover:bg-surface-2 transition-colors"
      title="更新可用 - 点击以查看详情"
    >
      <Package className="h-4 w-4 text-amber-500" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border">
        更新可用 - 点击以查看详情
      </div>
    </button>
  )
}

/**
 * Policy icons for auto-restart, HTTP health check, desired state, and auto-update.
 * Uses batch data to avoid N+1 queries; falls back to individual hooks if needed.
 */
function PolicyIcons({
  container,
  autoUpdateConfig,
  healthCheckConfig
}: {
  container: Container
  autoUpdateConfig?: { auto_update_enabled: boolean; floating_tag_mode: string } | null | undefined
  healthCheckConfig?: { enabled: boolean; current_status: string; consecutive_failures: number } | null | undefined
}) {
  const isRunning = container.state === 'running'
  const isExited = container.state === 'exited'
  const desiredState = container.desired_state
  const autoRestart = container.auto_restart

  // Use batch data if available, otherwise fall back to individual hooks
  // Pass undefined to disable the fallback query when batch data is present
  const fallbackUpdateStatus = useContainerUpdateStatus(
    autoUpdateConfig !== undefined ? undefined : container.host_id,
    autoUpdateConfig !== undefined ? undefined : container.id
  )
  const fallbackHealthCheck = useContainerHealthCheck(
    healthCheckConfig !== undefined ? undefined : container.host_id,
    healthCheckConfig !== undefined ? undefined : container.id
  )

  const autoUpdateEnabled = autoUpdateConfig?.auto_update_enabled ?? fallbackUpdateStatus.data?.auto_update_enabled ?? false
  const healthCheckEnabled = healthCheckConfig?.enabled ?? fallbackHealthCheck.data?.enabled ?? false
  const healthStatus = healthCheckConfig?.current_status ?? fallbackHealthCheck.data?.current_status ?? 'unknown'
  const consecutiveFailures = healthCheckConfig?.consecutive_failures ?? fallbackHealthCheck.data?.consecutive_failures

  // Determine if we should show warning (desired state is "should_run" but container is exited)
  const showWarning = desiredState === 'should_run' && isExited

  return (
    <div className="flex items-center gap-2">
      {/* Auto-restart icon */}
      <div className="relative group">
        {autoRestart ? (
          <RefreshCw className="h-4 w-4 text-info" />
        ) : (
          <RefreshCwOff className="h-4 w-4 text-muted-foreground" />
        )}
        {/* Tooltip */}
        <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 px-2 py-1 text-xs bg-surface-1 border border-border rounded shadow-lg whitespace-nowrap">
          自动重启: {autoRestart ? '已启用' : '已禁用'}
        </div>
      </div>

      {/* HTTP Health Check icon */}
      {healthCheckEnabled && (
        <div className="relative group">
          <Activity
            className={`h-4 w-4 ${
              healthStatus === 'healthy'
                ? 'text-success'
                : healthStatus === 'unhealthy'
                ? 'text-danger'
                : 'text-muted-foreground'
            }`}
          />
          {/* Tooltip */}
          <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 px-2 py-1 text-xs bg-surface-1 border border-border rounded shadow-lg whitespace-nowrap">
            {healthStatus === 'healthy' && 'HTTP(S) 健康检查状态: 健康'}
            {healthStatus === 'unhealthy' && (
              <>
                HTTP(S) 健康检查状态: 不健康
                {consecutiveFailures && consecutiveFailures > 0 && (
                  <> (连续不健康 {consecutiveFailures} 次)</>
                )}
              </>
            )}
            {healthStatus === 'unknown' && 'HTTP(S) 健康检查状态: 未知'}
          </div>
        </div>
      )}

      {/* Desired state icon */}
      <div className="relative group">
        {showWarning ? (
          <AlertTriangle className="h-4 w-4 text-warning" />
        ) : desiredState === 'should_run' ? (
          <Play className={`h-4 w-4 ${isRunning ? 'text-success fill-success' : 'text-foreground'}`} />
        ) : desiredState === 'on_demand' ? (
          <Clock className="h-4 w-4 text-muted-foreground" />
        ) : null}
        {/* Tooltip */}
        {desiredState && desiredState !== 'unspecified' && (
          <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 px-2 py-1 text-xs bg-surface-1 border border-border rounded shadow-lg whitespace-nowrap">
            {showWarning ? (
              <span>应当处于运行状态，但意外退出!</span>
            ) : desiredState === 'should_run' ? (
              <span>期望状态: 始终运行</span>
            ) : (
              <span>期望状态: 按需运行</span>
            )}
          </div>
        )}
      </div>

      {/* Auto-update icon */}
      {autoUpdateEnabled && (
        <div className="relative group">
          <Package className="h-4 w-4 text-amber-500" />
          {/* Tooltip */}
          <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 px-2 py-1 text-xs bg-surface-1 border border-border rounded shadow-lg whitespace-nowrap">
            自动更新: 已启用
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Status icon with color coding
 * Uses Circle icon with fill for visual consistency
 */
function StatusIcon({ state }: { state: Container['state'] }) {
  const iconMap = {
    running: { color: 'text-success', fill: 'fill-success', label: '运行中', animate: false },
    stopped: { color: 'text-danger', fill: 'fill-danger', label: '已退出', animate: false },
    exited: { color: 'text-danger', fill: 'fill-danger', label: '已退出', animate: false },
    created: { color: 'text-muted-foreground', fill: 'fill-muted-foreground', label: '已创建', animate: false },
    paused: { color: 'text-warning', fill: 'fill-warning', label: '已暂停', animate: false },
    restarting: { color: 'text-info', fill: 'fill-info', label: '重启中', animate: true },
    removing: { color: 'text-danger', fill: 'fill-danger', label: '删除中', animate: false },
    dead: { color: 'text-danger', fill: 'fill-danger', label: '已死亡', animate: false },
  }

  const config = iconMap[state] || iconMap.exited

  return (
    <div className="flex items-center gap-2" title={config.label}>
      <Circle
        className={`h-3 w-3 ${config.color} ${config.fill} ${config.animate ? 'animate-spin' : ''}`}
      />
      <span className="text-sm text-muted-foreground">{config.label}</span>
    </div>
  )
}


/**
 * Alert severity counts with color coding and click-to-open-drawer
 */
function ContainerAlertSeverityCounts({
  container,
  alertCounts,
  onAlertClick
}: {
  container: Container
  alertCounts: Map<string, AlertSeverityCounts> | undefined
  onAlertClick: (alertId: string) => void
}) {
  // Use composite key to prevent cross-host collisions (cloned VMs with same short IDs)
  const compositeKey = makeCompositeKey(container)
  const counts = alertCounts?.get(compositeKey)

  if (!counts || counts.total === 0) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  // Get first alert of each severity for click targets
  const getFirstAlertBySeverity = (severity: string) => {
    return counts.alerts.find(a => a.severity.toLowerCase() === severity)?.id
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {counts.critical > 0 && (
        <button
          onClick={() => {
            const alertId = getFirstAlertBySeverity('critical')
            if (alertId) onAlertClick(alertId)
          }}
          className="text-red-500 hover:underline cursor-pointer font-medium"
        >
          {counts.critical}
        </button>
      )}
      {counts.error > 0 && (
        <>
          {counts.critical > 0 && <span className="text-muted-foreground">/</span>}
          <button
            onClick={() => {
              const alertId = getFirstAlertBySeverity('error')
              if (alertId) onAlertClick(alertId)
            }}
            className="text-red-400 hover:underline cursor-pointer font-medium"
          >
            {counts.error}
          </button>
        </>
      )}
      {counts.warning > 0 && (
        <>
          {(counts.critical > 0 || counts.error > 0) && <span className="text-muted-foreground">/</span>}
          <button
            onClick={() => {
              const alertId = getFirstAlertBySeverity('warning')
              if (alertId) onAlertClick(alertId)
            }}
            className="text-yellow-500 hover:underline cursor-pointer font-medium"
          >
            {counts.warning}
          </button>
        </>
      )}
      {counts.info > 0 && (
        <>
          {(counts.critical > 0 || counts.error > 0 || counts.warning > 0) && <span className="text-muted-foreground">/</span>}
          <button
            onClick={() => {
              const alertId = getFirstAlertBySeverity('info')
              if (alertId) onAlertClick(alertId)
            }}
            className="text-blue-400 hover:underline cursor-pointer font-medium"
          >
            {counts.info}
          </button>
        </>
      )}
    </div>
  )
}

interface ContainerTableProps {
  hostId?: string // Optional: filter by specific host
}

export function ContainerTable({ hostId: propHostId }: ContainerTableProps = {}) {
  const { hasCapability } = useAuth()
  const canOperate = hasCapability('containers.operate')
  const { data: preferences } = useUserPreferences()
  const updatePreferences = useUpdatePreferences()
  const [sorting, setSorting] = useState<SortingState>(preferences?.container_table_sort || [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(preferences?.container_table_column_visibility || {})
  const [columnOrder, setColumnOrder] = useState<string[]>(preferences?.container_table_column_order || [])
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
  // Use composite keys {host_id}:{container_id} for multi-host support (cloned VMs with same short IDs)
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set())
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false)
  const [updateConfirmModalOpen, setUpdateConfirmModalOpen] = useState(false)
  const [validationModalOpen, setValidationModalOpen] = useState(false)
  const [validationData, setValidationData] = useState<{
    allowed: Array<{ container_id: string; container_name: string; reason: string }>
    warned: Array<{ container_id: string; container_name: string; reason: string; matched_pattern?: string }>
    blocked: Array<{ container_id: string; container_name: string; reason: string }>
  } | null>(null)
  const { enabled: simplifiedWorkflow } = useSimplifiedWorkflow()
  const { openModal } = useContainerModal()
  const { status: wsStatus } = useWebSocketContext()

  // Fetch batch configs for filtering and display (replaces N+1 individual queries)
  const { data: allAutoUpdateConfigs } = useAllAutoUpdateConfigs()
  const { data: allHealthCheckConfigs } = useAllHealthCheckConfigs()

  // Parse filters directly from URL params (URL is single source of truth)
  const filters = useMemo(() => {
    const hostParam = searchParams.get('host')
    const stateParam = searchParams.get('state')
    const policyAutoUpdateParam = searchParams.get('policy_auto_update')
    const policyAutoRestartParam = searchParams.get('policy_auto_restart')
    const policyHealthCheckParam = searchParams.get('policy_health_check')
    const updatesParam = searchParams.get('updates')
    const desiredStateParam = searchParams.get('desired_state')

    return {
      selectedHostIds: hostParam ? hostParam.split(',').filter(Boolean) : [],
      selectedStates: stateParam ? stateParam.split(',').filter((s): s is 'running' | 'stopped' => s === 'running' || s === 'stopped') : [] as ('running' | 'stopped')[],
      autoUpdateEnabled: policyAutoUpdateParam === 'enabled' ? true : policyAutoUpdateParam === 'disabled' ? false : null,
      autoRestartEnabled: policyAutoRestartParam === 'enabled' ? true : policyAutoRestartParam === 'disabled' ? false : null,
      healthCheckEnabled: policyHealthCheckParam === 'enabled' ? true : policyHealthCheckParam === 'disabled' ? false : null,
      showUpdatesAvailable: updatesParam === 'true',
      selectedDesiredStates: desiredStateParam ? desiredStateParam.split(',').filter((s): s is 'should_run' | 'on_demand' | 'unspecified' =>
        s === 'should_run' || s === 'on_demand' || s === 'unspecified'
      ) : [] as ('should_run' | 'on_demand' | 'unspecified')[]
    }
  }, [searchParams])

  // Initialize sorting from preferences when loaded
  useEffect(() => {
    if (preferences?.container_table_sort) {
      setSorting(preferences.container_table_sort as SortingState)
    }
  }, [preferences?.container_table_sort])

  // Save sorting changes to preferences
  useEffect(() => {
    // Don't save on initial load (empty array)
    if (sorting.length === 0 && !preferences?.container_table_sort) return

    // Debounce to avoid too many updates
    const timer = setTimeout(() => {
      updatePreferences.mutate({ container_table_sort: sorting })
    }, 500)

    return () => clearTimeout(timer)
  }, [sorting])

  // Initialize column visibility from preferences when loaded
  useEffect(() => {
    if (preferences?.container_table_column_visibility) {
      setColumnVisibility(preferences.container_table_column_visibility)
    }
  }, [preferences?.container_table_column_visibility])

  // Save column visibility changes to preferences
  useEffect(() => {
    // Don't save on initial load (empty object)
    if (Object.keys(columnVisibility).length === 0 && !preferences?.container_table_column_visibility) return

    // Debounce to avoid too many updates
    const timer = setTimeout(() => {
      updatePreferences.mutate({ container_table_column_visibility: columnVisibility })
    }, 500)

    return () => clearTimeout(timer)
  }, [columnVisibility])

  // Initialize column order from preferences when loaded
  useEffect(() => {
    if (preferences?.container_table_column_order && preferences.container_table_column_order.length > 0) {
      // Always ensure 'select' is first (not customizable, always on left)
      const orderWithSelect = ['select', ...preferences.container_table_column_order.filter(id => id !== 'select')]
      setColumnOrder(orderWithSelect)
    }
  }, [preferences?.container_table_column_order])

  // Save column order changes to preferences
  useEffect(() => {
    // Don't save on initial load (empty array)
    if (columnOrder.length === 0 && !preferences?.container_table_column_order) return

    // Remove 'select' before saving (we always add it back on load)
    const orderWithoutSelect = columnOrder.filter(id => id !== 'select')

    // Debounce to avoid too many updates
    const timer = setTimeout(() => {
      updatePreferences.mutate({ container_table_column_order: orderWithoutSelect })
    }, 500)

    return () => clearTimeout(timer)
  }, [columnOrder])

  // Fetch all alert counts in one batched request
  const { data: alertCounts } = useAlertCounts('container')

  // Alert drawer state
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)

  const [batchJobId, setBatchJobId] = useState<string | null>(null)
  const [showJobPanel, setShowJobPanel] = useState(false)
  const [expandedTagsContainerId, setExpandedTagsContainerId] = useState<string | null>(null)
  const [hostModalHostId, setHostModalHostId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // Fetch hosts for filter dropdown
  const { data: hosts } = useHosts()

  // Fetch updates summary for filtering
  const { data: updatesSummary } = useUpdatesSummary()

  // Handle batch job completion - clear both states
  const handleJobComplete = useCallback(() => {
    setBatchJobId(null)
    setShowJobPanel(false)
  }, [])

  // Selection handlers
  // containerId should be composite key: {host_id}:{container_id}
  const toggleContainerSelection = (containerId: string) => {
    setSelectedContainerIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(containerId)) {
        newSet.delete(containerId)
      } else {
        newSet.add(containerId)
      }
      return newSet
    })
  }

  const toggleSelectAll = (table: Table<Container>) => {
    const currentRows = table.getFilteredRowModel().rows
    const currentCompositeKeys = currentRows.map((row) => makeCompositeKey(row.original))

    // Check if all current rows are selected
    const allCurrentSelected = currentCompositeKeys.every((key: string) => selectedContainerIds.has(key))

    if (allCurrentSelected) {
      // Deselect all current rows
      setSelectedContainerIds(prev => {
        const newSet = new Set(prev)
        currentCompositeKeys.forEach((key: string) => newSet.delete(key))
        return newSet
      })
    } else {
      // Select all current rows
      setSelectedContainerIds(prev => {
        const newSet = new Set(prev)
        currentCompositeKeys.forEach((key: string) => newSet.add(key))
        return newSet
      })
    }
  }

  const clearSelection = () => {
    setSelectedContainerIds(new Set())
  }

  const handleBulkAction = (action: 'start' | 'stop' | 'restart') => {
    setPendingAction(action)
    setConfirmModalOpen(true)
  }

  const handleConfirmBulkAction = () => {
    if (!pendingAction) return
    batchMutation.mutate({
      action: pendingAction,
      containerIds: Array.from(selectedContainerIds),
    })
    setConfirmModalOpen(false)
    setPendingAction(null)
  }

  const handleCheckUpdates = () => {
    batchMutation.mutate({
      action: 'check-updates',
      containerIds: Array.from(selectedContainerIds),
    })
  }

  const handleBulkTagUpdate = async (mode: 'add' | 'remove', tags: string[]) => {
    if (!data) return

    const selectedContainers = data.filter((c) => selectedContainerIds.has(makeCompositeKey(c)))
    const action = mode === 'add' ? 'add-tags' : 'remove-tags'

    try {
      // Create batch job for tag update
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action,
        ids: Array.from(selectedContainerIds), // Send composite keys to backend
        params: { tags },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)

      // Show success toast
      const modeText = mode === 'add' ? '添加' : '删除'
      toast.success(`${modeText} ${tags.length} 个标签到 ${selectedContainers.length} 个容器中...`)
    } catch (error) {
      toast.error(`更新标签时失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  const handleBulkAutoRestartUpdate = async (enabled: boolean) => {
    if (!data) return

    const count = selectedContainerIds.size

    try {
      // Create batch job for auto-restart update
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'set-auto-restart',
        ids: Array.from(selectedContainerIds),
        params: { enabled },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)

      toast.success(`${enabled ? '启用' : '禁用'}自动重启设置到 ${count} 个容器中...`)
    } catch (error) {
      toast.error(`更新自动重启设置时失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  const handleBulkAutoUpdateUpdate = async (enabled: boolean, floatingTagMode: string) => {
    if (!data) return

    const count = selectedContainerIds.size

    try {
      // Create batch job for auto-update
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'set-auto-update',
        ids: Array.from(selectedContainerIds),
        params: { enabled, floating_tag_mode: floatingTagMode },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)

      const floatingTagModeMap = {
        exact: '精确',
        patch: '补丁',
        minor: '小型更新',
        latest: '保持最新',
      }
      const modeText = enabled ? `${floatingTagModeMap[floatingTagMode as keyof typeof floatingTagModeMap]}追踪模式下` : ''
      toast.success(`${enabled ? '启用' : '禁用'}${modeText}的自动更新设置到 ${count} 个容器中...`)
    } catch (error) {
      toast.error(`更新自动更新设置时失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  const handleBulkDesiredStateUpdate = async (state: 'should_run' | 'on_demand') => {
    if (!data) return

    const count = selectedContainerIds.size

    try {
      // Create batch job for desired state update
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'set-desired-state',
        ids: Array.from(selectedContainerIds),
        params: { desired_state: state },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)

      const stateText = state === 'should_run' ? '始终运行' : '按需运行'
      toast.success(`设置 "${stateText}" 期望状态到 ${count} 个容器中...`)
    } catch (error) {
      toast.error(`更新期望状态时失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  const handleDeleteContainers = () => {
    setDeleteConfirmModalOpen(true)
  }

  const handleConfirmDeleteContainers = async (removeVolumes: boolean) => {
    if (!data) return

    const count = selectedContainerIds.size

    try {
      // Create batch job for container deletion
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'delete-containers',
        ids: Array.from(selectedContainerIds),
        params: { remove_volumes: removeVolumes },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)
      setDeleteConfirmModalOpen(false)

      toast.success(`删除 ${count} 个容器中...`)
      clearSelection()
    } catch (error) {
      toast.error(`删除容器时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleUpdateContainers = async () => {
    if (!data || selectedContainerIds.size === 0) return

    try {
      // Call pre-flight validation endpoint
      const validation = await apiClient.post<{
        allowed: Array<{ container_id: string; container_name: string; reason: string }>
        warned: Array<{ container_id: string; container_name: string; reason: string; matched_pattern?: string }>
        blocked: Array<{ container_id: string; container_name: string; reason: string }>
        summary: { total: number; allowed: number; warned: number; blocked: number }
      }>('/batch/validate-update', {
        container_ids: Array.from(selectedContainerIds),
      })

      // If there are warned or blocked containers, show validation modal
      if (validation.warned.length > 0 || validation.blocked.length > 0) {
        setValidationData(validation)
        setValidationModalOpen(true)
      } else {
        // All containers allowed - show simple confirmation
        setUpdateConfirmModalOpen(true)
      }
    } catch (error) {
      debug.error('ContainerTable', '批处理验证更新时失败:', error)
      toast.error(`验证更新时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleConfirmUpdateContainers = async () => {
    if (!data) return

    const count = selectedContainerIds.size

    try {
      // Create batch job for container updates
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'update-containers',
        ids: Array.from(selectedContainerIds),
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)
      setUpdateConfirmModalOpen(false)

      toast.success(`更新 ${count} 个容器中...`)
      clearSelection()
    } catch (error) {
      toast.error(`更新容器时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleConfirmValidatedUpdate = async () => {
    if (!data || !validationData) return

    // Extract non-blocked container IDs (allowed + warned)
    const allowedIds = new Set(validationData.allowed.map(c => c.container_id))
    const warnedIds = new Set(validationData.warned.map(c => c.container_id))
    const updateIds = [...allowedIds, ...warnedIds]

    try {
      // Create batch job with force_warn parameter
      const result = await apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action: 'update-containers',
        ids: updateIds,
        params: {
          force_warn: true, // Allow warned containers to update
        },
      })
      setBatchJobId(result.job_id)
      setShowJobPanel(true)
      setValidationModalOpen(false)
      setValidationData(null)

      toast.success(`更新 ${updateIds.length} 个容器中...`)
      clearSelection()
    } catch (error) {
      toast.error(`更新容器时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }


  // Fetch containers with stats
  const { data, isLoading, error } = useQuery<Container[]>({
    queryKey: ['containers'],
    queryFn: () => apiClient.get('/containers'),
    refetchInterval: wsStatus === 'connected' ? false : POLLING_CONFIG.CONTAINER_DATA,
  })

  // Container action hook (reusable across components)
  // Uses per-container pending tracking + optimistic updates
  const { executeAction, isContainerPending } = useContainerActions()

  // Batch action mutation
  const batchMutation = useMutation({
    mutationFn: ({ action, containerIds }: { action: string; containerIds: string[] }) =>
      apiClient.post<{ job_id: string }>('/batch', {
        scope: 'container',
        action,
        ids: containerIds,
      }),
    onSuccess: (data) => {
      const jobId = data.job_id
      toast.success('批处理任务已启动', {
        description: `Job ID: ${jobId}。进度将在面板中显示。`,
      })
      // Clear selection after starting batch job
      clearSelection()
      // Open batch job progress panel
      setBatchJobId(jobId)
      setShowJobPanel(true)
      queryClient.invalidateQueries({ queryKey: ['containers'] })
    },
    onError: (error) => {
      debug.error('ContainerTable', '批处理操作失败:', error)
      toast.error('启动批处理任务时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    },
  })

  // Apply custom filters to container data
  // Performance: Uses batch data from useAllAutoUpdateConfigs and useAllHealthCheckConfigs
  // to avoid N+1 queries (single API call instead of N individual calls)
  const filteredData = useMemo(() => {
    if (!data) return []

    return data.filter((container) => {
      // Host filter (prop-based for embedded tables, URL-based for main table)
      if (propHostId && container.host_id !== propHostId) {
        return false
      }
      if (!propHostId && filters.selectedHostIds.length > 0 && (!container.host_id || !filters.selectedHostIds.includes(container.host_id))) {
        return false
      }

      // State filter (multi-select)
      if (filters.selectedStates.length > 0) {
        const containerState = container.state === 'running' ? 'running' : 'stopped'
        if (!filters.selectedStates.includes(containerState)) {
          return false
        }
      }

      // Auto-restart filter (boolean) - directly available on container
      if (filters.autoRestartEnabled !== null) {
        const hasAutoRestart = container.auto_restart ?? false
        if (hasAutoRestart !== filters.autoRestartEnabled) {
          return false
        }
      }

      // Desired State filter (multi-select)
      if (filters.selectedDesiredStates.length > 0) {
        const containerDesiredState = container.desired_state || 'unspecified'
        if (!filters.selectedDesiredStates.includes(containerDesiredState)) {
          return false
        }
      }

      // Updates Available filter
      if (filters.showUpdatesAvailable) {
        const compositeKey = makeCompositeKey(container)
        const hasUpdate = updatesSummary?.containers_with_updates?.includes(compositeKey) ?? false
        if (!hasUpdate) {
          return false
        }
      }

      // Auto-update filter (uses batch data - no N+1 queries!)
      if (filters.autoUpdateEnabled !== null && allAutoUpdateConfigs) {
        const compositeKey = makeCompositeKey(container)
        const config = allAutoUpdateConfigs[compositeKey]
        const hasAutoUpdate = config?.auto_update_enabled ?? false
        if (hasAutoUpdate !== filters.autoUpdateEnabled) {
          return false
        }
      }

      // Health check filter (uses batch data - no N+1 queries!)
      if (filters.healthCheckEnabled !== null && allHealthCheckConfigs) {
        const compositeKey = makeCompositeKey(container)
        const config = allHealthCheckConfigs[compositeKey]
        const hasHealthCheck = config?.enabled ?? false
        if (hasHealthCheck !== filters.healthCheckEnabled) {
          return false
        }
      }

      return true
    })
  }, [data, filters, updatesSummary, allAutoUpdateConfigs, allHealthCheckConfigs])

  // Table columns
  const columns = useMemo<ColumnDef<Container>[]>(
    () => [
      // 0. Selection checkbox
      {
        id: 'select',
        header: ({ table }) => {
          const currentRows = table.getFilteredRowModel().rows
          const currentCompositeKeys = currentRows.map(row => makeCompositeKey(row.original))
          const allCurrentSelected = currentCompositeKeys.length > 0 && currentCompositeKeys.every(key => selectedContainerIds.has(key))

          return (
            <fieldset disabled={!canOperate} className="flex items-center justify-center disabled:opacity-60">
              <input
                type="checkbox"
                checked={allCurrentSelected}
                onChange={() => toggleSelectAll(table)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </fieldset>
          )
        },
        cell: ({ row }) => (
          <fieldset disabled={!canOperate} className="flex items-center justify-center disabled:opacity-60">
            <input
              type="checkbox"
              checked={selectedContainerIds.has(makeCompositeKey(row.original))}
              onChange={() => toggleContainerSelection(makeCompositeKey(row.original))}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
          </fieldset>
        ),
        size: 50,
        enableSorting: false,
      },
      // 1. Status (icon)
      {
        accessorKey: 'state',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              状态
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        cell: ({ row }) => <StatusIcon state={row.original.state} />,
      },
      // 2. Name (clickable) with tags
      {
        accessorKey: 'name',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              名称
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        cell: ({ row }) => {
          const tags = row.original.tags || []
          const visibleTags = tags.slice(0, 3)
          const remainingCount = tags.length - visibleTags.length
          const isExpanded = expandedTagsContainerId === row.original.id

          return (
            <div className="flex flex-col gap-1">
              <button
                className="font-medium text-foreground hover:text-primary transition-colors text-left"
                onClick={() => {
                  const compositeKey = makeCompositeKey(row.original)
                  if (simplifiedWorkflow) {
                    // Open global modal directly
                    openModal(compositeKey, 'info')
                  } else {
                    // Open drawer (keeps local state for drawer)
                    setSelectedContainerId(compositeKey)
                    setDrawerOpen(true)
                  }
                }}
              >
                {row.original.name || '未知'}
              </button>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  {visibleTags.map((tag) => (
                    <TagChip
                      key={tag}
                      tag={tag}
                      size="sm"
                      onClick={() => {
                        // Filter by this tag
                        setGlobalFilter(tag)
                      }}
                    />
                  ))}
                  {remainingCount > 0 && (
                    <div className="relative group">
                      <button
                        className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedTagsContainerId(isExpanded ? null : row.original.id)
                        }}
                      >
                        +{remainingCount}
                      </button>

                      {/* Tooltip on hover - shows vertical list */}
                      {!isExpanded && (
                        <div className="invisible group-hover:visible absolute left-0 bottom-full mb-2 z-30 bg-surface-1 border border-border rounded-lg shadow-xl p-2 min-w-[150px] transition-all delay-300">
                          <div className="flex flex-col gap-1 text-xs text-foreground">
                            {tags.slice(3).map((tag) => (
                              <div key={tag} className="px-2 py-1">
                                {tag}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dropdown on click - shows clickable chips */}
                      {isExpanded && (
                        <>
                          {/* Backdrop to close dropdown when clicking outside */}
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setExpandedTagsContainerId(null)}
                          />
                          {/* Dropdown */}
                          <div className="absolute left-0 top-full mt-1 z-30 bg-surface-1 border border-border rounded-lg shadow-xl p-2 w-[250px]">
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(3).map((tag) => (
                                <TagChip
                                  key={tag}
                                  tag={tag}
                                  size="sm"
                                  onClick={() => {
                                    setGlobalFilter(tag)
                                    setExpandedTagsContainerId(null)
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        },
      },
      // 3. Policy (auto-restart, health check, desired state, auto-update)
      {
        id: 'policy',
        header: '策略',
        cell: ({ row }) => {
          const compositeKey = makeCompositeKey(row.original)
          return (
            <PolicyIcons
              container={row.original}
              autoUpdateConfig={allAutoUpdateConfigs === undefined ? undefined : (allAutoUpdateConfigs[compositeKey] ?? null)}
              healthCheckConfig={allHealthCheckConfigs === undefined ? undefined : (allHealthCheckConfigs[compositeKey] ?? null)}
            />
          )
        },
        size: 120,
        enableSorting: false,
      },
      // 4. Alerts
      {
        id: 'alerts',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(sortDirection === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              告警数
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        accessorFn: (row) => {
          // Calculate total alert count for sorting
          const compositeKey = makeCompositeKey(row)
          const counts = alertCounts?.get(compositeKey)
          if (!counts) return 0
          return counts.critical + counts.error + counts.warning + counts.info
        },
        cell: ({ row }) => (
          <ContainerAlertSeverityCounts
            container={row.original}
            alertCounts={alertCounts}
            onAlertClick={setSelectedAlertId}
          />
        ),
        enableSorting: true,
      },
      // 5. Host
      {
        accessorKey: 'host_name',
        id: 'host_id',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              主机
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        filterFn: (row, _columnId, filterValue) => {
          // Filter by host_id when set from URL params
          return row.original.host_id === filterValue
        },
        cell: ({ row }) => {
          const { host_name, host_id } = row.original
          return (
            <button
              className="text-sm text-left hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); host_id && setHostModalHostId(host_id) }}
            >
              {host_name || 'localhost'}
            </button>
          )
        },
      },
      // 7. IP Address (Docker network IPs)
      {
        id: 'ip',
        header: 'IP 地址',
        cell: ({ row }) => <IPAddressCell container={row.original} />,
        size: 150,
        enableSorting: false,
      },
      // 8. Ports
      {
        accessorKey: 'ports',
        id: 'ports',
        header: '端口映射',
        cell: ({ row }) => {
          const container = row.original
          if (!container.ports || container.ports.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>
          }

          const sorted = [...container.ports].sort((a, b) => {
            const portA = parseInt(a) || 0
            const portB = parseInt(b) || 0
            return portA - portB
          })
          return (
            <div className="text-xs text-muted-foreground">
              {sorted.join(', ')}
            </div>
          )
        },
        enableSorting: false,
      },
      // 8. Uptime (duration)
      {
        accessorKey: 'created',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(sortDirection === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              运行时长
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        cell: ({ row }) => {
          const container = row.original
          const isRunning = container.state === 'running'

          // Stopped containers don't have uptime
          if (!isRunning) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          // Calculate uptime from started_at timestamp (when container was last started)
          // Fall back to created if started_at not available
          const formatUptime = (timestampStr: string) => {
            try {
              const timestamp = new Date(timestampStr)
              const now = new Date()
              const diffMs = now.getTime() - timestamp.getTime()

              if (diffMs < 0) return '-'

              const seconds = Math.floor(diffMs / 1000)
              const minutes = Math.floor(seconds / 60)
              const hours = Math.floor(minutes / 60)
              const days = Math.floor(hours / 24)

              if (days > 0) {
                return `${days}d ${hours % 24}h`
              } else if (hours > 0) {
                return `${hours}h ${minutes % 60}m`
              } else if (minutes > 0) {
                return `${minutes}m`
              } else {
                return `${seconds}s`
              }
            } catch {
              return '-'
            }
          }

          // Use started_at for uptime (when container was last started), fall back to created
          const uptimeSource = container.started_at || container.created
          const tooltipText = new Date(container.started_at ?? '').toLocaleString()
            ? `启动于: ${new Date(container.started_at ?? '').toLocaleString()}`
            : `创建于: ${new Date(container.created).toLocaleString()}`

          return (
            <span className="text-sm text-muted-foreground" title={tooltipText}>
              {uptimeSource ? formatUptime(uptimeSource) : '-'}
            </span>
          )
        },
        enableSorting: true,
      },
      // 9. CPU%
      {
        id: 'cpu',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(sortDirection === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              CPU%
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        accessorFn: (row) => row.cpu_percent ?? -1,
        cell: ({ row }) => {
          const container = row.original
          // Only show CPU for running containers
          const isRunning = container.state === 'running'
          if (isRunning && container.cpu_percent !== undefined && container.cpu_percent !== null) {
            return (
              <span className="text-sm text-muted-foreground">
                {container.cpu_percent.toFixed(1)}%
              </span>
            )
          }
          return <span className="text-sm text-muted-foreground">-</span>
        },
        enableSorting: true,
      },
      // 10. RAM (memory usage)
      {
        id: 'memory',
        header: ({ column }) => {
          const sortDirection = column.getIsSorted()
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(sortDirection === 'asc')}
              className="h-8 px-2 hover:bg-surface-2"
            >
              RAM
              <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )
        },
        accessorFn: (row) => row.memory_usage ?? -1,
        cell: ({ row }) => {
          const container = row.original
          // Only show RAM for running containers
          const isRunning = container.state === 'running'

          if (!isRunning || container.memory_usage === undefined || container.memory_usage === null) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          const usage = formatBytes(container.memory_usage)
          const limit = container.memory_limit ? formatBytes(container.memory_limit) : '无限制'

          return (
            <span className="text-sm text-muted-foreground" title={`限制: ${limit}`}>
              {usage}
            </span>
          )
        },
        enableSorting: true,
      },
      // 11. Actions (Start/Stop/Restart/Logs/View details)
      {
        id: 'actions',
        header: '容器操作',
        cell: ({ row }) => {
          const container = row.original
          const isRunning = container.state === 'running'
          const isStopped = container.state === 'exited' || container.state === 'stopped' || container.state === 'created'
          const canStart = isStopped && container.host_id
          const canStop = isRunning && container.host_id
          const canRestart = isRunning && container.host_id

          return (
            <div className="flex items-center gap-1">
              <fieldset disabled={!canOperate} className="flex items-center gap-1 disabled:opacity-60">
                {/* Start button - enabled only when stopped */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (!container.host_id) {
                      toast.error('无法启动容器', {
                        description: '容器缺乏主机信息',
                      })
                      return
                    }
                    executeAction({
                      type: 'start',
                      container_id: container.id,
                      host_id: container.host_id,
                    })
                  }}
                  disabled={!canStart || isContainerPending(container.host_id || '', container.id)}
                  title="启动容器"
                >
                  <PlayCircle className={`h-4 w-4 ${canStart ? 'text-success' : 'text-muted-foreground'}`} />
                </Button>

                {/* Stop button - enabled only when running */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (!container.host_id) {
                      toast.error('无法停止容器', {
                        description: '容器缺乏主机信息',
                      })
                      return
                    }
                    executeAction({
                      type: 'stop',
                      container_id: container.id,
                      host_id: container.host_id,
                    })
                  }}
                  disabled={!canStop || isContainerPending(container.host_id || '', container.id)}
                  title="停止容器"
                >
                  <Square className={`h-4 w-4 ${canStop ? 'text-danger' : 'text-muted-foreground'}`} />
                </Button>

                {/* Restart button - enabled only when running */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (!container.host_id) {
                      toast.error('无法重启容器', {
                        description: '容器缺乏主机信息',
                      })
                      return
                    }
                    executeAction({
                      type: 'restart',
                      container_id: container.id,
                      host_id: container.host_id,
                    })
                  }}
                  disabled={!canRestart || isContainerPending(container.host_id || '', container.id)}
                  title="重启容器"
                >
                  <RotateCw className={`h-4 w-4 ${canRestart ? 'text-info' : 'text-muted-foreground'}`} />
                </Button>
              </fieldset>

              {/* Maximize button - opens full details modal (hidden in simplified workflow) */}
              {!simplifiedWorkflow && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    openModal(makeCompositeKey(container), 'info')
                  }}
                  title="查看完整信息"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}

              {/* Logs button - always enabled */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  openModal(makeCompositeKey(container), 'logs')
                }}
                title="查看容器日志"
              >
                <FileText className="h-4 w-4" />
              </Button>

              {/* Update badge - shows if update available */}
              <UpdateBadge
                hasUpdate={updatesSummary?.containers_with_updates?.includes(makeCompositeKey(container)) ?? false}
                onClick={() => {
                  openModal(makeCompositeKey(container), 'updates')
                }}
              />

              {/* WebUI link - shows if web_ui_url is defined and safe */}
              {container.web_ui_url && sanitizeHref(container.web_ui_url) && (
                <a
                  href={sanitizeHref(container.web_ui_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-surface-2 text-muted-foreground hover:text-primary transition-colors"
                  title="打开 WebUI"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )
        },
      },
    ],
    [executeAction, isContainerPending, selectedContainerIds, data, toggleContainerSelection, toggleSelectAll, alertCounts, allAutoUpdateConfigs, allHealthCheckConfigs, canOperate]
  )

  const table = useReactTable({
    data: filteredData || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const container = row.original

      // Search in container name
      if (container.name?.toLowerCase().includes(searchValue)) {
        return true
      }

      // Search in image
      if (container.image?.toLowerCase().includes(searchValue)) {
        return true
      }

      // Search in host name
      if (container.host_name?.toLowerCase().includes(searchValue)) {
        return true
      }

      // Search in tags array
      if (container.tags?.some(tag => tag.toLowerCase().includes(searchValue))) {
        return true
      }

      // Search in ports array (e.g., ["8080:80/tcp", "443:443/tcp"])
      if (container.ports?.some(port => port.toLowerCase().includes(searchValue))) {
        return true
      }

      // Search in primary IP address
      if (container.docker_ip?.toLowerCase().includes(searchValue)) {
        return true
      }

      // Search in all IP addresses (for multi-network containers)
      if (container.docker_ips) {
        const ipMatches = Object.values(container.docker_ips).some(ip =>
          ip.toLowerCase().includes(searchValue)
        )
        if (ipMatches) {
          return true
        }
      }

      return false
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      columnOrder,
    },
  })

  // Filter toggle handlers - update URL directly (URL is source of truth)
  const toggleHostFilter = (hostId: string) => {
    const params = new URLSearchParams(searchParams)
    const current = filters.selectedHostIds
    const newHosts = current.includes(hostId)
      ? current.filter(id => id !== hostId)
      : [...current, hostId]

    if (newHosts.length > 0) {
      params.set('host', newHosts.join(','))
    } else {
      params.delete('host')
    }
    setSearchParams(params, { replace: true })
  }

  const toggleStateFilter = (state: 'running' | 'stopped') => {
    const params = new URLSearchParams(searchParams)
    const current = filters.selectedStates
    const newStates = current.includes(state)
      ? current.filter(s => s !== state)
      : [...current, state]

    if (newStates.length > 0) {
      params.set('state', newStates.join(','))
    } else {
      params.delete('state')
    }
    setSearchParams(params, { replace: true })
  }

  const toggleDesiredStateFilter = (state: 'should_run' | 'on_demand' | 'unspecified') => {
    const params = new URLSearchParams(searchParams)
    const current = filters.selectedDesiredStates
    const newStates = current.includes(state)
      ? current.filter(s => s !== state)
      : [...current, state]

    if (newStates.length > 0) {
      params.set('desired_state', newStates.join(','))
    } else {
      params.delete('desired_state')
    }
    setSearchParams(params, { replace: true })
  }

  const togglePolicyFilter = (
    policy: 'auto_update' | 'auto_restart' | 'health_check',
    value: boolean
  ) => {
    const params = new URLSearchParams(searchParams)

    const paramNames = {
      auto_update: 'policy_auto_update',
      auto_restart: 'policy_auto_restart',
      health_check: 'policy_health_check',
    }

    const currentValues = {
      auto_update: filters.autoUpdateEnabled,
      auto_restart: filters.autoRestartEnabled,
      health_check: filters.healthCheckEnabled,
    }

    const currentValue = currentValues[policy]
    const paramName = paramNames[policy]

    // Mutual exclusivity: clicking same value clears, clicking opposite value toggles
    if (currentValue === value) {
      params.delete(paramName) // Clear filter
    } else {
      params.set(paramName, value ? 'enabled' : 'disabled') // Set to new value
    }
    setSearchParams(params, { replace: true })
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const hasActiveFilters =
    filters.selectedHostIds.length > 0 ||
    filters.selectedStates.length > 0 ||
    filters.autoUpdateEnabled !== null ||
    filters.autoRestartEnabled !== null ||
    filters.healthCheckEnabled !== null ||
    filters.showUpdatesAvailable ||
    filters.selectedDesiredStates.length > 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-1" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4">
        <p className="text-sm text-danger">
          加载容器时失败，请再试一次。
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${selectedContainerIds.size > 0 ? 'pb-[280px]' : ''}`}>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Search */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <Input
            placeholder="搜索容器..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="flex-1 sm:max-w-md"
            data-testid="containers-search-input"
          />
          <div className="text-sm text-muted-foreground whitespace-nowrap hidden sm:block">
            {table.getFilteredRowModel().rows.length} 个匹配的容器
          </div>
        </div>

        {/* Right: Filter dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              清除过滤器
            </Button>
          )}

          {/* Hosts Filter */}
          <DropdownMenu
            trigger={
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-2" />
                主机
                {filters.selectedHostIds.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                    {filters.selectedHostIds.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 ml-2" />
              </Button>
            }
            align="end"
          >
            <div className="max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {hosts && hosts.length > 0 ? (
                hosts.map((host) => (
                  <div
                    key={host.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                    onClick={() => toggleHostFilter(host.id)}
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      {filters.selectedHostIds.includes(host.id) && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <span className="text-xs">{host.name}</span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-muted-foreground">没有可用的主机</div>
              )}
            </div>
          </DropdownMenu>

          {/* Policy Filter */}
          <DropdownMenu
            trigger={
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-2" />
                策略
                {(filters.autoUpdateEnabled !== null || filters.autoRestartEnabled !== null || filters.healthCheckEnabled !== null || filters.selectedDesiredStates.length > 0) && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                    {[filters.autoUpdateEnabled, filters.autoRestartEnabled, filters.healthCheckEnabled].filter(v => v !== null).length + filters.selectedDesiredStates.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 ml-2" />
              </Button>
            }
            align="end"
          >
            <div onClick={(e) => e.stopPropagation()} className="min-w-[200px]">
              {/* Auto-update section */}
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">自动更新</div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('auto_update', true)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.autoUpdateEnabled === true && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已启用</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('auto_update', false)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.autoUpdateEnabled === false && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已禁用</span>
              </div>

              <DropdownMenuSeparator />

              {/* Auto-restart section */}
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">自动重启</div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('auto_restart', true)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.autoRestartEnabled === true && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已启用</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('auto_restart', false)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.autoRestartEnabled === false && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已禁用</span>
              </div>

              <DropdownMenuSeparator />

              {/* Health check section */}
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">HTTP/HTTPS 健康检查</div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('health_check', true)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.healthCheckEnabled === true && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已启用</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => togglePolicyFilter('health_check', false)}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.healthCheckEnabled === false && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已禁用</span>
              </div>

              <DropdownMenuSeparator />

              {/* Desired State section */}
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">期望状态</div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleDesiredStateFilter('should_run')}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.selectedDesiredStates.includes('should_run') && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">始终运行</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleDesiredStateFilter('on_demand')}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.selectedDesiredStates.includes('on_demand') && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">按需运行</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleDesiredStateFilter('unspecified')}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.selectedDesiredStates.includes('unspecified') && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">尚未指定</span>
              </div>
            </div>
          </DropdownMenu>

          {/* State Filter */}
          <DropdownMenu
            trigger={
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-2" />
                状态
                {(filters.selectedStates.length > 0 || filters.showUpdatesAvailable) && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                    {filters.selectedStates.length + (filters.showUpdatesAvailable ? 1 : 0)}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 ml-2" />
              </Button>
            }
            align="end"
          >
            <div onClick={(e) => e.stopPropagation()}>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleStateFilter('running')}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.selectedStates.includes('running') && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">运行中</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => toggleStateFilter('stopped')}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.selectedStates.includes('stopped') && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">已停止</span>
              </div>
              <div
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  if (filters.showUpdatesAvailable) {
                    params.delete('updates')
                  } else {
                    params.set('updates', 'true')
                  }
                  setSearchParams(params, { replace: true })
                }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filters.showUpdatesAvailable && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-xs">有可用更新</span>
              </div>
            </div>
          </DropdownMenu>

          {/* Column Customization */}
          <ColumnCustomizationPanel table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full" data-testid="containers-table">
          <thead className="border-b border-border bg-muted/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-sm font-medium ${
                      header.column.columnDef.meta?.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  未找到任何容器
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t hover:bg-[#151827] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${
                        cell.column.columnDef.meta?.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Container Drawer */}
      <ContainerDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedContainerId(null)
        }}
        containerId={selectedContainerId}
        onExpand={() => {
          setDrawerOpen(false)
          // Open global modal when expanding from drawer
          if (selectedContainerId) {
            openModal(selectedContainerId, 'info')
          }
        }}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedContainerIds.size}
        selectedContainers={data?.filter((c) => selectedContainerIds.has(makeCompositeKey(c))) || []}
        onClearSelection={clearSelection}
        onAction={handleBulkAction}
        onCheckUpdates={handleCheckUpdates}
        onDelete={handleDeleteContainers}
        onUpdateContainers={handleUpdateContainers}
        onTagUpdate={handleBulkTagUpdate}
        onAutoRestartUpdate={handleBulkAutoRestartUpdate}
        onAutoUpdateUpdate={handleBulkAutoUpdateUpdate}
        onDesiredStateUpdate={handleBulkDesiredStateUpdate}
      />

      {/* Bulk Action Confirmation Modal */}
      <BulkActionConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false)
          setPendingAction(null)
        }}
        onConfirm={handleConfirmBulkAction}
        action={pendingAction || 'start'}
        containers={
          data?.filter((c) => selectedContainerIds.has(makeCompositeKey(c))) || []
        }
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmModalOpen}
        onClose={() => setDeleteConfirmModalOpen(false)}
        onConfirm={handleConfirmDeleteContainers}
        containers={
          data?.filter((c) => selectedContainerIds.has(makeCompositeKey(c))) || []
        }
      />

      {/* Update Confirmation Modal */}
      <UpdateConfirmModal
        isOpen={updateConfirmModalOpen}
        onClose={() => setUpdateConfirmModalOpen(false)}
        onConfirm={handleConfirmUpdateContainers}
        containers={
          data?.filter((c) => selectedContainerIds.has(makeCompositeKey(c))) || []
        }
      />

      {/* Batch Update Validation Confirmation Modal */}
      {validationData && (
        <BatchUpdateValidationConfirmModal
          isOpen={validationModalOpen}
          onClose={() => {
            setValidationModalOpen(false)
            setValidationData(null)
          }}
          onConfirm={handleConfirmValidatedUpdate}
          allowed={validationData.allowed}
          warned={validationData.warned}
          blocked={validationData.blocked}
        />
      )}

      {/* Batch Job Progress Panel */}
      <BatchJobPanel
        jobId={batchJobId}
        isVisible={showJobPanel}
        onClose={() => setShowJobPanel(false)}
        onJobComplete={handleJobComplete}
        bulkActionBarOpen={selectedContainerIds.size > 0}
      />

      {/* Alert Details Drawer */}
      {selectedAlertId && (
        <AlertDetailsDrawer alertId={selectedAlertId} onClose={() => setSelectedAlertId(null)} />
      )}

      {/* Host Details Modal */}
      <HostDetailsModal
        hostId={hostModalHostId}
        host={hosts?.find(h => h.id === hostModalHostId) ?? null}
        open={!!hostModalHostId}
        onClose={() => setHostModalHostId(null)}
      />
    </div>
  )
}
