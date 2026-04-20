/**
 * Alert Template Settings Component
 * Customize alert message templates with category-specific options
 */

import { useState, useEffect } from 'react'
import { useGlobalSettings, useUpdateGlobalSettings, useTemplateVariables } from '@/hooks/useSettings'
import { toast } from 'sonner'
import { RotateCcw, Copy, Check } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

type TemplateType = 'default' | 'metric' | 'state_change' | 'health' | 'update'

export function AlertTemplateSettings() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('alerts.manage')
  const { data: settings } = useGlobalSettings()
  const { data: variables } = useTemplateVariables()
  const updateSettings = useUpdateGlobalSettings()

  const [activeTab, setActiveTab] = useState<TemplateType>('default')
  const [templates, setTemplates] = useState<Record<TemplateType, string>>({
    default: '',
    metric: '',
    state_change: '',
    health: '',
    update: '',
  })
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load templates from settings OR backend defaults
  useEffect(() => {
    if (settings && variables?.default_templates) {
      setTemplates({
        default: settings.alert_template || variables.default_templates.default,
        metric: settings.alert_template_metric || variables.default_templates.metric,
        state_change: settings.alert_template_state_change || variables.default_templates.state_change,
        health: settings.alert_template_health || variables.default_templates.health,
        update: settings.alert_template_update || variables.default_templates.update,
      })
    }
  }, [settings, variables])

  const handleTemplateChange = (type: TemplateType, value: string) => {
    setTemplates(prev => ({ ...prev, [type]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        alert_template: templates.default,
        alert_template_metric: templates.metric,
        alert_template_state_change: templates.state_change,
        alert_template_health: templates.health,
        alert_template_update: templates.update,
      })
      setHasChanges(false)
      toast.success('已成功保存告警消息模板')
    } catch (error) {
      toast.error('无法保存告警消息模板')
    }
  }

  const handleReset = (type: TemplateType) => {
    if (variables?.default_templates) {
      setTemplates(prev => ({ ...prev, [type]: variables.default_templates[type] }))
      setHasChanges(true)
      toast.info(`${{
        'default': "默认",
        'metric': "指标告警",
        'state_change': "状态更改",
        'health': "健康检查",
        'update': "更新"
      }[type]}模板已重置为默认 (请点击保存按钮确认更改)`)
    }
  }

  const handleResetAll = () => {
    if (variables?.default_templates) {
      setTemplates(variables.default_templates)
      setHasChanges(true)
      toast.info('全部消息模板已重置为默认 (请点击保存按钮确认更改)')
    }
  }

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable)
    setCopiedVar(variable)
    setTimeout(() => setCopiedVar(null), 2000)
    toast.success('已复制变量至剪切板')
  }

  const tabs = [
    { id: 'default' as TemplateType, label: '默认', description: '所有告警类型的备用消息模板' },
    { id: 'metric' as TemplateType, label: '指标告警', description: 'CPU、内存，以及磁盘使用率' },
    { id: 'state_change' as TemplateType, label: '状态更改', description: '已停止、已死亡，或者已重启' },
    { id: 'health' as TemplateType, label: '健康检查', description: '不健康的检查状态' },
    { id: 'update' as TemplateType, label: '容器更新', description: '有新更新可用' },
  ]

  return (
    <fieldset disabled={!canManage} className="space-y-6 disabled:opacity-60">
      {/* Template Category Tabs */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">模板类型</h3>
          <p className="text-xs text-gray-400 mt-1">
            为不同类型的告警自定义相互独立的消息模板。未设置自定义消息模板的告警类型将使用默认的文本内容。
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <div className="text-left">
                <div>{tab.label}</div>
                <div className="text-xs opacity-75">{tab.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Template Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            {tabs.find(t => t.id === activeTab)?.label}模板
          </label>
          <button
            onClick={() => handleReset(activeTab)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            重置此模板
          </button>
        </div>
        <textarea
          value={templates[activeTab]}
          onChange={(e) => handleTemplateChange(activeTab, e.target.value)}
          rows={12}
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="请输入自定义的消息通知模板..."
        />
        <p className="mt-2 text-xs text-gray-400">
          支持 Markdown 格式。可使用例如 {'{CONTAINER_NAME}'} 这样的变量插入动态文本内容。
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {updateSettings.isPending ? '保存中...' : '保存全部模板'}
        </button>
        <button
          onClick={handleResetAll}
          className="flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
        >
          <RotateCcw className="h-4 w-4" />
          全部重置为默认
        </button>
      </div>

      {/* Available Variables */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">可用变量</h3>
          <p className="text-xs text-gray-400 mt-1">
            点击以复制变量至剪切板
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {variables?.variables.map((info) => (
            <button
              key={info.name}
              onClick={() => handleCopyVariable(info.name)}
              className="flex items-start gap-3 p-3 rounded-md bg-gray-800/50 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors text-left"
            >
              <div className="flex-shrink-0 mt-0.5">
                {copiedVar === info.name ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono text-blue-400 break-all">{info.name}</code>
                <p className="text-xs text-gray-400 mt-1">{info.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
