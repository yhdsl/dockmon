/**
 * Dashboard Settings Component
 * Controls for dashboard appearance and performance
 */

import { useUserPreferences, useUpdatePreferences, useTimeFormat, useSimplifiedWorkflow } from '@/lib/hooks/useUserPreferences'
import { useGlobalSettings, useUpdateGlobalSettings } from '@/hooks/useSettings'
import { ToggleSwitch } from './ToggleSwitch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const EDITOR_THEMES = [
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'vscode-dark', label: 'VS Code Dark' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'material-dark', label: 'Material Dark' },
  { value: 'nord', label: 'Nord' },
  { value: 'atomone', label: 'Atom One Dark' },
  { value: 'aura', label: 'Aura' },
  { value: 'andromeda', label: 'Andromeda' },
  { value: 'copilot', label: 'Copilot' },
  { value: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
  { value: 'sublime', label: 'Sublime' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'tokyo-night-storm', label: 'Tokyo Night Storm' },
  { value: 'okaidia', label: 'Okaidia' },
  { value: 'abyss', label: 'Abyss' },
  { value: 'kimbie', label: 'Kimbie' },
] as const

export function DashboardSettings() {
  const { data: prefs } = useUserPreferences()
  const updatePreferences = useUpdatePreferences()
  const { enabled: simplifiedWorkflow, setEnabled: setSimplifiedWorkflow } = useSimplifiedWorkflow()
  const { timeFormat, setTimeFormat } = useTimeFormat()
  const { data: globalSettings } = useGlobalSettings()
  const updateGlobalSettings = useUpdateGlobalSettings()

  const editorTheme = globalSettings?.editor_theme ?? 'aura'
  const showKpiBar = prefs?.dashboard?.showKpiBar ?? true
  const showStatsWidgets = prefs?.dashboard?.showStatsWidgets ?? false
  const optimizedLoading = prefs?.dashboard?.optimizedLoading ?? true
  const showContainerStats = prefs?.dashboard?.showContainerStats ?? false

  const handleToggleKpiBar = (checked: boolean) => {
    updatePreferences.mutate({
      dashboard: {
        ...prefs?.dashboard,
        showKpiBar: checked
      }
    })
    toast.success(checked ? '摘要栏已启用' : '摘要栏已禁用')
  }

  const handleToggleStatsWidgets = (checked: boolean) => {
    updatePreferences.mutate({
      dashboard: {
        ...prefs?.dashboard,
        showStatsWidgets: checked
      }
    })
    toast.success(checked ? '状态小部件已启用' : '状态小部件已禁用')
  }

  const handleToggleOptimizedLoading = (checked: boolean) => {
    updatePreferences.mutate({
      dashboard: {
        ...prefs?.dashboard,
        optimizedLoading: checked
      }
    })
    toast.success(checked ? '加载优化已启用' : '加载优化已禁用')
  }

  const handleToggleContainerStats = (checked: boolean) => {
    updatePreferences.mutate({
      dashboard: {
        ...prefs?.dashboard,
        showContainerStats: checked
      }
    })
    toast.success(checked ? '容器统计信息已启用' : '容器统计信息已禁用')
  }

  const handleToggleSimplifiedWorkflow = (checked: boolean) => {
    setSimplifiedWorkflow(checked)
    toast.success(checked ? '工作流简化已启用 - 已跳过抽屉视图' : '工作流简化已禁用 - 已显示抽屉视图')
  }

  const handleEditorThemeChange = async (theme: string) => {
    try {
      await updateGlobalSettings.mutateAsync({ editor_theme: theme })
      toast.success(`已更新编辑器主题为 ${EDITOR_THEMES.find(t => t.value === theme)?.label}`)
    } catch {
      toast.error('无法更新编辑器主题')
    }
  }

  const handleTimeFormatChange = (format: '12h' | '24h') => {
    setTimeFormat(format)
    toast.success(`时间格式已更新为 ${format === '12h' ? '12 小时制' : '24 小时制'}`)
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">仪表盘摘要</h3>
          <p className="text-xs text-gray-400 mt-1">
            控制在仪表盘中显示的部件
          </p>
        </div>
        <div className="divide-y divide-border">
          <ToggleSwitch
            id="show-kpi-bar"
            label="显示摘要栏"
            description="在仪表板的顶部显示摘要栏，以展示主机状态、容器状态以及系统健康状态"
            checked={showKpiBar}
            onChange={handleToggleKpiBar}
          />
          <ToggleSwitch
            id="show-stats-widgets"
            label="显示状态小部件"
            description="在仪表板中显示包含详细统计信息的小部件"
            checked={showStatsWidgets}
            onChange={handleToggleStatsWidgets}
          />
          <ToggleSwitch
            id="show-container-stats"
            label="显示每个容器的 CPU/RAM 统计信息"
            description="在展开视图中为每个正在运行的容器展示 CPU 和内存的使用状态"
            checked={showContainerStats}
            onChange={handleToggleContainerStats}
          />
        </div>
      </div>

      {/* Display */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">显示</h3>
          <p className="text-xs text-gray-400 mt-1">
            自定义如何显示信息数据
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="time-format" className="block text-sm font-medium text-gray-300 mb-2">
              时间格式
            </label>
            <Select value={timeFormat} onValueChange={(v) => handleTimeFormatChange(v as '12h' | '24h')}>
              <SelectTrigger id="time-format" className="w-full max-w-xs">
                <SelectValue>
                  {timeFormat === '12h' ? '12 小时制 (1:30 PM)' : '24 小时制 (13:30)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12 小时制 (1:30 PM)</SelectItem>
                <SelectItem value="24h">24 小时制 (13:30)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-gray-400">
              选择应用中时间的显示格式
            </p>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">工作流</h3>
          <p className="text-xs text-gray-400 mt-1">
            自定义主机与容器的交互方式
          </p>
        </div>
        <div className="divide-y divide-border">
          <ToggleSwitch
            id="simplified-workflow"
            label="工作流简化"
            description="跳过抽屉视图，在点击主机或容器时直接打开详细信息页面。适合立即希望查阅全部信息的用户。"
            checked={simplifiedWorkflow}
            onChange={handleToggleSimplifiedWorkflow}
          />
        </div>
      </div>

      {/* Performance */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">性能</h3>
          <p className="text-xs text-gray-400 mt-1">
            优化仪表板性能以提升电池续航和响应速度
          </p>
        </div>
        <div className="divide-y divide-border">
          <ToggleSwitch
            id="optimized-loading"
            label="仪表盘加载优化"
            description="对于不在视图中的主机卡片暂停其统计数据折线图的更新。在大型仪表板 (50+ 主机) 中可有效节省 CPU 占用和电量消耗。禁用后将持续更新所有主机的折线图。"
            checked={optimizedLoading}
            onChange={handleToggleOptimizedLoading}
          />
        </div>
      </div>

      {/* Editor */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">编辑器</h3>
          <p className="text-xs text-gray-400 mt-1">
            自定义代码编辑器的外观主题，包含堆栈页面和容器配置页面。
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="editor-theme" className="block text-sm font-medium text-gray-300 mb-2">
              编辑器主题
            </label>
            <Select value={editorTheme} onValueChange={handleEditorThemeChange}>
              <SelectTrigger id="editor-theme" className="w-full">
                <SelectValue>
                  {EDITOR_THEMES.find(t => t.value === editorTheme)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEMES.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-gray-400">
              堆栈部署中 YAML 和 JSON 编辑器的主题配色。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
