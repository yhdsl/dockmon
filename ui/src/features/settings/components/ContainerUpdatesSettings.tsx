/**
 * Container Updates Settings Component
 * Configure automatic update checks, validation policies, and registry credentials
 */

import { useState, useEffect } from 'react'
import { useGlobalSettings, useUpdateGlobalSettings } from '@/hooks/useSettings'
import { toast } from 'sonner'
import { RefreshCw, Database, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api/client'
import { useCheckAllUpdates } from '@/features/containers/hooks/useContainerUpdates'
import { ToggleSwitch } from './ToggleSwitch'
import { UpdatePoliciesSettings } from './UpdatePoliciesSettings'
import { RegistryCredentialsSettings } from './RegistryCredentialsSettings'
import { useAuth } from '@/features/auth/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ImageCacheEntry {
  cache_key: string
  digest: string
  registry_url: string
  ttl_seconds: number
  checked_at: string
  expires_at: string
  remaining_seconds: number
  is_expired: boolean
}

interface ImageCacheResponse {
  total_entries: number
  entries: ImageCacheEntry[]
}

export function ContainerUpdatesSettings() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('policies.manage')
  const { data: settings } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()
  const checkAllUpdates = useCheckAllUpdates()

  const [updateCheckTime, setUpdateCheckTime] = useState(settings?.update_check_time ?? '02:00')
  const [skipComposeContainers, setSkipComposeContainers] = useState(settings?.skip_compose_containers ?? true)
  const [healthCheckTimeout, setHealthCheckTimeout] = useState(settings?.health_check_timeout_seconds ?? 120)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)

  // Image pruning settings
  const [pruneImagesEnabled, setPruneImagesEnabled] = useState(settings?.prune_images_enabled ?? true)
  const [imageRetentionCount, setImageRetentionCount] = useState(settings?.image_retention_count ?? 2)
  const [imagePruneGraceHours, setImagePruneGraceHours] = useState(settings?.image_prune_grace_hours ?? 48)
  const [isPruningImages, setIsPruningImages] = useState(false)

  // Image cache modal
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false)
  const [cacheData, setCacheData] = useState<ImageCacheResponse | null>(null)
  const [isLoadingCache, setIsLoadingCache] = useState(false)

  // Sync state when settings load from API
  useEffect(() => {
    if (settings) {
      setUpdateCheckTime(settings.update_check_time ?? '02:00')
      setSkipComposeContainers(settings.skip_compose_containers ?? true)
      setHealthCheckTimeout(settings.health_check_timeout_seconds ?? 120)
      setPruneImagesEnabled(settings.prune_images_enabled ?? true)
      setImageRetentionCount(settings.image_retention_count ?? 2)
      setImagePruneGraceHours(settings.image_prune_grace_hours ?? 48)
    }
  }, [settings])

  // Validate schedule format (HH:MM or cron expression)
  const isValidSchedule = (schedule: string): boolean => {
    const trimmed = schedule.trim()
    // HH:MM format (simple daily time)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (timeRegex.test(trimmed)) return true

    // Cron expression (5 fields: minute hour day-of-month month day-of-week)
    // Basic validation: 5 space-separated fields with valid characters
    const cronParts = trimmed.split(/\s+/)
    if (cronParts.length !== 5) return false

    // Each field should contain only valid cron characters
    const cronCharRegex = /^[\d,\-*/]+$/
    return cronParts.every(part => cronCharRegex.test(part))
  }

  const handleUpdateCheckTimeBlur = async () => {
    if (updateCheckTime !== settings?.update_check_time) {
      const trimmed = updateCheckTime.trim()
      if (!isValidSchedule(trimmed)) {
        toast.error('无效的调度格式。 请使用 HH:MM (例如 02:00) 或者 cron 表达式 (例如 0 4 * * 6)')
        setUpdateCheckTime(settings?.update_check_time ?? '02:00')
        return
      }

      try {
        await updateSettings.mutateAsync({ update_check_time: trimmed })
        toast.success('已成功更新更新调度')
      } catch (error) {
        toast.error('无法更新更新调度')
      }
    }
  }

  const handleSkipComposeToggle = async (checked: boolean) => {
    setSkipComposeContainers(checked)
    try {
      await updateSettings.mutateAsync({ skip_compose_containers: checked })
      toast.success(checked ? '由 Compose 创建的容器将会被跳过' : '由 Compose 创建的容器将一同更新')
    } catch (error) {
      toast.error('无法更新更新设置')
      setSkipComposeContainers(!checked) // Revert on error
    }
  }

  const handleHealthCheckTimeoutBlur = async () => {
    if (healthCheckTimeout !== settings?.health_check_timeout_seconds) {
      if (healthCheckTimeout < 10 || healthCheckTimeout > 600) {
        toast.error('超时时长必须在 10 到 600 秒之间')
        setHealthCheckTimeout(settings?.health_check_timeout_seconds ?? 120)
        return
      }

      try {
        await updateSettings.mutateAsync({ health_check_timeout_seconds: healthCheckTimeout })
        toast.success('已成功更新健康检查超时时长')
      } catch (error) {
        toast.error('无法更新健康检查超时时长')
      }
    }
  }

  const handleCheckAllNow = async () => {
    setIsCheckingUpdates(true)
    try {
      // Use the hook mutation which properly invalidates caches (fixes #115)
      const stats = await checkAllUpdates.mutateAsync()

      if (stats.errors > 0) {
        toast.warning(
          `已完成更新检查，但存在部分错误。 已检查 ${stats.checked}/${stats.total} 个容器，共发现 ${stats.updates_found} 个更新可用。`,
          { duration: 5000 }
        )
      } else {
        toast.success(
          `已成功完成更新检查! 已检查 ${stats.checked} 个容器，共发现 ${stats.updates_found} 个更新可用。`,
          { duration: 5000 }
        )
      }
    } catch (error) {
      toast.error(`检查更新时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handlePruneImagesToggle = async (checked: boolean) => {
    setPruneImagesEnabled(checked)
    try {
      await updateSettings.mutateAsync({ prune_images_enabled: checked })
      toast.success(checked ? '镜像清理已启用' : '镜像清理已禁用')
    } catch (error) {
      toast.error('无法更新镜像清理设置')
      setPruneImagesEnabled(!checked) // Revert on error
    }
  }

  const handleImageRetentionCountBlur = async () => {
    if (imageRetentionCount !== settings?.image_retention_count) {
      if (imageRetentionCount < 0 || imageRetentionCount > 10) {
        toast.error('保留数目必须介于 0 到 10 之间。')
        setImageRetentionCount(settings?.image_retention_count ?? 2)
        return
      }

      try {
        await updateSettings.mutateAsync({ image_retention_count: imageRetentionCount })
        toast.success('已成功更新镜像保留数目')
      } catch (error) {
        toast.error('无法更新镜像保留数目')
        setImageRetentionCount(settings?.image_retention_count ?? 2) // Rollback on error
      }
    }
  }

  const handleImagePruneGraceHoursBlur = async () => {
    if (imagePruneGraceHours !== settings?.image_prune_grace_hours) {
      if (imagePruneGraceHours < 1 || imagePruneGraceHours > 168) {
        toast.error('暂缓期必须介于 1 到 168 小时之间。')
        setImagePruneGraceHours(settings?.image_prune_grace_hours ?? 48)
        return
      }

      try {
        await updateSettings.mutateAsync({ image_prune_grace_hours: imagePruneGraceHours })
        toast.success('已成功更新暂缓期')
      } catch (error) {
        toast.error('无法更新暂缓期')
        setImagePruneGraceHours(settings?.image_prune_grace_hours ?? 48) // Rollback on error
      }
    }
  }

  const handlePruneNow = async () => {
    setIsPruningImages(true)
    try {
      const result = await apiClient.post<{ removed: number }>('/images/prune', {})

      if (result.removed > 0) {
        toast.success(`已成功修剪 ${result.removed} 个旧镜像/悬挂镜像`, {
          duration: 5000
        })
      } else {
        toast.info('没有镜像可被修剪 (全部镜像均符合保留策略)', {
          duration: 5000
        })
      }
    } catch (error) {
      toast.error(`修剪镜像时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsPruningImages(false)
    }
  }

  const handleViewCache = async () => {
    setIsCacheModalOpen(true)
    setIsLoadingCache(true)
    try {
      const data = await apiClient.get<ImageCacheResponse>('/updates/image-cache')
      setCacheData(data)
    } catch (error) {
      toast.error(`加载缓存时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoadingCache(false)
    }
  }

  const handleDeleteCacheEntry = async (cacheKey: string) => {
    try {
      await apiClient.delete(`/updates/image-cache/${encodeURIComponent(cacheKey)}`)
      toast.success('已成功删除缓存条目')
      // Refresh cache data
      const data = await apiClient.get<ImageCacheResponse>('/updates/image-cache')
      setCacheData(data)
    } catch (error) {
      toast.error(`删除缓存条目时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '已过期'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  const formatTTL = (seconds: number): string => {
    if (seconds < 3600) return `${seconds / 60}m`
    return `${seconds / 3600}h`
  }

  return (
    <fieldset disabled={!canManage} className="space-y-6 disabled:opacity-60">
      {/* Update Check Schedule */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">更新检查调度</h3>
          <p className="text-xs text-gray-400 mt-1">配置 DockMon 何时检查容器更新</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="update-check-time" className="block text-sm font-medium text-gray-300 mb-2">
              更新检查调度
            </label>
            <div className="flex gap-3">
              <input
                id="update-check-time"
                type="text"
                value={updateCheckTime}
                onChange={(e) => setUpdateCheckTime(e.target.value)}
                onBlur={handleUpdateCheckTimeBlur}
                placeholder="02:00 或者 0 4 * * 6"
                className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button
                onClick={handleCheckAllNow}
                disabled={isCheckingUpdates}
                variant="outline"
                className="whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                立即检查
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              计划更新检查的调度时间。如果需要每日定时检查，请使用 HH:MM (例如 02:00)，或者使用 cron 表达式设置更为灵活的时间安排
              (例如 <code className="bg-gray-700 px-1 rounded">0 4 * * 6</code> 代表在每周六的凌晨4点进行检查)。
            </p>
          </div>

          <div>
            <Button
              onClick={handleViewCache}
              variant="outline"
              className="w-full"
            >
              <Database className="h-4 w-4 mr-2" />
              查看注册表缓存
            </Button>
            <p className="mt-1 text-xs text-gray-400">
              查看已缓存的注册表查询内容。注册表缓存可以减少实际 API 的调用，从而避免触发速率限制。
            </p>
          </div>
        </div>
      </div>

      {/* Update Safety */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">安全设置</h3>
          <p className="text-xs text-gray-400 mt-1">配置容器更新时的安全设置</p>
        </div>
        <div className="space-y-4">
          <div className="divide-y divide-border">
            <ToggleSwitch
              id="skip-compose"
              label="跳过由 Docker Compose 创建的容器"
              description="自动跳过由 Docker Compose 创建和管理的容器的自动更新 (仍可以手动进行更新)"
              checked={skipComposeContainers}
              onChange={handleSkipComposeToggle}
              disabled={!canManage}
            />
          </div>

          <div>
            <label htmlFor="health-check-timeout" className="block text-sm font-medium text-gray-300 mb-2">
              健康检查超时时长 (秒)
            </label>
            <input
              id="health-check-timeout"
              type="number"
              min="10"
              max="600"
              value={healthCheckTimeout}
              onChange={(e) => setHealthCheckTimeout(Number(e.target.value))}
              onBlur={handleHealthCheckTimeoutBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              完成容器更新后等待健康检查完成的最长时间 (10-600 秒)
            </p>
          </div>
        </div>
      </div>

      {/* Image Cleanup */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">镜像清理</h3>
          <p className="text-xs text-gray-400 mt-1">自动删除未使用的 Docker 镜像以释放磁盘空间</p>
        </div>
        <div className="space-y-4">
          <div className="divide-y divide-border">
            <ToggleSwitch
              id="prune-images"
              label="自动修剪镜像"
              description="每天自动删除未使用的 Docker 镜像 (每个镜像将保留最近 N 个版本)"
              checked={pruneImagesEnabled}
              onChange={handlePruneImagesToggle}
              disabled={!canManage}
            />
          </div>

          {pruneImagesEnabled && (
            <>
              <div>
                <label htmlFor="image-retention-count" className="block text-sm font-medium text-gray-300 mb-2">
                  镜像保留数目
                </label>
                <input
                  id="image-retention-count"
                  type="number"
                  min="0"
                  max="10"
                  value={imageRetentionCount}
                  onChange={(e) => setImageRetentionCount(Number(e.target.value))}
                  onBlur={handleImageRetentionCountBlur}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  每个镜像将保留最近 N 个版本。其中 0 代表删除正在使用外的所有镜像，1-10 代表保留最近 N 个版本，超过暂缓期后将自动删除较旧的版本。
                </p>
              </div>

              <div>
                <label htmlFor="image-prune-grace-hours" className="block text-sm font-medium text-gray-300 mb-2">
                  暂缓期 (小时)
                </label>
                <input
                  id="image-prune-grace-hours"
                  type="number"
                  min="1"
                  max="168"
                  value={imagePruneGraceHours}
                  onChange={(e) => setImagePruneGraceHours(Number(e.target.value))}
                  onBlur={handleImagePruneGraceHoursBlur}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  不删除早于暂缓期的镜像 (1-168 小时)。用于在需要时提供回滚操作的空间。
                </p>
              </div>
            </>
          )}

          <div>
            <Button
              onClick={handlePruneNow}
              disabled={isPruningImages || !pruneImagesEnabled}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isPruningImages ? 'animate-spin' : ''}`} />
              立即修剪镜像
            </Button>
            <p className="mt-2 text-xs text-gray-400">
              手动触发镜像修剪操作。这将根据设置的保留策略删除未使用的镜像。
            </p>
          </div>
        </div>
      </div>

      {/* Update Validation Policies */}
      <div>
        <UpdatePoliciesSettings />
      </div>

      {/* Registry Credentials */}
      <div>
        <RegistryCredentialsSettings />
      </div>

      {/* Image Cache Modal */}
      <Dialog open={isCacheModalOpen} onOpenChange={setIsCacheModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>注册表缓存</DialogTitle>
            <DialogDescription>
              注册表缓存可以减少实际 API 的调用，从而避免触发速率限制。
            </DialogDescription>
          </DialogHeader>

          {isLoadingCache ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : cacheData ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                {cacheData.total_entries} 个条目已缓存
              </div>

              {cacheData.entries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  没有缓存的条目。请运行更新检查以生成注册表缓存。
                </div>
              ) : (
                <div className="space-y-3">
                  {cacheData.entries.map((entry) => (
                    <div
                      key={entry.cache_key}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-white truncate" title={entry.cache_key}>
                            {entry.cache_key}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            摘要: {entry.digest}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {entry.is_expired ? (
                            <XCircle className="h-4 w-4 text-red-400" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            存活时间: {formatTTL(entry.ttl_seconds)}
                          </div>
                          <div>
                            {entry.is_expired ? (
                              <span className="text-red-400">已过期</span>
                            ) : (
                              <span className="text-green-400">
                                过期时间: {formatTimeRemaining(entry.remaining_seconds)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCacheEntry(entry.cache_key)}
                          className="h-6 px-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400">
                  <strong>存活时间由标签决定:</strong> :latest 标签为 30 分钟，浮动标签 (1.25) 为 6 小时，固定标签 (1.25.3) 为 24 小时
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </fieldset>
  )
}
