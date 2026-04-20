/**
 * Alert & Notification Settings Component
 * Customize alert message templates
 */

import { useState, useEffect } from 'react'
import { useGlobalSettings, useUpdateGlobalSettings, useTemplateVariables } from '@/hooks/useSettings'
import { toast } from 'sonner'
import { RotateCcw, Copy, Check } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

const DEFAULT_TEMPLATE = `**{SEVERITY} 告警: {KIND}**

**{SCOPE_TYPE}:** \`{CONTAINER_NAME}\`
**主机:** {HOST_NAME}
**当前数值:** {CURRENT_VALUE} (threshold: {THRESHOLD})
**时间:** {TIMESTAMP}
**告警规则:** {RULE_NAME}
───────────────────────`

export function AlertNotificationSettings() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('alerts.manage')
  const { data: settings } = useGlobalSettings()
  const { data: variables } = useTemplateVariables()
  const updateSettings = useUpdateGlobalSettings()

  const [template, setTemplate] = useState(settings?.alert_template || DEFAULT_TEMPLATE)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Update local state when settings load
  useEffect(() => {
    if (settings?.alert_template) {
      setTemplate(settings.alert_template)
    }
  }, [settings])

  const handleTemplateChange = (value: string) => {
    setTemplate(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ alert_template: template })
      setHasChanges(false)
      toast.success('已成功保存告警消息模板')
    } catch (error) {
      toast.error('无法保存告警消息模板')
    }
  }

  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE)
    setHasChanges(true)
    toast.info('消息模板已重置为默认 (请点击保存按钮确认更改)')
  }

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable)
    setCopiedVar(variable)
    setTimeout(() => setCopiedVar(null), 2000)
    toast.success('已复制变量至剪切板')
  }

  return (
    <fieldset disabled={!canManage} className="space-y-6 disabled:opacity-60">
      {/* Alert Message Template Section */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">告警消息模板</h2>
          <p className="text-sm text-muted-foreground mt-1">
            自定义所有告警通知的消息模板。可使用变量插入动态文本内容。
          </p>
        </div>

        <div className="space-y-4">
          {/* Template Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">消息模板</label>
            <textarea
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="请输入自定义的告警模板..."
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
              {updateSettings.isPending ? '保存中...' : '保存模板'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
            >
              <RotateCcw className="h-4 w-4" />
              重置为默认
            </button>
          </div>
        </div>
      </div>

      {/* Available Variables Section */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">可用变量</h2>
          <p className="text-sm text-muted-foreground mt-1">
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
