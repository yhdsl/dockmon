/**
 * System Settings Component
 * Polling, retries, timeouts, and connection settings
 */

import { useState, useEffect } from 'react'
import { useGlobalSettings, useUpdateGlobalSettings } from '@/hooks/useSettings'
import { toast } from 'sonner'
import { ToggleSwitch } from './ToggleSwitch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'

const SESSION_TIMEOUT_OPTIONS = [
  { value: '24', label: '24 小时' },
  { value: '168', label: '7 天' },
  { value: '720', label: '30 天' },
  { value: '2160', label: '3 个月' },
  { value: '4320', label: '6 个月' },
  { value: '8760', label: '12 个月' },
  { value: '0', label: '永久' },
]

export function SystemSettings() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('settings.manage')
  const { data: settings } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()

  const [pollingInterval, setPollingInterval] = useState(settings?.polling_interval ?? 2)
  const [connectionTimeout, setConnectionTimeout] = useState(settings?.connection_timeout ?? 10)
  const [maxRetries, setMaxRetries] = useState(settings?.max_retries ?? 3)
  const [retryDelay, setRetryDelay] = useState(settings?.retry_delay ?? 30)
  const [defaultAutoRestart, setDefaultAutoRestart] = useState(settings?.default_auto_restart ?? false)
  const [unusedTagRetentionDays, setUnusedTagRetentionDays] = useState(settings?.unused_tag_retention_days ?? 30)
  const [eventRetentionDays, setEventRetentionDays] = useState(settings?.event_retention_days ?? 60)
  const [alertRetentionDays, setAlertRetentionDays] = useState(settings?.alert_retention_days ?? 90)
  const [externalUrl, setExternalUrl] = useState(settings?.external_url ?? '')
  const [statsPersistenceEnabled, setStatsPersistenceEnabled] = useState(settings?.stats_persistence_enabled ?? false)
  const [statsRetentionDays, setStatsRetentionDays] = useState(settings?.stats_retention_days ?? 30)
  const [statsPointsPerView, setStatsPointsPerView] = useState(settings?.stats_points_per_view ?? 500)

  // Sync state when settings load from API
  useEffect(() => {
    if (settings) {
      setPollingInterval(settings.polling_interval ?? 2)
      setConnectionTimeout(settings.connection_timeout ?? 10)
      setMaxRetries(settings.max_retries ?? 3)
      setRetryDelay(settings.retry_delay ?? 30)
      setDefaultAutoRestart(settings.default_auto_restart ?? false)
      setUnusedTagRetentionDays(settings.unused_tag_retention_days ?? 30)
      setEventRetentionDays(settings.event_retention_days ?? 60)
      setAlertRetentionDays(settings.alert_retention_days ?? 90)
      setExternalUrl(settings.external_url ?? '')
      setStatsPersistenceEnabled(settings.stats_persistence_enabled ?? false)
      setStatsRetentionDays(settings.stats_retention_days ?? 30)
      setStatsPointsPerView(settings.stats_points_per_view ?? 500)
    }
  }, [settings])

  // Auto-save handlers for number inputs (save on blur)
  const handlePollingIntervalBlur = async () => {
    if (pollingInterval !== settings?.polling_interval) {
      try {
        await updateSettings.mutateAsync({ polling_interval: pollingInterval })
        toast.success('已成功更新轮询间隔')
      } catch (error) {
        toast.error('无法更新轮询间隔')
      }
    }
  }

  const handleConnectionTimeoutBlur = async () => {
    if (connectionTimeout !== settings?.connection_timeout) {
      try {
        await updateSettings.mutateAsync({ connection_timeout: connectionTimeout })
        toast.success('已成功更新连接超时时长')
      } catch (error) {
        toast.error('无法更新连接超时时长')
      }
    }
  }

  const handleMaxRetriesBlur = async () => {
    if (maxRetries !== settings?.max_retries) {
      try {
        await updateSettings.mutateAsync({ max_retries: maxRetries })
        toast.success('已成功更新最大重试次数')
      } catch (error) {
        toast.error('无法更新最大重试次数')
      }
    }
  }

  const handleRetryDelayBlur = async () => {
    if (retryDelay !== settings?.retry_delay) {
      try {
        await updateSettings.mutateAsync({ retry_delay: retryDelay })
        toast.success('已成功更新重试间隔')
      } catch (error) {
        toast.error('无法更新重试间隔')
      }
    }
  }

  const handleUnusedTagRetentionBlur = async () => {
    if (unusedTagRetentionDays !== settings?.unused_tag_retention_days) {
      try {
        await updateSettings.mutateAsync({ unused_tag_retention_days: unusedTagRetentionDays })
        toast.success('已成功更新标签保留时长')
      } catch (error) {
        toast.error('无法更新标签保留时长')
      }
    }
  }

  const handleEventRetentionBlur = async () => {
    if (eventRetentionDays !== settings?.event_retention_days) {
      try {
        await updateSettings.mutateAsync({ event_retention_days: eventRetentionDays })
        toast.success('已成功更新事件保留时长')
      } catch (error) {
        toast.error('无法更新事件保留时长')
      }
    }
  }

  const handleAlertRetentionBlur = async () => {
    if (alertRetentionDays !== settings?.alert_retention_days) {
      try {
        await updateSettings.mutateAsync({ alert_retention_days: alertRetentionDays })
        toast.success('已成功更新告警保留时长')
      } catch (error) {
        toast.error('无法更新告警保留时长')
      }
    }
  }

  // Auto-save handler for toggle
  const handleDefaultAutoRestartToggle = async (checked: boolean) => {
    setDefaultAutoRestart(checked)
    try {
      await updateSettings.mutateAsync({ default_auto_restart: checked })
      toast.success(checked ? '默认自动重启已启用' : '默认自动重启已禁用')
    } catch (error) {
      toast.error('无法更新默认自动重启设置')
      setDefaultAutoRestart(!checked) // Revert on error
    }
  }

  const handleStatsPersistenceToggle = async (checked: boolean) => {
    setStatsPersistenceEnabled(checked)
    try {
      await updateSettings.mutateAsync({ stats_persistence_enabled: checked })
      toast.success(checked ? 'Stats persistence enabled' : 'Stats persistence disabled')
    } catch (error) {
      toast.error('Failed to update stats persistence')
      setStatsPersistenceEnabled(!checked)
    }
  }

  const handleStatsRetentionBlur = async () => {
    if (statsRetentionDays !== settings?.stats_retention_days) {
      try {
        await updateSettings.mutateAsync({ stats_retention_days: statsRetentionDays })
        toast.success('Stats retention updated')
      } catch (error) {
        toast.error('Failed to update stats retention')
      }
    }
  }

  const handleStatsPointsPerViewBlur = async () => {
    if (statsPointsPerView !== settings?.stats_points_per_view) {
      try {
        await updateSettings.mutateAsync({ stats_points_per_view: statsPointsPerView })
        toast.success('Chart resolution updated — restart to apply')
      } catch (error) {
        toast.error('Failed to update chart resolution')
      }
    }
  }

  const handleExternalUrlBlur = async () => {
    // Normalize: trim and remove trailing slash
    const normalizedUrl = externalUrl.trim().replace(/\/+$/, '')
    if (normalizedUrl !== (settings?.external_url ?? '')) {
      try {
        // Save empty string as null to clear the override
        await updateSettings.mutateAsync({ external_url: normalizedUrl || null })
        setExternalUrl(normalizedUrl)
        toast.success('已成功更新外部 URL')
      } catch (error) {
        toast.error('无法更新外部 URL')
      }
    }
  }

  return (
    <fieldset disabled={!canManage} className="space-y-6 disabled:opacity-60">
      {/* External Access */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">外部访问</h3>
          <p className="text-xs text-gray-400 mt-1">配置如何从外部网络访问 DockMon</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="external-url" className="block text-sm font-medium text-gray-300 mb-2">
              外部 URL
            </label>
            <input
              id="external-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              onBlur={handleExternalUrlBlur}
              placeholder={settings?.external_url_from_env || 'https://dockmon.example.com'}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              从外部访问 DockMon 的链接 (例如 https://dockmon.example.com)。用于配置通知中的快速操作链接。
              {settings?.external_url_from_env && (
                <span className="block mt-1 text-gray-500">
                  默认环境变量: {settings.external_url_from_env}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">系统安全</h3>
          <p className="text-xs text-gray-400 mt-1">身份验证与会话设置</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="session-timeout" className="block text-sm font-medium text-gray-300 mb-2">
              会话有效期
            </label>
            <Select
              value={String(settings?.session_timeout_hours ?? 24)}
              onValueChange={async (v) => {
                const value = Number(v)
                try {
                  await updateSettings.mutateAsync({ session_timeout_hours: value })
                  toast.success('已成功更新会话有效期')
                } catch (error) {
                  toast.error('无法更新会话有效期')
                }
              }}
            >
              <SelectTrigger id="session-timeout" className="w-full max-w-xs">
                <SelectValue>
                  {SESSION_TIMEOUT_OPTIONS.find(o => o.value === String(settings?.session_timeout_hours ?? 24))?.label ?? '24 小时'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SESSION_TIMEOUT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-gray-400">
              保持登录会话有效状态的时间长度。更改后将立即对所有的会话生效。
            </p>
          </div>
        </div>
      </div>

      {/* Monitoring */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">状态检测</h3>
          <p className="text-xs text-gray-400 mt-1">配置 DockMon 检测 Docker 主机的频率</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="polling-interval" className="block text-sm font-medium text-gray-300 mb-2">
              轮询间隔 (秒)
            </label>
            <input
              id="polling-interval"
              type="number"
              min="1"
              max="600"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              onBlur={handlePollingIntervalBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">检测 Docker 主机的间隔时长 (1-600 秒)</p>
          </div>
        </div>
      </div>

      {/* Connection */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">主机连接</h3>
          <p className="text-xs text-gray-400 mt-1">连接超时与重试设置</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="connection-timeout" className="block text-sm font-medium text-gray-300 mb-2">
              连接超时时长 (秒)
            </label>
            <input
              id="connection-timeout"
              type="number"
              min="5"
              max="120"
              value={connectionTimeout}
              onChange={(e) => setConnectionTimeout(Number(e.target.value))}
              onBlur={handleConnectionTimeoutBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">连接至 Docker API 的超时时长 (5-120 秒)</p>
          </div>

          <div>
            <label htmlFor="max-retries" className="block text-sm font-medium text-gray-300 mb-2">
              最大重试次数
            </label>
            <input
              id="max-retries"
              type="number"
              min="0"
              max="10"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              onBlur={handleMaxRetriesBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">连接超时后的最多重试次数 (0-10)</p>
          </div>

          <div>
            <label htmlFor="retry-delay" className="block text-sm font-medium text-gray-300 mb-2">
              重试间隔 (秒)
            </label>
            <input
              id="retry-delay"
              type="number"
              min="5"
              max="300"
              value={retryDelay}
              onChange={(e) => setRetryDelay(Number(e.target.value))}
              onBlur={handleRetryDelayBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">重试行为的间隔时长 (5-300 秒)</p>
          </div>
        </div>
      </div>

      {/* Container Behavior */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">容器行为</h3>
          <p className="text-xs text-gray-400 mt-1">容器的默认操作行为</p>
        </div>
        <div className="divide-y divide-border">
          <ToggleSwitch
            id="default-auto-restart"
            label="默认自动重启容器"
            description="当容器意外退出时自动重启 (可单独对容器进行配置)"
            checked={defaultAutoRestart}
            onChange={handleDefaultAutoRestartToggle}
            disabled={!canManage}
          />
        </div>
      </div>

      {/* Data Retention */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">数据保留</h3>
          <p className="text-xs text-gray-400 mt-1">配置 DockMon 历史数据的保留时长</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="event-retention" className="block text-sm font-medium text-gray-300 mb-2">
              事件保留时长 (天)
            </label>
            <input
              id="event-retention"
              type="number"
              min="0"
              max="365"
              value={eventRetentionDays}
              onChange={(e) => setEventRetentionDays(Number(e.target.value))}
              onBlur={handleEventRetentionBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              事件日志与历史记录的保留时长。超过此时长的事件将在每晚维护时自动删除。设置为 0 表示永久保留事件。 (0-365 天)
            </p>
          </div>

          <div>
            <label htmlFor="unused-tag-retention" className="block text-sm font-medium text-gray-300 mb-2">
              未使用标签保留时长 (天)
            </label>
            <input
              id="unused-tag-retention"
              type="number"
              min="0"
              max="365"
              value={unusedTagRetentionDays}
              onChange={(e) => setUnusedTagRetentionDays(Number(e.target.value))}
              onBlur={handleUnusedTagRetentionBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              自动删除在指定天数内未分配给任何容器或主机的标签。设置为 0 表示永久保留未使用的标签。 (0-365 天)
            </p>
          </div>

          <div>
            <label htmlFor="alert-retention" className="block text-sm font-medium text-gray-300 mb-2">
              告警保留时长 (天)
            </label>
            <input
              id="alert-retention"
              type="number"
              min="0"
              max="730"
              value={alertRetentionDays}
              onChange={(e) => setAlertRetentionDays(Number(e.target.value))}
              onBlur={handleAlertRetentionBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              已解决告警的保留时长。超过此时长的已解决告警将在每晚维护时自动删除。设置为 0 表示永久保留已解决告警。 (0-730 天)
            </p>
          </div>
        </div>
      </div>

      {/* Stats History */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Stats History</h3>
          <p className="text-xs text-gray-400 mt-1">
            Persisted CPU, memory, and network history for the long-range chart views (1h / 8h / 24h / 7d / 30d).
            Live charts work without this; persistence is only required for views that look back further than the live window.
          </p>
        </div>
        <div className="space-y-4">
          <ToggleSwitch
            id="stats-persistence-enabled"
            label="Persist stats to disk"
            description="Off by default. Turn on to start recording samples for the historical chart views."
            checked={statsPersistenceEnabled}
            onChange={handleStatsPersistenceToggle}
            disabled={!canManage}
          />

          <div>
            <label htmlFor="stats-retention-days" className="block text-sm font-medium text-gray-300 mb-2">
              Retention (days)
            </label>
            <input
              id="stats-retention-days"
              type="number"
              min="1"
              max="30"
              value={statsRetentionDays}
              onChange={(e) => setStatsRetentionDays(Number(e.target.value))}
              onBlur={handleStatsRetentionBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              How long to keep persisted stats. Older buckets are dropped during the periodic retention pass. (1-30 days)
            </p>
          </div>

          <div>
            <label htmlFor="stats-points-per-view" className="block text-sm font-medium text-gray-300 mb-2">
              Chart resolution (points per view)
            </label>
            <input
              id="stats-points-per-view"
              type="number"
              min="100"
              max="2000"
              value={statsPointsPerView}
              onChange={(e) => setStatsPointsPerView(Number(e.target.value))}
              onBlur={handleStatsPointsPerViewBlur}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Number of data points per chart view. Higher = smoother charts, more disk and memory.{' '}
              <strong>Requires a restart to take effect.</strong> (100-2000)
            </p>
          </div>
        </div>
      </div>
    </fieldset>
  )
}
