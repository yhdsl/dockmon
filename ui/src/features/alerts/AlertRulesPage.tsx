/**
 * AlertRulesPage Component
 *
 * Manage alert rules with CRUD operations
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAlertRules, useDeleteAlertRule, useToggleAlertRule } from './hooks/useAlertRules'
import type { AlertRule } from '@/types/alerts'
import { Plus, Settings, Trash2, Power, PowerOff, Edit, AlertTriangle } from 'lucide-react'
import { AlertRuleFormModal } from './components/AlertRuleFormModal'
import { useAuth } from '@/features/auth/AuthContext'

export function AlertRulesPage() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('alerts.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: rulesData, isLoading } = useAlertRules()
  const deleteRule = useDeleteAlertRule()
  const toggleRule = useToggleAlertRule()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  const rules = rulesData?.rules ?? []

  // Handle URL param for opening specific rule for editing
  useEffect(() => {
    const ruleId = searchParams.get('ruleId')
    if (ruleId && rules.length > 0) {
      const rule = rules.find(r => r.id === ruleId)
      if (rule) {
        setEditingRule(rule)
        // Clear the URL param after opening
        searchParams.delete('ruleId')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [searchParams, rules, setSearchParams])

  const handleToggleEnabled = async (rule: AlertRule) => {
    await toggleRule.mutateAsync({ ruleId: rule.id, enabled: !rule.enabled })
  }

  const handleDelete = async () => {
    if (!deletingRuleId) return
    await deleteRule.mutateAsync(deletingRuleId)
    setDeletingRuleId(null)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'error':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'host':
        return 'bg-purple-100 text-purple-700'
      case 'container':
        return 'bg-blue-100 text-blue-700'
      case 'group':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#0d1117] px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">告警规则</h1>
          <p className="text-sm text-gray-400">创建基于监控指标和逻辑条件触发的告警规则</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!canManage}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          创建告警规则
        </button>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-400">加载告警规则中...</div>
        ) : rules.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <Settings className="mb-2 h-12 w-12" />
            <p className="text-lg">尚未设置任何告警规则</p>
            <p className="text-sm">创建你的第一个告警规则以开始监控</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-lg border bg-[#0d1117] p-4 transition-opacity ${
                    rule.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    {/* Rule Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getSeverityColor(rule.severity)}`}>
                          {{'info': '通知','warning': '警告','error': '错误','critical': '严重',}[rule.severity]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScopeColor(rule.scope)}`}>
                          {{'host': '主机','container': '容器',}[rule.scope]}
                        </span>
                        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300">
                            {{
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
                            }[rule.kind]}
                        </span>
                        {!rule.enabled && (
                          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-400">
                            已禁用
                          </span>
                        )}
                      </div>

                      {rule.description && <p className="text-sm text-gray-400 mb-3">{rule.description}</p>}

                      {/* Rule Details */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        {rule.metric && rule.threshold && (
                          <span>
                            监控指标: {{'cpu_percent': ' CPU 占用率','memory_percent': '内存占用率','disk_percent': '磁盘占用率',}[rule.metric]} {rule.operator} {rule.threshold}%
                          </span>
                        )}
                        {rule.alert_active_delay_seconds > 0 && (
                          <span>
                            告警触发延迟: {rule.alert_active_delay_seconds}s
                          </span>
                        )}
                        {rule.occurrences && <span>触发次数: {rule.occurrences}</span>}
                        {rule.notification_cooldown_seconds > 0 && <span>通知冷却时长: {rule.notification_cooldown_seconds}s</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <fieldset disabled={!canManage} className="disabled:opacity-60 ml-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleEnabled(rule)}
                          className={`rounded-md p-2 transition-colors ${
                            rule.enabled
                              ? 'text-green-500 hover:bg-gray-800'
                              : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                          }`}
                          title={rule.enabled ? '禁用告警规则' : '启用告警规则'}
                        >
                          {rule.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                        </button>

                        <button
                          onClick={() => setEditingRule(rule)}
                          className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                          title="编辑告警规则"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setDeletingRuleId(rule.id)}
                          className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-red-400"
                          title="删除告警规则"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </fieldset>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRule) && (
        <AlertRuleFormModal
          rule={editingRule}
          onClose={() => {
            setShowCreateModal(false)
            setEditingRule(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingRuleId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#0d1117] p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-white">删除告警规则</h3>
                <p className="text-sm text-gray-400">
                  确定要删除此告警规则吗？该操作无法撤销。但由该告警规则创建的告警数据将会被保留。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingRuleId(null)}
                className="rounded-md bg-gray-800 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={!canManage || deleteRule.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteRule.isPending ? '删除中...' : '删除告警规则'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
