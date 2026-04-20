/**
 * Container Updates Tab
 *
 * Shows update status and allows manual update checks
 * Includes update policy selector and validation
 */

import { memo, useState, useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Package, RefreshCw, Check, AlertCircle, Download, Shield, ExternalLink, Edit2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useTimeFormat } from '@/lib/hooks/useUserPreferences'
import { formatDateTime } from '@/lib/utils/timeFormat'
import { useContainerUpdateStatus, useCheckContainerUpdate, useUpdateAutoUpdateConfig, useExecuteUpdate } from '../../hooks/useContainerUpdates'
import { useSetContainerUpdatePolicy } from '../../hooks/useUpdatePolicies'
import { UpdateValidationConfirmModal } from '../UpdateValidationConfirmModal'
import { LayerProgressDisplay } from '@/components/shared/LayerProgressDisplay'
import { getRegistryUrl, getRegistryName } from '@/lib/utils/registry'
import type { Container } from '../../types'
import type { UpdatePolicyValue } from '../../types/updatePolicy'
import { POLICY_OPTIONS } from '../../types/updatePolicy'

export interface ContainerUpdatesTabProps {
  container: Container
}

function ContainerUpdatesTabInternal({ container }: ContainerUpdatesTabProps) {
  const { hasCapability } = useAuth()
  const canUpdate = hasCapability('containers.update')
  const canManagePolicy = hasCapability('policies.manage')
  const { timeFormat } = useTimeFormat()
  // CRITICAL: Always use 12-char short ID for API calls (backend expects short IDs)
  const containerShortId = container.id.slice(0, 12)

  const { data: updateStatus, isLoading } = useContainerUpdateStatus(
    container.host_id,
    containerShortId
  )
  const checkUpdate = useCheckContainerUpdate()
  const updateAutoUpdateConfig = useUpdateAutoUpdateConfig()
  const executeUpdate = useExecuteUpdate()
  const setContainerPolicy = useSetContainerUpdatePolicy()

  // Local state for settings
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(updateStatus?.auto_update_enabled ?? false)
  const [trackingMode, setTrackingMode] = useState<string>(updateStatus?.floating_tag_mode || 'exact')
  const [updatePolicy, setUpdatePolicy] = useState<UpdatePolicyValue>(null)

  // Changelog URL state (v2.0.2+)
  const [changelogUrl, setChangelogUrl] = useState<string>('')
  const [isEditingChangelog, setIsEditingChangelog] = useState(false)

  // Registry page URL state (v2.0.2+)
  const [registryPageUrl, setRegistryPageUrl] = useState<string>('')
  const [isEditingRegistry, setIsEditingRegistry] = useState(false)

  // Update progress state (minimal - just track if updating)
  const [isUpdating, setIsUpdating] = useState(false)

  // Validation confirmation modal state
  const [validationConfirmOpen, setValidationConfirmOpen] = useState(false)
  const [validationReason, setValidationReason] = useState<string>('')
  const [validationPattern, setValidationPattern] = useState<string | undefined>()

  // Rate limiting state for "Check Now" button
  const [lastCheckTime, setLastCheckTime] = useState<number>(0)

  // Sync local state when server data changes
  useEffect(() => {
    if (updateStatus) {
      setAutoUpdateEnabled(updateStatus.auto_update_enabled ?? false)
      setTrackingMode(updateStatus.floating_tag_mode || 'exact')
      setUpdatePolicy(updateStatus.update_policy ?? null)
      setChangelogUrl(updateStatus.changelog_url || '')  // v2.0.2+
      setRegistryPageUrl(updateStatus.registry_page_url || '')  // v2.0.2+
    }
  }, [updateStatus])

  const handleCheckNow = async () => {
    if (!container.host_id) {
      toast.error('无法检查更新', {
        description: '容器缺乏主机信息',
      })
      return
    }

    // Rate limiting: prevent spamming "Check Now" button (5 second minimum between checks)
    const now = Date.now()
    const MIN_CHECK_INTERVAL_MS = 5000 // 5 seconds
    if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
      const remainingSeconds = Math.ceil((MIN_CHECK_INTERVAL_MS - (now - lastCheckTime)) / 1000)
      toast.warning(`请等待 ${remainingSeconds} 秒后再执行更新操作`)
      return
    }
    setLastCheckTime(now)

    try {
      await checkUpdate.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
      })
      toast.success('检查更新完成')
      // Query will auto-invalidate via the mutation's onSuccess
    } catch (error) {
      toast.error('检查更新时出错', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleUpdateNow = async () => {
    await performUpdate(false)
  }

  const handleAutoUpdateToggle = async (enabled: boolean) => {
    if (!container.host_id) {
      toast.error('无法配置自动更新', {
        description: '容器缺乏主机信息',
      })
      return
    }

    try {
      // Don't update local state optimistically - wait for server response
      const result = await updateAutoUpdateConfig.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        autoUpdateEnabled: enabled,
        floatingTagMode: trackingMode as 'exact' | 'patch' | 'minor' | 'latest',
      })
      // Update local state only after successful server save
      setAutoUpdateEnabled(result.auto_update_enabled ?? false)
      toast.success(enabled ? '自动更新已启用' : '自动更新已禁用')
    } catch (error) {
      // No need to revert - we never changed it optimistically
      toast.error('更新自动更新设置时出错', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleTrackingModeChange = async (mode: string) => {
    if (!container.host_id) {
      toast.error('无法配置追踪模式', {
        description: '容器缺乏主机信息',
      })
      return
    }

    try {
      // Don't update local state optimistically - wait for server response
      const result = await updateAutoUpdateConfig.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        autoUpdateEnabled,
        floatingTagMode: mode as 'exact' | 'patch' | 'minor' | 'latest',
      })
      // Update local state only after successful server save
      setTrackingMode(result.floating_tag_mode || 'exact')
      toast.success('追踪模式已更新')
    } catch (error) {
      // No need to revert - we never changed it optimistically
      toast.error('无法更新追踪模式', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handlePolicyChange = async (policy: UpdatePolicyValue) => {
    if (!container.host_id) {
      toast.error('无法配置更新策略', {
        description: '容器缺乏主机信息',
      })
      return
    }

    try {
      // Don't update local state optimistically - wait for server response
      const result = await setContainerPolicy.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        policy,
      })
      // Update local state only after successful server save
      setUpdatePolicy(result.update_policy ?? null)
      const policyLabel = POLICY_OPTIONS.find((opt) => opt.value === policy)?.label || 'Auto-detect'
      toast.success(`更新更新策略为${policyLabel}`)
    } catch (error) {
      // No need to revert - we never changed it optimistically
      toast.error('更新更新策略时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleChangelogSave = async () => {
    if (!container.host_id) {
      toast.error('无法保存更新日志 URL', {
        description: '容器缺乏主机信息',
      })
      return
    }

    // Validate URL format if not empty
    if (changelogUrl.trim()) {
      try {
        new URL(changelogUrl.trim())
      } catch {
        toast.error('无效的 URL', {
          description: '请输入一个合法的 URL (例如 https://github.com/user/repo/releases)',
        })
        return
      }
    }

    try {
      // Don't update local state optimistically - wait for server response
      const result = await updateAutoUpdateConfig.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        autoUpdateEnabled,
        floatingTagMode: trackingMode as 'exact' | 'patch' | 'minor' | 'latest',
        changelogUrl: changelogUrl.trim() || null,  // v2.0.2+
      })
      // Update local state only after successful server save
      setChangelogUrl(result.changelog_url || '')
      toast.success(changelogUrl.trim() ? '更新日志 URL 已保存' : '更新日志 URL 已清空')
      setIsEditingChangelog(false)
    } catch (error) {
      // No need to revert - we never changed it optimistically
      toast.error('保存更新日志 URL 时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleRegistrySave = async () => {
    if (!container.host_id) {
      toast.error('无法保存注册表 URL', {
        description: '容器缺乏主机信息',
      })
      return
    }

    // Validate URL format if not empty
    if (registryPageUrl.trim()) {
      try {
        new URL(registryPageUrl.trim())
      } catch {
        toast.error('无效的 URL', {
          description: '请输入一个合法的 URL (例如 https://hub.docker.com/r/user/image)',
        })
        return
      }
    }

    try {
      // Don't update local state optimistically - wait for server response
      const result = await updateAutoUpdateConfig.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        autoUpdateEnabled,
        floatingTagMode: trackingMode as 'exact' | 'patch' | 'minor' | 'latest',
        registryPageUrl: registryPageUrl.trim() || null,  // v2.0.2+
      })
      // Update local state only after successful server save
      setRegistryPageUrl(result.registry_page_url || '')
      toast.success(registryPageUrl.trim() ? '注册表 URL 已保存' : '注册表 URL 已清空')
      setIsEditingRegistry(false)
    } catch (error) {
      // No need to revert - we never changed it optimistically
      toast.error('保存注册表 URL 时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleConfirmUpdate = async () => {
    // User confirmed, proceed with update
    await performUpdate(true)
  }

  const performUpdate = async (force: boolean = false) => {
    if (!container.host_id) {
      toast.error('无法执行更新操作', {
        description: '容器缺乏主机信息',
      })
      return
    }

    // Mark as updating (progress will be tracked by LayerProgressDisplay)
    setIsUpdating(true)

    try {
      const result = await executeUpdate.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        force,
      })

      // Check if update is blocked by policy
      if (result.status === 'blocked' || result.validation === 'block') {
        setIsUpdating(false)
        toast.error('被更新策略阻止', {
          description: result.reason || '此容器包含一个禁止策略阻止了更新操作',
        })
        return
      }

      // Check if validation warning returned
      if (!force && result.validation === 'warn') {
        setValidationReason(result.reason || '此容器匹配到了一个更新验证模式')
        setValidationPattern(result.matched_pattern)
        setValidationConfirmOpen(true)
        setIsUpdating(false)
        return
      }

      // Check if update failed (e.g., health check timeout, startup issues)
      if (result.status === 'failed') {
        setIsUpdating(false)
        toast.error(result.message || '容器更新失败', {
          description: result.detail || '更新失败，此容器已自动恢复到之前的状态。',
          duration: 10000, // Longer duration for important failure message
        })
        return
      }

      toast.success('容器已成功更新', {
        description: result.message,
      })
      setIsUpdating(false)
      // Query will auto-invalidate via the mutation's onSuccess
    } catch (error) {
      setIsUpdating(false)
      toast.error('更新容器时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasUpdate = updateStatus?.update_available
  const lastChecked = updateStatus?.last_checked_at
    ? formatDateTime(updateStatus.last_checked_at, timeFormat)
    : '从未进行'

  // Check if auto-updates are enabled but won't work due to blockers
  const isComposeBlocked = updateStatus?.is_compose_container && updateStatus?.skip_compose_enabled
  const isValidationBlocked = updateStatus?.validation_info?.result === 'block'
  const isValidationWarned = updateStatus?.validation_info?.result === 'warn'

  const hasBlockers = autoUpdateEnabled && (isComposeBlocked || isValidationBlocked || isValidationWarned)

  return (
    <div className="p-6 space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hasUpdate ? (
            <>
              <Package className="h-8 w-8 text-amber-500" />
              <div>
                <h3 className="text-lg font-semibold text-amber-500">更新可用</h3>
                <p className="text-sm text-muted-foreground">
                  此容器的镜像有可用的新版本。
                </p>
              </div>
            </>
          ) : (
            <>
              <Check className="h-8 w-8 text-success" />
              <div>
                <h3 className="text-lg font-semibold">已是最新</h3>
                <p className="text-sm text-muted-foreground">
                  此容器正在使用最新的镜像版本。
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <fieldset disabled={!canUpdate} className="flex gap-2 disabled:opacity-60">
            {hasUpdate && (
              <Button
                onClick={handleUpdateNow}
                disabled={executeUpdate.isPending}
                variant="default"
              >
                {executeUpdate.isPending ? (
                  <>
                    <Download className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    立即更新
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleCheckNow}
              disabled={checkUpdate.isPending}
              variant="outline"
            >
              {checkUpdate.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  检查中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  立即检查
                </>
              )}
            </Button>
          </fieldset>
          {updateStatus && (
            <p className="text-xs text-muted-foreground">
              上次检查时间: {lastChecked}
            </p>
          )}
        </div>
      </div>

      {/* Auto-Update Blocker Warning */}
      {hasBlockers && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-200 mb-2">
                自动更新操作不会被自动运行
              </h4>
              <p className="text-sm text-yellow-200/90 mb-3">
                尽管已启用自动更新操作，但此容器不会被自动更新，因为:
              </p>
              <ul className="text-sm text-yellow-200/90 space-y-1.5">
                {isComposeBlocked && (
                  <li className="flex flex-col gap-1">
                    <span>• 此容器由 Docker Compose 创建，但该功能已被 DockMon 设置阻止。</span>
                    <span className="text-xs text-yellow-200/70 ml-4">
                      请更改设置 → 容器更新 → "跳过 Docker Compose 容器"
                    </span>
                  </li>
                )}
                {isValidationBlocked && updateStatus?.validation_info && (
                  <li className="flex flex-col gap-1">
                    <span>• {updateStatus.validation_info.reason}</span>
                    <span className="text-xs text-yellow-200/70 ml-4">
                      {updateStatus.validation_info.matched_pattern
                        ? `请更改设置 → 更新验证 → 编辑模式 "${updateStatus.validation_info.matched_pattern}"`
                        : '请更改设置 → 更新验证或者更新容器策略'
                      }
                    </span>
                  </li>
                )}
                {isValidationWarned && updateStatus?.validation_info && (
                  <li className="flex flex-col gap-1">
                    <span>• 需要手动确认: {updateStatus.validation_info.reason}</span>
                    <span className="text-xs text-yellow-200/70 ml-4">
                      {updateStatus.validation_info.matched_pattern
                        ? `匹配到模式 "${updateStatus.validation_info.matched_pattern}" - 每次更新前都需要确认`
                        : '每次更新前都需要手动确认'
                      }
                    </span>
                  </li>
                )}
              </ul>
              <p className="text-xs text-yellow-200/70 mt-3">
                注意，仍然可使用上方的 "立即更新" 按钮进行手动更新。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress - Using shared LayerProgressDisplay component */}
      {isUpdating && container.host_id && (
        <LayerProgressDisplay
          hostId={container.host_id}
          entityId={containerShortId}
          eventType="container_update_layer_progress"
          simpleProgressEventType="container_update_progress"
          initialProgress={0}
          initialMessage="初始化更新中..."
        />
      )}

      {/* Update details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Current Image */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">当前镜像</h4>
          </div>
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">镜像</p>
              <p className="text-sm font-mono break-all">
                {updateStatus?.current_image || container.image}
              </p>
            </div>
            {updateStatus?.current_version && (
              <div>
                <p className="text-xs text-muted-foreground">版本</p>
                <p className="text-sm font-semibold">{updateStatus.current_version}</p>
              </div>
            )}
            {updateStatus?.current_digest && (
              <div>
                <p className="text-xs text-muted-foreground">摘要</p>
                <p className="text-sm font-mono text-xs">{updateStatus.current_digest}</p>
              </div>
            )}
          </div>
        </div>

        {/* Latest Image */}
        {hasUpdate && updateStatus && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium text-amber-500">最新可用</h4>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">镜像</p>
                <p className="text-sm font-mono break-all">{updateStatus.latest_image}</p>
              </div>
              {updateStatus.latest_version && (
                <div>
                  <p className="text-xs text-muted-foreground">版本</p>
                  <p className="text-sm font-semibold text-amber-500">{updateStatus.latest_version}</p>
                </div>
              )}
              {updateStatus.latest_digest && (
                <div>
                  <p className="text-xs text-muted-foreground">摘要</p>
                  <p className="text-sm font-mono text-xs">{updateStatus.latest_digest}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Changelog & Registry Links (v2.0.2+) */}
      <fieldset disabled={!canUpdate} className="border-t pt-6 disabled:opacity-60">
        <h4 className="text-lg font-medium text-foreground mb-4">资源链接</h4>

        <div className="grid grid-cols-2 gap-6">
          {/* Changelog URL */}
          <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">更新日志</label>
            {updateStatus?.changelog_source === 'manual' && (
              <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded">手动添加</span>
            )}
            {updateStatus?.changelog_source && updateStatus.changelog_source !== 'manual' && updateStatus.changelog_source !== 'failed' && (
              <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded">自动检测</span>
            )}
          </div>

          {isEditingChangelog ? (
            <div className="flex gap-2">
              <Input
                value={changelogUrl}
                onChange={(e) => setChangelogUrl(e.target.value)}
                placeholder="https://github.com/user/repo/releases"
                className="flex-1"
              />
              <Button onClick={handleChangelogSave} size="sm" disabled={updateAutoUpdateConfig.isPending}>
                {updateAutoUpdateConfig.isPending ? '保存中...' : '保存'}
              </Button>
              <Button onClick={() => {
                setChangelogUrl(updateStatus?.changelog_url || '')
                setIsEditingChangelog(false)
              }} size="sm" variant="outline">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {changelogUrl ? (
                <a
                  href={changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 bg-muted rounded-lg p-3 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{changelogUrl}</span>
                </a>
              ) : (
                <div className="flex-1 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  未设置更新日志 URL
                </div>
              )}
              <Button
                onClick={() => setIsEditingChangelog(true)}
                size="sm"
                variant="outline"
                className="flex-shrink-0"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                {changelogUrl ? '编辑' : '添加'}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {updateStatus?.changelog_source === 'manual'
              ? '手动添加的 URL 会被保留，不会被自动检测功能覆盖。清除后可重新启用自动检测功能。'
              : '自动检测得到的更新日志链接可以被自定义的 URL 覆盖。'}
          </p>
        </div>

          {/* Docker Registry Link */}
          <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Docker 注册表</label>
            {updateStatus?.registry_page_source === 'manual' && (
              <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded">手动添加</span>
            )}
            {!updateStatus?.registry_page_source && (
              <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-400/10 rounded">自动检测</span>
            )}
          </div>

          {isEditingRegistry ? (
            <div className="flex gap-2">
              <Input
                value={registryPageUrl}
                onChange={(e) => setRegistryPageUrl(e.target.value)}
                placeholder="https://hub.docker.com/r/user/image"
                className="flex-1"
              />
              <Button onClick={handleRegistrySave} size="sm" disabled={updateAutoUpdateConfig.isPending}>
                {updateAutoUpdateConfig.isPending ? '保存中...' : '保存'}
              </Button>
              <Button onClick={() => {
                setRegistryPageUrl(updateStatus?.registry_page_url || '')
                setIsEditingRegistry(false)
              }} size="sm" variant="outline">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {/* Use manual URL if set, otherwise auto-detect */}
              {(() => {
                const displayUrl = registryPageUrl || getRegistryUrl(container.image)
                const displayName = registryPageUrl ? '查看注册表' : `在 ${getRegistryName(container.image)} 上查看`
                return (
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 bg-muted rounded-lg p-3 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{displayName}</span>
                  </a>
                )
              })()}
              <Button
                onClick={() => setIsEditingRegistry(true)}
                size="sm"
                variant="outline"
                className="flex-shrink-0"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                {registryPageUrl ? '编辑' : '添加'}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {updateStatus?.registry_page_source === 'manual'
              ? '手动添加的 URL 会被保留，不会被自动检测功能覆盖。清除后可重新启用自动检测功能。'
              : '自动检测得到的更新日志链接可以被自定义的 URL 覆盖。'}
          </p>
          </div>
        </div>
      </fieldset>

      {/* Settings */}
      <div className="space-y-4 border-t pt-6">
        <h4 className="text-lg font-medium text-foreground mb-3">更新设置</h4>

        <div className="space-y-4">
          {/* Auto-update toggle */}
          <fieldset disabled={!canUpdate} className="disabled:opacity-60">
          <div className="flex items-start justify-between py-4">
            <div className="flex-1 mr-4">
              <label htmlFor="auto-update" className="text-sm font-medium cursor-pointer">
                自动更新
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                当有新版本镜像可用时，自动更新此容器。
              </p>
            </div>
            <Switch
              id="auto-update"
              checked={autoUpdateEnabled}
              onCheckedChange={handleAutoUpdateToggle}
              disabled={updateAutoUpdateConfig.isPending}
            />
          </div>

          {/* Tracking mode selector */}
          <div className="py-4">
            <div className="mb-3">
              <label className="text-sm font-medium">
                追踪模式
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                选择 DockMon 追踪此容器镜像更新的策略。
              </p>
            </div>

            <div className="space-y-3">
              {/* Respect Tag (was "exact") */}
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  trackingMode === 'exact'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${updateAutoUpdateConfig.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="tracking-mode"
                  value="exact"
                  checked={trackingMode === 'exact'}
                  onChange={(e) => handleTrackingModeChange(e.target.value)}
                  disabled={updateAutoUpdateConfig.isPending}
                  className="mt-0.5 h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">遵循标签</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    使用容器或者 Compose 配置文件中定义的镜像标签。如果标签是确定的 (例如 nginx:1.25.3)，
                    则容器将保持在该版本。如果是可变的 (例如 :latest)，则 DockMon 将拉取该标签对应的最新镜像。
                  </p>
                </div>
              </label>

              {/* Patch Updates */}
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  trackingMode === 'patch'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${updateAutoUpdateConfig.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="tracking-mode"
                  value="patch"
                  checked={trackingMode === 'patch'}
                  onChange={(e) => handleTrackingModeChange(e.target.value)}
                  disabled={updateAutoUpdateConfig.isPending}
                  className="mt-0.5 h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">补丁更新</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    仅追踪补丁类型的更新 (或者错误修复)。
                    例如: nginx:1.25.3 → 将追踪 1.25.x (会更新至 1.25.4、1.25.99，但不会更新至 1.26.0)。最为保守的选项。
                  </p>
                </div>
              </label>

              {/* Minor Updates */}
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  trackingMode === 'minor'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${updateAutoUpdateConfig.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="tracking-mode"
                  value="minor"
                  checked={trackingMode === 'minor'}
                  onChange={(e) => handleTrackingModeChange(e.target.value)}
                  disabled={updateAutoUpdateConfig.isPending}
                  className="mt-0.5 h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">小型更新</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    在同一个主版本内追踪次要版本和补丁更新。
                    例如: nginx:1.25.3 → 将追踪 1.x (会更新至 1.26.0、1.99.0，但不会更新至 2.0.0)。推荐大多数用户使用。
                  </p>
                </div>
              </label>

              {/* Always Latest */}
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  trackingMode === 'latest'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${updateAutoUpdateConfig.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="tracking-mode"
                  value="latest"
                  checked={trackingMode === 'latest'}
                  onChange={(e) => handleTrackingModeChange(e.target.value)}
                  disabled={updateAutoUpdateConfig.isPending}
                  className="mt-0.5 h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">保持最新</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    始终追踪 :latest 标签，而不考虑当前版本情况。这将始终拉取最新可用的镜像版本，但可能会包含破坏性的更改。
                  </p>
                </div>
              </label>
            </div>
          </div>
          </fieldset>

          {/* Update policy selector */}
          <fieldset disabled={!canManagePolicy} className="disabled:opacity-60">
          <div className="flex items-start justify-between py-4 border-t">
            <div className="flex-1 mr-4">
              <label htmlFor="update-policy" className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                更新策略
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                控制此容器何时可以被更新。
              </p>
            </div>
            <Select
              value={updatePolicy ?? 'null'}
              onValueChange={(value) => handlePolicyChange(value === 'null' ? null : value as UpdatePolicyValue)}
              disabled={setContainerPolicy.isPending}
            >
              <SelectTrigger id="update-policy" className="w-[180px]">
                <SelectValue>
                  {POLICY_OPTIONS.find((opt) => opt.value === updatePolicy)?.label || '使用全局设置'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((option) => (
                  <SelectItem key={option.value ?? 'null'} value={option.value ?? 'null'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </fieldset>
        </div>
      </div>

      {/* Validation Confirmation Modal */}
      <UpdateValidationConfirmModal
        isOpen={validationConfirmOpen}
        onClose={() => setValidationConfirmOpen(false)}
        onConfirm={handleConfirmUpdate}
        containerName={container.name}
        reason={validationReason}
        matchedPattern={validationPattern}
      />

      {/* Help text */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium">关于容器更新</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>DockMon 会根据配置的时间每天自动检查更新</li>
          <li>点击 "立即检查" 按钮可用手动检查更新</li>
          <li>启用自动更新后，在有可用更新时会自动拉取并重建容器</li>
          <li>更新后会验证容器的健康状态，以确保更新成功</li>
          <li>更新检查基于镜像的摘要进行比较，而非仅根据标签</li>
          <li>对于由 Compose 文件管理的容器，更新仅针对正在运行的容器本身。请及时更新你的 compose 文件以持久化更改</li>
        </ul>
      </div>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
// Return true if props are equal (should NOT re-render)
export const ContainerUpdatesTab = memo(ContainerUpdatesTabInternal, (prevProps, nextProps) => {
  // Only re-render if container ID or host ID changes
  const areEqual = (
    prevProps.container.id === nextProps.container.id &&
    prevProps.container.host_id === nextProps.container.host_id
  )
  return areEqual
})
