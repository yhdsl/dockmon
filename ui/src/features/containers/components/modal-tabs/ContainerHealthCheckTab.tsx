/**
 * Container Health Check Tab
 *
 * Shows HTTP/HTTPS health check configuration and status
 */

import { memo, useState, useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useTimeFormat } from '@/lib/hooks/useUserPreferences'
import { formatDateTime } from '@/lib/utils/timeFormat'
import { useContainerHealthCheck, useUpdateHealthCheck, useTestHealthCheck } from '../../hooks/useContainerHealthCheck'
import type { Container } from '../../types'

export interface ContainerHealthCheckTabProps {
  container: Container
}

function ContainerHealthCheckTabInternal({ container }: ContainerHealthCheckTabProps) {
  const { hasCapability } = useAuth()
  const canViewHC = hasCapability('healthchecks.view')
  const canManageHC = hasCapability('healthchecks.manage')
  const canTestHC = hasCapability('healthchecks.test')
  const { timeFormat } = useTimeFormat()

  // CRITICAL: Always use 12-char short ID for API calls (backend expects short IDs)
  const containerShortId = container.id.slice(0, 12)

  // Pass undefined when no view permission to prevent fetching
  const { data: healthCheck, isLoading } = useContainerHealthCheck(
    canViewHC ? container.host_id : undefined,
    canViewHC ? containerShortId : undefined
  )
  const updateHealthCheck = useUpdateHealthCheck()
  const testHealthCheck = useTestHealthCheck()

  // Local state for form
  const [enabled, setEnabled] = useState(false)
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [expectedStatusCodes, setExpectedStatusCodes] = useState('200')
  const [timeoutSeconds, setTimeoutSeconds] = useState(10)
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState(60)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [verifySsl, setVerifySsl] = useState(true)
  const [checkFrom, setCheckFrom] = useState<'backend' | 'agent'>('backend')  // v2.2.0+
  const [autoRestartOnFailure, setAutoRestartOnFailure] = useState(false)
  const [failureThreshold, setFailureThreshold] = useState(3)
  const [successThreshold, setSuccessThreshold] = useState(1)
  const [maxRestartAttempts, setMaxRestartAttempts] = useState(3)  // v2.0.2+
  const [restartRetryDelaySeconds, setRestartRetryDelaySeconds] = useState(120)  // v2.0.2+

  // Sync local state when server data changes
  useEffect(() => {
    if (healthCheck) {
      setEnabled(healthCheck.enabled)
      setUrl(healthCheck.url || '')
      setMethod(healthCheck.method || 'GET')
      setExpectedStatusCodes(healthCheck.expected_status_codes || '200')
      setTimeoutSeconds(healthCheck.timeout_seconds ?? 10)
      setCheckIntervalSeconds(healthCheck.check_interval_seconds ?? 60)
      setFollowRedirects(healthCheck.follow_redirects ?? true)
      setVerifySsl(healthCheck.verify_ssl ?? true)
      setCheckFrom(healthCheck.check_from ?? 'backend')  // v2.2.0+
      setAutoRestartOnFailure(healthCheck.auto_restart_on_failure ?? false)
      setFailureThreshold(healthCheck.failure_threshold ?? 3)
      setSuccessThreshold(healthCheck.success_threshold ?? 1)
      setMaxRestartAttempts(healthCheck.max_restart_attempts ?? 3)  // v2.0.2+
      setRestartRetryDelaySeconds(healthCheck.restart_retry_delay_seconds ?? 120)  // v2.0.2+
    }
  }, [healthCheck])

  if (!canViewHC) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You do not have permission to view health checks.
      </div>
    )
  }

  const handleTest = async () => {
    if (!container.host_id) {
      toast.error('无法测试健康检查', {
        description: '容器没有主机信息',
      })
      return
    }

    if (!url) {
      toast.error('URL 为必填项', {
        description: '请输入一个 URL 以供测试',
      })
      return
    }

    try {
      const result = await testHealthCheck.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        config: {
          url,
          method,
          expected_status_codes: expectedStatusCodes,
          timeout_seconds: timeoutSeconds,
          follow_redirects: followRedirects,
          verify_ssl: verifySsl,
        },
      })

      if (result.is_healthy) {
        toast.success('健康检查测试成功!', {
          description: `${result.message} (${result.response_time_ms}ms)`,
        })
      } else {
        toast.error('健康检查测试失败', {
          description: result.message,
        })
      }
    } catch (error) {
      toast.error('测试健康检查时失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const handleSave = async () => {
    if (!container.host_id) {
      toast.error('无法保存健康检查', {
        description: '容器没有主机信息',
      })
      return
    }

    if (enabled && !url) {
      toast.error('URL 为必填项', {
        description: '请输入一个 URL 以供测试',
      })
      return
    }

    try {
      await updateHealthCheck.mutateAsync({
        hostId: container.host_id,
        containerId: containerShortId,
        config: {
          // Only send configuration fields, not read-only state tracking fields
          enabled,
          url,
          method,
          expected_status_codes: expectedStatusCodes,
          timeout_seconds: timeoutSeconds,
          check_interval_seconds: checkIntervalSeconds,
          follow_redirects: followRedirects,
          verify_ssl: verifySsl,
          check_from: checkFrom,  // v2.2.0+
          auto_restart_on_failure: autoRestartOnFailure,
          failure_threshold: failureThreshold,
          success_threshold: successThreshold,
          max_restart_attempts: maxRestartAttempts,  // v2.0.2+
          restart_retry_delay_seconds: restartRetryDelaySeconds,  // v2.0.2+
        },
      })
      toast.success('健康检查配置已成功保存')
    } catch (error) {
      toast.error('保存健康检查配置时失败', {
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

  // Check if health check record exists in database
  // Backend returns null for consecutive_failures when no record exists
  const healthCheckExists = healthCheck && healthCheck.consecutive_failures !== null

  const currentStatus = healthCheck?.current_status || 'unknown'
  const lastChecked = healthCheck?.last_checked_at
    ? formatDateTime(healthCheck.last_checked_at, timeFormat)
    : '从未'

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'healthy':
        return <CheckCircle2 className="h-8 w-8 text-success" />
      case 'unhealthy':
        return <XCircle className="h-8 w-8 text-danger" />
      default:
        return <Activity className="h-8 w-8 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (currentStatus) {
      case 'healthy':
        return { title: '健康', description: '容器健康检查响应正常' }
      case 'unhealthy':
        return { title: '不健康', description: healthCheck?.last_error_message || '健康检查失败' }
      default:
        return { title: '未知', description: enabled ? '等待第一次健康检查' : '未启用健康检查' }
    }
  }

  const status = getStatusText()

  return (
    <div className="p-6 space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className={`text-lg font-semibold ${
              currentStatus === 'healthy' ? 'text-success' :
              currentStatus === 'unhealthy' ? 'text-danger' :
              'text-foreground'
            }`}>
              {status.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {status.description}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <fieldset disabled={!canTestHC} className="disabled:opacity-60">
            <Button
              onClick={handleTest}
              disabled={testHealthCheck.isPending || !url || !healthCheckExists}
              variant="outline"
              title={!healthCheckExists ? '首先保存健康检查配置以供测试' : ''}
            >
              {testHealthCheck.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  立即检查
                </>
              )}
            </Button>
          </fieldset>

          <fieldset disabled={!canManageHC} className="disabled:opacity-60">
            <Button
              onClick={handleSave}
              disabled={updateHealthCheck.isPending}
              variant="default"
            >
              {updateHealthCheck.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存更改'
              )}
            </Button>
          </fieldset>
        </div>
      </div>

      {/* Current Status Details (if enabled and has data) */}
      {enabled && healthCheck?.last_checked_at && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">上次检查时间</span>
            </div>
            <p className="text-sm font-medium">{lastChecked}</p>
          </div>

          {healthCheck.last_response_time_ms !== null && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium">响应时长</span>
              </div>
              <p className="text-sm font-medium">{healthCheck.last_response_time_ms}ms</p>
            </div>
          )}

          {healthCheck.consecutive_failures !== null && healthCheck.consecutive_failures > 0 && (
            <div className="bg-danger/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-danger mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium">连续失败次数</span>
              </div>
              <p className="text-sm font-medium text-danger">
                {healthCheck.consecutive_failures} / {healthCheck.failure_threshold}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Configuration Form */}
      <fieldset disabled={!canManageHC} className="space-y-4 border-t pt-6 disabled:opacity-60">
        <h4 className="text-lg font-medium text-foreground mb-3">配置</h4>

        {/* Enable/Disable toggle */}
        <div className="flex items-start justify-between py-4">
          <div className="flex-1 mr-4">
            <label htmlFor="health-check-enabled" className="text-sm font-medium cursor-pointer">
              启用健康检查
            </label>
            <p className="text-sm text-muted-foreground mt-1">
              使用 HTTP/HTTPS 健康检查监控此容器
            </p>
          </div>
          <Switch
            id="health-check-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* URL */}
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium">
            URL <span className="text-danger">*</span>
          </label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8080/health"
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            完整的用于检查的 URL (例如 http://localhost:8080/health)
          </p>
        </div>

        {/* Method and Expected Status Codes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="method" className="text-sm font-medium">
              HTTP 方法
            </label>
            <Select
              value={method}
              onValueChange={setMethod}
              disabled={!enabled}
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="HEAD">HEAD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="status-codes" className="text-sm font-medium">
              预期状态码
            </label>
            <Input
              id="status-codes"
              value={expectedStatusCodes}
              onChange={(e) => setExpectedStatusCodes(e.target.value)}
              placeholder="200"
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              例如 "200"、"200-299" 或者 "200,201,204"
            </p>
          </div>
        </div>

        {/* Timeout and Interval */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="timeout" className="text-sm font-medium">
              超时时长 (秒)
            </label>
            <Input
              id="timeout"
              type="number"
              min="5"
              max="60"
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              disabled={!enabled}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="interval" className="text-sm font-medium">
              检查间隔 (秒)
            </label>
            <Input
              id="interval"
              type="number"
              min="10"
              max="3600"
              value={checkIntervalSeconds}
              onChange={(e) => setCheckIntervalSeconds(Number(e.target.value))}
              disabled={!enabled}
            />
          </div>
        </div>

        {/* Failure and Success Thresholds */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="failure-threshold" className="text-sm font-medium">
              失败次数阈值
            </label>
            <Input
              id="failure-threshold"
              type="number"
              min="1"
              max="10"
              value={failureThreshold}
              onChange={(e) => setFailureThreshold(Number(e.target.value))}
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              标记为不健康前的连续失败次数
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="success-threshold" className="text-sm font-medium">
              成功次数阈值
            </label>
            <Input
              id="success-threshold"
              type="number"
              min="1"
              max="10"
              value={successThreshold}
              onChange={(e) => setSuccessThreshold(Number(e.target.value))}
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              在失败后重新标记为健康所需的连续成功次数
            </p>
          </div>
        </div>

        {/* SSL and Redirects */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start justify-between py-2">
            <div className="flex-1 mr-4">
              <label htmlFor="verify-ssl" className="text-sm font-medium cursor-pointer">
                验证 SSL
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                验证 SSL 证书
              </p>
            </div>
            <Switch
              id="verify-ssl"
              checked={verifySsl}
              onCheckedChange={setVerifySsl}
              disabled={!enabled}
            />
          </div>

          <div className="flex items-start justify-between py-2">
            <div className="flex-1 mr-4">
              <label htmlFor="follow-redirects" className="text-sm font-medium cursor-pointer">
                跟随重定向
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                跟随 HTTP 重定向请求
              </p>
            </div>
            <Switch
              id="follow-redirects"
              checked={followRedirects}
              onCheckedChange={setFollowRedirects}
              disabled={!enabled}
            />
          </div>
        </div>

        {/* Check Location (v2.2.0+) */}
        <div className="space-y-2">
          <label htmlFor="check-from" className="text-sm font-medium">
            健康检查请求源
          </label>
          <Select
            value={checkFrom}
            onValueChange={(value) => setCheckFrom(value as 'backend' | 'agent')}
            disabled={!enabled}
          >
            <SelectTrigger id="check-from">
              <SelectValue>
                {checkFrom === 'backend' ? 'DockMon 后端' : '远程代理'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backend">DockMon 后端</SelectItem>
              <SelectItem value="agent">远程代理</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {checkFrom === 'backend'
              ? '健康检查由 DockMon 后端服务器执行'
              : '健康检查由远程主机上的代理执行 (当 DockMon 后端无法访问此容器时)'}
          </p>
        </div>

        {/* Auto-restart section */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-start justify-between py-2">
            <div className="flex-1 mr-4">
              <label htmlFor="auto-restart" className="text-sm font-medium cursor-pointer">
                失败时自动重启
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                当达到失败次数阈值时自动重启容器
              </p>
            </div>
            <Switch
              id="auto-restart"
              checked={autoRestartOnFailure}
              onCheckedChange={setAutoRestartOnFailure}
              disabled={!enabled}
            />
          </div>

          {/* Retry configuration (v2.0.2+) - only show when auto-restart is enabled */}
          {autoRestartOnFailure && (
            <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
              <div className="space-y-2">
                <label htmlFor="max-restart-attempts" className="text-sm font-medium">
                  最大重启尝试次数
                </label>
                <Input
                  id="max-restart-attempts"
                  type="number"
                  min="1"
                  max="10"
                  value={maxRestartAttempts}
                  onChange={(e) => setMaxRestartAttempts(Number(e.target.value))}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  每次不健康状态下的重启最大尝试次数 (容器恢复健康后重置)
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="restart-retry-delay" className="text-sm font-medium">
                  重试延迟 (秒)
                </label>
                <Input
                  id="restart-retry-delay"
                  type="number"
                  min="30"
                  max="600"
                  value={restartRetryDelaySeconds}
                  onChange={(e) => setRestartRetryDelaySeconds(Number(e.target.value))}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  重复尝试重启之间的延迟间隔。注意: 10 分钟的安全窗口内最多允许 12 次重启 (较长的延迟时长可能会限制重启的尝试次数)
                </p>
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {/* Help text */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium">关于 HTTP 健康检查</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>健康检查会定期向一个 URL 发送请求，以验证容器是否正常响应</li>
          <li>只有连续失败的次数达到阈值后才会标记容器为不健康</li>
          <li>自动重启设置可用在健康检查失败时自动重启容器</li>
          <li>如果已设置对应的告警规则，将在健康状态发生变化时触发告警</li>
          <li>为了获得最佳性能，请使用内部的 URL (localhost/容器网络)</li>
        </ul>
      </div>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export const ContainerHealthCheckTab = memo(ContainerHealthCheckTabInternal, (prevProps, nextProps) => {
  const areEqual = (
    prevProps.container.id === nextProps.container.id &&
    prevProps.container.host_id === nextProps.container.host_id
  )
  return areEqual
})
