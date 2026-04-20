/**
 * Update Policies Settings Component
 *
 * Manages global update validation policies:
 * - View all validation patterns grouped by category
 * - Toggle entire categories on/off
 * - Add/remove custom patterns
 * - Expandable pattern lists
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Database,
  Network,
  Activity,
  Shield,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useUpdatePolicies,
  useTogglePolicyCategory,
  useCreateCustomPattern,
  useDeleteCustomPattern,
  useUpdatePolicyAction
} from '@/features/containers/hooks/useUpdatePolicies'
import type { UpdatePolicyCategory, UpdatePolicyAction } from '@/features/containers/types/updatePolicy'
import { ACTION_OPTIONS } from '@/features/containers/types/updatePolicy'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'

/**
 * Category metadata for display
 */
const CATEGORY_CONFIG: Record<
  Exclude<UpdatePolicyCategory, 'custom'>,
  {
    label: string
    description: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    color: string
  }
> = {
  databases: {
    label: '数据库',
    description: '数据库容器 (postgres, mysql, mongodb 等)',
    icon: Database,
    color: 'text-blue-400'
  },
  proxies: {
    label: '代理',
    description: '反向代理和流量入口容器 (traefik, nginx, caddy)',
    icon: Network,
    color: 'text-purple-400'
  },
  monitoring: {
    label: '监控',
    description: '监控或指标监视容器 (grafana, prometheus)',
    icon: Activity,
    color: 'text-green-400'
  },
  critical: {
    label: '关键设施',
    description: '关键的基础设施容器 (portainer, dockmon)',
    icon: Shield,
    color: 'text-red-400'
  }
}

export function UpdatePoliciesSettings() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('policies.manage')
  const { data: policies, isLoading, isError } = useUpdatePolicies()
  const toggleCategory = useTogglePolicyCategory()
  const createPattern = useCreateCustomPattern()
  const deletePattern = useDeleteCustomPattern()
  const updateAction = useUpdatePolicyAction()

  const [expandedCategories, setExpandedCategories] = useState<Set<UpdatePolicyCategory>>(new Set())
  const [customPatternInput, setCustomPatternInput] = useState('')
  const [newPatternAction, setNewPatternAction] = useState<UpdatePolicyAction>('warn')

  /**
   * Toggle category expansion
   */
  const toggleExpanded = (category: UpdatePolicyCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  /**
   * Handle category toggle switch
   */
  const handleToggleCategory = async (category: UpdatePolicyCategory, enabled: boolean) => {
    try {
      await toggleCategory.mutateAsync({ category, enabled })
      toast.success(`模式 '${CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.label || category}' ${enabled ? '已启用' : '已禁用'}`)
    } catch (error) {
      toast.error('无法更新指定类别', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  /**
   * Handle add custom pattern
   */
  const handleAddCustomPattern = async () => {
    const pattern = customPatternInput.trim()
    if (!pattern) {
      toast.error('请输入一个模式名')
      return
    }

    try {
      await createPattern.mutateAsync({ pattern, action: newPatternAction })
      toast.success(`已成功添加自定义模式 '${pattern}' 并指定操作为 '${{warn: "警告", ignore: "忽略"}[newPatternAction]}'`)
      setCustomPatternInput('')
      setNewPatternAction('warn') // Reset to default
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        toast.error(`模式 '${pattern}' 已存在`)
      } else {
        toast.error('无法添加自定义模式', {
          description: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  }

  /**
   * Handle update policy action
   */
  const handleUpdateAction = async (policyId: number, pattern: string, action: UpdatePolicyAction) => {
    try {
      await updateAction.mutateAsync({ policyId, action })
      toast.success(`模式 '${pattern}' 操作已更新为 '${{warn: "警告", ignore: "忽略"}[action]}'`)
    } catch (error) {
      toast.error('无法更新模式操作', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  /**
   * Handle delete custom pattern
   */
  const handleDeleteCustomPattern = async (policyId: number, pattern: string) => {
    try {
      await deletePattern.mutateAsync({ policyId })
      toast.success(`已成功删除自定义模式 '${pattern}'`)
    } catch (error) {
      toast.error('无法删除自定义模式', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  /**
   * Check if all patterns in category are enabled
   */
  const isCategoryEnabled = (category: UpdatePolicyCategory): boolean => {
    const categoryPolicies = policies?.categories[category] || []
    if (categoryPolicies.length === 0) return false
    return categoryPolicies.every((p) => p.enabled)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <p className="text-sm text-destructive">无法加载更新策略，请稍后重试。</p>
      </div>
    )
  }

  return (
    <fieldset disabled={!canManage} className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary">更新验证策略</h3>
        <p className="text-sm text-text-secondary mt-1">
          配置容器更新时的自动验证策略。
          匹配的容器在更新前将需要进行确认。
        </p>
      </div>

      {/* Built-in Categories */}
      <div className="space-y-3">
        {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((category) => {
          const config = CATEGORY_CONFIG[category]
          const categoryPolicies = policies?.categories[category] || []
          const isExpanded = expandedCategories.has(category)
          const isEnabled = isCategoryEnabled(category)
          const Icon = config.icon

          return (
            <div key={category} className="bg-surface-2 rounded-lg border border-border overflow-hidden">
              {/* Category Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleExpanded(category)}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${config.label}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <div className={config.color}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-text-primary">{config.label}</h4>
                      <span className="text-xs text-text-tertiary">
                        ({categoryPolicies.length} 个模式)
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{config.description}</p>
                  </div>
                </div>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggleCategory(category, checked)}
                  disabled={toggleCategory.isPending || categoryPolicies.length === 0}
                  aria-label={`Toggle ${config.label} category`}
                />
              </div>

              {/* Expanded Pattern List */}
              {isExpanded && categoryPolicies.length > 0 && (
                <div className="px-4 pb-4 border-t border-border bg-surface-3">
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {categoryPolicies.map((policy) => (
                      <div
                        key={policy.id}
                        className={`text-xs px-2 py-1 rounded font-mono ${
                          policy.enabled
                            ? 'bg-surface-1 text-text-primary border border-border'
                            : 'bg-surface-2 text-text-tertiary border border-border/50'
                        }`}
                      >
                        {policy.pattern}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Custom Patterns Section */}
      <div className="bg-surface-2 rounded-lg border border-border p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-gray-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-text-primary">自定义模式</h4>
            <p className="text-xs text-text-secondary mt-0.5">
              添加自定义的模式，用于匹配容器或镜像名称
            </p>
          </div>
        </div>

        {/* Add Custom Pattern Input */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Label htmlFor="custom-pattern" className="sr-only">
              自定义模式
            </Label>
            <Input
              id="custom-pattern"
              placeholder="请输入模式名 (例如 myapp)"
              value={customPatternInput}
              onChange={(e) => setCustomPatternInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCustomPattern()
                }
              }}
              disabled={createPattern.isPending}
              className="h-9"
            />
          </div>
          <Select
            value={newPatternAction}
            onValueChange={(value) => setNewPatternAction(value as UpdatePolicyAction)}
            disabled={createPattern.isPending}
          >
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue>
                {ACTION_OPTIONS.find((o) => o.value === newPatternAction)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddCustomPattern}
            disabled={createPattern.isPending || !customPatternInput.trim()}
            size="sm"
            className="h-9"
          >
            {createPattern.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '添加'
            )}
          </Button>
        </div>

        {/* Custom Patterns List */}
        {policies?.categories.custom && policies.categories.custom.length > 0 ? (
          <div className="space-y-2">
            {policies.categories.custom.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between bg-surface-3 rounded px-3 py-2 border border-border gap-2"
              >
                <span className="text-sm font-mono text-text-primary flex-1">{policy.pattern}</span>
                <Select
                  value={policy.action}
                  onValueChange={(value) => handleUpdateAction(policy.id, policy.pattern, value as UpdatePolicyAction)}
                  disabled={updateAction.isPending}
                >
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue>
                      {ACTION_OPTIONS.find((o) => o.value === policy.action)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => handleDeleteCustomPattern(policy.id, policy.pattern)}
                  disabled={deletePattern.isPending}
                  className="text-text-tertiary hover:text-destructive transition-colors disabled:opacity-50"
                  aria-label={`Delete pattern ${policy.pattern}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary italic">尚未添加任何策略</p>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <p className="text-xs text-info/90">
          <strong>工作指南:</strong> 这些模式将用于匹配容器或镜像的名称。
          <br /><br />
          <strong>警告操作:</strong> 匹配的容器在自动更新前需要用户确认。
          <br />
          <strong>忽略操作:</strong> 匹配的容器将完全不会被自动更新，但仍可以在容器的 "更新" 页面手动检查和更新。
        </p>
      </div>
    </fieldset>
  )
}
