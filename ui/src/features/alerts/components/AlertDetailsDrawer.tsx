/**
 * AlertDetailsDrawer Component
 *
 * Drawer showing full alert details with actions (resolve, snooze, annotate)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCircle2, Clock, MessageSquare, AlertCircle, Server, Container, Settings, MoreVertical, Activity, ChevronDown } from 'lucide-react'
import { useAlert, useAlertAnnotations, useResolveAlert, useSnoozeAlert, useUnsnoozeAlert, useAddAnnotation, useAlertEvents } from '../hooks/useAlerts'
import { useTimeFormat } from '@/lib/hooks/useUserPreferences'
import { formatDateTime as formatDateTimeUtil } from '@/lib/utils/timeFormat'
import type { AlertSeverity, AlertState } from '@/types/alerts'
import { useAuth } from '@/features/auth/AuthContext'

interface AlertDetailsDrawerProps {
  alertId: string
  onClose: () => void
}

const SNOOZE_DURATIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 240, label: '4 小时' },
  { value: 1440, label: '24 小时' },
]

export function AlertDetailsDrawer({ alertId, onClose }: AlertDetailsDrawerProps) {
  const navigate = useNavigate()
  const { hasCapability } = useAuth()
  const canManage = hasCapability('alerts.manage')
  const { timeFormat } = useTimeFormat()
  const { data: alert, isLoading } = useAlert(alertId)
  const { data: annotationsData } = useAlertAnnotations(alertId)
  const { data: eventsData } = useAlertEvents(alert)
  const resolveAlert = useResolveAlert()
  const snoozeAlert = useSnoozeAlert()
  const unsnoozeAlert = useUnsnoozeAlert()
  const addAnnotation = useAddAnnotation()

  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [showKebabMenu, setShowKebabMenu] = useState(false)
  const [annotationText, setAnnotationText] = useState('')
  const [showAnnotationForm, setShowAnnotationForm] = useState(false)
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)

  const annotations = annotationsData?.annotations ?? []
  const events = eventsData?.events ?? []

  const handleResolve = () => {
    if (!alert) return
    resolveAlert.mutate({ alertId: alert.id })
    setShowResolveConfirm(false)
    onClose()
  }

  const handleSnooze = (durationMinutes: number) => {
    if (!alert) return
    snoozeAlert.mutate({ alertId: alert.id, durationMinutes })
    setShowSnoozeMenu(false)
  }

  const handleUnsnooze = () => {
    if (!alert) return
    unsnoozeAlert.mutate(alert.id)
  }

  const handleAddAnnotation = () => {
    if (!alert || !annotationText.trim()) return
    addAnnotation.mutate({
      alertId: alert.id,
      text: annotationText.trim(),
    })
    setAnnotationText('')
    setShowAnnotationForm(false)
  }

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'error':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const getStateColor = (state: AlertState) => {
    switch (state) {
      case 'open':
        return 'text-red-600 bg-red-50'
      case 'snoozed':
        return 'text-blue-600 bg-blue-50'
      case 'resolved':
        return 'text-green-600 bg-green-50'
    }
  }

  const formatDateTime = (dateString: string) => {
    return formatDateTimeUtil(dateString, timeFormat)
  }

  const getEventSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-500'
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-500'
      case 'info':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const getEventCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'state_change':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'resource_alert':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'update_available':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'health_change':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  if (isLoading || !alert) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-[600px] bg-[#0d1117] shadow-2xl">
        <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-[600px] bg-[#0d1117] shadow-2xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">告警详情</h2>
            <div className="flex items-center gap-2">
              {/* Kebab Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowKebabMenu(!showKebabMenu)}
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {/* Kebab Dropdown */}
                {showKebabMenu && (
                  <>
                    <div className="fixed inset-0 z-[55]" onClick={() => setShowKebabMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-gray-800 shadow-xl border border-gray-700 py-1 z-[56]">
                      <button
                        onClick={() => {
                          setShowKebabMenu(false)
                          navigate(`/events?scope_id=${alert.scope_id}`)
                          onClose()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                      >
                        <Activity className="h-4 w-4" />
                        查看相关事件
                      </button>
                      {alert.rule_id && (
                        <button
                          onClick={() => {
                            setShowKebabMenu(false)
                            navigate(`/alerts/rules?ruleId=${alert.rule_id}`)
                            onClose()
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                        >
                          <Settings className="h-4 w-4" />
                          编辑告警规则
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Status Badges */}
            <div className="mb-4 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStateColor(alert.state)}`}>
                {{
                  open: "未解决",
                  snoozed: "稍后解决",
                  resolved: "已解决"
                }[alert.state]}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-sm font-medium ${getSeverityColor(alert.severity)}`}
              >
                {{
                  critical: "严重",
                  error: "错误",
                  warning: "警告",
                  info: "通知"
                }[alert.severity]}
              </span>
            </div>

            {/* Title & Message */}
            <h3 className="mb-3 text-xl font-semibold text-white">{alert.title}</h3>

            {/* Metadata Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* For host-scoped alerts, show host pill */}
              {alert.scope_type === 'host' && alert.host_name && (
                <button
                  onClick={() => {
                    // For host-scoped alerts, scope_id IS the host_id
                    navigate(`/hosts?hostId=${alert.scope_id}`)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  主机: {alert.host_name}
                </button>
              )}

              {/* For container-scoped alerts, show host pill (container always has a host) */}
              {alert.scope_type === 'container' && alert.host_name && alert.host_id && (
                <button
                  onClick={() => {
                    // For container-scoped alerts, navigate to host modal using host_id
                    navigate(`/hosts?hostId=${alert.host_id}`)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  主机: {alert.host_name}
                </button>
              )}

              {/* For container-scoped alerts, also show container pill */}
              {alert.scope_type === 'container' && alert.container_name && alert.scope_id && (
                <button
                  onClick={() => {
                    navigate(`/containers?containerId=${alert.scope_id}`)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Container className="h-3.5 w-3.5" />
                  容器: {alert.container_name}
                </button>
              )}

              {/* Rule pill */}
              {alert.rule_id && (
                <button
                  onClick={() => {
                    navigate(`/alerts/rules?ruleId=${alert.rule_id}`)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  告警规则: {{
                  cpu_high: 'CPU占用高',
                  memory_high: '内存占用高',
                  disk_low: '磁盘可用低',
                  container_unhealthy: '容器不健康(内置)',
                  health_check_failed: '容器不健康',
                  container_stopped: '容器已停止',
                  container_restart: '容器已重启',
                  host_down: '主机离线',
                  update_available: '更新可用',
                  update_completed: '更新完成',
                  update_failed: '更新失败',
                }[alert.kind]}
                </button>
              )}
            </div>

            <p className="mb-6 text-gray-300">{alert.message}</p>

            {/* Metadata Grid */}
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-900/50 p-4">
              <div>
                <div className="text-xs text-gray-500">首次告警</div>
                <div className="text-sm text-white">{formatDateTime(alert.first_seen)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">上次告警</div>
                <div className="text-sm text-white">{formatDateTime(alert.last_seen)}</div>
              </div>
              {alert.current_value != null && (
                <div>
                  <div className="text-xs text-gray-500">当前数值</div>
                  <div className="text-sm text-white">{alert.current_value.toFixed(2)}</div>
                </div>
              )}
              {alert.threshold != null && (
                <div>
                  <div className="text-xs text-gray-500">阈值</div>
                  <div className="text-sm text-white">{alert.threshold.toFixed(2)}</div>
                </div>
              )}
              {alert.snoozed_until && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">延迟至</div>
                  <div className="text-sm text-white">{formatDateTime(alert.snoozed_until)}</div>
                </div>
              )}
              {alert.resolved_at && (
                <>
                  <div>
                    <div className="text-xs text-gray-500">解决于</div>
                    <div className="text-sm text-white">{formatDateTime(alert.resolved_at)}</div>
                  </div>
                  {alert.resolved_reason && (
                    <div>
                      <div className="text-xs text-gray-500">原因</div>
                      <div className="text-sm text-white">{alert.resolved_reason}</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Events Section */}
            <div className="mb-6">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="h-4 w-4" />
                相关事件 ({events.length})
              </h4>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="rounded-lg bg-gray-900/30 px-4 py-3 text-center text-sm text-gray-500">
                    未找到相关事件
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg bg-gray-900/50 p-3 hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getEventCategoryColor(event.category)}`}
                          >
                            {{
                              "alert": "告警",
                              "host": "主机",
                              "container": "容器",
                              "system": "系统",
                              "notification": "通知",
                              "user": "用户",
                            }[event.category]}
                          </span>
                          <span className={`text-xs font-medium ${getEventSeverityColor(event.severity)}`}>
                            {{
                              "debug": "调试",
                              "info": "通知",
                              "warning": "警告",
                              "error": "错误",
                              "critical": "严重",
                            }[event.severity]}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDateTime(event.timestamp)}
                        </span>
                      </div>
                      <div className="mb-1 text-sm font-medium text-white">{event.title}</div>
                      {event.message && (
                        <p className="text-xs text-gray-400">{event.message}</p>
                      )}
                      {event.old_state && event.new_state && (
                        <div className="mt-2 text-xs text-gray-500">
                          状态: <span className="text-gray-400">{event.old_state}</span>
                          {' → '}
                          <span className="text-gray-300">{event.new_state}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Annotations Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquare className="h-4 w-4" />
                  注释 ({annotations.length})
                </h4>
                {alert.state !== 'resolved' && (
                  <fieldset disabled={!canManage} className="disabled:opacity-60">
                    <button
                      onClick={() => setShowAnnotationForm(!showAnnotationForm)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      添加注释
                    </button>
                  </fieldset>
                )}
              </div>

              {/* Add Annotation Form */}
              {showAnnotationForm && (
                <div className="mb-4 rounded-lg bg-gray-900/50 p-3">
                  <fieldset disabled={!canManage} className="disabled:opacity-60">
                    <textarea
                      value={annotationText}
                      onChange={(e) => setAnnotationText(e.target.value)}
                      placeholder="为此告警添加注释..."
                      className="mb-2 w-full rounded-md bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAnnotationForm(false)
                          setAnnotationText('')
                        }}
                        className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddAnnotation}
                        disabled={!annotationText.trim()}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        添加注释
                      </button>
                    </div>
                  </fieldset>
                </div>
              )}

              {/* Annotations List */}
              <div className="space-y-2">
                {annotations.length === 0 ? (
                  <div className="rounded-lg bg-gray-900/30 px-4 py-3 text-center text-sm text-gray-500">
                    尚未添加注释
                  </div>
                ) : (
                  annotations.map((annotation) => (
                    <div key={annotation.id} className="rounded-lg bg-gray-900/50 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {annotation.user || '未知用户'} • {formatDateTime(annotation.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{annotation.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          {alert.state !== 'resolved' && (
            <fieldset disabled={!canManage} className="disabled:opacity-60">
            <div className="border-t border-gray-800 px-6 py-4">
              <div className="flex gap-3">
                {alert.state === 'snoozed' ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="text-xs text-gray-400 text-center">
                      将于 {alert.snoozed_until ? formatDateTime(alert.snoozed_until) : '未知时间'} 后解冻
                    </div>
                    <button
                      onClick={handleUnsnooze}
                      className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                    >
                      <AlertCircle className="h-4 w-4" />
                      解冻
                    </button>
                  </div>
                ) : (
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                    >
                      <Clock className="h-4 w-4" />
                      <span>冻结</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {/* Snooze Duration Menu */}
                    {showSnoozeMenu && (
                      <>
                        <div className="fixed inset-0 z-[55]" onClick={() => setShowSnoozeMenu(false)} />
                        <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg bg-gray-800 shadow-xl border border-gray-700 z-[56]">
                          {SNOOZE_DURATIONS.map((duration) => (
                            <button
                              key={duration.value}
                              onClick={() => handleSnooze(duration.value)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {duration.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowResolveConfirm(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  已解决
                </button>
              </div>
            </div>
            </fieldset>
          )}
        </div>
      </div>

      {/* Resolve Confirmation Dialog */}
      {showResolveConfirm && alert && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-gray-700 rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 text-white">解决告警</h3>
                <p className="text-sm text-gray-400">
                  确定要将此告警标记为已解决吗？这将关闭{' '}
                  <span className="font-semibold text-white">{alert.title}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResolveConfirm(false)}
                disabled={resolveAlert.isPending}
                className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors text-sm text-gray-300 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={!canManage || resolveAlert.isPending}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors text-sm disabled:opacity-50"
              >
                {resolveAlert.isPending ? '标记中...' : '解决告警'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
